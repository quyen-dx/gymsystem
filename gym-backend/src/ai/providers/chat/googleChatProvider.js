import { GoogleGenAI, createPartFromFunctionResponse } from '@google/genai'
import { providers } from '../../../config/aiConfig.js'

const MODELS = providers.google.models
const API_KEYS = providers.google.apiKeys

let keyIdx = 0
let modelIdx = 0

function isModelNotFound(err) {
  const status = err?.status || err?.code
  const msg = err?.message || ''
  return status === 404 || /not.?found|model.*(retired|deprecated|removed)/i.test(msg)
}

function isRetryable(err) {
  const status = err?.status || err?.code
  const msg = err?.message || ''
  if (status === 400 || status === 401 || status === 403) return false
  return status === 404 || status === 429
    || (typeof status === 'number' && status >= 500 && status < 600)
    || /RESOURCE_EXHAUSTED|quota|rate.?\s*limit|timeout|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network|temporary/i.test(msg)
}

function makeClient() {
  const key = API_KEYS[keyIdx]
  if (!key) return null
  return new GoogleGenAI({ apiKey: key })
}

function rotateModel() {
  keyIdx = 0
  modelIdx++
}

function rotate() {
  keyIdx++
  if (keyIdx >= API_KEYS.length) {
    keyIdx = 0
    modelIdx++
  }
}

export function isAvailable() {
  return API_KEYS.length > 0 && !!API_KEYS[keyIdx]
}

export function makeFunctionResponsePart(id, name, result) {
  return createPartFromFunctionResponse(id, name, result)
}

async function callWithRotation(fn) {
  while (modelIdx < MODELS.length) {
    const client = makeClient()
    if (!client) { rotate(); continue }
    try {
      return await fn(client)
    } catch (err) {
      if (isModelNotFound(err)) {
        console.warn(`[AI chat] ${MODELS[modelIdx]} not found (404/deprecated), switching to next model...`)
        rotateModel()
        continue
      }
      if (isRetryable(err)) {
        console.warn(`[AI chat] ${MODELS[modelIdx]} key ${keyIdx + 1}/${API_KEYS.length} retryable error, rotating...`)
        rotate()
        continue
      }
      throw err
    }
  }
  throw Object.assign(new Error('PROVIDER_EXHAUSTED'), { code: 'PROVIDER_EXHAUSTED' })
}

let _reqNum = 0

function _dump(label, contents) {
  _reqNum++
  console.log('')
  console.log('########## REQUEST #' + _reqNum + ' [' + label + '] ##########')
  console.log('Model:', MODELS[modelIdx])
  console.log('Contents: ' + (contents || []).length + ' items')
  if (!contents) { console.log('*** contents is NULL/UNDEFINED ***'); return }
  contents.forEach((c, ci) => {
    const pcount = (c.parts || []).length
    console.log('  [' + ci + '] role=' + (c.role || 'UNDEFINED') + ' parts=' + pcount)
    if (!c.parts) { console.log('    *** parts is NULL/UNDEFINED ***'); return }
    c.parts.forEach((p, pi) => {
      const js = JSON.stringify(p)
      if (js.length > 400) {
        console.log('    [' + pi + '] ' + JSs(p).substring(0, 400) + '...(truncated)')
      } else {
        console.log('    [' + pi + '] ' + js)
      }
      if (p === null) console.log('    *** PART IS null ***')
      if (p === undefined) console.log('    *** PART IS undefined ***')
      if (typeof p === 'object' && Object.keys(p).length === 0) console.log('    *** PART IS {} (empty object) ***')
    })
  })
  console.log('##########################################')
}
function JSs(o) {
  try { return JSON.stringify(o) } catch(e) { return '[not serializable: ' + e.message + ']' }
}

export async function generateContent({ contents, config }) {
  _dump('generateContent', contents)
  return callWithRotation(client =>
    client.models.generateContent({ model: MODELS[modelIdx], contents, config })
  )
}

export async function* generateStream({ contents, config }) {
  _dump('generateStream', contents)
  while (modelIdx < MODELS.length) {
    const client = makeClient()
    if (!client) { rotate(); continue }
    try {
      const stream = await client.models.generateContentStream({ model: MODELS[modelIdx], contents, config })
      for await (const chunk of stream) yield chunk
      return
    } catch (err) {
      if (isModelNotFound(err)) {
        console.warn(`[AI chat stream] ${MODELS[modelIdx]} not found (404/deprecated), switching to next model...`)
        rotateModel()
        continue
      }
      if (isRetryable(err)) {
        console.warn(`[AI chat stream] ${MODELS[modelIdx]} key ${keyIdx + 1}/${API_KEYS.length} retryable error, rotating...`)
        rotate()
        continue
      }
      throw err
    }
  }
  throw Object.assign(new Error('PROVIDER_EXHAUSTED'), { code: 'PROVIDER_EXHAUSTED' })
}
