import { z } from 'zod'

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID không hợp lệ')

export const purchaseSchema = z.object({
  planId: objectId,
  durationMultiplier: z.coerce.number().int().min(1).max(12).optional().default(1),
}).strict()

export const renewSchema = z.object({
  planId: objectId,
  durationMultiplier: z.coerce.number().int().min(1).max(12).optional().default(1),
}).strict()

export const upgradeSchema = z.object({
  newPlanId: objectId,
}).strict()

export const downgradeSchema = z.object({
  newPlanId: objectId,
}).strict()

export const changePlanSchema = z.object({
  planId: objectId,
}).strict()

export const membershipIdParamSchema = z.object({
  membershipId: objectId,
})
