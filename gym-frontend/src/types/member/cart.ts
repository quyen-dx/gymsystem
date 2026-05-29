export interface CartProduct {
  _id: string
  name: string
  price: number
  basePrice?: number
  image?: string
  stock?: number
  sellerId?: string
  brand?: string
}

export interface CartItem extends CartProduct {
  quantity: number
  weight?: string
  sellerId?: string
}
