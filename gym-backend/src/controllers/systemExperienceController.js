import Faq from '../models/Faq.js'
import Feedback from '../models/Feedback.js'
import LandingContent from '../models/LandingContent.js'
import Policy from '../models/Policy.js'
import mongoose from 'mongoose'
import UserActivity from '../models/UserActivity.js'
import { recordUserActivity } from '../services/userActivityService.js'

const normalizePageId = (value) => {
  const pageId = String(value || 'home').trim().toLowerCase()
  return ['home', 'about'].includes(pageId) ? pageId : 'home'
}

const getLandingPage = async (pageId = 'home') => {
  const normalizedPageId = normalizePageId(pageId)
  let landing = await LandingContent.findOne({ pageId: normalizedPageId })

  if (!landing && normalizedPageId === 'home') {
    landing = await LandingContent.findOne({ $or: [{ pageId: { $exists: false } }, { pageId: '' }] })
    if (landing) {
      landing.pageId = 'home'
      await landing.save()
    }
  }

  if (!landing) landing = await LandingContent.create({ pageId: normalizedPageId })
  return normalizeLandingDoc(landing)
}

const slugify = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toLocalized = (value, fallback = '') => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      vi: String(value.vi || value.en || fallback || '').trim(),
      en: String(value.en || '').trim(),
    }
  }
  const text = String(value || fallback || '').trim()
  return { vi: text, en: '' }
}

const normalizeLandingPayload = (payload = {}) => {
  const next = { ...payload }
  ;[
    'heroTitle', 'heroSubtitle', 'heroBadgeText', 'ctaText', 'secondaryCtaText',
    'servicesEyebrow', 'servicesTitle', 'testimonialsEyebrow', 'testimonialsTitle',
    'finalCtaTitle', 'finalCtaSubtitle', 'finalCtaPrimaryText', 'finalCtaSecondaryText',
    'aboutTitle', 'aboutContent',
  ].forEach((key) => {
    if (next[key] !== undefined) next[key] = toLocalized(next[key])
  })
  if (Array.isArray(next.sections)) {
    next.sections = next.sections.map((section) => ({
      ...section,
      title: toLocalized(section?.title),
      content: toLocalized(section?.content),
    }))
  }
  if (Array.isArray(next.stats)) {
    next.stats = next.stats.map((item) => ({ ...item, label: toLocalized(item?.label) }))
  }
  if (Array.isArray(next.services)) {
    next.services = next.services.map((item) => ({
      ...item,
      title: toLocalized(item?.title),
      description: toLocalized(item?.description || item?.desc),
      link: item?.link || item?.path || '',
    }))
  }
  if (Array.isArray(next.testimonials)) {
    next.testimonials = next.testimonials.map((item) => ({
      ...item,
      content: toLocalized(item?.content || item?.quote),
      userName: item?.userName || item?.name || '',
      userSubtitle: toLocalized(item?.userSubtitle || item?.duration),
    }))
  }
  return next
}

const normalizeLandingDoc = async (landing) => {
  if (!landing) return landing
  let changed = false
  ;[
    'heroTitle', 'heroSubtitle', 'heroBadgeText', 'ctaText', 'secondaryCtaText',
    'servicesEyebrow', 'servicesTitle', 'testimonialsEyebrow', 'testimonialsTitle',
    'finalCtaTitle', 'finalCtaSubtitle', 'finalCtaPrimaryText', 'finalCtaSecondaryText',
    'aboutTitle', 'aboutContent',
  ].forEach((key) => {
    if (typeof landing[key] === 'string') {
      landing[key] = toLocalized(landing[key])
      changed = true
    }
  })
  if (Array.isArray(landing.sections)) {
    landing.sections.forEach((section) => {
      if (typeof section.title === 'string') {
        section.title = toLocalized(section.title)
        changed = true
      }
      if (typeof section.content === 'string') {
        section.content = toLocalized(section.content)
        changed = true
      }
    })
  }
  if (Array.isArray(landing.stats)) {
    landing.stats.forEach((item) => {
      if (typeof item.label === 'string') { item.label = toLocalized(item.label); changed = true }
    })
  }
  if (Array.isArray(landing.services)) {
    landing.services.forEach((item) => {
      if (typeof item.title === 'string') { item.title = toLocalized(item.title); changed = true }
      if (typeof item.description === 'string') { item.description = toLocalized(item.description); changed = true }
    })
  }
  if (Array.isArray(landing.testimonials)) {
    landing.testimonials.forEach((item) => {
      if (typeof item.content === 'string') { item.content = toLocalized(item.content); changed = true }
      if (typeof item.userSubtitle === 'string') { item.userSubtitle = toLocalized(item.userSubtitle); changed = true }
    })
  }
  if (changed) await landing.save()
  return landing
}

export const getLandingContent = async (_req, res) => {
  const landing = await getLandingPage('home')
  res.json({ landing })
}

export const updateLandingContent = async (req, res) => {
  const landing = await getLandingPage('home')
  const payload = normalizeLandingPayload(req.body)
  const allowed = [
    'heroTitle', 'heroSubtitle', 'heroBadgeText', 'heroImageUrl', 'ctaText', 'ctaLink', 'secondaryCtaText', 'secondaryCtaLink',
    'stats', 'servicesEyebrow', 'servicesTitle', 'services', 'testimonialsEyebrow', 'testimonialsTitle', 'testimonials',
    'finalCtaTitle', 'finalCtaSubtitle', 'finalCtaPrimaryText', 'finalCtaPrimaryLink', 'finalCtaSecondaryText', 'finalCtaSecondaryLink',
    'aboutTitle', 'aboutContent', 'sections',
  ]
  allowed.forEach((key) => {
    if (payload[key] !== undefined) landing[key] = payload[key]
  })
  await landing.save()

  res.json({ message: 'Cập nhật landing CMS thành công', landing })
}

export const getCmsPage = async (req, res) => {
  const pageId = normalizePageId(req.params.pageId)
  const landing = await getLandingPage(pageId)
  res.json({ pageId, landing })
}

export const updateCmsPage = async (req, res) => {
  const pageId = normalizePageId(req.params.pageId)
  const landing = await getLandingPage(pageId)
  const payload = normalizeLandingPayload(req.body)
  const allowed = [
    'heroTitle', 'heroSubtitle', 'heroBadgeText', 'heroImageUrl', 'ctaText', 'ctaLink', 'secondaryCtaText', 'secondaryCtaLink',
    'stats', 'servicesEyebrow', 'servicesTitle', 'services', 'testimonialsEyebrow', 'testimonialsTitle', 'testimonials',
    'finalCtaTitle', 'finalCtaSubtitle', 'finalCtaPrimaryText', 'finalCtaPrimaryLink', 'finalCtaSecondaryText', 'finalCtaSecondaryLink',
    'aboutTitle', 'aboutContent', 'sections',
  ]
  landing.pageId = pageId
  allowed.forEach((key) => {
    if (payload[key] !== undefined) landing[key] = payload[key]
  })
  await landing.save()

  res.json({ message: 'Cập nhật landing CMS thành công', pageId, landing })
}

const getLangField = (base) => (lang) => lang === 'en' ? `${base}En` : `${base}Vi`

export const getFaqs = async (req, res) => {
  const { search = '', category = '', categoryVi = '', categoryEn = '', includeHidden = 'false', lang = '' } = req.query
  const filter = {}
  if (req.user?.role !== 'admin' || includeHidden !== 'true') filter.isPublished = true
  if (categoryVi) filter.categoryVi = categoryVi
  if (categoryEn) filter.categoryEn = categoryEn
  const orConditions = []
  if (category && !categoryVi && !categoryEn) {
    orConditions.push(
      { categoryVi: category },
      { categoryEn: category },
    )
  }
  if (search) {
    const qf = getLangField('question')(lang)
    const af = getLangField('answer')(lang)
    orConditions.push(
      { [qf]: { $regex: search, $options: 'i' } },
      { [af]: { $regex: search, $options: 'i' } },
    )
  }
  if (orConditions.length > 0) filter.$or = orConditions
  const faqs = await Faq.find(filter).sort({ order: 1, createdAt: -1 })
  res.json({ faqs })
}

export const getFaqById = async (req, res) => {
  const filter = { _id: req.params.id }
  if (!['admin', 'super_admin'].includes(req.user?.role)) filter.isPublished = true
  const faq = await Faq.findOne(filter)
  if (!faq) return res.status(404).json({ message: 'Không tìm thấy FAQ' })
  res.json({ faq })
}

export const createFaq = async (req, res) => {
  const faq = await Faq.create(req.body)

  res.status(201).json({ message: 'Tạo FAQ thành công', faq })
}

export const updateFaq = async (req, res) => {
  const faq = await Faq.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
  if (!faq) return res.status(404).json({ message: 'Không tìm thấy FAQ' })

  res.json({ message: 'Cập nhật FAQ thành công', faq })
}

export const deleteFaq = async (req, res) => {
  const faq = await Faq.findByIdAndDelete(req.params.id)
  if (!faq) return res.status(404).json({ message: 'Không tìm thấy FAQ' })

  res.json({ message: 'Xóa FAQ thành công' })
}

export const getPolicies = async (req, res) => {
  const { search = '', category = '', categoryVi = '', categoryEn = '', includeHidden = 'false', lang = '' } = req.query
  const filter = req.user?.role === 'admin' && includeHidden === 'true' ? {} : { isPublished: true }
  if (categoryVi) filter.categoryVi = categoryVi
  if (categoryEn) filter.categoryEn = categoryEn
  const orConditions = []
  if (category && !categoryVi && !categoryEn) {
    orConditions.push(
      { categoryVi: category },
      { categoryEn: category },
    )
  }
  if (search) {
    const tf = getLangField('title')(lang)
    const cf = getLangField('content')(lang)
    orConditions.push(
      { [tf]: { $regex: search, $options: 'i' } },
      { [cf]: { $regex: search, $options: 'i' } },
    )
  }
  if (orConditions.length > 0) filter.$or = orConditions
  const policies = await Policy.find(filter).sort({ createdAt: -1 })
  res.json({ policies })
}

export const getPolicyBySlug = async (req, res) => {
  const key = req.params.slug
  const filter = mongoose.Types.ObjectId.isValid(key) ? { _id: key } : { slug: key }
  if (!['admin', 'super_admin'].includes(req.user?.role)) filter.isPublished = true
  const policy = await Policy.findOne(filter)
  if (!policy) return res.status(404).json({ message: 'Không tìm thấy chính sách' })
  res.json({ policy })
}

export const createPolicy = async (req, res) => {
  const slug = req.body.slug || slugify(req.body.titleVi || req.body.titleEn)
  const policy = await Policy.create({ ...req.body, slug })
  res.status(201).json({ message: 'Tạo chính sách thành công', policy })
}

const bumpVersion = (currentVersion) => {
  const parts = String(currentVersion || '1.0').split('.')
  const major = parseInt(parts[0], 10) || 1
  const minor = parseInt(parts[1], 10) || 0
  return `${major}.${minor + 1}`
}

export const updatePolicy = async (req, res) => {
  const payload = { ...req.body }
  if ((payload.titleVi || payload.titleEn) && !payload.slug) payload.slug = slugify(payload.titleVi || payload.titleEn)

  const existingPolicy = await Policy.findById(req.params.id)
  if (!existingPolicy) return res.status(404).json({ message: 'Không tìm thấy chính sách' })

  const contentChanged =
    (payload.contentVi !== undefined && payload.contentVi !== existingPolicy.contentVi) ||
    (payload.contentEn !== undefined && payload.contentEn !== existingPolicy.contentEn)

  if (contentChanged && !payload.version) {
    payload.version = bumpVersion(existingPolicy.version)
  }

  const policy = await Policy.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true })
  res.json({ message: 'Cập nhật chính sách thành công', policy })
}

export const deletePolicy = async (req, res) => {
  const policy = await Policy.findByIdAndDelete(req.params.id)
  if (!policy) return res.status(404).json({ message: 'Không tìm thấy chính sách' })
  res.json({ message: 'Xóa chính sách thành công' })
}

export const createFeedback = async (req, res) => {
  const { title, content, type = 'suggestion', priority = 'medium' } = req.body
  if (!title || !content) return res.status(400).json({ message: 'Tiêu đề và nội dung là bắt buộc' })
  const attachments = (req.files || []).map((file) => ({
    url: file.path,
    publicId: file.filename || '',
    type: 'image',
  }))
  const feedback = await Feedback.create({ user: req.user._id, title, content, type, priority, attachments })
  await recordUserActivity({
    userId: req.user._id,
    type: 'feedback',
    title: 'Gửi góp ý hệ thống',
    description: title,
    metadata: { feedbackId: feedback._id },
  })
  res.status(201).json({ message: 'Đã gửi góp ý', feedback })
}

export const getMyFeedback = async (req, res) => {
  const feedback = await Feedback.find({ user: req.user._id }).sort({ createdAt: -1 })
  res.json({ feedback })
}

export const getAllFeedback = async (req, res) => {
  const { status = '', type = '' } = req.query
  const filter = {}
  if (status) filter.status = status
  if (type) filter.type = type
  const feedback = await Feedback.find(filter).populate('user', 'name email phone').sort({ createdAt: -1 })
  res.json({ feedback })
}

export const updateFeedbackStatus = async (req, res) => {
  const { status, adminReply } = req.body
  const feedback = await Feedback.findById(req.params.id)
  if (!feedback) return res.status(404).json({ message: 'Không tìm thấy feedback' })
  if (status) feedback.status = status
  if (adminReply !== undefined) feedback.adminReply = adminReply
  await feedback.save()
  res.json({ message: 'Cập nhật feedback thành công', feedback })
}

export const getMyActivity = async (req, res) => {
  const activities = await UserActivity.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100)
  res.json({ activities })
}
