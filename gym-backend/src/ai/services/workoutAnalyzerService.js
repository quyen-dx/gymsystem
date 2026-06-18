import HealthLog from '../../models/HealthLog.js'
import UserActivity from '../../models/UserActivity.js'
import Booking from '../../models/Booking.js'
import Plan from '../../models/Plan.js'

const GOAL_KEYWORDS = {
  muscle_gain: ['tăng cơ', 'tang co', 'muscle', 'tập cơ', 'co bap', 'hypertrophy'],
  fat_loss: ['giảm mỡ', 'giam mo', 'giảm cân', 'giam can', 'fat loss', 'lose fat', 'lose weight', 'cut'],
  weight_gain: ['tăng cân', 'tang can', 'bulk', 'bulking', 'gain weight', 'lên cân'],
  endurance: ['bền', 'endurance', 'cardio', 'chạy bền', 'chay ben', 'stamina'],
  general_fitness: ['sức khỏe', 'suc khoe', 'fitness', 'general', 'khoẻ', 'khoe hon'],
}

const detectGoal = (...texts) => {
  const normalized = texts.filter(Boolean).join(' ').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase()
  for (const [goal, keywords] of Object.entries(GOAL_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(kw))) return goal
  }
  return 'general_fitness'
}

const getDateRange = (period) => {
  const end = new Date()
  const start = new Date()
  if (period === '7d' || period === 'week') start.setDate(start.getDate() - 7)
  else if (period === '30d' || period === 'month') start.setDate(start.getDate() - 30)
  else if (period === '90d' || period === 'quarter') start.setDate(start.getDate() - 90)
  else if (period === 'all') { start.setFullYear(2000) }
  else start.setDate(start.getDate() - 30)
  return { start, end }
}

export const getWorkoutLogs = async ({ userId, period = '30d', limit = 50, type = 'workout' }) => {
  const { start, end } = getDateRange(period)
  const logs = await HealthLog.find({
    user: userId,
    type,
    date: { $gte: start, $lte: end },
  }).sort({ date: -1 }).limit(limit).lean()
  return logs
}

export const logWorkout = async ({ userId, exercises, totalDuration, intensity, workoutType, caloriesBurned, notes, tags, date, source = 'manual' }) => {
  const doc = await HealthLog.create({
    user: userId,
    type: 'workout',
    date: date || new Date(),
    exercises: exercises || [],
    totalDuration: totalDuration || 0,
    intensity: intensity || '',
    workoutType: workoutType || '',
    caloriesBurned: caloriesBurned || 0,
    notes: notes || '',
    tags: tags || [],
    source,
  })
  await UserActivity.create({
    user: userId,
    type: 'workout_complete',
    title: 'Workout completed',
    description: notes || `${workoutType || ''} workout`,
    metadata: { logId: doc._id, totalDuration, caloriesBurned, workoutType },
  })
  return doc
}

export const getWorkoutStats = async ({ userId, period = '30d' }) => {
  const { start, end } = getDateRange(period)
  const [logs, activities, bookings] = await Promise.all([
    HealthLog.find({ user: userId, type: 'workout', date: { $gte: start, $lte: end } }).sort({ date: -1 }).lean(),
    UserActivity.find({ user: userId, type: 'workout_complete', createdAt: { $gte: start, $lte: end } }).sort({ createdAt: -1 }).lean(),
    Booking.find({ memberId: userId, status: 'completed', completedAt: { $gte: start, $lte: end } }).lean(),
  ])

  const allEntries = [...logs, ...activities, ...bookings]
  const totalWorkouts = allEntries.length
  const totalDuration = logs.reduce((sum, l) => sum + (l.totalDuration || 0), 0)
  const totalCalories = logs.reduce((sum, l) => sum + (l.caloriesBurned || 0), 0)
  const daysInPeriod = Math.ceil((end.getTime() - start.getTime()) / 86400000)

  const byDay = {}
  allEntries.forEach((entry) => {
    const d = new Date(entry.date || entry.createdAt || entry.completedAt).toISOString().slice(0, 10)
    byDay[d] = (byDay[d] || 0) + 1
  })

  const activeDays = Object.keys(byDay).length
  const frequencyPerWeek = activeDays > 0 ? Math.round((activeDays / daysInPeriod) * 7) : 0
  const longestStreak = calculateLongestStreak(Object.keys(byDay).sort())
  const currentStreak = calculateCurrentStreak(Object.keys(byDay))

  const workoutTypes = {}
  logs.forEach((l) => {
    const wt = l.workoutType || 'other'
    workoutTypes[wt] = (workoutTypes[wt] || 0) + 1
  })

  return {
    period,
    totalWorkouts,
    totalDuration,
    totalCalories,
    activeDays,
    daysInPeriod,
    frequencyPerWeek,
    longestStreak,
    currentStreak,
    avgDurationPerSession: totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0,
    avgCaloriesPerSession: totalWorkouts > 0 ? Math.round(totalCalories / totalWorkouts) : 0,
    workoutTypes: Object.entries(workoutTypes).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count })),
    completionRate: Math.min(100, Math.round((activeDays / Math.max(1, Math.ceil(daysInPeriod / 2))) * 100)),
  }
}

export const analyzeWorkoutHistory = async ({ userId, period = '30d', query = '' }) => {
  const stats = await getWorkoutStats({ userId, period })
  const logs = await getWorkoutLogs({ userId, period, limit: 20 })
  const goal = detectGoal(query)

  const strengths = []
  const improvements = []
  const insights = []

  if (stats.frequencyPerWeek >= 4) {
    strengths.push('Duy trì tần suất tập đều đặn 4+ buổi/tuần')
    insights.push('Tần suất tập rất tốt, có thể tăng cường độ từng buổi.')
  } else if (stats.frequencyPerWeek >= 2) {
    strengths.push('Tập đều đặn 2-3 buổi/tuần')
    insights.push('Duy trì và tăng dần lên 4 buổi/tuần để tối ưu tiến độ.')
  } else {
    improvements.push('Tăng tần suất tập lên ít nhất 3 buổi/tuần')
    insights.push('Nên đặt mục tiêu tập tối thiểu 3 buổi mỗi tuần.')
  }

  if (stats.longestStreak >= 14) {
    strengths.push(`Chuỗi tập kỷ lục ${stats.longestStreak} ngày - rất đáng nể!`)
  } else if (stats.longestStreak >= 5) {
    strengths.push(`Chuỗi tập dài nhất ${stats.longestStreak} ngày, đang đi đúng hướng`)
  }

  if (stats.currentStreak >= 3) {
    strengths.push(`Đang duy trì chuỗi ${stats.currentStreak} ngày liên tiếp`)
  } else if (stats.activeDays > 0 && stats.currentStreak < 2) {
    improvements.push('Cố gắng tập liên tiếp ít nhất 3 ngày để tạo thói quen')
  }

  if (stats.totalDuration > 0) {
    const avgDuration = stats.avgDurationPerSession
    if (avgDuration < 30) {
      improvements.push('Tăng thời gian mỗi buổi tập lên 45-60 phút')
    } else if (avgDuration >= 45) {
      strengths.push(`Thời gian tập trung bình ${avgDuration} phút/buổi - chất lượng tốt`)
    }
  }

  if (stats.totalWorkouts >= 10) {
    strengths.push(`Đã hoàn thành ${stats.totalWorkouts} buổi tập trong kỳ`)
  } else if (stats.totalWorkouts > 0) {
    insights.push(`Mới có ${stats.totalWorkouts} buổi tập, hãy duy trì đều đặn hơn.`)
  }

  const workoutTypeNames = {
    strength: 'Tập tạ',
    cardio: 'Cardio',
    hiit: 'HIIT',
    flexibility: 'Dãn cơ',
    crossfit: 'CrossFit',
    yoga: 'Yoga',
    swimming: 'Bơi',
    sports: 'Thể thao',
    other: 'Khác',
  }
  const topTypes = stats.workoutTypes.slice(0, 3)

  const getWorkoutTip = (goal) => {
    const tips = {
      muscle_gain: 'Tập trung vào compound movement (squat, deadlift, bench press) với rep range 8-12.',
      fat_loss: 'Kết hợp strength training + cardio, ưu tiên HIIT 2-3 buổi/tuần.',
      weight_gain: 'Tập với tạ nặng rep thấp (5-8), ăn thặng dư calo 300-500.',
      endurance: 'Tăng dần thời gian cardio, duy trì HR zone 2 trong 30-60 phút.',
      general_fitness: 'Kết hợp đa dạng các loại hình tập luyện, duy trì đều đặn.',
    }
    return tips[goal] || tips.general_fitness
  }

  return {
    period,
    stats,
    goal,
    goalLabel: {
      muscle_gain: 'Tăng cơ',
      fat_loss: 'Giảm mỡ',
      weight_gain: 'Tăng cân',
      endurance: 'Sức bền',
      general_fitness: 'Sức khỏe tổng quát',
    }[goal] || 'Sức khỏe tổng quát',
    strengths: strengths.length > 0 ? strengths : ['Đã bắt đầu tập luyện, hãy duy trì!'],
    improvements: improvements.length > 0 ? improvements : ['Duy trì lịch tập hiện tại và tăng dần cường độ.'],
    insights,
    topWorkoutTypes: topTypes.map((t) => ({
      type: t.type,
      label: workoutTypeNames[t.type] || t.type,
      count: t.count,
    })),
    tip: getWorkoutTip(goal),
    recentLogs: logs.slice(0, 5),
  }
}

export const generateWorkoutPlan = async ({ userId, goal = 'general_fitness', frequency = 4, duration = 45, level = 'beginner', query = '' }) => {
  const detectedGoal = detectGoal(query) || goal

  const plans = {
    muscle_gain: {
      label: 'Tăng cơ',
      beginner: [
        { day: 'Thứ 2', focus: 'Ngực & Tay sau', exercises: [{ name: 'Bench Press', sets: 3, reps: 10 }, { name: 'Dumbbell Fly', sets: 3, reps: 12 }, { name: 'Tricep Pushdown', sets: 3, reps: 12 }, { name: 'Push-up', sets: 3, reps: 'tối đa' }] },
        { day: 'Thứ 4', focus: 'Lưng & Tay trước', exercises: [{ name: 'Lat Pulldown', sets: 3, reps: 10 }, { name: 'Seated Row', sets: 3, reps: 12 }, { name: 'Bicep Curl', sets: 3, reps: 12 }, { name: 'Plank', sets: 3, reps: '30s' }] },
        { day: 'Thứ 6', focus: 'Chân & Vai', exercises: [{ name: 'Squat', sets: 3, reps: 10 }, { name: 'Leg Press', sets: 3, reps: 12 }, { name: 'Shoulder Press', sets: 3, reps: 10 }, { name: 'Lateral Raise', sets: 3, reps: 12 }] },
      ],
      intermediate: [],
    },
    fat_loss: {
      label: 'Giảm mỡ',
      beginner: [
        { day: 'Thứ 2', focus: 'Full body HIIT', exercises: [{ name: 'Jumping Jacks', sets: 3, reps: '30s' }, { name: 'Mountain Climbers', sets: 3, reps: '30s' }, { name: 'Burpees', sets: 3, reps: 10 }, { name: 'High Knees', sets: 3, reps: '30s' }] },
        { day: 'Thứ 3', focus: 'Cardio nhẹ', exercises: [{ name: 'Treadmill', sets: 1, reps: '30 phút', duration: 30 }, { name: 'Stretching', sets: 1, reps: '10 phút', duration: 10 }] },
        { day: 'Thứ 5', focus: 'Strength + Cardio', exercises: [{ name: 'Goblet Squat', sets: 3, reps: 12 }, { name: 'Dumbbell Row', sets: 3, reps: 12 }, { name: 'Jump Rope', sets: 3, reps: '1 phút' }, { name: 'Plank to Toe Tap', sets: 3, reps: 12 }] },
        { day: 'Thứ 7', focus: 'Active Recovery', exercises: [{ name: 'Walking', sets: 1, reps: '30 phút' }, { name: 'Foam Rolling', sets: 1, reps: '15 phút' }] },
      ],
      intermediate: [],
    },
    general_fitness: {
      label: 'Sức khỏe tổng quát',
      beginner: [
        { day: 'Thứ 2', focus: 'Toàn thân A', exercises: [{ name: 'Bodyweight Squat', sets: 3, reps: 12 }, { name: 'Push-up', sets: 3, reps: 8 }, { name: 'Plank', sets: 3, reps: '20s' }, { name: 'Glute Bridge', sets: 3, reps: 12 }] },
        { day: 'Thứ 4', focus: 'Toàn thân B', exercises: [{ name: 'Lunges', sets: 3, reps: 10 }, { name: 'Dumbbell Row', sets: 3, reps: 10 }, { name: 'Dead Bug', sets: 3, reps: 10 }, { name: 'Bird Dog', sets: 3, reps: 10 }] },
        { day: 'Thứ 6', focus: 'Cardio & Core', exercises: [{ name: 'Jump Rope', sets: 3, reps: '30s' }, { name: 'Bicycle Crunch', sets: 3, reps: 15 }, { name: 'Russian Twist', sets: 3, reps: 12 }, { name: 'Mountain Climbers', sets: 3, reps: '20s' }] },
      ],
      intermediate: [],
    },
    endurance: {
      label: 'Sức bền',
      beginner: [
        { day: 'Thứ 2', focus: 'Cardio nền tảng', exercises: [{ name: 'Jogging', sets: 1, reps: '20 phút' }, { name: 'Stretching', sets: 1, reps: '10 phút' }] },
        { day: 'Thứ 4', focus: 'Interval chạy', exercises: [{ name: 'Chạy nhanh 1 phút / đi bộ 2 phút', sets: 6 }, { name: 'Walking cool down', sets: 1, reps: '10 phút' }] },
        { day: 'Thứ 6', focus: 'Cross Training', exercises: [{ name: 'Cycling', sets: 1, reps: '25 phút' }, { name: 'Bodyweight Circuit', sets: 2, reps: '10 reps mỗi bài' }] },
      ],
      intermediate: [],
    },
    weight_gain: {
      label: 'Tăng cân',
      beginner: [
        { day: 'Thứ 2', focus: 'Đẩy', exercises: [{ name: 'Bench Press', sets: 4, reps: 8 }, { name: 'Overhead Press', sets: 3, reps: 8 }, { name: 'Side Lateral Raise', sets: 3, reps: 10 }, { name: 'Tricep Dips', sets: 3, reps: 8 }] },
        { day: 'Thứ 4', focus: 'Kéo', exercises: [{ name: 'Deadlift', sets: 3, reps: 6 }, { name: 'Pull-up hoặc Lat Pulldown', sets: 4, reps: 8 }, { name: 'Barbell Row', sets: 3, reps: 8 }, { name: 'Bicep Curl', sets: 3, reps: 10 }] },
        { day: 'Thứ 6', focus: 'Chân', exercises: [{ name: 'Squat', sets: 4, reps: 8 }, { name: 'Romanian Deadlift', sets: 3, reps: 8 }, { name: 'Leg Press', sets: 3, reps: 10 }, { name: 'Calf Raise', sets: 4, reps: 12 }] },
      ],
      intermediate: [],
    },
  }

  const planData = plans[detectedGoal] || plans.general_fitness
  const levelPlan = planData[level] || planData.beginner
  const selectedDays = levelPlan.slice(0, Math.min(frequency, 4))

  return {
    goal: detectedGoal,
    goalLabel: planData.label,
    level,
    frequency,
    durationPerSession: duration,
    weeklySchedule: selectedDays,
    tips: [
      'Luôn khởi động 5-10 phút trước khi tập.',
      'Uống đủ nước trong và sau buổi tập.',
      'Ngủ đủ 7-8 tiếng để cơ thể phục hồi.',
      'Tăng dần khối lượng tạ khi đã quen với bài tập.',
    ],
    nutritionTip: {
      muscle_gain: 'Tăng 300-500 calo/ngày, ưu tiên protein (1.6-2.2g/kg cơ thể).',
      fat_loss: 'Ăn thâm hụt 300-500 calo/ngày, tăng chất xơ và protein.',
      weight_gain: 'Ăn thặng dư 500+ calo/ngày, chia nhỏ bữa ăn.',
      endurance: 'Carbs là chính, nạp trước khi tập 1-2 tiếng.',
      general_fitness: 'Ăn cân bằng đủ protein, chất béo lành mạnh và tinh bột.',
    }[detectedGoal] || 'Duy trì chế độ ăn cân bằng, đủ dinh dưỡng.',
  }
}

const calculateLongestStreak = (days) => {
  if (days.length === 0) return 0
  let maxStreak = 1, current = 1
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1])
    const curr = new Date(days[i])
    const diff = (curr.getTime() - prev.getTime()) / 86400000
    if (diff === 1) {
      current++
      maxStreak = Math.max(maxStreak, current)
    } else {
      current = 1
    }
  }
  return maxStreak
}

const calculateCurrentStreak = (days) => {
  if (days.length === 0) return 0
  const sorted = [...days].sort().reverse()
  let streak = 1
  const today = new Date()
  const mostRecent = new Date(sorted[0])
  const diffFromToday = (today.getTime() - mostRecent.getTime()) / 86400000
  if (diffFromToday > 2) return 0
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    const diff = (prev.getTime() - curr.getTime()) / 86400000
    if (diff === 1) streak++
    else break
  }
  return streak
}

export const getWorkoutAnalyzerContext = async (memberId) => {
  const [stats, analysis] = await Promise.all([
    getWorkoutStats({ userId: memberId, period: '30d' }),
    getWorkoutLogs({ userId: memberId, period: '30d', limit: 5 }),
  ])
  return { ...stats, recentLogs: analysis }
}
