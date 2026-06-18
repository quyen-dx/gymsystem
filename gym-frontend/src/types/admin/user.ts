export interface AdminUser {
  _id: string
  name: string
  email: string | null
  phone: string | null
  facebookId?: string | null
  facebookProfileUrl?: string | null
  role: 'super_admin' | 'admin' | 'pt' | 'staff' | 'member' | 'user' | 'seller'
  provider: string
  isActive: boolean
  isVerified: boolean
  avatar: string
  coverImage?: string
  createdAt: string
  memberCode?: string
  fullName?: string
  gender?: string
  nationality?: string
  dateOfBirth?: string
  country?: string
  province?: string
  detailedAddress?: string
  identityStatus?: string
  identityType?: string
  identityNumber?: string
  identityCountry?: string
  identityFrontImage?: string
  identityBackImage?: string
  identityRejectReason?: string
  emergencyContact?: {
    name: string
    phone: string
    relationship?: string
  }
  healthInfo?: {
    height: number | null
    weight: number | null
    goals: string[]
    activityLevel: string
    notes: string
  }
  contactEmail?: string
  language?: string
  timezone?: string
}

export interface UserDetailResponse {
  user: AdminUser
  addresses: any[]
  activeMembership: any
  membershipHistory: any[]
  recentBookings: any[]
  orderHistory: any[]
  totalWorkouts: number
}
