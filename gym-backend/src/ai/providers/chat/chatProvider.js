import { chat as cfg, providers } from '../../../config/aiConfig.js'

const PROVIDER_LOADERS = {
  google: () => import('./googleChatProvider.js'),
  deepseek: () => import('./deepseekChatProvider.js'),
  openrouter: () => import('./openrouterChatProvider.js'),
  openai: null,
  claude: null,
}

function isRetryable(err) {
  const msg = err?.message || ''
  return err?.code === 'PROVIDER_EXHAUSTED'
    || err?.status === 429 || err?.status === 502 || err?.status === 503 || err?.status === 504
    || /PROVIDER_EXHAUSTED|timeout|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network|temporary/i.test(msg)
}

function resolveOrder() {
  if (cfg.provider === 'auto') {
    const order = cfg.providerOrder
    if (order.length === 0) return ['google', 'deepseek', 'openrouter']
    return order
  }
  return [cfg.provider]
}

async function getProvider(name) {
  const load = PROVIDER_LOADERS[name]
  if (!load) return null

  const providerCfg = providers[name]
  if (providerCfg && !providerCfg.enabled) return null

  const mod = await load()
  return mod
}

async function callWithFailover(fnName, ...args) {
  const order = resolveOrder()
  console.log(`[FAILOVER] fn=${fnName} order=[${order.join(',')}]`)

  for (const name of order) {
    try {
      console.log(`[FAILOVER] trying ${name}...`)
      const prov = await getProvider(name)
      console.log(`[FAILOVER] ${name} prov=${!!prov} isAvail=${prov?.isAvailable ? prov.isAvailable() : 'no_fn'}`)
      if (!prov || !prov.isAvailable || !prov.isAvailable()) {
        console.warn(`[AI failover] ${name}: not available, skipping`)
        continue
      }
      console.log(`[FAILOVER] ${name}: calling ${fnName}`)
      return await prov[fnName](...args)
    } catch (err) {
      console.log(`[FAILOVER] ${name}: error code=${err?.code} msg=${err?.message?.substring(0, 100)}`)
      if (isRetryable(err)) {
        console.warn(`[AI failover] ${name} exhausted → switching to next provider`)
        continue
      }
      throw err
    }
  }
  throw Object.assign(new Error('All AI providers are currently unavailable. Please try again later.'), { code: 'SERVICE_UNAVAILABLE' })
}

let _googlePart = null
async function loadGoogleForParts() {
  if (!_googlePart) _googlePart = (await import('./googleChatProvider.js')).makeFunctionResponsePart
  return _googlePart
}

export async function makeFunctionResponsePart(id, name, result) {
  const gfn = await loadGoogleForParts()
  return gfn(id, name, result)
}

export async function generateContent(opts) {
  return callWithFailover('generateContent', opts)
}

export async function* generateStream(opts) {
  const order = resolveOrder()

  for (const name of order) {
    try {
      const prov = await getProvider(name)
      if (!prov || !prov.isAvailable || !prov.isAvailable()) {
        console.warn(`[AI failover] ${name}: not available, skipping`)
        continue
      }
      for await (const chunk of prov.generateStream(opts)) {
        yield chunk
      }
      return
    } catch (err) {
      if (isRetryable(err)) {
        console.warn(`[AI failover] ${name} stream exhausted → switching to next provider`)
        continue
      }
      throw err
    }
  }
  throw Object.assign(new Error('All AI providers are currently unavailable. Please try again later.'), { code: 'SERVICE_UNAVAILABLE' })
}

export function isAvailable() {
  return true
}
