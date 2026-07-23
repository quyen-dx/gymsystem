import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { vector as cfg } from '../../../config/aiConfig.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORAGE_PATH = cfg.storagePath
  || path.resolve(__dirname, '../../../../ai-knowledge/.vectors.json')

let store = null

function load() {
  if (store) return store
  try {
    const data = fs.readFileSync(STORAGE_PATH, 'utf-8')
    store = JSON.parse(data)
    return store
  } catch {
    store = { documents: [] }
    return store
  }
}

function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const mag = Math.sqrt(na) * Math.sqrt(nb)
  return mag === 0 ? 0 : dot / mag
}

export function search(embedding, { topK = 5, minScore = 0.5 } = {}) {
  const s = load()
  if (!s.documents.length || !embedding?.length) return []

  const scored = s.documents
    .map(doc => ({
      title: doc.title,
      category: doc.category,
      content: doc.content,
      source: doc.source,
      updatedAt: doc.updatedAt,
      score: cosineSimilarity(embedding, doc.embedding),
    }))
    .filter(doc => doc.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  return scored
}

export function isAvailable() {
  try {
    const s = load()
    return s.documents.length > 0
  } catch {
    return false
  }
}

export { load, cosineSimilarity, STORAGE_PATH }
