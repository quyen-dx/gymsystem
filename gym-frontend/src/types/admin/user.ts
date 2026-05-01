export interface AdminUser {
  _id: string
  name: string
  email: string | null
  phone: string | null
  facebookId?: string | null
  facebookProfileUrl?: string | null
  role: 'admin' | 'pt' | 'staff' | 'member' | 'user' | 'seller'
  provider: string
  isActive: boolean
  isVerified: boolean
  avatar: string
  createdAt: string
}
