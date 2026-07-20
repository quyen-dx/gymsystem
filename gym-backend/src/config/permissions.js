/**
 * RBAC Permission Registry
 *
 * Mirrors docs/PERMISSION_MATRIX.md exactly.
 * Role values match User model role enum: super_admin | admin | pt | staff | member | seller
 * Guest is not stored (unauthenticated) — excluded from all permission rows.
 *
 * Each key under a resource maps to the exact action label from PERMISSION_MATRIX.md.
 * No role hierarchy — a role has a permission only if it is explicitly listed.
 */

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  PT: 'pt',
  STAFF: 'staff',
  MEMBER: 'member',
  SELLER: 'seller',
})

const S = ROLES.SUPER_ADMIN
const A = ROLES.ADMIN
const P = ROLES.PT
const ST = ROLES.STAFF
const M = ROLES.MEMBER
const SE = ROLES.SELLER

/**
 * Permission table — one entry per (resource, action) pair.
 *
 * Structure:
 *   PERMISSIONS[resource][action] = [...roles]
 *
 * Resource and action names mirror PERMISSION_MATRIX.md row/column labels.
 * Normalised to snake_case for safe key access; semantics are 1:1.
 */
export const PERMISSIONS = Object.freeze({
  // ── Resource: User Management ──────────────────────────────────────
  user: Object.freeze({
    view_own: Object.freeze([M, P, ST, SE, A, S]),
    view_any: Object.freeze([P, ST, A, S]),
    create: Object.freeze([ST, A, S]),
    update_own: Object.freeze([M, P, ST, SE, A, S]),
    update_any: Object.freeze([A, S]),
    delete: Object.freeze([S]),
    assign_role: Object.freeze([S]),
  }),

  // ── Resource: Membership ───────────────────────────────────────────
  membership: Object.freeze({
    view_own: Object.freeze([M, P, A, S]),
    view_any: Object.freeze([ST, A, S]),
    create: Object.freeze([ST, A, S]),
    update_any: Object.freeze([A, S]),
    delete: Object.freeze([S]),
    cancel_own: Object.freeze([M, A, S]),
    cancel_any: Object.freeze([A, S]),
    freeze_own: Object.freeze([M, A, S]),
    approve_freeze: Object.freeze([A, S]),
    process_refund: Object.freeze([A, S]),
  }),

  // ── Resource: Booking ──────────────────────────────────────────────
  booking: Object.freeze({
    view_own: Object.freeze([M, P, A, S]),
    view_assigned: Object.freeze([P, A, S]),
    view_all: Object.freeze([ST, A, S]),
    create: Object.freeze([M, ST, A, S]),
    confirm_reject: Object.freeze([P, A, S]),
    cancel_own: Object.freeze([M, P, A, S]),
    cancel_any: Object.freeze([ST, A, S]),
    mark_noshow: Object.freeze([P, A, S]),
  }),

  // ── Resource: Check-in ─────────────────────────────────────────────
  checkin: Object.freeze({
    view_own: Object.freeze([M, A, S]),
    view_any: Object.freeze([ST, A, S]),
    create: Object.freeze([M, ST, A, S]),
    manual: Object.freeze([ST, A, S]),
  }),

  // ── Resource: Workout ──────────────────────────────────────────────
  workout: Object.freeze({
    view_own: Object.freeze([M, A, S]),
    view_assigned: Object.freeze([P, A, S]),
    create_own: Object.freeze([M, A, S]),
    create_for_member: Object.freeze([P, A, S]),
    update_own: Object.freeze([M, A, S]),
    update_any: Object.freeze([P, A, S]),
    delete_own: Object.freeze([M, A, S]),
  }),

  // ── Resource: Payment ──────────────────────────────────────────────
  payment: Object.freeze({
    view_own: Object.freeze([M, P, SE, A, S]),
    view_all: Object.freeze([A, S]),
    create: Object.freeze([M]),
    process_refund: Object.freeze([A, S]),
    view_revenue: Object.freeze([P, SE, A, S]),
    export_financials: Object.freeze([A, S]),
  }),

  // ── Resource: Wallet ───────────────────────────────────────────────
  wallet: Object.freeze({
    view_own: Object.freeze([M, P, SE, A, S]),
    view_all: Object.freeze([A, S]),
    deposit: Object.freeze([M, P, SE, A, S]),
    withdraw: Object.freeze([M, P, SE]),
    transfer: Object.freeze([M, P, SE]),
    manual_adjust: Object.freeze([A, S]),
  }),

  // ── Resource: Shop & Products ──────────────────────────────────────
  shop: Object.freeze({
    browse: Object.freeze([M, P, ST, SE, A, S]),
    view_own_products: Object.freeze([SE, A, S]),
    create_products: Object.freeze([SE, A, S]),
    update_own_products: Object.freeze([SE, A, S]),
    delete_own_products: Object.freeze([SE, A, S]),
    approve_products: Object.freeze([A, S]),
    view_own_orders: Object.freeze([M, SE, A, S]),
    view_all_orders: Object.freeze([A, S]),
    process_shipping: Object.freeze([SE, A, S]),
    process_returns: Object.freeze([A, S]),
    manage_categories: Object.freeze([A, S]),
  }),

  // ── Resource: Schedule ─────────────────────────────────────────────
  schedule: Object.freeze({
    view_own: Object.freeze([P, A, S]),
    view_all: Object.freeze([M, P, ST, A, S]),
    create_own: Object.freeze([P, A, S]),
    create_any: Object.freeze([ST, A, S]),
    update_own: Object.freeze([P, A, S]),
    update_any: Object.freeze([ST, A, S]),
  }),

  // ── Resource: System Settings ──────────────────────────────────────
  settings: Object.freeze({
    view: Object.freeze([A, S]),
    update: Object.freeze([S]),
    view_logs: Object.freeze([A, S]),
  }),

  // ── Resource: Notifications ────────────────────────────────────────
  notification: Object.freeze({
    view_own: Object.freeze([M, P, ST, SE, A, S]),
    view_all: Object.freeze([A, S]),
    send: Object.freeze([A, S]),
    configure_templates: Object.freeze([A, S]),
  }),

  // ── Resource: Reports & Analytics ──────────────────────────────────
  report: Object.freeze({
    view_personal: Object.freeze([M, P, SE, A, S]),
    view_gym: Object.freeze([A, S]),
    export: Object.freeze([A, S]),
    view_financial: Object.freeze([A, S]),
  }),

  // ── Resource: Content ──────────────────────────────────────────────
  content: Object.freeze({
    view_public: Object.freeze([M, P, ST, SE, A, S]),
    create: Object.freeze([A, S]),
    update: Object.freeze([A, S]),
    delete: Object.freeze([A, S]),
  }),

  // ── Resource: AI Assistant ─────────────────────────────────────────
  ai: Object.freeze({
    chat: Object.freeze([M, P, ST, SE, A, S]),
    view_history: Object.freeze([M, P, ST, SE, A, S]),
    admin_override: Object.freeze([A, S]),
  }),
})

/**
 * Check whether a role is permitted to perform an action on a resource.
 *
 * @param {string} role       - User role from User model enum
 * @param {string} resource   - Resource key (e.g. 'user', 'membership')
 * @param {string} action     - Action key (e.g. 'view_own', 'delete')
 * @returns {boolean}
 */
export const can = (role, resource, action) => {
  const resourcePermissions = PERMISSIONS[resource]
  if (!resourcePermissions) return false

  const allowedRoles = resourcePermissions[action]
  if (!allowedRoles) return false

  return allowedRoles.includes(role)
}

/**
 * Return the list of roles allowed to perform an action on a resource.
 *
 * @param {string} resource
 * @param {string} action
 * @returns {string[] | null}
 */
export const getAllowedRoles = (resource, action) => {
  return PERMISSIONS[resource]?.[action] ?? null
}

/**
 * Return all actions defined for a resource.
 *
 * @param {string} resource
 * @returns {string[]}
 */
export const getResourceActions = (resource) => {
  const actions = PERMISSIONS[resource]
  return actions ? Object.keys(actions) : []
}

/**
 * Validate that a resource + action pair is defined in the matrix.
 *
 * @param {string} resource
 * @param {string} action
 * @returns {boolean}
 */
export const isValidPermission = (resource, action) => {
  return can(ROLES.SUPER_ADMIN, resource, action) || can(ROLES.ADMIN, resource, action) || can(ROLES.MEMBER, resource, action)
}

export default PERMISSIONS
