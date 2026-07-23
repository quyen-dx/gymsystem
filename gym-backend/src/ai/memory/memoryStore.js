import { memory as cfg } from '../../config/aiConfig.js'

const DEFAULT_TTL = () => cfg.ttl * 60 * 1000

class InMemoryMemoryStore {
  constructor() {
    this._store = new Map()
  }

  get(sessionId) {
    const entry = this._store.get(sessionId)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this._store.delete(sessionId)
      return null
    }
    return entry.memory
  }

  set(sessionId, memory) {
    this._store.set(sessionId, { memory, expiresAt: Date.now() + DEFAULT_TTL() })
  }

  delete(sessionId) {
    this._store.delete(sessionId)
  }

  cleanup() {
    const now = Date.now()
    for (const [key, entry] of this._store) {
      if (now > entry.expiresAt) this._store.delete(key)
    }
  }

  get size() {
    return this._store.size
  }
}

const STORE_MAP = { memory: InMemoryMemoryStore }

const providerName = cfg.provider.toLowerCase()
const StoreClass = STORE_MAP[providerName]

if (!StoreClass) throw new Error(`Unknown MEMORY_PROVIDER: ${providerName}. Supported: memory`)

const instance = new StoreClass()

setInterval(() => instance.cleanup(), 60_000)

export default instance
