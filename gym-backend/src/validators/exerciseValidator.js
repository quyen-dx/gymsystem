import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const createExerciseSchema = z.object({
  name: z.string().min(1, 'Tên bài tập là bắt buộc').max(200),
  muscleGroup: z.array(z.string().min(1).max(50)).optional().default([]),
  equipment: z.array(z.string().min(1).max(50)).optional().default([]),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('intermediate'),
  description: z.string().max(2000).optional().default(''),
  mediaUrls: z.array(z.string().url()).optional().default([]),
  category: z.string().max(100).optional().default(''),
})

export const updateExerciseSchema = z.object({
  name: z.string().min(1, 'Tên bài tập là bắt buộc').max(200).optional(),
  muscleGroup: z.array(z.string().min(1).max(50)).optional(),
  equipment: z.array(z.string().min(1).max(50)).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  description: z.string().max(2000).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  category: z.string().max(100).optional(),
})

export const exerciseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().max(200).optional(),
  muscleGroup: z.string().max(50).optional(),
  equipment: z.string().max(50).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  category: z.string().max(100).optional(),
  createdBy: z.string().regex(objectIdRegex).optional(),
})

export const exerciseIdParamsSchema = z.object({
  id: z.string().regex(objectIdRegex, 'ID bài tập không hợp lệ'),
})

export const createWorkoutLogSchema = z.object({
  workoutId: z.string().regex(objectIdRegex, 'ID workout không hợp lệ'),
  exerciseId: z.string().regex(objectIdRegex).optional(),
  exerciseName: z.string().min(1, 'Tên bài tập là bắt buộc').max(200),
  date: z.string().min(1, 'Ngày tập là bắt buộc'),
  actualSets: z.number().int().min(0).optional().default(0),
  actualReps: z.number().int().min(0).optional().default(0),
  weight: z.number().min(0).optional().default(0),
  durationMinutes: z.number().min(0).optional().default(0),
  rpe: z.number().int().min(1).max(10).nullable().optional().default(null),
  notes: z.string().max(1000).optional().default(''),
})

export const updateWorkoutLogSchema = z.object({
  exerciseName: z.string().min(1).max(200).optional(),
  date: z.string().min(1).optional(),
  actualSets: z.number().int().min(0).optional(),
  actualReps: z.number().int().min(0).optional(),
  weight: z.number().min(0).optional(),
  durationMinutes: z.number().min(0).optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(1000).optional(),
})

export const workoutLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  userId: z.string().regex(objectIdRegex).optional(),
  workoutId: z.string().regex(objectIdRegex).optional(),
  exerciseId: z.string().regex(objectIdRegex).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export const workoutLogIdParamsSchema = z.object({
  id: z.string().regex(objectIdRegex, 'ID log không hợp lệ'),
})
