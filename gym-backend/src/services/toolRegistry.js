import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MODULES_PATH = path.resolve(__dirname, '../modules')

class ToolRegistry {
  constructor() {
    this._tools = new Map()
    this._subjectMap = new Map()
    this._scanned = false
  }

  async scanModules() {
    if (this._scanned) return
    this._scanned = true

    let entries
    try {
      entries = fs.readdirSync(MODULES_PATH, { withFileTypes: true })
    } catch {
      console.log('[TOOL_REGISTRY] No modules directory found at', MODULES_PATH)
      return
    }

    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name)
    for (const dir of dirs) {
      const toolPath = path.join(MODULES_PATH, dir, 'tool.js')
      if (!fs.existsSync(toolPath)) continue
      try {
        const toolUrl = new URL('file:///' + toolPath.replace(/\\/g, '/')).href
        const mod = await import(toolUrl)
        const tools = mod.default || []
        if (!Array.isArray(tools)) {
          console.log(`[TOOL_REGISTRY] ${dir}/tool.js does not export an array, skipping`)
          continue
        }
        for (const tool of tools) {
          this.registerTool(tool)
        }
        console.log(`[TOOL_REGISTRY] Loaded ${tools.length} tool(s) from ${dir}/tool.js`)
      } catch (err) {
        console.log(`[TOOL_REGISTRY] Error loading ${dir}/tool.js:`, err.message)
      }
    }
  }

  registerTool({ name, description, handler, subjects = [], parameters, responseBuilder }) {
    if (!name || typeof handler !== 'function') {
      console.log('[TOOL_REGISTRY] Invalid tool definition:', name)
      return
    }
    const subjectsArr = Array.isArray(subjects) ? subjects : [subjects].filter(Boolean)
    this._tools.set(name, {
      name,
      description: description || '',
      handler,
      subjects: subjectsArr,
      parameters: parameters || { type: 'object', properties: {} },
      responseBuilder: responseBuilder || null,
    })
    for (const subject of subjectsArr) {
      if (!this._subjectMap.has(subject)) this._subjectMap.set(subject, [])
      const existing = this._subjectMap.get(subject)
      if (!existing.includes(name)) existing.push(name)
    }
  }

  getTool(name) {
    return this._tools.get(name) || null
  }

  getToolsBySubject(subject) {
    return this._subjectMap.get(subject) || []
  }

  getHandler(name) {
    const tool = this._tools.get(name)
    return tool ? tool.handler : null
  }

  getResponseBuilder(name) {
    const tool = this._tools.get(name)
    return tool?.responseBuilder || null
  }

  getAllToolNames() {
    return [...this._tools.keys()]
  }

  getAllTools() {
    return [...this._tools.values()]
  }

  getAllSubjects() {
    return [...this._subjectMap.keys()]
  }

  getSubjectMap() {
    const map = {}
    for (const [subject, tools] of this._subjectMap) {
      map[subject] = tools
    }
    return map
  }

  getDeclarations() {
    return this.getAllTools().map(t => ({
      name: t.name,
      description: t.description,
      subjects: t.subjects,
      parametersJsonSchema: t.parameters,
    }))
  }

  async runTool(name, args, context = {}) {
    const tool = this._tools.get(name)
    if (!tool) {
      const error = new Error(`Tool ${name} không được hỗ trợ`)
      error.statusCode = 400
      throw error
    }
    return tool.handler({ ...(args || {}), userId: context.userId })
  }
}

export const toolRegistry = new ToolRegistry()
export default ToolRegistry
