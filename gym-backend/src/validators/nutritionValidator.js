import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

// Nutrition Plan
export const createNutritionPlanSchema = z.object({
  userId: z.string().regex(objectIdRegex, 'ID hội viên không hợp lệ'),
  name: z.string().min(1, 'Tên kế hoạch là bắt buộc').max(200),
  goal: z.string().max(100).optional().default(''),
  dailyCalorieTarget: z.number().min(0).optional().default(0),
  proteinTarget_g: z.number().min(0).optional().default(0),
  carbsTarget_g: z.number().min(0).optional().default(0),
  fatTarget_g: z.number().min(0).optional().default(0),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().max(1000).optional().default(''),
})

export const updateNutritionPlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  goal: z.string().max(100).optional(),
  dailyCalorieTarget: z.number().min(0).optional(),
  proteinTarget_g: z.number().min(0).optional(),
  carbsTarget_g: z.number().min(0).optional(),
  fatTarget_g: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
})

export const nutritionPlanQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  userId: z.string().regex(objectIdRegex).optional(),
  isActive: z.coerce.boolean().optional(),
})

// Food
export const createFoodSchema = z.object({
  name: z.string().min(1, 'Tên thực phẩm là bắt buộc').max(200),
  description: z.string().max(1000).optional().default(''),
  category: z.string().max(100).optional().default(''),
  servingSize: z.string().max(50).optional().default(''),
  calories: z.number().min(0).optional().default(0),
  protein_g: z.number().min(0).optional().default(0),
  carbs_g: z.number().min(0).optional().default(0),
  fat_g: z.number().min(0).optional().default(0),
  fiber_g: z.number().min(0).optional().default(0),
})

export const updateFoodSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  servingSize: z.string().max(50).optional(),
  calories: z.number().min(0).optional(),
  protein_g: z.number().min(0).optional(),
  carbs_g: z.number().min(0).optional(),
  fat_g: z.number().min(0).optional(),
  fiber_g: z.number().min(0).optional(),
})

export const foodQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
})

// Meal Log
export const createMealLogSchema = z.object({
  date: z.string().min(1, 'Ngày là bắt buộc'),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional().default('snack'),
  foodId: z.string().regex(objectIdRegex).optional(),
  foodName: z.string().min(1, 'Tên món ăn là bắt buộc').max(200),
  quantity: z.number().min(0).optional().default(1),
  unit: z.enum(['g', 'ml', 'serving', 'piece']).optional().default('serving'),
  calories: z.number().min(0).optional().default(0),
  protein_g: z.number().min(0).optional().default(0),
  carbs_g: z.number().min(0).optional().default(0),
  fat_g: z.number().min(0).optional().default(0),
  fiber_g: z.number().min(0).optional().default(0),
  notes: z.string().max(500).optional().default(''),
})

export const updateMealLogSchema = z.object({
  date: z.string().min(1).optional(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  foodName: z.string().min(1).max(200).optional(),
  quantity: z.number().min(0).optional(),
  unit: z.enum(['g', 'ml', 'serving', 'piece']).optional(),
  calories: z.number().min(0).optional(),
  protein_g: z.number().min(0).optional(),
  carbs_g: z.number().min(0).optional(),
  fat_g: z.number().min(0).optional(),
  fiber_g: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
})

export const mealLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  userId: z.string().regex(objectIdRegex).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
})

export const dailySummaryQuerySchema = z.object({
  date: z.string().min(1, 'Ngày là bắt buộc'),
})
