import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MODULES_PATH = path.resolve(__dirname, '../../modules')

class MetadataService {
  constructor() {
    this._moduleMeta = new Map()
    this._scanned = false
  }

  async scanModules() {
    if (this._scanned) return
    this._scanned = true

    let entries
    try {
      entries = fs.readdirSync(MODULES_PATH, { withFileTypes: true })
    } catch {
      console.log('[AI_METADATA] No modules directory found')
      return
    }

    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name)
    for (const dir of dirs) {
      const jsonPath = path.join(MODULES_PATH, dir, 'ai.json')
      if (!fs.existsSync(jsonPath)) continue
      try {
        const raw = fs.readFileSync(jsonPath, 'utf8')
        const meta = JSON.parse(raw)
        if (!meta.module) meta.module = dir
        this._moduleMeta.set(dir, meta)
        console.log(`[AI_METADATA] Loaded ${dir}: ${meta.description}`)
      } catch (err) {
        console.log(`[AI_METADATA] Error loading ${dir}/ai.json:`, err.message)
      }
    }
  }

  getModule(name) {
    return this._moduleMeta.get(name) || null
  }

  getToolModules(toolName) {
    const result = []
    for (const [, meta] of this._moduleMeta) {
      if (meta.tools && meta.tools.includes(toolName)) {
        result.push(meta)
      }
    }
    return result
  }

  getAllModules() {
    return [...this._moduleMeta.values()]
  }

  getActiveModules() {
    return this.getAllModules().filter(m => m.tools && m.tools.length > 0)
  }

  getInactiveModules() {
    return this.getAllModules().filter(m => !m.tools || m.tools.length === 0)
  }

  buildMetaPrompt() {
    const active = this.getActiveModules()
    if (active.length === 0) return ''
    const lines = ['\nAvailable modules:']
    for (const m of active) {
      lines.push(`- ${m.module}: ${m.description}`)
      if (m.examples && m.examples.length > 0) {
        lines.push(`  Examples: ${m.examples.slice(0, 5).join(', ')}`)
      }
    }
    return lines.join('\n')
  }

  buildExamplePrompt() {
    const active = this.getActiveModules()
    const allExamples = []
    for (const m of active) {
      if (m.examples) allExamples.push(...m.examples)
    }
    if (allExamples.length === 0) return ''
    return `\nExample queries:\n${allExamples.map(e => `- "${e}"`).join('\n')}`
  }
}

export const metadataService = new MetadataService()
export default MetadataService
