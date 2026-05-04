import { createContext, useEffect, useState } from 'react'
import type { CartItem, CartProduct } from '../types/member/cart'

type CartContextType = {
  cart: CartItem[]
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>
  addToCart: (product: CartProduct, opts?: { weight?: string }) => void
  cartCount: number
}

const CartContext = createContext<CartContextType | null>(null)

const getCart = (): CartItem[] => {
  try {
    return JSON.parse(localStorage.getItem('cart') || '[]')
  } catch {
    return []
  }
}

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>(getCart)

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart))
  }, [cart])

  const addToCart = (product: CartProduct, opts?: { weight?: string }) => {
    const weight = opts?.weight?.trim() || undefined
    setCart(prev => {
      const existing = prev.find(i => i._id === product._id && (i.weight || '') === (weight || ''))

      if (existing) {
        return prev.map(i =>
          i._id === product._id && (i.weight || '') === (weight || '')
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }

      return [...prev, { ...product, weight, quantity: 1 }]
    })
  }

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider value={{ cart, setCart, addToCart, cartCount }}>
      {children}
    </CartContext.Provider>
  )
}

export { CartContext }
