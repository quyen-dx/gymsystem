// sourceRouter.js
// Determines which data sources are allowed for a query.
// This is a policy layer — it never fetches data itself.

// ── INTENTS THAT REQUIRE GYMPRO DATABASE ──────────────────────
// These intents MUST use GymPro internal data. Web/LLM knowledge
// is NOT allowed to replace or supplement database results.

const GYMPRO_ONLY_INTENTS = new Set([
  // Membership
  'membership_status',
  'membership_detail',
  'membership_list',
  'membership_compare',
  'membership_recommendation',
  'membership_renewal',
  'membership_info',
  'membership_benefit_lookup',
  // PT (data lookups only)
  'pt_list',
  'pt_detail',
  'pt_recommendation',
  'pt_availability',
  'pt_booking',
  // Booking
  'booking_status',
  'booking_info',
  'booking_action',
  'booking_create',
  'booking_cancel',
  // Check-in
  'checkin_summary',
  'checkin_goal',
  // Product
  'product_list',
  'product_detail',
  'product_recommendation',
  'shop_advice',
  'product_advice',
  // Payment / Profile / Report
  'member_profile',
  'dashboard',
  'notifications',
  'report_data',
  'revenue_data',
  // Policy / FAQ (from DB)
  'policy_answer',
  'policy_refund',
  'policy_privacy',
  'policy_payment',
  'faq_answer',
])

// ── INTENTS THAT ALLOW WEB SEARCH ─────────────────────────────
// These intents are about general fitness knowledge.
// Answers may use web search results or LLM knowledge.
// MUST NOT contain GymPro-specific data (prices, plans, PTs, etc.).

const WEB_ALLOWED_INTENTS = new Set([
  'nutrition_advice',
  'nutrition_meal_plan',
  'nutrition_macro',
  'nutrition_pre_workout',
  'nutrition_post_workout',
  'pt_advice',
  'workout_advice',
  'workout_plan',
  'workout_safety',
  'workout_exercise_detail',
  'health_advice',
  'web_fitness_knowledge',
])

// ── SUBJECT-BASED POLICY ──────────────────────────────────────
// Fallback when intent is not explicitly classified.

const GYMPRO_ONLY_SUBJECTS = new Set([
  'plan', 'membership', 'pt', 'booking', 'checkin',
  'product', 'shop', 'policy', 'faq', 'report', 'account',
])

const WEB_ALLOWED_SUBJECTS = new Set([
  'nutrition', 'workout', 'health',
])

// ── GYMPRO FACT DETECTION ─────────────────────────────────────
// Patterns that indicate GymPro-specific data in a query.
// If detected, the query MUST use GymPro database.

const GYMPRO_ENTITY_PATTERNS = [
  /\b(gói|gói tập|membership|plan)\b/i,
  /\b(pt|huấn luyện viên|trainer)\b/i,
  /\b(checkin|điểm danh)\b/i,
  /\b(lịch|booking|đặt lịch)\b/i,
  /\b(sản phẩm|shop|whey|creatine)\b/i,
  /\b(chính sách|policy|faq)\b/i,
  /\b(doanh thu|báo cáo|report)\b/i,
  /\b(tài khoản|account|profile|mật khẩu)\b/i,
]

const hasGymProEntities = (query = '') =>
  GYMPRO_ENTITY_PATTERNS.some((p) => p.test(query))

// ── MAIN SOURCE ROUTER ────────────────────────────────────────

export const SOURCE_LABELS = {
  gympro_only: { sourceType: 'gympro', label: 'Dữ liệu hệ thống GymPro' },
  web_allowed: { sourceType: 'external', label: 'Thông tin tham khảo' },
}

export const getSourceMeta = ({ intent = '', subject = '', query = '' } = {}) => {
  const resolved = resolveSource({ intent, subject, query })
  return SOURCE_LABELS[resolved.source] || SOURCE_LABELS.gympro_only
}

export const resolveSource = ({ intent = '', subject = '', query = '' } = {}) => {
  // Rule 1: Explicit gympro_only intents
  if (GYMPRO_ONLY_INTENTS.has(intent)) {
    return { source: 'gympro_only', allowedDatabases: ['gympro_db'], allowWeb: false }
  }

  // Rule 2: If query mentions GymPro entities (plan names, PT, pricing, etc.),
  // force gympro_only even if the intent is web_allowed.
  // e.g. "Tôi dùng gói Basic thì nên ăn gì" → must use database for "Basic"
  if (hasGymProEntities(query)) {
    return { source: 'gympro_only', allowedDatabases: ['gympro_db'], allowWeb: false }
  }

  // Rule 3: Explicit web_allowed intents
  if (WEB_ALLOWED_INTENTS.has(intent)) {
    return { source: 'web_allowed', allowedDatabases: ['web_knowledge'], allowWeb: true }
  }

  // Rule 4: Subject-based fallback
  if (GYMPRO_ONLY_SUBJECTS.has(subject)) {
    return { source: 'gympro_only', allowedDatabases: ['gympro_db'], allowWeb: false }
  }
  if (WEB_ALLOWED_SUBJECTS.has(subject)) {
    return { source: 'web_allowed', allowedDatabases: ['web_knowledge'], allowWeb: true }
  }

  // Default: general knowledge
  return { source: 'web_allowed', allowedDatabases: ['web_knowledge'], allowWeb: true }
}
