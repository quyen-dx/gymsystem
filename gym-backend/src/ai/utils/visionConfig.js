import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROMPT_PATH = path.resolve(__dirname, '../prompts/visionPrompt.md')

let visionPrompt = ''
try {
  visionPrompt = fs.readFileSync(PROMPT_PATH, 'utf-8')
} catch (err) {
  console.error('[AI][Vision] Failed to load vision prompt:', err.message)
}

export function getVisionPrompt() {
  return visionPrompt
}

export { SUPPORTED_FORMATS, SUPPORTED_EXTENSIONS, MAX_FILE_SIZE } from '../tools/visionTool.js'
