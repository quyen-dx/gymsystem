import { createContext, useEffect, useState, useCallback } from 'react'
import type { CartItem, CartProduct } from '../types/member/cart'
import { useAuth } from '../hooks/useAuth'

type CartContextType = {
  cart: CartItem[]
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>
  addToCart: (product: CartProduct, opts?: { weight?: string }) => void
  cartCount: number
}

const CartContext = createContext<CartContextType | null>(null)

const getCartKey = (userId?: string) => (userId ? `cart_${userId}` : 'cart')

const getCart = (userId?: string): CartItem[] => {
  try {
    return JSON.parse(localStorage.getItem(getCartKey(userId)) || '[]')
  } catch {
    return []
  }
}

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth()
  const userId = user?._id
  const [cart, setCart] = useState<CartItem[]>(() => getCart(userId))

  useEffect(() => {
    setCart(getCart(userId))
  }, [userId])

  const saveCart = useCallback((items: CartItem[]) => {
    localStorage.setItem(getCartKey(userId), JSON.stringify(items))
  }, [userId])

  useEffect(() => {
    saveCart(cart)
  }, [cart, saveCart])

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
