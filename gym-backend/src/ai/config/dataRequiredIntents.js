// dataRequiredIntents.js
// Single source of truth for intents that REQUIRE real database data.
// Imported by: domainRouter, queryReasoner, gymProAgent, and any guard layer.
// If any of these intents is classified but the corresponding tool returns
// zero / empty / not-found data, the LLM must NOT be called to fabricate
// an answer — a safe "no data" response is returned instead.

export const DATA_REQUIRED_INTENTS = new Set([
  // ── Membership / Plan ──────────────────────────────────────
  'membership',
  'membership_list',
  'membership_detail',
  'membership_compare',
  'membership_recommendation',
  'membership_status',
  'membership_renewal',
  'membership_info',
  'membership_benefit_lookup',
  'plan_comparison',

  // ── PT / Trainer ───────────────────────────────────────────
  'pt',
  'pt_list',
  'pt_detail',
  'pt_recommendation',
  'pt_availability',
  'pt_booking',

  // ── Check-in ───────────────────────────────────────────────
  'checkin',
  'checkin_summary',
  'checkin_goal',

  // ── Booking / Schedule ─────────────────────────────────────
  'booking',
  'booking_status',
  'booking_info',
  'booking_action',
  'booking_create',
  'booking_cancel',
  'schedule',

  // ── Product / Shop ─────────────────────────────────────────
  'product',
  'product_list',
  'product_detail',
  'product_recommendation',
  'shop_advice',
  'product_advice',

  // ── Workout (data-dependent only) ──────────────────────────
  'workout_analyze',
  'workout_progress',
  'progress',

  // ── Policy / FAQ ───────────────────────────────────────────
  'policy_answer',
  'policy_refund',
  'policy_privacy',
  'policy_payment',
  'faq_answer',

  // ── Report ─────────────────────────────────────────────────
  'report',
  'report_data',
  'revenue_data',

  // ── Dashboard / Notification / Profile ─────────────────────
  'dashboard',
  'notifications',
  'member_profile',
])
