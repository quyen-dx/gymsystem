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

export type WorkoutExercise = {
  _id?: string
  name: string
  sets: number
  reps: number
  restTime: string
  techniqueNote?: string
}

export type WorkoutSession = {
  _id?: string
  sessionName: string
  feedback?: string
  exercises: WorkoutExercise[]
}

export type WorkoutWeek = {
  _id?: string
  weekNumber: number
  sessions: WorkoutSession[]
}

export type WorkoutPlan = {
  _id: string
  workoutName: string
  goal: string
  durationWeeks: number
  startDate?: string
  endDate?: string
  description?: string
  member: string | { _id: string; name?: string; fullName?: string; displayName?: string; email?: string; phone?: string }
  personalTrainer: string | { _id: string; name?: string; fullName?: string; displayName?: string; email?: string; phone?: string }
  estimatedCalories: number
  weeks: WorkoutWeek[]
  createdAt?: string
  updatedAt?: string
}

export type WorkoutPlanPayload = {
  workoutName: string
  goal: string
  durationWeeks: number
  startDate?: string
  endDate?: string
  description?: string
  member: string
  personalTrainer: string
  estimatedCalories: number
  weeks: WorkoutWeek[]
}

export type SessionFeedback = {
  _id: string
  workoutId: string | { _id: string; name?: string }
  memberId: string | { _id: string; name?: string; fullName?: string; email?: string; phone?: string; avatar?: string }
  ptId: string | { _id: string; name?: string; fullName?: string; email?: string; phone?: string; avatar?: string }
  date: string
  note: string
  performance: 'excellent' | 'good' | 'average' | 'below_average' | 'poor'
  recommendation: string
  createdAt?: string
  updatedAt?: string
}

export type SessionFeedbackPayload = {
  workoutId: string
  memberId: string
  date: string
  note?: string
  performance?: string
  recommendation?: string
}

export const workoutService = {
  getWorkouts(params?: Record<string, unknown>) {
    return api.get<{ workouts?: WorkoutPlan[]; data?: WorkoutPlan[]; pagination?: { total: number; page: number; limit: number; totalPages: number } }>('/workouts', { params })
  },

  getWorkoutById(id: string) {
    return api.get<{ workout?: WorkoutPlan; data?: WorkoutPlan }>(`/workouts/${id}`)
  },

  createWorkout(data: WorkoutPlanPayload) {
    return api.post('/workouts', data)
  },

  updateWorkout(id: string, data: WorkoutPlanPayload) {
    return api.put(`/workouts/${id}`, data)
  },

  deleteWorkout(id: string) {
    return api.delete(`/workouts/${id}`)
  },

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

  getSessionFeedbacks(params?: { memberId?: string; workoutId?: string }) {
    return api.get<{ feedbacks: SessionFeedback[] }>('/workouts/feedback/all', { params })
  },

  createSessionFeedback(data: SessionFeedbackPayload) {
    return api.post('/workouts/feedback', data)
  },

  updateSessionFeedback(id: string, data: Partial<SessionFeedbackPayload>) {
    return api.put(`/workouts/feedback/${id}`, data)
  },

  deleteSessionFeedback(id: string) {
    return api.delete(`/workouts/feedback/${id}`)
  },
}
