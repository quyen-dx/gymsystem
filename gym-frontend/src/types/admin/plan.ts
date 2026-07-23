export interface AdminPlan {
  _id: string
  nameVi: string
  price: number
  durationDays: number
  descriptionVi?: string
  featureIds?: Array<{ _id: string; code: string; name: string; description?: string }>
  color: string
  isActive: boolean
  memberCount: number
  createdAt: string
}
