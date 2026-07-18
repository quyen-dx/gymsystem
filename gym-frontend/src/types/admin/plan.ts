export interface AdminPlan {
  _id: string
  nameVi: string
  price: number
  durationDays: number
  descriptionVi?: string
  featuresVi: string[]
  featureIds?: string[]
  color: string
  isActive: boolean
  memberCount: number
  createdAt: string
}
