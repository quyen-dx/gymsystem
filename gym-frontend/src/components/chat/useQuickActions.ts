import { useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useLocation } from 'react-router-dom'

export interface QuickAction {
  label: string
  route: string
  variant?: 'primary' | 'secondary'
}

// ─── Role-based intent → action mapping ───

type ActionSet = { label: string; route: string; priority: number }[]

const MEMBER_ACTIONS: Record<string, ActionSet> = {
  plans: [
    { label: 'Gói của tôi', route: '/my-membership', priority: 1 },
    { label: 'So sánh gói', route: '/plans', priority: 2 },
    { label: 'Đăng ký gói', route: '/plans', priority: 3 },
    { label: 'Liên hệ', route: '/help', priority: 5 },
  ],
  membership: [
    { label: 'Gói của tôi', route: '/my-membership', priority: 1 },
    { label: 'Gia hạn', route: '/my-membership/renew', priority: 2 },
    { label: 'Nâng cấp gói', route: '/plans', priority: 3 },
    { label: 'Liên hệ', route: '/help', priority: 5 },
  ],
  wallet: [
    { label: 'Nạp tiền', route: '/deposit', priority: 1 },
    { label: 'Gói của tôi', route: '/my-membership', priority: 2 },
    { label: 'Hoạt động', route: '/my-activity', priority: 3 },
  ],
  pt_my: [
    { label: 'Lịch tập', route: '/booking', priority: 1 },
    { label: 'Gói của tôi', route: '/my-membership', priority: 3 },
  ],
  pt_general: [
    { label: 'Đặt PT 1-1', route: '/booking', priority: 1 },
    { label: 'Đăng ký PT nhóm', route: '/booking', priority: 2 },
  ],
  booking: [
    { label: 'Đặt lịch tập', route: '/booking', priority: 1 },
    { label: 'Lịch của tôi', route: '/booking', priority: 2 },
  ],
  no_membership: [
    { label: 'Xem gói tập', route: '/plans', priority: 1 },
    { label: 'Đăng ký', route: '/plans', priority: 2 },
    { label: 'Liên hệ', route: '/help', priority: 4 },
  ],
  member_default: [
    { label: 'Gói của tôi', route: '/my-membership', priority: 1 },
    { label: 'Check-in', route: '/checkin', priority: 2 },
    { label: 'Trợ giúp', route: '/help', priority: 3 },
  ],
}

const PT_ACTIONS: Record<string, ActionSet> = {
  students: [
    { label: 'Học viên của tôi', route: '/pt/students', priority: 1 },
    { label: 'Lịch làm việc', route: '/pt/schedule', priority: 2 },
    { label: 'Giáo án', route: '/pt/workouts', priority: 3 },
  ],
  pt_default: [
    { label: 'Học viên của tôi', route: '/pt/students', priority: 1 },
    { label: 'Lịch làm việc', route: '/pt/schedule', priority: 2 },
    { label: 'Thư viện giáo án', route: '/pt/workouts', priority: 3 },
  ],
}

const STAFF_ACTIONS: Record<string, ActionSet> = {
  payments: [
    { label: 'Thanh toán', route: '/staff/payments', priority: 1 },
    { label: 'Hội viên', route: '/staff/members', priority: 2 },
    { label: 'Check-in', route: '/staff/checkin', priority: 3 },
  ],
  members: [
    { label: 'Hội viên', route: '/staff/members', priority: 1 },
    { label: 'Check-in', route: '/staff/checkin', priority: 2 },
    { label: 'Thanh toán', route: '/staff/payments', priority: 3 },
  ],
  staff_default: [
    { label: 'Thanh toán', route: '/staff/payments', priority: 1 },
    { label: 'Hội viên', route: '/staff/members', priority: 2 },
    { label: 'Check-in', route: '/staff/checkin', priority: 3 },
  ],
}

const ADMIN_ACTIONS: Record<string, ActionSet> = {
  admin_default: [
    { label: 'Bảng tin', route: '/admin/dashboard', priority: 1 },
    { label: 'Hội viên', route: '/admin/members', priority: 2 },
    { label: 'Quản lý PT', route: '/admin/pt', priority: 3 },
    { label: 'Báo cáo', route: '/admin/reports', priority: 4 },
  ],
}

// ─── Intent detection from message content ───

function detectIntent(userMsg: string, assistantMsg: string): string | null {
  const combined = ((userMsg || '') + ' ' + (assistantMsg || '')).toLowerCase()

  if (/\bg[ió]i t[aậ]p\b|\bplan\b|quy[eề]n l[oợ]i g[ió]i|danh s[aá]ch g[ió]i|đ[aă]ng k[ýy] g[ió]i|lo[aạ]i g[ió]i|so s[aá]nh g[ió]i|n[aâ]ng c[aấ]p g[ió]i/.test(combined)) return 'plans'
  if (/\bh[oộ]i vi[eê]n.*c[ủu]a t[oô]i|membership|gia h[aạ]n|g[ió]i.*c[oò]n|g[ió]i.*h[êế]t h[aạ]n/.test(combined)) return 'membership'
  if (/\bv[íi]|wallet|s[oố] d[ưu]|n[aạ]p ti[eề]n/.test(combined)) return 'wallet'
  if (/\bpt.*c[ủu]a t[oô]i|hu[aấ]n luy[eệ]n vi[eê]n.*c[ủu]a/.test(combined)) return 'pt_my'
  if (/\bpt\b|hu[aấ]n luy[eệ]n vi[eê]n|đ[aặ]t pt|pt 1.1|pt nh[oó]m/.test(combined)) return 'pt_general'
  if (/\bđ[aặ]t l[ịi]ch|booking|l[ịi]ch t[aậ]p|l[ịi]ch pt/.test(combined)) return 'booking'
  if (/\bch[ưu]a c[oó] g[oó]i|ch[ưu]a đ[aă]ng k[ýy]|kh[oô]ng c[oó] g[oó]i|chưa có membership/.test(combined)) return 'no_membership'

  // Staff/admin intents
  if (/\bthanh to[aá]n|payment|giao d[ịi]ch/.test(combined)) return 'payments'
  if (/\bh[oộ]i vi[eê]n\b|member|danh s[aá]ch h[oộ]i vi/.test(combined)) return 'members'

  return null
}

// ─── Hook ───

export function useQuickActions(
  lastUserMessage: string,
  lastAssistantContent: string,
) {
  const { user } = useAuth()
  const location = useLocation()

  return useMemo((): QuickAction[] => {
    if (!user) return []

    const role = user.role
    const intent = detectIntent(lastUserMessage, lastAssistantContent)

    let actionMap: Record<string, ActionSet>
    let defaultKey: string

    switch (role) {
      case 'admin':
      case 'super_admin':
        actionMap = { ...ADMIN_ACTIONS }
        defaultKey = 'admin_default'
        break
      case 'staff':
        actionMap = { ...STAFF_ACTIONS }
        defaultKey = 'staff_default'
        break
      case 'pt':
        actionMap = { ...PT_ACTIONS }
        defaultKey = 'pt_default'
        break
      case 'member':
      case 'user':
        actionMap = { ...MEMBER_ACTIONS }
        defaultKey = 'member_default'
        break
      default:
        actionMap = { ...MEMBER_ACTIONS }
        defaultKey = 'member_default'
    }

    const resolved = intent && actionMap[intent]
      ? actionMap[intent]
      : actionMap[defaultKey] || []

    return resolved
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 4)
      .map(({ label, route, priority: _p }) => ({
        label,
        route,
        variant: _p <= 2 ? 'primary' as const : 'secondary' as const,
      }))
  }, [user, lastUserMessage, lastAssistantContent, location.pathname])
}
