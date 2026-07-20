import { z } from 'zod'

export const loginHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  action: z.enum(['login', 'login_failed']).optional(),
})

export const deviceIdParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID thiết bị không hợp lệ'),
})

export const unlockBodySchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID người dùng không hợp lệ'),
}).strict()
