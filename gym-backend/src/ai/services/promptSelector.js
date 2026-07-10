// promptSelector.js
// Loads the correct writer prompt based on subject.
// Each prompt file contains ONLY its domain's writing rules.
// Shared rules (language, safety, formatting) are in SYSTEM_PROMPT.md.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// writers/ is at src/ai/writers/, promptSelector is at src/ai/services/
const PROMPT_DIR = resolve(__dirname, '..', 'writers')

const PROMPT_FILES = {
  nutrition: 'nutrition.prompt.md',
  workout: 'workout.prompt.md',
  health: 'health.prompt.md',
  membership: 'membership.prompt.md',
  plan: 'membership.prompt.md',
  pt: 'pt.prompt.md',
  trainer: 'pt.prompt.md',
  product: 'product.prompt.md',
  shop: 'product.prompt.md',
  faq: 'faq.prompt.md',
  policy: 'faq.prompt.md',
  general: 'general.prompt.md',
  greeting: 'general.prompt.md',
  booking: null,
  checkin: null,
  report: null,
  account: null,
  navigation: null,
}

let _cache = {}

const loadPrompt = (filename) => {
  if (!filename) return ''
  if (_cache[filename]) return _cache[filename]
  try {
    const filepath = join(PROMPT_DIR, filename)
    const content = readFileSync(filepath, 'utf-8')
    _cache[filename] = content
    return content
  } catch (err) {
    console.error(`[PROMPT_SELECTOR] Failed to load ${filename}: ${err.message}`)
    return ''
  }
}

export const getSystemPrompt = () => loadPrompt('SYSTEM_PROMPT.md')

export const getWriterPrompt = (subject = '') => {
  const key = subject.toLowerCase().trim()
  const filename = PROMPT_FILES[key]
  if (!filename) return ''  // deterministic domains don't need a writer prompt
  return loadPrompt(filename)
}
