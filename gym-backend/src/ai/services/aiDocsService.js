import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const AI_DOCS_DIR = path.resolve(__dirname, '../docs')

export const AI_DOC_FILES = {
  render: 'AI_RENDER_GUIDE.md',
  master: 'AI_GYMPRO_REASONING_MASTER.md',
  architecture: 'AI_REASONING_ARCHITECTURE.md',
  business: 'GYMPRO_BUSINESS_BRAIN.md',
  navigation: 'NAVIGATION_MAP.md',
  legacy: 'LEGACY_REASONING_ARCHITECTURE.md',
  constitution: 'GYMPRO_CONSTITUTION.md',
}

const MAX_DOC_CHARS = 9000

const docCache = new Map()

const normalizeKey = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

export const parseMarkdownSections = (content = '') => {
  const sections = new Map()
  const headingPattern = /^(#{1,3})\s+(?:(?:\d+\.)\s+)?(.+)$/gm
  const matches = [...content.matchAll(headingPattern)]

  for (let i = 0; i < matches.length; i += 1) {
    const rawTitle = matches[i][2].trim()
    const start = matches[i].index
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length
    const section = content.slice(start, end).trim()
    sections.set(rawTitle, section)
    sections.set(normalizeKey(rawTitle), section)
  }

  return sections
}

const trimText = (text = '', maxChars = MAX_DOC_CHARS) => {
  if (!text || text.length <= maxChars) return text
  return `${text.slice(0, maxChars).trim()}\n\n[AI docs truncated: only relevant excerpts were included.]`
}

export const loadAiDoc = (fileName) => {
  const safeName = path.basename(fileName)
  const filePath = path.resolve(AI_DOCS_DIR, safeName)

  try {
    const stat = fs.statSync(filePath)
    const cached = docCache.get(safeName)
    const shouldReload = !cached
      || cached.path !== filePath
      || (process.env.NODE_ENV === 'development' && cached.mtimeMs !== stat.mtimeMs)

    if (!shouldReload) return cached

    const content = fs.readFileSync(filePath, 'utf8')
    const loaded = {
      fileName: safeName,
      path: filePath,
      mtimeMs: stat.mtimeMs,
      content,
      sections: parseMarkdownSections(content),
      loaded: true,
    }
    docCache.set(safeName, loaded)
    return loaded
  } catch (err) {
    const missing = {
      fileName: safeName,
      path: filePath,
      content: '',
      sections: new Map(),
      loaded: false,
      error: err.message,
    }
    docCache.set(safeName, missing)
    return missing
  }
}

const uniq = (items = []) => [...new Set(items.filter(Boolean))]

const subjectAliases = {
  membership: 'plan',
  membership_plans: 'plan',
  products: 'product',
  shop: 'product',
  policies: 'policy',
  schedule: 'booking',
  account_navigation: 'account',
  account_management: 'account',
}

const normalizeSubject = (subject) => subjectAliases[normalizeKey(subject)] || normalizeKey(subject) || 'core'

const sectionPlan = ({ subject, action, intent, responseType, purpose }) => {
  const s = normalizeSubject(subject)
  const a = normalizeKey(action)
  const i = normalizeKey(intent)
  const r = normalizeKey(responseType)
  const p = normalizeKey(purpose)
  const wantsFollowUp = /follow|detail|reference|resolve/.test(`${a} ${i} ${r}`)
  const wantsRecommend = /recommend|advice|goi y|tu van/.test(`${a} ${i} ${r}`)
  const wantsList = /list|danh sach/.test(`${a} ${i} ${r}`)
  const wantsRender = p === 'render' || /render|list|detail|recommend|response|answer/.test(`${p} ${r}`)

  const master = ['Quy tắc dữ liệu', 'Thứ tự nguồn dữ liệu', 'Safety Rule']
  const architecture = ['Core Principle', 'Layer 1 - Query Understanding', 'Layer 2 - Intent Classification', 'Layer 3 - Tool Planning', 'Layer 4 - Data Priority']
  const business = []
  const navigation = []
  const render = ['Nguyên Tắc Chung', 'Typography Rules', 'Anti Patterns']
  const wantsNavigation = [
    'navigation',
    'account',
    'profile',
    'booking',
    'checkin',
    'workout',
    'health',
    'payment',
    'order',
    'faq',
    'policy',
    'help',
    'product',
    'forgot_password',
    'auth',
  ].some((key) => `${s} ${a} ${i} ${r} ${p}`.includes(key))

  if (wantsFollowUp || ['pt', 'plan'].includes(s)) {
    master.push('Memory Rule')
    architecture.push('Layer 5 - Context Reasoning', 'Layer 6 - Entity Resolution')
  }

  if (['plan', 'membership'].includes(s)) {
    master.push('Plan', 'Tool Planning', 'Response Rule')
    architecture.push('membership', 'membership_detail', 'membership_recommendation', 'Layer 7 - Response Planning')
    business.push('Membership', 'Gói tập', 'Recommendation Intelligence', 'Business Decision Examples')
    render.push(wantsList ? 'Plan List' : 'Plan List', 'Separator')
  } else if (s === 'pt') {
    master.push('PT', 'Tool Planning', 'Response Rule')
    architecture.push('pt_list', 'pt_detail', 'Layer 7 - Response Planning')
    business.push('PT', 'Booking', 'Recommendation Intelligence', 'Business Decision Examples')
    render.push('PT List')
  } else if (s === 'nutrition') {
    master.push('Nutrition', 'Web Search Rule', 'Response Rule')
    architecture.push('nutrition', 'Layer 7 - Response Planning')
    business.push('Nutrition', 'Health', 'Goal Understanding')
    render.push('Nutrition')
  } else if (s === 'workout' || s === 'health') {
    master.push('Workout', 'Nutrition', 'Web Search Rule', 'Response Rule')
    architecture.push('workout', 'health', 'Layer 7 - Response Planning')
    business.push('Workout', 'Health', 'Goal Understanding')
    render.push('Workout', 'Nutrition')
  } else if (s === 'product') {
    master.push('Product', 'Web Search Rule', 'Response Rule')
    architecture.push('product', 'Layer 7 - Response Planning')
    business.push('Product', 'Sản phẩm', 'Business Decision Examples')
    render.push('Product List')
  } else if (s === 'policy' || s === 'faq') {
    master.push('Policy/FAQ', 'Response Rule')
    architecture.push('policy', 'faq', 'Layer 7 - Response Planning')
    business.push('Policy', 'FAQ')
  } else if (s === 'booking') {
    master.push('PT', 'Tool Planning', 'Memory Rule', 'Response Rule')
    architecture.push('schedule', 'Layer 5 - Context Reasoning', 'Layer 7 - Response Planning')
    business.push('Booking', 'PT')
  } else if (s === 'checkin') {
    master.push('Memory Rule', 'Response Rule')
    architecture.push('checkin', 'Layer 7 - Response Planning')
    business.push('Checkin')
  } else if (s === 'account') {
    master.push('Response Rule', 'Safety Rule')
    architecture.push('account_navigation', 'account_management', 'Layer 7 - Response Planning')
    business.push('Business Decision Examples')
  } else {
    master.push('Tổng quan GymPro', 'Response Rule')
    architecture.push('general_chat', 'unknown')
  }

  if (wantsRecommend) {
    master.push('Tool Planning', 'Response Rule')
    architecture.push('Recommendation Response')
    business.push('Recommendation Intelligence', 'Personalized Response Rules')
  }

  if (wantsRender) {
    master.push('Render Rule')
    architecture.push('Layer 8 - Rendering Separation')
  }

  if (wantsNavigation) {
    navigation.push('Data Rule', 'Member Routes', 'PT Routes', 'Staff Routes', 'Admin Routes', 'Seller Routes', 'Intent Examples', 'Security Examples')
  }

  return {
    [AI_DOC_FILES.master]: uniq(master),
    [AI_DOC_FILES.architecture]: uniq(architecture),
    [AI_DOC_FILES.business]: uniq(business),
    [AI_DOC_FILES.navigation]: uniq(navigation),
    [AI_DOC_FILES.render]: uniq(render),
  }
}

const pickSections = (doc, names = []) => {
  const selected = []
  const labels = []

  for (const name of names) {
    const section = doc.sections.get(name) || doc.sections.get(normalizeKey(name))
    if (section) {
      selected.push(section)
      labels.push(name)
    }
  }

  return { selected, labels }
}

export const getAiDocSections = ({ fileName, sections = [], maxChars = MAX_DOC_CHARS } = {}) => {
  const doc = loadAiDoc(fileName)
  if (!doc.loaded) {
    return {
      content: '',
      fileName: path.basename(fileName || ''),
      path: doc.path,
      sections: [],
      loaded: false,
      error: doc.error,
    }
  }

  const { selected, labels } = pickSections(doc, sections)
  const content = selected.length > 0 ? selected.join('\n\n') : ''
  return {
    content: trimText(content, maxChars),
    fullContent: doc.content,
    fileName: doc.fileName,
    path: doc.path,
    sections: labels,
    loaded: true,
  }
}

export const getRelevantAiDocs = ({
  subject = 'core',
  action = '',
  intent = '',
  responseType = '',
  purpose = '',
  files,
  sections = {},
  maxChars = MAX_DOC_CHARS,
} = {}) => {
  const planned = sectionPlan({ subject, action, intent, responseType, purpose })
  const targetFiles = files?.length ? files : Object.keys(planned)
  const extraSections = Array.isArray(sections)
    ? Object.fromEntries(targetFiles.map((fileName) => [fileName, sections]))
    : (sections || {})
  const docs = []
  const loadedFiles = []
  const loadedSections = []

  for (const fileName of targetFiles) {
    const requestedSections = uniq([...(planned[fileName] || []), ...(extraSections[fileName] || [])])
    if (requestedSections.length === 0) continue

    const doc = getAiDocSections({ fileName, sections: requestedSections, maxChars })
    if (doc.loaded && doc.content) {
      docs.push(doc)
      loadedFiles.push(doc.fileName)
      loadedSections.push(...doc.sections)
    }
  }

  const content = trimText(docs.map((doc) => `--- ${doc.fileName} ---\n${doc.content}`).join('\n\n'), maxChars)

  return {
    content,
    docs,
    loadedFiles: uniq(loadedFiles),
    sections: uniq(loadedSections),
    subject: normalizeSubject(subject),
    action,
    intent,
    responseType,
    loaded: docs.length > 0,
  }
}

export const logAiDocsLoaded = ({ prefix = '[AI_DOCS]', docsInfo } = {}) => {
  if (!docsInfo) return
  console.log(`${prefix} loaded files: ${docsInfo.loadedFiles.join(', ') || 'none'}`)
  console.log(`${prefix} subject: ${docsInfo.subject || 'core'}`)
  console.log(`${prefix} sections: ${docsInfo.sections.join(', ') || 'none'}`)
}

export const __aiDocsTestHooks = {
  docCache,
  normalizeKey,
  sectionPlan,
  trimText,
}
