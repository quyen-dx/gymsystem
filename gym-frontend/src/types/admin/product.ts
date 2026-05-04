export interface AdminProductPartner {
  name?: string
  avatar?: string
  description?: string
}

export interface AdminWeightVariant {
  label: string
  priceDelta: number
  stock?: number
}

export interface AdminProduct {
  _id: string
  shop_id?: string | { _id: string; name?: string; user_id?: string }
  name: string
  description: string
  price: number
  image: string
  images?: string[]
  descriptionImages?: string[]
  weights?: string[]
  weightVariants?: AdminWeightVariant[]
  category: string
  stock: number
  isActive: boolean
  partner?: AdminProductPartner
}
