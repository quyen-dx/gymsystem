export interface AdminShopOwner {
  _id: string
  name: string
  email?: string
  phone?: string
  role: string
  isSeller: boolean
}

export interface AdminShop {
  _id: string
  user_id: AdminShopOwner
  name: string
  description?: string
  avatar?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}
