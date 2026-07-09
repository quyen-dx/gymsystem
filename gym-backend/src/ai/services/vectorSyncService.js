import VectorDocument from '../../models/VectorDocument.js'
import Faq from '../../models/Faq.js'
import Policy from '../../models/Policy.js'
import {
  SOURCES, embedText, computeHash, chunkText, insertChunks,
  deleteBySourceId, getCollectionStats, indexAll, incrementalIndex,
} from './vectorStoreService.js'
import { logLatency } from './aiLogService.js'

/* ============================================================
   Document-to-item transformers
   Mirror the shape returned by SOURCES[source].fetch()
   ============================================================ */

function faqToItem(doc) {
  return {
    id: String(doc._id),
    title: doc.questionVi || doc.questionEn || '',
    contentVi: `Hỏi: ${doc.questionVi}\nTrả lời: ${doc.answerVi}`,
    contentEn: `Q: ${doc.questionEn}\nA: ${doc.answerEn}`,
    language: 'both',
    metadata: { categoryVi: doc.categoryVi, categoryEn: doc.categoryEn },
  }
}

function policyToItem(doc) {
  const id = doc.slug || String(doc._id)
  return {
    id,
    title: doc.titleVi || doc.titleEn || '',
    contentVi: `${doc.titleVi}\n\n${doc.contentVi}`,
    contentEn: `${doc.titleEn}\n\n${doc.contentEn}`,
    language: 'both',
    metadata: { slug: doc.slug, categoryVi: doc.categoryVi, categoryEn: doc.categoryEn, type: doc.type },
  }
}

/* ============================================================
   Core: chunk + embed + insert a single item
   ============================================================ */

async function indexItem(source, item) {
  const text = item.contentVi || item.content
  if (!text || !text.trim()) return 0

  const baseMeta = {
    sourceId: item.id || '',
    title: item.title || '',
    language: item.language || 'vi',
    metadata: item.metadata || {},
  }

  const viChunks = chunkText(text, baseMeta)
  const allChunks = [...viChunks]

  if (item.language === 'both' && item.contentEn && item.contentEn !== text) {
    const enMeta = { ...baseMeta, language: 'en' }
    allChunks.push(...chunkText(item.contentEn, enMeta))
  }

  if (allChunks.length === 0) return 0
  return insertChunks(source, allChunks)
}

/* ============================================================
   Per-document sync (for faq / policy)
   Called from Mongoose hooks
   ============================================================ */

export async function syncOnSave(source, doc) {
  const start = Date.now()

  let item
  if (source === 'faq') item = faqToItem(doc)
  else if (source === 'policy') item = policyToItem(doc)
  else return

  if (doc.isPublished === false) {
    const deleted = await deleteBySourceId(source, item.id)
    logLatency('vectorSync', Date.now() - start, {
      action: 'delete_unpublished',
      source,
      sourceId: item.id,
      chunksDeleted: deleted,
    })
    return
  }

  await deleteBySourceId(source, item.id)
  const inserted = await indexItem(source, item)

  logLatency('vectorSync', Date.now() - start, {
    action: doc.isNew ? 'create' : 'update',
    source,
    sourceId: item.id,
    chunksInserted: inserted,
  })
}

export async function syncOnFindOneAndUpdate(source, doc) {
  if (!doc) return
  const start = Date.now()

  let item
  if (source === 'faq') item = faqToItem(doc)
  else if (source === 'policy') item = policyToItem(doc)
  else return

  if (doc.isPublished === false) {
    const deleted = await deleteBySourceId(source, item.id)
    logLatency('vectorSync', Date.now() - start, {
      action: 'delete_unpublished',
      source,
      sourceId: item.id,
      chunksDeleted: deleted,
    })
    return
  }

  await deleteBySourceId(source, item.id)
  const inserted = await indexItem(source, item)

  logLatency('vectorSync', Date.now() - start, {
    action: 'update',
    source,
    sourceId: item.id,
    chunksInserted: inserted,
  })
}

export async function syncOnDelete(source, sourceId) {
  const start = Date.now()
  const deleted = await deleteBySourceId(source, sourceId)

  logLatency('vectorSync', Date.now() - start, {
    action: 'delete',
    source,
    sourceId,
    chunksDeleted: deleted,
  })
}

/* ============================================================
   Exercise source sync (aggregation-based)
   Called when any Workout doc is created / updated / deleted
   ============================================================ */

export async function syncExerciseSource() {
  const start = Date.now()

  const result = await incrementalIndex('exercise')

  const fetcher = SOURCES.exercise
  const items = await fetcher.fetch()
  const currentIds = new Set(items.map((i) => i.id))

  const orphanResult = await VectorDocument.deleteMany({
    source: 'exercise',
    sourceId: { $nin: [...currentIds] },
  })

  logLatency('vectorSync', Date.now() - start, {
    action: 'syncExercise',
    indexed: result.indexed,
    orphansDeleted: orphanResult.deletedCount || 0,
  })
}

/* ============================================================
   Orphan / missing cleanup for model-backed sources
   ============================================================ */

async function cleanOrphansForSource(source) {
  let publishedIds
  if (source === 'faq') {
    publishedIds = (await Faq.find({ isPublished: true }).distinct('_id').lean()).map((id) => String(id))
  } else if (source === 'policy') {
    const policies = await Policy.find({ isPublished: true }).lean()
    const ids = new Set()
    policies.forEach((p) => {
      ids.add(String(p._id))
      if (p.slug) ids.add(p.slug)
    })
    publishedIds = [...ids]
  } else {
    return 0
  }

  const orphanResult = await VectorDocument.deleteMany({
    source,
    sourceId: { $nin: publishedIds },
  })
  return orphanResult.deletedCount || 0
}

/* ============================================================
   Startup sync
   Called once when the server boots
   ============================================================ */

export async function startupSync() {
  const stats = await getCollectionStats()

  if (stats.total === 0) {
    console.log('[VECTOR_SYNC] Collection empty – building all source vectors...')
    return indexAll()
  }

  console.log(`[VECTOR_SYNC] ${stats.total} vectors found – running safety sync...`)
  const results = []

  for (const source of ['faq', 'policy']) {
    try {
      const r = await incrementalIndex(source)
      const orphans = await cleanOrphansForSource(source)
      results.push({ source, ...r, orphansCleaned: orphans })
      console.log(`[VECTOR_SYNC] ${source}: ${r.indexed} indexed, ${orphans} orphans cleaned`)
    } catch (err) {
      console.warn(`[VECTOR_SYNC] ${source} sync failed:`, err.message)
      results.push({ source, error: err.message })
    }
  }

  try {
    await syncExerciseSource()
    results.push({ source: 'exercise', synced: true })
    console.log('[VECTOR_SYNC] exercise sync completed')
  } catch (err) {
    console.warn('[VECTOR_SYNC] exercise sync failed:', err.message)
    results.push({ source: 'exercise', error: err.message })
  }

  return results
}
