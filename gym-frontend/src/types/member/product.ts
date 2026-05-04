export interface ProductReview {
  _id: string
  userId: string
  name: string
  avatar: string
  rating: number
  comment: string
  createdAt: string
}

export interface ProductPartner {
  name: string
  avatar: string
  description: string
}

export interface ProductShop {
  _id: string
  name?: string
  avatar?: string
  description?: string
  address?: {
    street?: string
    ward?: string
    district?: string
    city?: string
  }
  rating?: number
  reviewCount?: number
  user_id?: {
    _id: string
    name?: string
    avatar?: string
  }
}

export interface ProductWeightVariant {
  label: string
  priceDelta: number
  stock?: number
}

export interface MemberProduct {
  _id: string
  name: string
  description: string
  price: number
  image?: string
  images?: string[]
  descriptionImages?: string[]
  weights?: string[]
  weightVariants?: ProductWeightVariant[]
  category?: string
  stock?: number
  shop_id?: string | ProductShop
  partner?: ProductPartner
  reviews?: ProductReview[]
  rating?: number
  reviewCount?: number
}
