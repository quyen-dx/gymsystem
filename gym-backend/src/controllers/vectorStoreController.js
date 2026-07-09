import { indexAll, indexSource, getCollectionStats, search, getSources } from '../ai/services/vectorStoreService.js'

export const reIndexAll = async (req, res) => {
  try {
    const results = await indexAll()
    const total = results.reduce((s, r) => s + (r.inserted || 0), 0)
    res.json({ message: `Re-index complete: ${total} chunks across ${results.length} sources`, results })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const reIndexSource = async (req, res) => {
  try {
    const { source } = req.params
    const valid = getSources()
    if (!valid.includes(source)) {
      return res.status(400).json({ message: `Invalid source. Valid: ${valid.join(', ')}` })
    }
    const result = await indexSource(source)
    res.json({ message: `Re-indexed ${source}: ${result.inserted} chunks`, result })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getStats = async (req, res) => {
  try {
    const stats = await getCollectionStats()
    const sources = getSources()
    res.json({ ...stats, sources })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const searchVector = async (req, res) => {
  try {
    const { query, topK = 5, sources } = req.body
    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'query is required' })
    }
    const results = await search(query.trim(), {
      sources: Array.isArray(sources) ? sources : undefined,
      topK: Math.min(topK, 20),
    })
    res.json({ query, total: results.length, results })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
