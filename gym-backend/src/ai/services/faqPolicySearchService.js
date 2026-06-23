import Faq from '../../models/Faq.js'
import Policy from '../../models/Policy.js'

const normalize = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const uniq = (items = []) => [...new Set(items.filter(Boolean))]

const tokenize = (text = '') => normalize(text).split(/\s+/).filter((token) => token.length >= 3)

const expandSupportQuery = (query = '') => {
  const n = normalize(query)
  const expansions = []
  const add = (...items) => expansions.push(...items)

  if (/\b(mat khau|password|dang nhap|login|otp)\b/.test(n)) {
    add('tai khoan', 'bao mat', 'dang nhap', 'mat khau', 'quen mat khau', 'doi mat khau', 'otp')
  }
  if (/\b(email|profile|ho so|thong tin ca nhan|avatar|anh dai dien)\b/.test(n)) {
    add('tai khoan', 'ho so', 'thong tin ca nhan', 'email', 'avatar')
  }
  if (/\b(dang ky|gia han|goi tap|hoi vien|membership|plan)\b/.test(n)) {
    add('goi tap', 'hoi vien', 'dang ky', 'gia han', 'membership')
  }
  if (/\b(dat lich|huy lich|doi lich|lich pt|booking|pt)\b/.test(n)) {
    add('dat lich', 'huy lich', 'lich pt', 'booking', 'pt')
  }
  if (/\b(checkin|check in|diem danh|vao phong)\b/.test(n)) {
    add('checkin', 'diem danh', 'vao phong')
  }
  if (/\b(thanh toan|hoa don|payment|invoice|vi|wallet)\b/.test(n)) {
    add('thanh toan', 'hoa don', 'payment')
  }
  if (/\b(ho tro|lien he|support|hotline)\b/.test(n)) {
    add('ho tro', 'lien he', 'support')
  }
  if (/\b(hoan tien|refund|bao luu|huy goi|chinh sach|dieu khoan|bao mat|privacy)\b/.test(n)) {
    add('chinh sach', 'quy dinh', 'hoan tien', 'bao luu', 'thanh toan', 'bao mat')
  }

  return uniq([query, n, ...expansions]).join(' ')
}

export const inferFaqCategory = (query = '') => {
  const n = normalize(query)
  if (/\b(goi tap|membership|plan|dang ky|gia han|hoi vien)\b/.test(n)) return 'Gói tập'
  if (/\b(tai khoan|account|mat khau|password|email|profile|ho so|otp|dang nhap|login|dang ky|register|avatar)\b/.test(n)) return 'Tài khoản'
  if (/\b(dat lich|huy lich|lich pt|booking|pt)\b/.test(n)) return 'Đặt lịch'
  if (/\b(checkin|check in|diem danh|vao phong)\b/.test(n)) return 'Check-in'
  if (/\b(thanh toan|hoa don|payment|invoice|vi|wallet)\b/.test(n)) return 'Thanh toán'
  if (/\b(ho tro|lien he|support|hotline)\b/.test(n)) return 'Hỗ trợ'
  return ''
}

export const inferPolicyCategory = (query = '') => {
  const n = normalize(query)
  if (/\b(hoan tien|refund|doi tra|huy goi|tra tien)\b/.test(n)) return 'Hoàn tiền'
  if (/\b(thanh toan|payment|hoa don|invoice|chuyen khoan|tra gop)\b/.test(n)) return 'Thanh toán'
  if (/\b(bao mat|privacy|du lieu ca nhan|thong tin ca nhan|personal data)\b/.test(n)) return 'Bảo mật'
  if (/\b(dieu khoan|terms|chinh sach|quy dinh|hoi vien|membership|bao luu|gia han|huy)\b/.test(n)) return 'Chính sách'
  return ''
}

const scoreRecord = ({ query, expandedQuery, category, item, fields, categoryFields }) => {
  const normalizedQuery = normalize(query)
  const expandedTokens = tokenize(expandedQuery)
  const queryTokens = tokenize(normalizedQuery)
  const categoryText = normalize(categoryFields.map((field) => item[field]).filter(Boolean).join(' '))
  const primaryText = normalize(fields.primary.map((field) => item[field]).filter(Boolean).join(' '))
  const bodyText = normalize(fields.body.map((field) => item[field]).filter(Boolean).join(' '))
  const allText = `${categoryText} ${primaryText} ${bodyText}`.trim()
  const normalizedCategory = normalize(category)

  let score = 0
  if (normalizedCategory && categoryText.includes(normalizedCategory)) score += 60
  if (normalizedQuery && primaryText.includes(normalizedQuery)) score += 80
  if (normalizedQuery && allText.includes(normalizedQuery)) score += 40

  for (const token of queryTokens) {
    if (categoryText.includes(token)) score += 8
    if (primaryText.includes(token)) score += 12
    if (bodyText.includes(token)) score += 4
  }

  for (const token of expandedTokens) {
    if (categoryText.includes(token)) score += 5
    if (primaryText.includes(token)) score += 7
    if (bodyText.includes(token)) score += 2
  }

  return score
}

export const searchFaqs = async ({ query = '', category = '', limit = 5 } = {}) => {
  const inferredCategory = category || inferFaqCategory(query)
  const expandedQuery = expandSupportQuery(query)
  const faqs = await Faq.find({ isPublished: true })
    .select('questionVi questionEn answerVi answerEn categoryVi categoryEn isPublished order updatedAt')
    .sort({ order: 1, createdAt: -1 })
    .limit(80)
    .lean()

  const results = faqs
    .map((faq) => ({
      id: String(faq._id),
      questionVi: faq.questionVi,
      questionEn: faq.questionEn,
      answerVi: faq.answerVi,
      answerEn: faq.answerEn,
      categoryVi: faq.categoryVi,
      categoryEn: faq.categoryEn,
      updatedAt: faq.updatedAt,
      score: scoreRecord({
        query,
        expandedQuery,
        category: inferredCategory,
        item: faq,
        fields: { primary: ['questionVi', 'questionEn'], body: ['answerVi', 'answerEn'] },
        categoryFields: ['categoryVi', 'categoryEn'],
      }),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  const matched = results[0] || null
  if (matched) {
    console.log(`[FAQ_SEARCH] query="${query}", matched="${matched.questionVi || matched.questionEn}", category="${matched.categoryVi || matched.categoryEn || ''}"`)
  } else {
    console.log(`[FAQ_SEARCH] query="${query}", matched="none", category="${inferredCategory}"`)
  }

  return {
    count: results.length,
    query,
    category: inferredCategory,
    matched,
    results,
  }
}

export const searchPolicies = async ({ query = '', category = '', limit = 5 } = {}) => {
  const inferredCategory = category || inferPolicyCategory(query)
  const expandedQuery = expandSupportQuery(query)
  const policies = await Policy.find({ isPublished: true })
    .select('titleVi titleEn slug categoryVi categoryEn contentVi contentEn isPublished updatedAt')
    .sort({ createdAt: -1 })
    .limit(80)
    .lean()

  const results = policies
    .map((policy) => ({
      id: String(policy._id),
      titleVi: policy.titleVi,
      titleEn: policy.titleEn,
      slug: policy.slug,
      categoryVi: policy.categoryVi,
      categoryEn: policy.categoryEn,
      contentVi: String(policy.contentVi || '').slice(0, 1600),
      contentEn: String(policy.contentEn || '').slice(0, 1600),
      updatedAt: policy.updatedAt,
      score: scoreRecord({
        query,
        expandedQuery,
        category: inferredCategory,
        item: policy,
        fields: { primary: ['titleVi', 'titleEn', 'slug'], body: ['contentVi', 'contentEn'] },
        categoryFields: ['categoryVi', 'categoryEn'],
      }),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  const matched = results[0] || null
  if (matched) {
    console.log(`[POLICY_SEARCH] matched="${matched.titleVi || matched.titleEn}", category="${matched.categoryVi || matched.categoryEn || ''}"`)
  } else {
    console.log(`[POLICY_SEARCH] query="${query}", matched="none", category="${inferredCategory}"`)
  }

  return {
    count: results.length,
    query,
    category: inferredCategory,
    matched,
    results,
  }
}

export const isSupportFaqQuery = (query = '') => {
  const n = normalize(query)
  return /\b(o dau|lam sao|the nao|huong dan|duoc khong|doi|quen|thay doi|dang ky|gia han|dat lich|huy lich|checkin|check in|lien he|ho tro|xem lich su|tai khoan|mat khau|email|profile|ho so|otp)\b/.test(n)
}

export const isPolicyQuery = (query = '') => {
  const n = normalize(query)
  return /\b(hoan tien|refund|thanh toan|payment|bao mat|privacy|dieu khoan|terms|chinh sach|quy dinh|bao luu|huy goi|hoi vien|membership policy)\b/.test(n)
}

export const isStrongPolicyQuery = (query = '') => {
  const n = normalize(query)
  return /\b(hoan tien|refund|bao mat|privacy|dieu khoan|terms|chinh sach|quy dinh|bao luu|huy goi|membership policy)\b/.test(n)
}

export const buildFaqPolicyAnswer = ({ faqSearch, policySearch, query = '', language = 'vi' } = {}) => {
  const lang = language === 'en' ? 'en' : 'vi'
  const faq = faqSearch?.matched || null
  const policy = policySearch?.matched || null
  const item = faq || policy
  const n = normalize(query)
  if (!item) {
    if (/\b(mat khau|password)\b/.test(n) && /\b(doi|thay doi|o dau|where)\b/.test(n)) {
      return lang === 'en'
        ? 'Go to Account -> Account & Security -> Change password.'
        : 'Bạn vào Tài khoản → Tài khoản & Bảo mật → Đổi mật khẩu.'
    }
    return null
  }

  const title = faq
    ? (lang === 'en' ? (item.questionEn || item.questionVi) : (item.questionVi || item.questionEn))
    : (lang === 'en' ? (item.titleEn || item.titleVi) : (item.titleVi || item.titleEn))
  const body = faq
    ? (lang === 'en' ? (item.answerEn || item.answerVi) : (item.answerVi || item.answerEn))
    : (lang === 'en' ? (item.contentEn || item.contentVi) : (item.contentVi || item.contentEn))

  const lines = []
  if (title) lines.push(title)
  if (body) lines.push(String(body).trim())

  if (faq && /\b(mat khau|password)\b/.test(n) && /\b(doi|thay doi|o dau|where)\b/.test(n)) {
    const nav = lang === 'en'
      ? 'If you are already logged in and want to change your password, go to Account -> Account & Security -> Change password.'
      : 'Nếu bạn đang đăng nhập và muốn đổi mật khẩu: Tài khoản → Tài khoản & Bảo mật → Đổi mật khẩu.'
    if (!normalize(lines.join(' ')).includes(normalize(nav))) lines.push(nav)
  }

  return lines.filter(Boolean).join('\n\n')
}
