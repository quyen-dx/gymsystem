import { z } from 'zod'

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId')

export const emailSchema = z
  .string()
  .email('Invalid email format')
  .toLowerCase()
  .trim()

export const phoneSchema = z
  .string()
  .regex(/^[0-9]{9,11}$/, 'Invalid phone number')
  .trim()

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const sortSchema = z
  .string()
  .regex(/^-?[a-zA-Z_]+(,-?[a-zA-Z_]+)*$/, 'Invalid sort format')
  .optional()

export const objectIdOrSlugSchema = z
  .string()
  .min(1, 'Identifier is required')

export default {
  objectIdSchema,
  emailSchema,
  phoneSchema,
  paginationSchema,
  sortSchema,
  objectIdOrSlugSchema,
}
