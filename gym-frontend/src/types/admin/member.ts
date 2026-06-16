export interface MemberPlan {
  _id: string
  nameVi: string
  nameEn: string
  price: number
  durationDays: number
  color: string
}

export interface MemberMembership {
  _id: string
  memberId: string
  planId: MemberPlan
  startDate: string
  endDate: string
  status: 'active' | 'expired' | 'cancelled'
  createdAt: string
}

export interface MemberUser {
  _id: string
  name: string
  fullName?: string
  email: string | null
  phone: string | null
  avatar: string
  dateOfBirth: string | null
  role: string
  isActive: boolean
  isLocked: boolean
  status: string
  createdAt: string
  updatedAt: string
  gender?: string
  memberCode?: string
}

export interface MemberListItem extends MemberUser {
  remainingDays: number
  activeMembership: MemberMembership | null
  membershipHistory: MemberMembership[]
  checkinCount: number
}

export interface MemberDetail extends MemberUser {
  activeMembership: MemberMembership | null
  membershipHistory: MemberMembership[]
  remainingDays: number
}

export interface TimelineEvent {
  _id: string
  type: string
  title: string
  description: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface MemberStats {
  totalMembers: number
  newThisMonth: number
  activeMemberships: number
  expiringSoon: number
  expired: number
  locked: number
}

export interface MemberFormData {
  name: string
  email: string
  phone: string
  password?: string
  dateOfBirth?: string
  gender?: string
}

export interface HealthScore {
  overall: number
  checkinScore: number
  workoutCompletionScore: number
  checkinCount: number
  level: string
  levelText: string
}
