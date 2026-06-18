import api from './api'

export type WorkoutLogPayload = {
  exercises?: { name: string; sets?: number; reps?: number; weight?: number; duration?: number; notes?: string }[]
  totalDuration?: number
  intensity?: string
  workoutType?: string
  caloriesBurned?: number
  notes?: string
  tags?: string[]
  date?: string
}

export type HealthMeasurementPayload = {
  weight?: number
  bodyFat?: number
  muscle?: number
  bmi?: number
  visceralFat?: number
  chest?: number
  waist?: number
  hips?: number
  arm?: number
  thigh?: number
  notes?: string
  date?: string
}

export type WorkoutStats = {
  period: string
  totalWorkouts: number
  totalDuration: number
  totalCalories: number
  activeDays: number
  daysInPeriod: number
  frequencyPerWeek: number
  longestStreak: number
  currentStreak: number
  avgDurationPerSession: number
  avgCaloriesPerSession: number
  workoutTypes: { type: string; count: number }[]
  completionRate: number
}

export const workoutService = {
  getHistory(params?: { period?: string; limit?: number }) {
    return api.get('/workout/history', { params })
  },

  getStats(params?: { period?: string }) {
    return api.get('/workout/stats', { params })
  },

  getAnalysis(params?: { period?: string; query?: string }) {
    return api.get('/workout/analysis', { params })
  },

  logWorkout(data: WorkoutLogPayload) {
    return api.post('/workout/log', data)
  },

  getPlan(data: { goal?: string; frequency?: number; duration?: number; level?: string }) {
    return api.post('/workout/plan', data)
  },

  deleteLog(id: string) {
    return api.delete(`/workout/${id}`)
  },

  getHealthLogs(params?: { period?: string; type?: string }) {
    return api.get('/workout/health', { params })
  },

  logHealthMeasurement(data: HealthMeasurementPayload) {
    return api.post('/workout/health', data)
  },
}
