// responsePlanner.js
// Detects response style from query + intent and returns structure/tone config.
// This layer sits between tool result and answer builder.
// It ONLY changes presentation — never adds factual data.

export const STYLES = {
  // ── Nutrition styles ─────────────────────────────────────────
  NUTRITION_FOOD_LIST: 'nutrition_food_list',
  NUTRITION_STEP_BY_STEP: 'nutrition_step_by_step',
  NUTRITION_MEAL_PLAN: 'nutrition_meal_plan',
  NUTRITION_EXPLANATION: 'nutrition_explanation',

  // ── Workout styles ───────────────────────────────────────────
  WORKOUT_SCHEDULE: 'workout_schedule',
  WORKOUT_EXERCISE: 'workout_exercise',
  WORKOUT_EXPLANATION: 'workout_explanation',

  // ── General styles ───────────────────────────────────────────
  GENERAL_STEP_BY_STEP: 'general_step_by_step',
  GENERAL_EXPLANATION: 'general_explanation',
}

// ── Style detection for nutrition queries ──────────────────────

// Normalize Vietnamese text for matching (remove accents, lowercase)
const n = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase()

const NUTRITION_FOOD_KEYWORDS = /\b(an gi|nen an|mon nao|thuc pham nao|do an|thuc an)\b/
const NUTRITION_STEP_KEYWORDS = /\b(lam sao|lam the nao|cach|cac buoc|huong dan)\b/
const NUTRITION_MEAL_KEYWORDS = /\b(thuc don|menu|bua an|bua|bua sang|bua trua|bua toi|bua phu)\b/

const detectNutritionStyle = (query = '', goal = null) => {
  const normalized = n(query)
  // Meal plan keywords always override (goal-independent)
  if (NUTRITION_MEAL_KEYWORDS.test(normalized)) return STYLES.NUTRITION_MEAL_PLAN
  // If goal is explicitly set, use goal-based style:
  // - "làm sao/cách" → step_by_step
  // - default → food_list (shows foods for that goal)
  if (goal) {
    if (NUTRITION_STEP_KEYWORDS.test(normalized)) return STYLES.NUTRITION_STEP_BY_STEP
    return STYLES.NUTRITION_FOOD_LIST
  }
  // No goal → keyword-based fallback
  if (NUTRITION_FOOD_KEYWORDS.test(normalized)) return STYLES.NUTRITION_FOOD_LIST
  if (NUTRITION_STEP_KEYWORDS.test(normalized)) return STYLES.NUTRITION_STEP_BY_STEP
  return STYLES.NUTRITION_EXPLANATION
}

// ── Style detection for workout queries ────────────────────────

const WORKOUT_SCHEDULE_KEYWORDS = /\b(lich tap|ke hoach|giao an|buoi moi tuan|chia lich|workout plan)\b/
const WORKOUT_EXERCISE_KEYWORDS = /\b(bai tap|dong tac|tap gi|workout|exercise|ky thuat|form)\b/

const detectWorkoutStyle = (query = '') => {
  const normalized = n(query)
  if (WORKOUT_SCHEDULE_KEYWORDS.test(normalized)) return STYLES.WORKOUT_SCHEDULE
  if (WORKOUT_EXERCISE_KEYWORDS.test(normalized)) return STYLES.WORKOUT_EXERCISE
  return STYLES.WORKOUT_EXPLANATION
}

// ── Domain safety rules ────────────────────────────────────────
// These domains MUST use deterministic templates, not creative styles.

const DETERMINISTIC_ONLY = new Set([
  'membership_status',
  'membership_detail',
  'membership_list',
  'membership_compare',
  'membership_renewal',
  'booking_status',
  'booking_info',
  'booking_action',
  'checkin_summary',
  'checkin_goal',
  'payment',
])

export const isDeterministicOnly = (intent) => DETERMINISTIC_ONLY.has(intent)

// ── Main planner ───────────────────────────────────────────────

export const planResponseStyle = ({ intent = '', subject = '', query = '', goal = null } = {}) => {
  // Deterministic domains always return 'deterministic' style
  if (isDeterministicOnly(intent)) {
    return { style: 'deterministic', structure: ['factual_answer'] }
  }

  if (subject === 'nutrition' || intent.startsWith('nutrition_')) {
    const style = detectNutritionStyle(query, goal)
    const structures = {
      [STYLES.NUTRITION_FOOD_LIST]: ['short_answer', 'food_categories', 'practical_tip'],
      [STYLES.NUTRITION_STEP_BY_STEP]: ['short_explanation', 'steps', 'notes'],
      [STYLES.NUTRITION_MEAL_PLAN]: ['meals', 'goal_note'],
      [STYLES.NUTRITION_EXPLANATION]: ['explanation', 'key_points', 'practical_tip'],
    }
    return { style, structure: structures[style] || ['explanation'] }
  }

  if (subject === 'workout' || intent.startsWith('workout_')) {
    const style = detectWorkoutStyle(query)
    const structures = {
      [STYLES.WORKOUT_SCHEDULE]: ['plan_name', 'sessions', 'exercises', 'recovery_note'],
      [STYLES.WORKOUT_EXERCISE]: ['explanation', 'technique_tips', 'safety_notes'],
      [STYLES.WORKOUT_EXPLANATION]: ['explanation', 'key_points', 'tip'],
    }
    return { style, structure: structures[style] || ['explanation'] }
  }

  return { style: 'deterministic', structure: ['factual_answer'] }
}
