import { GoogleGenAI } from '@google/genai'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import VectorDocument from '../../models/VectorDocument.js'
import Faq from '../../models/Faq.js'
import Policy from '../../models/Policy.js'
import Workout from '../../models/Workout.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '../../../..')
const README_PATH = path.join(PROJECT_ROOT, 'README.md')
const KNOWLEDGE_DOCS_DIR = path.resolve(__dirname, '../docs')

const EMBEDDING_MODEL = 'text-embedding-004'
const EMBEDDING_DIMENSIONS = 768
const BATCH_SIZE = 100
const CHUNK_MIN_CHARS = 200
const CHUNK_MAX_CHARS = 1500
const VECTOR_SEARCH_INDEX = 'vector_index'

let _embeddingClient = null

const getEmbeddingClient = () => {
  if (!_embeddingClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required for vector embeddings')
    }
    _embeddingClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return _embeddingClient
}

export const embedText = async (text) => {
  const client = getEmbeddingClient()
  const result = await client.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
  })
  return result.embedding?.values || []
}

const embedTexts = async (texts) => {
  const client = getEmbeddingClient()
  const allEmbeddings = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const result = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: batch,
    })
    const embeddings = (result.embeddings || []).map((e) => e.values || [])
    allEmbeddings.push(...embeddings)
  }
  return allEmbeddings
}

export const computeHash = (text) => crypto.createHash('md5').update(text).digest('hex')

export const chunkText = (text, meta = {}) => {
  if (!text || text.trim().length === 0) return []
  const normalized = text.trim()

  if (normalized.length <= CHUNK_MAX_CHARS) {
    return [{ ...meta, content: normalized, chunkIndex: 0, contentHash: computeHash(normalized) }]
  }

  const chunks = []
  let chunkIndex = 0
  const sections = normalized.split(/(?=^#{1,3}\s)/m)

  for (const section of sections) {
    if (!section.trim()) continue

    if (section.length <= CHUNK_MAX_CHARS) {
      chunks.push({ ...meta, content: section.trim(), chunkIndex: chunkIndex++, contentHash: computeHash(section.trim()) })
      continue
    }

    const paragraphs = section.split(/\n\s*\n/).filter((p) => p.trim())
    let current = ''

    for (const para of paragraphs) {
      const trimmed = para.trim()
      if (!trimmed) continue

      if (current.length + trimmed.length > CHUNK_MAX_CHARS && current.length >= CHUNK_MIN_CHARS) {
        chunks.push({ ...meta, content: current.trim(), chunkIndex: chunkIndex++, contentHash: computeHash(current.trim()) })
        current = ''
      }

      current += (current ? '\n\n' : '') + trimmed
    }

    if (current.trim()) {
      chunks.push({ ...meta, content: current.trim(), chunkIndex: chunkIndex++, contentHash: computeHash(current.trim()) })
    }
  }

  return chunks
}

export const SOURCES = {
  faq: {
    label: 'FAQ',
    fetch: async () => {
      const items = await Faq.find({ isPublished: true }).sort({ order: 1 }).lean()
      return items.map((item) => ({
        id: String(item._id),
        title: item.questionVi || item.questionEn || '',
        contentVi: `Hỏi: ${item.questionVi}\nTrả lời: ${item.answerVi}`,
        contentEn: `Q: ${item.questionEn}\nA: ${item.answerEn}`,
        language: 'both',
        metadata: { categoryVi: item.categoryVi, categoryEn: item.categoryEn },
      }))
    },
  },
  policy: {
    label: 'Policy',
    fetch: async () => {
      const items = await Policy.find({ isPublished: true }).sort({ createdAt: -1 }).lean()
      return items.map((item) => ({
        id: `${item.slug || String(item._id)}`,
        title: item.titleVi || item.titleEn || '',
        contentVi: `${item.titleVi}\n\n${item.contentVi}`,
        contentEn: `${item.titleEn}\n\n${item.contentEn}`,
        language: 'both',
        metadata: { slug: item.slug, categoryVi: item.categoryVi, categoryEn: item.categoryEn, type: item.type },
      }))
    },
  },
  readme: {
    label: 'README',
    fetch: async () => {
      try {
        const content = fs.readFileSync(README_PATH, 'utf8')
        if (!content.trim()) return []
        return [{
          id: 'readme',
          title: 'README - Hướng dẫn Git',
          contentVi: content,
          contentEn: content,
          language: 'vi',
          metadata: {},
        }]
      } catch {
        return []
      }
    },
  },
  exercise: {
    label: 'Exercise',
    fetch: async () => {
      const results = await Workout.aggregate([
        { $unwind: '$weeks' },
        { $unwind: '$weeks.sessions' },
        { $unwind: '$weeks.sessions.exercises' },
        {
          $group: {
            _id: { name: '$weeks.sessions.exercises.name', technique: '$weeks.sessions.exercises.techniqueNote' },
            count: { $sum: 1 },
          },
        },
        { $match: { '_id.name': { $ne: '' } } },
        { $sort: { count: -1 } },
      ])

      return results.map((r) => {
        const name = r._id.name
        const technique = r._id.technique || ''
        const content = technique ? `${name}: ${technique}` : name
        return {
          id: name.toLowerCase().replace(/\s+/g, '-'),
          title: name,
          contentVi: content,
          contentEn: content,
          language: 'vi',
          metadata: { exerciseCount: r.count, techniqueNote: technique },
        }
      })
    },
  },
  nutrition: {
    label: 'Nutrition',
    fetch: async () => {
      return []
    },
  },
  knowledge: {
    label: 'Knowledge',
    fetch: async () => {
      const docs = []
      try {
        const files = fs.readdirSync(KNOWLEDGE_DOCS_DIR).filter((f) => f.endsWith('.md'))
        for (const file of files) {
          const filePath = path.join(KNOWLEDGE_DOCS_DIR, file)
          const content = fs.readFileSync(filePath, 'utf8')
          if (!content.trim()) continue
          docs.push({
            id: file.replace(/\.md$/i, ''),
            title: file.replace(/\.md$/i, '').replace(/_/g, ' '),
            contentVi: content,
            contentEn: content,
            language: 'vi',
            metadata: { fileName: file },
          })
        }
      } catch {
      }
      return docs
    },
  },
  module_readme: {
    label: 'Module README',
    fetch: async () => {
      const MODULES_PATH = path.resolve(__dirname, '../../modules')
      const docs = []
      let dirs
      try {
        dirs = fs.readdirSync(MODULES_PATH, { withFileTypes: true })
      } catch {
        return docs
      }
      for (const entry of dirs) {
        if (!entry.isDirectory()) continue
        const readmePath = path.join(MODULES_PATH, entry.name, 'README.md')
        if (!fs.existsSync(readmePath)) continue
        try {
          const content = fs.readFileSync(readmePath, 'utf8')
          if (!content.trim()) continue
          docs.push({
            id: `${entry.name}/README.md`,
            title: `Module: ${entry.name}`,
            contentVi: content,
            contentEn: content,
            language: 'vi',
            metadata: { moduleName: entry.name, fileName: 'README.md' },
          })
        } catch {
        }
      }
      return docs
    },
  },
}

const deleteBySource = async (source) => {
  const result = await VectorDocument.deleteMany({ source })
  return result.deletedCount || 0
}

export const insertChunks = async (source, chunks) => {
  if (chunks.length === 0) return 0

  const texts = chunks.map((c) => c.content)
  const embeddings = await embedTexts(texts)

  const docs = chunks.map((chunk, i) => ({
    source,
    sourceId: chunk.sourceId || '',
    title: chunk.title || '',
    content: chunk.content,
    language: chunk.language || 'vi',
    metadata: chunk.metadata || {},
    chunkIndex: chunk.chunkIndex,
    embedding: embeddings[i] || [],
    contentHash: chunk.contentHash || computeHash(chunk.content),
  }))

  await VectorDocument.insertMany(docs, { ordered: false })
  return docs.length
}

export const indexSource = async (source) => {
  const fetcher = SOURCES[source]
  if (!fetcher) throw new Error(`Unknown source: ${source}`)

  const items = await fetcher.fetch()
  if (items.length === 0) return { source, deleted: 0, inserted: 0 }

  await deleteBySource(source)

  let totalInserted = 0
  for (const item of items) {
    let text = item.contentVi || item.content
    const meta = {
      sourceId: item.id || '',
      title: item.title || '',
      language: item.language || 'vi',
      metadata: item.metadata || {},
    }
    const viChunks = chunkText(text, meta)

    let enChunks = []
    if (item.language === 'both' && item.contentEn && item.contentEn !== text) {
      const enMeta = { ...meta, language: 'en' }
      enChunks = chunkText(item.contentEn, enMeta)
    }

    const allChunks = [...viChunks, ...enChunks]
    if (allChunks.length === 0) continue

    const inserted = await insertChunks(source, allChunks)
    totalInserted += inserted
  }

  return { source, deleted: items.length > 0 ? undefined : 0, inserted: totalInserted }
}

export const indexAll = async () => {
  const results = []
  for (const source of Object.keys(SOURCES)) {
    try {
      const result = await indexSource(source)
      results.push(result)
    } catch (err) {
      results.push({ source, error: err.message })
    }
  }
  return results
}

export const deleteBySourceId = async (source, sourceId) => {
  const result = await VectorDocument.deleteMany({ source, sourceId })
  return result.deletedCount || 0
}

export const incrementalIndex = async (source) => {
  const fetcher = SOURCES[source]
  if (!fetcher) throw new Error(`Unknown source: ${source}`)

  const items = await fetcher.fetch()
  let indexed = 0

  for (const item of items) {
    const sourceId = item.id || ''
    const existing = await VectorDocument.findOne({ source, sourceId }).sort({ chunkIndex: -1 })

    let text = item.contentVi || item.content
    const newHash = computeHash(text)

    if (existing && existing.contentHash === newHash) continue

    await VectorDocument.deleteMany({ source, sourceId })
    const meta = {
      sourceId,
      title: item.title || '',
      language: item.language || 'vi',
      metadata: item.metadata || {},
    }
    const viChunks = chunkText(text, meta)
    let allChunks = [...viChunks]

    if (item.language === 'both' && item.contentEn && item.contentEn !== text) {
      const enMeta = { ...meta, language: 'en' }
      allChunks.push(...chunkText(item.contentEn, enMeta))
    }

    if (allChunks.length > 0) {
      const inserted = await insertChunks(source, allChunks)
      indexed += inserted
    }
  }

  return { source, indexed }
}

export const updateDocument = async (source, sourceId, newData) => {
  await deleteBySourceId(source, sourceId)
  const meta = {
    sourceId: sourceId || '',
    title: newData.title || '',
    language: newData.language || 'vi',
    metadata: newData.metadata || {},
  }
  const chunks = chunkText(newData.content, meta)
  if (chunks.length === 0) return 0
  const inserted = await insertChunks(source, chunks)
  return inserted
}

export const search = async (query, { sources, topK = 5, minScore = 0, language } = {}) => {
  if (!query || !query.trim()) return []

  const queryVector = await embedText(query.trim())
  if (queryVector.length === 0) return []

  const pipeline = [
    {
      $vectorSearch: {
        index: VECTOR_SEARCH_INDEX,
        path: 'embedding',
        queryVector,
        numCandidates: Math.min(topK * 10, 100),
        limit: topK,
        ...(sources?.length ? { filter: { source: { $in: sources } } } : {}),
      },
    },
    { $project: { embedding: 0 } },
  ]

  const results = await VectorDocument.aggregate(pipeline)

  return results
    .filter((r) => (r.score || 0) >= minScore)
    .map((r) => ({
      source: r.source,
      sourceId: r.sourceId,
      title: r.title,
      content: r.content,
      language: r.language,
      metadata: r.metadata,
      score: r.score || 0,
    }))
}

export const getCollectionStats = async () => {
  const stats = await VectorDocument.aggregate([
    { $group: { _id: '$source', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ])
  const total = stats.reduce((s, g) => s + g.count, 0)
  return { total, perSource: Object.fromEntries(stats.map((s) => [s._id, s.count])) }
}

export const getSources = () => Object.keys(SOURCES)
export const SOURCE_NAMES = Object.keys(SOURCES)
