export interface AdminPlan {
  _id: string
  nameVi: string
  nameEn: string
  price: number
  durationDays: number
  descriptionVi?: string
  descriptionEn?: string
  featuresVi: string[]
  featuresEn: string[]
  color: string
  isActive: boolean
  memberCount: number
  createdAt: string
}
