import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Tên danh mục là bắt buộc').max(100),
  description: z.string().max(500).optional().default(''),
  parentId: z.string().regex(objectIdRegex).optional().nullable(),
  image: z.string().max(500).optional().default(''),
  sortOrder: z.number().int().min(0).optional().default(0),
})

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  parentId: z.string().regex(objectIdRegex).optional().nullable(),
  image: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const createProductVariantSchema = z.object({
  name: z.string().min(1, 'Tên biến thể là bắt buộc').max(100),
  sku: z.string().min(1, 'SKU là bắt buộc').max(50),
  price: z.number().min(0).optional().default(0),
  stock: z.number().int().min(0).optional().default(0),
  sortOrder: z.number().int().min(0).optional().default(0),
})

export const updateProductVariantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sku: z.string().min(1).max(50).optional(),
  price: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  reserved: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})
