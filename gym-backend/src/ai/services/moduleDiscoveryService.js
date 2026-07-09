import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MODULES_PATH = path.resolve(__dirname, '../../modules')

class ModuleDiscoveryService {
  constructor() {
    this._modules = new Map()
    this._discovered = false
  }

  async discoverAll() {
    let entries
    try {
      entries = fs.readdirSync(MODULES_PATH, { withFileTypes: true })
    } catch {
      console.log('[MODULE_DISCOVERY] No src/modules/ directory found')
      return []
    }

    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)
    const discovered = []

    for (const dir of dirs.sort()) {
      const modulePath = path.join(MODULES_PATH, dir)
      const mod = {
        name: dir,
        path: modulePath,
        hasService: fs.existsSync(path.join(modulePath, 'service.js')),
        hasTool: fs.existsSync(path.join(modulePath, 'tool.js')),
        hasMetadata: fs.existsSync(path.join(modulePath, 'ai.json')),
        hasReadme: fs.existsSync(path.join(modulePath, 'README.md')),
        tools: [],
        description: '',
      }

      if (mod.hasMetadata) {
        try {
          const raw = fs.readFileSync(path.join(modulePath, 'ai.json'), 'utf8')
          const meta = JSON.parse(raw)
          mod.description = meta.description || ''
          mod.tools = meta.tools || []
        } catch {
        }
      }

      this._modules.set(dir, mod)
      discovered.push(mod)
    }

    const { toolRegistry } = await import('./toolRegistry.js')
    await toolRegistry.scanModules()

    const { metadataService } = await import('./metadataService.js')
    await metadataService.scanModules()

    const readmeModules = discovered.filter((m) => m.hasReadme)
    if (readmeModules.length > 0) {
      try {
        const { indexSource } = await import('./vectorStoreService.js')
        await indexSource('module_readme')
      } catch (err) {
        console.log('[MODULE_DISCOVERY] README indexing skipped:', err.message)
      }
    }

    this._discovered = true

    this._logSummary(discovered)
    return discovered
  }

  _logSummary(modules) {
    const toolModules = modules.filter((m) => m.hasTool)
    const withReadme = modules.filter((m) => m.hasReadme)
    const withService = modules.filter((m) => m.hasService)

    console.log(`[MODULE_DISCOVERY] ${modules.length} module(s) found`)
    if (toolModules.length > 0) {
      const totalTools = toolModules.reduce((s, m) => s + m.tools.length, 0)
      console.log(`[MODULE_DISCOVERY]   ${toolModules.length} module(s) with tool.js → ${totalTools} tool(s) registered`)
    }
    if (withService.length > 0) {
      console.log(`[MODULE_DISCOVERY]   ${withService.length} module(s) with service.js`)
    }
    if (withReadme.length > 0) {
      console.log(`[MODULE_DISCOVERY]   ${withReadme.length} module(s) with README.md → vector indexed`)
    }
  }

  getModule(name) {
    return this._modules.get(name) || null
  }

  getAllModules() {
    return [...this._modules.values()]
  }

  getModulesWith(feature) {
    return this.getAllModules().filter((m) => m[feature])
  }
}

export const moduleDiscovery = new ModuleDiscoveryService()
export default ModuleDiscoveryService
