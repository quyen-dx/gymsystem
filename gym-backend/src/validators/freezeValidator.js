import { z } from 'zod'

export const createFreezeSchema = z.object({
  startDate: z.string().datetime({ message: 'Ngày bắt đầu không hợp lệ' }),
  endDate: z.string().datetime({ message: 'Ngày kết thúc không hợp lệ' }),
  reason: z.string().max(500).optional(),
}).strict()

export const approveFreezeSchema = z.object({
  note: z.string().max(500).optional(),
}).strict()

export const freezeIdParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID không hợp lệ'),
})

export const freezeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(['pending', 'approved', 'rejected', 'active', 'completed']).optional(),
  cycleId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
})
