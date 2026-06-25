export interface QRTokenResponse {
  token: string
  expiredAt: string
  ttl: number
  memberId: string
}

export interface VerifiedMember {
  _id: string
  name: string
  email: string | null
  phone: string | null
  avatar: string
}

export interface VerifiedMembership {
  planName: string
  planColor: string
  startDate: string
  endDate: string
}

export interface VerifyQRResponse {
  member: VerifiedMember
  membership: VerifiedMembership
}

export interface ConfirmCheckinResponse {
  message: string
  checkin: {
    _id: string
    checkinTime: string
    streakDay: number
  }
}

export interface MemberStreakResponse {
  memberId: string
  streak: number
}

export interface TodayCheckinItem {
  _id: string
  memberId: {
    _id: string
    name: string
    email: string
    phone: string
    avatar: string
  }
  staffId: {
    _id: string
    name: string
  }
  checkinTime: string
  status: string
  selfieUrl?: string
  streakDay: number
}

export interface TodayCheckinsResponse {
  checkins: TodayCheckinItem[]
  total: number
}

export interface StaffCheckinHistoryItem {
  checkinId: string
  _id: string
  checkinTime: string
  memberId: string
  memberCode: string
  memberName: string
  email: string
  phone: string
  planName: string
  staffId: string
  staffName: string
  status: 'success' | 'failed' | 'expired' | 'blocked'
  errorNote?: string
  streakDay?: number
}

export interface StaffCheckinHistoryResponse {
  checkins: StaffCheckinHistoryItem[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  filters: {
    mode: string
    date: string
    startTime: string
    endTime: string
    keyword: string
  }
}

export interface StaffVerifyCheckinResponse {
  message: string
  checkin: StaffCheckinHistoryItem
}

export interface CheckinStats {
  totalCheckins: number
  uniqueMembers: number
  period: string
}

export interface HeatmapCell {
  day: number
  hour: number
  count: number
  members: string[]
}

export interface HeatmapResponse {
  heatmap: HeatmapCell[]
}
