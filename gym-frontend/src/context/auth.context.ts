import { createContext } from 'react'

export type AuthProviderType = 'google' | 'facebook' | 'phone'

export interface User {
  _id: string
  email: string | null
  name: string
  password?: string | null
  phone?: string | null
  facebookProfileUrl?: string | null
  dateOfBirth?: string | null
  provider: AuthProviderType
  role: 'admin' | 'pt' | 'staff' | 'member' | 'user' | 'seller'
  isSeller?: boolean
  shopId?: string | null
  shop_id?: string | null
  avatar?: string
  isActive: boolean
  isVerified: boolean
  hasPassword?: boolean
  createdAt: string
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
}

export const AuthContext = createContext<AuthContextType | null>(null)
