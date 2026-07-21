import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const createHealthMetricSchema = z.object({
  date: z.string().min(1, 'Ngày là bắt buộc'),
  weight: z.number().min(0).optional().nullable(),
  height: z.number().min(0).optional().nullable(),
  bodyFatPercent: z.number().min(0).max(100).optional().nullable(),
  muscleMass: z.number().min(0).optional().nullable(),
  boneMass: z.number().min(0).optional().nullable(),
  waterPercent: z.number().min(0).max(100).optional().nullable(),
  visceralFat: z.number().min(0).max(60).optional().nullable(),
  bmi: z.number().min(0).optional().nullable(),
  bmr: z.number().min(0).optional().nullable(),
  waist: z.number().min(0).optional().nullable(),
  hip: z.number().min(0).optional().nullable(),
  chest: z.number().min(0).optional().nullable(),
  arm: z.number().min(0).optional().nullable(),
  thigh: z.number().min(0).optional().nullable(),
  source: z.enum(['manual', 'inbody_scan', 'ai_estimated']).optional().default('manual'),
  scanImageUrl: z.string().max(500).optional().default(''),
  notes: z.string().max(1000).optional().default(''),
})

export const updateHealthMetricSchema = z.object({
  date: z.string().min(1).optional(),
  weight: z.number().min(0).optional().nullable(),
  height: z.number().min(0).optional().nullable(),
  bodyFatPercent: z.number().min(0).max(100).optional().nullable(),
  muscleMass: z.number().min(0).optional().nullable(),
  boneMass: z.number().min(0).optional().nullable(),
  waterPercent: z.number().min(0).max(100).optional().nullable(),
  visceralFat: z.number().min(0).max(60).optional().nullable(),
  bmi: z.number().min(0).optional().nullable(),
  bmr: z.number().min(0).optional().nullable(),
  waist: z.number().min(0).optional().nullable(),
  hip: z.number().min(0).optional().nullable(),
  chest: z.number().min(0).optional().nullable(),
  arm: z.number().min(0).optional().nullable(),
  thigh: z.number().min(0).optional().nullable(),
  source: z.enum(['manual', 'inbody_scan', 'ai_estimated']).optional(),
  scanImageUrl: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
})

export const healthMetricQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  userId: z.string().regex(objectIdRegex).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  source: z.enum(['manual', 'inbody_scan', 'ai_estimated']).optional(),
})

export const healthTrendsQuerySchema = z.object({
  metric: z.enum(['weight', 'bodyFatPercent', 'muscleMass', 'bmi']).optional().default('weight'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export const createBodyCompositionSchema = z.object({
  date: z.string().min(1, 'Ngày là bắt buộc'),
  source: z.enum(['inbody', 'manual', 'smart_scale']).optional().default('manual'),
  metricId: z.string().regex(objectIdRegex).optional(),
  rawData: z.record(z.unknown()).optional().default({}),
  segmentalAnalysis: z.object({
    rightArm: z.object({ leanMass: z.number().nullable().optional(), fatMass: z.number().nullable().optional() }).optional(),
    leftArm: z.object({ leanMass: z.number().nullable().optional(), fatMass: z.number().nullable().optional() }).optional(),
    trunk: z.object({ leanMass: z.number().nullable().optional(), fatMass: z.number().nullable().optional() }).optional(),
    rightLeg: z.object({ leanMass: z.number().nullable().optional(), fatMass: z.number().nullable().optional() }).optional(),
    leftLeg: z.object({ leanMass: z.number().nullable().optional(), fatMass: z.number().nullable().optional() }).optional(),
  }).optional(),
  scanImageUrl: z.string().max(500).optional().default(''),
  notes: z.string().max(1000).optional().default(''),
})

export const bodyCompositionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  userId: z.string().regex(objectIdRegex).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export const createFitnessGoalSchema = z.object({
  type: z.enum(['weight_loss', 'muscle_gain', 'maintenance', 'endurance', 'custom']),
  targetWeight: z.number().min(0).optional().nullable(),
  targetBodyFatPercent: z.number().min(0).max(100).optional().nullable(),
  targetDate: z.string().optional(),
  currentValue: z.number().min(0).optional().nullable(),
  startValue: z.number().min(0).optional().nullable(),
  progressPercent: z.number().min(0).max(100).optional().default(0),
  notes: z.string().max(1000).optional().default(''),
})

export const updateFitnessGoalSchema = z.object({
  type: z.enum(['weight_loss', 'muscle_gain', 'maintenance', 'endurance', 'custom']).optional(),
  targetWeight: z.number().min(0).optional().nullable(),
  targetBodyFatPercent: z.number().min(0).max(100).optional().nullable(),
  targetDate: z.string().optional(),
  currentValue: z.number().min(0).optional().nullable(),
  startValue: z.number().min(0).optional().nullable(),
  progressPercent: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
})

export const fitnessGoalQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  userId: z.string().regex(objectIdRegex).optional(),
  type: z.enum(['weight_loss', 'muscle_gain', 'maintenance', 'endurance', 'custom']).optional(),
  isActive: z.coerce.boolean().optional(),
})

export const bmiCalculatorSchema = z.object({
  height: z.number().min(1, 'Chiều cao là bắt buộc (cm)').max(300),
  weight: z.number().min(1, 'Cân nặng là bắt buộc (kg)').max(700),
})

export const bmrCalculatorSchema = z.object({
  height: z.number().min(1, 'Chiều cao là bắt buộc (cm)').max(300),
  weight: z.number().min(1, 'Cân nặng là bắt buộc (kg)').max(700),
  age: z.number().int().min(10).max(120).optional(),
  gender: z.enum(['male', 'female']).optional(),
})

export const tdeeCalculatorSchema = z.object({
  bmr: z.number().min(1, 'BMR là bắt buộc'),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
})

export const macrosCalculatorSchema = z.object({
  tdee: z.number().min(1, 'TDEE là bắt buộc'),
  goal: z.enum(['weight_loss', 'muscle_gain', 'maintenance']).optional().default('maintenance'),
})
