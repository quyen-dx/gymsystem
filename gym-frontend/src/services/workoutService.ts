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
  restTime: number
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

export type TemplateDayExercise = {
  name: string
  note: string
}

export type TemplateDay = {
  dayOfWeek: number
  muscleGroup: string
  description: string
  exercises: TemplateDayExercise[]
}

export type WorkoutPlan = {
  _id: string
  name?: string
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
  days?: TemplateDay[]
  isTemplate?: boolean
  status?: 'active' | 'completed' | 'archived'
  createdAt?: string
  updatedAt?: string
}

export type WorkoutPlanPayload = {
  workoutName: string
  specializationId?: string
  goal: string
  durationWeeks: number
  startDate?: string
  endDate?: string
  description?: string
  member?: string
  personalTrainer?: string
  estimatedCalories: number
  weeks: WorkoutWeek[]
  days?: TemplateDay[]
  isTemplate?: boolean
  status?: 'active' | 'completed' | 'archived'
}

export type ScheduleExercise = {
  name: string
  note?: string
  completed?: boolean
}

export type ScheduleSession = {
  dayOrder: number
  date: string
  time: string
  endTime?: string
  className?: string
  classCode?: string
  location?: string
  title: string
  muscleGroup: string
  exercises: ScheduleExercise[]
  status: 'pending' | 'completed' | 'skipped'
  feedback: string
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

export type WorkoutSchedule = {
  _id: string
  memberId: string | { _id: string; name?: string }
  templateId: string | { _id: string; name?: string; goal?: string; description?: string }
  assignedBy: string | { _id: string; name?: string; email?: string }
  startDate: string
  weekIndex?: number
  totalWeeks?: number
  status: 'active' | 'completed' | 'archived'
  sessions: ScheduleSession[]
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

export type LibraryWorkout = {
  _id: string
  name?: string
  workoutName: string
  goal: string
  specializationId?: string
  totalSessions: number
  assignmentCount: number
  version: number
  templateStatus: 'published' | 'under_review' | 'hidden' | 'deleted'
  durationWeeks: number
  description?: string
  ptId: string | { _id: string; name?: string; fullName?: string; email?: string; avatar?: string }
  weeks: WorkoutWeek[]
  days?: TemplateDay[]
  isTemplate?: boolean
  createdAt?: string
  updatedAt?: string
}

export type LibraryQuery = {
  search?: string
  specializationId?: string
  goal?: string
  createdBy?: string
  trainerId?: string
  mine?: string
  totalSessions?: number
  status?: string
  sortBy?: 'most_used' | 'newest'
  page?: number
  limit?: number
}

export type LibraryResponse = {
  workouts: LibraryWorkout[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type ImprovementRequest = {
  _id: string
  workoutTemplateId: string | { _id: string; name: string; goal?: string; specializationId?: string }
  senderTrainerId: string | { _id: string; name?: string; fullName?: string; email?: string; avatar?: string }
  receiverTrainerId: string | { _id: string; name?: string; fullName?: string; email?: string; avatar?: string }
  title: string
  content: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt?: string
  updatedAt?: string
}

export type WorkoutReport = {
  _id: string
  workoutTemplateId: string | { _id: string; name: string; goal?: string; specializationId?: string; ptId?: any; templateStatus?: string }
  reporterTrainerId: string | { _id: string; name?: string; fullName?: string; email?: string; avatar?: string }
  reason: string
  detail: string
  status: 'pending' | 'reviewed' | 'resolved' | 'rejected'
  resolvedBy?: string | { _id: string; name?: string; fullName?: string }
  resolution?: string
  resolvedAt?: string
  createdAt?: string
  updatedAt?: string
}

export const workoutService = {
  getWorkouts(params?: Record<string, unknown>) {
    return api.get<WorkoutPlan[]>('/workouts', { params })
  },

  getTemplates(params?: Record<string, unknown>) {
    return api.get<WorkoutPlan[]>('/workouts', { params: { ...params, isTemplate: 'true' } })
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

  // Shared library
  getSharedTemplates(params?: LibraryQuery) {
    return api.get<LibraryResponse>('/workout-library/templates', { params })
  },

  getSpecializations() {
    return api.get<{ specializations: string[] }>('/workout-library/specializations')
  },

  getGoals() {
    return api.get<{ goals: string[] }>('/workout-library/goals')
  },

  getGoalsBySpecializationFilter(specializationId?: string) {
    return api.get<{ goals: string[] }>('/workout-library/goals-by-specialization', {
      params: specializationId ? { specializationId } : {},
    })
  },

  getTrainersWithWorkouts() {
    return api.get<{ trainers: { _id: string; name: string; fullName?: string; email?: string; avatar?: string }[] }>('/workout-library/trainers-with-workouts')
  },

  getGoalsBySpecialization(specializationId: string) {
    return api.get<{ goals: string[] }>(`/specializations/${encodeURIComponent(specializationId)}/goals`)
  },

  assignWorkout(data: { workoutTemplateId: string; memberId: string }) {
    return api.post('/workout-library/assign', data)
  },

  getWorkoutAssignments(id: string) {
    return api.get(`/workout-library/${id}/assignments`)
  },

  hideWorkout(id: string, reason?: string) {
    return api.put(`/workout-library/${id}/hide`, { reason })
  },

  restoreWorkout(id: string) {
    return api.put(`/workout-library/${id}/restore`)
  },

  // Improvements
  submitImprovement(data: { workoutTemplateId: string; title: string; content: string }) {
    return api.post('/workout-improvements', data)
  },

  getReceivedImprovements(params?: { status?: string }) {
    return api.get<{ improvements: ImprovementRequest[] }>('/workout-improvements/received', { params })
  },

  getSentImprovements(params?: { status?: string }) {
    return api.get<{ improvements: ImprovementRequest[] }>('/workout-improvements/sent', { params })
  },

  acceptImprovement(id: string) {
    return api.put(`/workout-improvements/${id}/accept`)
  },

  rejectImprovement(id: string) {
    return api.put(`/workout-improvements/${id}/reject`)
  },

  // Reports
  reportWorkout(data: { workoutTemplateId: string; reason: string; detail?: string }) {
    return api.post('/workout-reports', data)
  },

  getWorkoutReports(params?: { status?: string; page?: number; limit?: number }) {
    return api.get<{ reports: WorkoutReport[]; pagination: any }>('/workout-reports', { params })
  },

  getReportSummary() {
    return api.get<{ summary: any[] }>('/workout-reports/summary')
  },

  resolveReport(id: string, data?: { action?: string; resolution?: string }) {
    return api.put(`/workout-reports/${id}/resolve`, data)
  },

  rejectReport(id: string, data?: { resolution?: string }) {
    return api.put(`/workout-reports/${id}/reject`, data)
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
