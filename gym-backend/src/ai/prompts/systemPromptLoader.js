import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROMPT_PATH = path.resolve(__dirname, '../../../ai-knowledge/prompts/system-prompt-vi.md')

let systemPrompt = ''
try {
  systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf-8')
} catch (err) {
  console.error('[AI] Failed to load system prompt:', err.message)
}

export function getSystemPrompt() {
  return systemPrompt
}
