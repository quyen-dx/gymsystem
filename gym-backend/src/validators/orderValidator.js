import { z } from 'zod'

export const cartItemSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().min(1, 'quantity must be at least 1'),
})

export const addCartItemSchema = cartItemSchema

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0, 'quantity must be >= 0'),
})

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        sellerId: z.string().optional(),
        quantity: z.number().int().min(1),
        price: z.number().min(0),
        weight: z.number().min(0).optional(),
        variant: z.object({ weight: z.string().optional() }).optional(),
        productName: z.string().optional(),
        productImage: z.string().optional(),
      }),
    )
    .optional(),
  cartId: z.string().optional(),
  address: z
    .object({
      recipientName: z.string().min(1),
      phone: z.string().min(1),
      street: z.string().min(1),
      ward: z.string().optional(),
      district: z.string().min(1),
      province: z.string().optional(),
      city: z.string().optional(),
      note: z.string().optional(),
    })
    .optional(),
  paymentReference: z.string().optional(),
  discountCode: z.string().optional(),
})

export const orderStatusSchema = z.object({
  status: z.string().min(1, 'status is required'),
})

export const cancelOrderSchema = z.object({
  reason: z.string().optional(),
})

export const returnRequestSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(1),
      variantWeight: z.string().optional(),
      quantity: z.number().int().min(1),
      unitPrice: z.number().min(0),
      reason: z.string().optional(),
    }),
  ),
  reason: z.string().optional(),
})

export const shippingCalcSchema = z.object({
  address: z
    .object({
      recipientName: z.string().optional(),
      phone: z.string().optional(),
      street: z.string().optional(),
      ward: z.string().optional(),
      district: z.string().optional(),
      city: z.string().optional(),
      province: z.string().optional(),
    })
    .passthrough(),
  totalWeight: z.number().optional(),
  items: z.array(z.any()).optional(),
})
