import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const GUIDE_FILE_NAME = 'AI_GYMPRO_REASONING_MASTER.md'
const MAX_GUIDE_CHARS = 9000

const candidatePaths = [
  path.resolve(process.cwd(), 'docs', GUIDE_FILE_NAME),
  path.resolve(process.cwd(), '..', 'docs', GUIDE_FILE_NAME),
  path.resolve(__dirname, '../../../../docs', GUIDE_FILE_NAME),
]

const sectionAliases = {
  core: ['Tổng quan GymPro', 'Quy tắc dữ liệu', 'Thứ tự nguồn dữ liệu', 'Luồng suy luận chính', 'Query Reasoner', 'Output Schema Gợi Ý'],
  memory: ['Memory Rule'],
  response: ['Response Rule'],
  render: ['Render Rule'],
  safety: ['Safety Rule'],
  cache: ['Cache Rule'],
  web: ['Web Search Rule'],
  plan: ['Plan', 'Quy tắc dữ liệu', 'Memory Rule', 'Render Rule', 'Response Rule', 'Safety Rule'],
  pt: ['PT', 'Memory Rule', 'Render Rule', 'Response Rule', 'Safety Rule'],
  membership: ['Plan', 'Quy tắc dữ liệu', 'Memory Rule', 'Response Rule', 'Safety Rule'],
  booking: ['PT', 'Tool Planning', 'Memory Rule', 'Response Rule', 'Safety Rule'],
  workout: ['Workout', 'Memory Rule', 'Response Rule', 'Safety Rule'],
  health: ['Nutrition', 'Workout', 'Web Search Rule', 'Response Rule', 'Safety Rule'],
  nutrition: ['Nutrition', 'Web Search Rule', 'Response Rule', 'Safety Rule'],
  product: ['Product', 'Web Search Rule', 'Quy tắc dữ liệu', 'Response Rule', 'Safety Rule'],
  shop: ['Product', 'Web Search Rule', 'Quy tắc dữ liệu', 'Response Rule', 'Safety Rule'],
  policy: ['Policy/FAQ', 'Quy tắc dữ liệu', 'Web Search Rule', 'Response Rule', 'Safety Rule'],
  faq: ['Policy/FAQ', 'Quy tắc dữ liệu', 'Web Search Rule', 'Response Rule', 'Safety Rule'],
  checkin: ['Workout', 'Memory Rule', 'Response Rule', 'Safety Rule'],
  report: ['Quy tắc dữ liệu', 'Thứ tự nguồn dữ liệu', 'Safety Rule'],
  general: ['Tổng quan GymPro', 'Quy tắc dữ liệu', 'Response Rule', 'Safety Rule'],
}

let cache = {
  path: null,
  mtimeMs: 0,
  content: '',
  sections: null,
}

const resolveGuidePath = () => candidatePaths.find((candidate) => fs.existsSync(candidate)) || candidatePaths[0]

const parseSections = (content) => {
  const sections = new Map()
  const headingPattern = /^(#{2,3})\s+(?:(?:\d+\.)\s+)?(.+)$/gm
  const matches = [...content.matchAll(headingPattern)]

  for (let i = 0; i < matches.length; i += 1) {
    const title = matches[i][2].trim()
    const start = matches[i].index
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length
    sections.set(title, content.slice(start, end).trim())
  }

  return sections
}

const loadGuide = () => {
  const guidePath = resolveGuidePath()
  const stat = fs.statSync(guidePath)
  const shouldReload = !cache.content
    || cache.path !== guidePath
    || (process.env.NODE_ENV === 'development' && stat.mtimeMs !== cache.mtimeMs)

  if (shouldReload) {
    const content = fs.readFileSync(guidePath, 'utf8')
    cache = {
      path: guidePath,
      mtimeMs: stat.mtimeMs,
      content,
      sections: parseSections(content),
    }
  }

  return cache
}

const uniq = (items) => [...new Set(items.filter(Boolean))]

const trimGuide = (text, maxChars = MAX_GUIDE_CHARS) => {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars).trim()}\n\n[Guide truncated: only relevant rules included in prompt.]`
}

export const getReasoningGuide = ({ subject, sections = [], maxChars = MAX_GUIDE_CHARS } = {}) => {
  try {
    const loaded = loadGuide()
    const subjectKey = String(subject || 'core').toLowerCase()
    const sectionNames = uniq([
      ...sections,
      ...(sectionAliases[subjectKey] || sectionAliases.core),
    ])

    const selected = sectionNames
      .map((name) => loaded.sections.get(name))
      .filter(Boolean)

    const content = selected.length > 0 ? selected.join('\n\n') : loaded.content

    return {
      content: trimGuide(content, maxChars),
      fullContent: loaded.content,
      path: loaded.path,
      sections: sectionNames,
      loaded: true,
    }
  } catch (err) {
    return {
      content: '',
      fullContent: '',
      path: resolveGuidePath(),
      sections: [],
      loaded: false,
      error: err.message,
    }
  }
}

export const __reasoningGuideTestHooks = {
  parseSections,
  resolveGuidePath,
  trimGuide,
}
