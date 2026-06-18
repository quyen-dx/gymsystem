import { createContext } from 'react'

export type AuthProviderType = 'google' | 'facebook' | 'phone' | 'email'

export interface User {
  _id: string
  email: string | null
  name: string
  displayName?: string
  password?: string | null
  phone?: string | null
  facebookProfileUrl?: string | null
  dateOfBirth?: string | null
  provider: AuthProviderType
  role: 'super_admin' | 'admin' | 'pt' | 'staff' | 'member' | 'user' | 'seller'
  isSeller?: boolean
  shopId?: string | null
  shop_id?: string | null
  avatar?: string
  coverImage?: string | null
  themePreference?: 'system' | 'light' | 'dark'
  accentColor?: string
  isActive: boolean
  isVerified: boolean
  hasPassword?: boolean
  createdAt: string
  memberCode?: string
  username?: string
  fullName?: string
  gender?: string
  nationality?: string
  language?: string
  timezone?: string
  country?: string
  province?: string
  detailedAddress?: string
  emergencyContact?: {
    name?: string
    phone?: string
    relationship?: string
    country?: string
  }
  healthInfo?: {
    height?: number | null
    weight?: number | null
    goals?: string[]
    activityLevel?: string
    notes?: string
  }
  identityVerification?: {
    documentType?: string
    documentNumber?: string
    documentImage?: string
    verified?: boolean
  }
  identityType?: string
  identityNumber?: string
  identityCountry?: string
  identityFrontImage?: string
  identityBackImage?: string
  identityStatus?: '' | 'pending' | 'approved' | 'rejected'
  identityRejectReason?: string
  identityReviewedAt?: string
}

export interface LoginPayload {
  provider: AuthProviderType
  identifier: string
  password?: string
  oauthToken?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (payload: LoginPayload) => Promise<User>
  logout: () => void
  updateUser: (user: User | null) => void
  refreshUser: () => Promise<User | null>
}

export const AuthContext = createContext<AuthContextType | null>(null)
