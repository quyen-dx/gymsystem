import { AI_DOC_FILES, getAiDocSections, parseMarkdownSections } from './aiDocsService.js'

const MAX_GUIDE_CHARS = 9000

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

const uniq = (items) => [...new Set(items.filter(Boolean))]

const normalizeSubject = (subject) => {
  const key = String(subject || 'core').toLowerCase()
  if (key === 'membership_plans') return 'plan'
  if (key === 'products') return 'product'
  return key
}

export const getReasoningGuide = ({ subject, sections = [], maxChars = MAX_GUIDE_CHARS } = {}) => {
  const subjectKey = normalizeSubject(subject)
  const sectionNames = uniq([
    ...sections,
    ...(sectionAliases[subjectKey] || sectionAliases.core),
  ])

  return getAiDocSections({
    fileName: AI_DOC_FILES.master,
    sections: sectionNames,
    maxChars,
  })
}

export const __reasoningGuideTestHooks = {
  parseSections: parseMarkdownSections,
  resolveGuidePath: () => getAiDocSections({ fileName: AI_DOC_FILES.master }).path,
}
