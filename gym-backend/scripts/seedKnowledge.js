import { GoogleGenAI } from '@google/genai'
import { embedding as cfg } from '../src/config/aiConfig.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '500', 10)
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '50', 10)
const EMBEDDING_MODEL = cfg.model
const KNOWLEDGE_DIR = path.resolve(__dirname, '../ai-knowledge')
const OUTPUT_PATH = path.resolve(__dirname, '../ai-knowledge/.vectors.json')

const EXCLUDE_DIRS = new Set(['prompts'])
const EXCLUDE_FILES = new Set(['.vectors.json', 'AI_REFACTOR_REPORT.md'])
const EXCLUDE_PREFIX = new Set(['AI_SPRINT_'])

let genAI = null

function getClient() {
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey: cfg.apiKey })
  }
  return genAI
}

function extractTitle(content, filePath) {
  const match = content.match(/^#\s+(.+)/m)
  if (match) return match[1].trim()
  return path.basename(filePath, '.md')
}

function getCategory(filePath) {
  const relative = path.relative(KNOWLEDGE_DIR, filePath)
  const parts = relative.split(path.sep)
  return parts.length > 1 ? parts[0] : 'general'
}

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  if (text.length <= size) return [text]
  const chunks = []
  let start = 0
  while (start < text.length) {
    let end = start + size
    if (end < text.length) {
      const boundary = text.lastIndexOf('\n', end)
      if (boundary > start + size / 2) end = boundary
    }
    chunks.push(text.slice(start, Math.min(end, text.length)).trim())
    start = end - overlap
    if (start >= text.length - overlap) break
    if (start < 0) start = 0
    if (chunks.length > 0 && start >= text.length - 1) break
  }
  return chunks.filter(Boolean)
}

function scanKnowledgeFiles() {
  const files = []

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name)) walk(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.md') && !EXCLUDE_FILES.has(entry.name) && ![...EXCLUDE_PREFIX].some(p => entry.name.startsWith(p))) {
        files.push(fullPath)
      }
    }
  }

  walk(KNOWLEDGE_DIR)
  return files
}

async function generateEmbedding(text) {
  const client = getClient()
  try {
    const result = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
    })
    return result.embeddings?.[0]?.values || null
  } catch (error) {
    console.error(`[Seed] Embedding failed: ${error.message}`)
    return null
  }
}

async function seed() {
  console.log('[Seed] Scanning knowledge directory...')
  const files = scanKnowledgeFiles()
  console.log(`[Seed] Found ${files.length} markdown files.`)

  const documents = []

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8')
    const title = extractTitle(content, filePath)
    const category = getCategory(filePath)
    const source = path.relative(KNOWLEDGE_DIR, filePath).replace(/\\/g, '/')
    const stats = fs.statSync(filePath)
    const updatedAt = stats.mtime.toISOString()

    const chunks = chunkText(content)
    console.log(`[Seed] ${source}: ${chunks.length} chunk(s)`)

    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i]
      console.log(`[Seed]   Embedding chunk ${i + 1}/${chunks.length} (${chunkContent.length} chars)...`)
      const embedding = await generateEmbedding(chunkContent)
      if (!embedding) {
        console.warn(`[Seed]   Skipping chunk ${i + 1} — embedding failed`)
        continue
      }
      documents.push({
        id: `${source}_chunk_${i}`,
        title: i === 0 ? title : `${title} (tiếp theo ${i})`,
        category,
        source,
        content: chunkContent,
        updatedAt,
        embedding,
      })
    }
  }

  const output = { documents, metadata: { totalDocuments: documents.length, chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP, seededAt: new Date().toISOString() } }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`\n[Seed] ✓ Saved ${documents.length} document chunks to ${OUTPUT_PATH}`)
}

seed().catch(error => {
  console.error('[Seed] Error:', error.message)
  process.exit(1)
})
