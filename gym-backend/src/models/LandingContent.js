import mongoose from 'mongoose'

const localizedTextSchema = new mongoose.Schema(
  {
    vi: { type: String, default: '', trim: true },
    en: { type: String, default: '', trim: true },
  },
  { _id: false },
)

const landingSectionSchema = new mongoose.Schema(
  {
    title: { type: localizedTextSchema, default: () => ({ vi: '', en: '' }) },
    content: { type: localizedTextSchema, default: () => ({ vi: '', en: '' }) },
    imageUrl: { type: String, default: '', trim: true },
    order: { type: Number, default: 0 },
  },
  { _id: true },
)

const statSchema = new mongoose.Schema(
  {
    value: { type: String, default: '', trim: true },
    label: { type: localizedTextSchema, default: () => ({ vi: '', en: '' }) },
    order: { type: Number, default: 0 },
  },
  { _id: true },
)

const serviceCardSchema = new mongoose.Schema(
  {
    icon: { type: String, default: '•', trim: true },
    title: { type: localizedTextSchema, default: () => ({ vi: '', en: '' }) },
    description: { type: localizedTextSchema, default: () => ({ vi: '', en: '' }) },
    link: { type: String, default: '', trim: true },
    color: { type: String, default: '#e05a30', trim: true },
    order: { type: Number, default: 0 },
  },
  { _id: true },
)

const testimonialSchema = new mongoose.Schema(
  {
    rating: { type: Number, default: 5, min: 1, max: 5 },
    content: { type: localizedTextSchema, default: () => ({ vi: '', en: '' }) },
    userName: { type: String, default: '', trim: true },
    userSubtitle: { type: localizedTextSchema, default: () => ({ vi: '', en: '' }) },
    avatar: { type: String, default: '', trim: true },
    order: { type: Number, default: 0 },
  },
  { _id: true },
)

const landingContentSchema = new mongoose.Schema(
  {
    pageId: { type: String, default: 'home', trim: true, index: true },
    heroTitle: { type: localizedTextSchema, default: () => ({ vi: 'GymPro', en: 'GymPro' }) },
    heroSubtitle: { type: localizedTextSchema, default: () => ({ vi: 'Quản lý hành trình luyện tập hiện đại.', en: 'Manage your modern fitness journey.' }) },
    heroBadgeText: { type: localizedTextSchema, default: () => ({ vi: 'Hệ thống quản lý gym chuyên nghiệp', en: 'Professional Gym Management System' }) },
    heroImageUrl: { type: String, default: '', trim: true },
    ctaText: { type: localizedTextSchema, default: () => ({ vi: 'Bắt đầu ngay', en: 'Get Started' }) },
    ctaLink: { type: String, default: '/booking', trim: true },
    secondaryCtaText: { type: localizedTextSchema, default: () => ({ vi: 'Điểm danh ngay', en: 'Check-in Now' }) },
    secondaryCtaLink: { type: String, default: '/checkin', trim: true },
    stats: { type: [statSchema], default: [] },
    servicesEyebrow: { type: localizedTextSchema, default: () => ({ vi: 'Dịch vụ & tiện ích', en: 'Services & Utilities' }) },
    servicesTitle: { type: localizedTextSchema, default: () => ({ vi: 'MỌI THỨ BẠN CẦN', en: 'EVERYTHING YOU NEED' }) },
    services: { type: [serviceCardSchema], default: [] },
    testimonialsEyebrow: { type: localizedTextSchema, default: () => ({ vi: 'Thành viên nói gì', en: 'What Members Say' }) },
    testimonialsTitle: { type: localizedTextSchema, default: () => ({ vi: 'ĐƯỢC TIN TƯỞNG', en: 'TRUSTED BY MANY' }) },
    testimonials: { type: [testimonialSchema], default: [] },
    finalCtaTitle: { type: localizedTextSchema, default: () => ({ vi: 'BẮT ĐẦU\nHÀNH TRÌNH', en: 'START YOUR\nJOURNEY' }) },
    finalCtaSubtitle: { type: localizedTextSchema, default: () => ({ vi: '{{firstName}}, lịch tập tiếp theo của bạn đã sẵn sàng để được chinh phục.', en: '{{firstName}}, your next workout is ready to be conquered.' }) },
    finalCtaPrimaryText: { type: localizedTextSchema, default: () => ({ vi: 'Đặt lịch PT ngay', en: 'Book a PT Session' }) },
    finalCtaPrimaryLink: { type: String, default: '/booking', trim: true },
    finalCtaSecondaryText: { type: localizedTextSchema, default: () => ({ vi: 'Xem sức khoẻ', en: 'View Health' }) },
    finalCtaSecondaryLink: { type: String, default: '/health', trim: true },
    aboutTitle: { type: localizedTextSchema, default: () => ({ vi: 'Về GymPro', en: 'About GymPro' }) },
    aboutContent: { type: localizedTextSchema, default: () => ({ vi: '', en: '' }) },
    sections: { type: [landingSectionSchema], default: [] },
  },
  { timestamps: true },
)

export default mongoose.model('LandingContent', landingContentSchema)
