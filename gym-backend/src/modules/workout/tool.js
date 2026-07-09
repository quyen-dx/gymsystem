import { analyzeWorkoutHistory, generateWorkoutPlan } from '../../ai/services/workoutAnalyzerService.js'
import { getSmartRecommendations } from '../../ai/services/smartRecommendService.js'

export default [
  {
    name: 'analyzeWorkout',
    description: 'Phân tích lịch sử tập luyện của người dùng trong khoảng thời gian nhất định.',
    subjects: ['workout', 'progress', 'health'],
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string', description: 'Khoảng thời gian phân tích (VD: "7d", "30d") (optional, default: "30d")' },
      },
    },
    handler: async ({ userId, period = '30d' }) => {
      const analysis = await analyzeWorkoutHistory({ userId, period })
      return { type: 'workout_analyzer', ...analysis }
    },
  },
  {
    name: 'generateWorkoutPlan',
    description: 'Tạo giáo án tập luyện phù hợp với mục tiêu và thể trạng người dùng.',
    subjects: ['workout', 'health'],
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'Mục tiêu tập luyện (optional, default: "general_fitness")' },
        frequency: { type: 'number', description: 'Số buổi/tuần (optional, default: 4)' },
        level: { type: 'string', description: 'Trình độ: beginner/intermediate/advanced (optional, default: "beginner")' },
      },
    },
    handler: async ({ userId, goal = 'general_fitness', frequency = 4, level = 'beginner' }) => {
      const plan = await generateWorkoutPlan({ userId, goal, frequency: parseInt(frequency, 10) || 4, level })
      return { type: 'workout_plan', ...plan }
    },
  },
  {
    name: 'getSmartRecommendations',
    description: 'Đề xuất gói tập phù hợp nhất dựa trên mục tiêu, ngân sách và tần suất tập.',
    subjects: ['plan', 'membership'],
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'Mục tiêu tập luyện' },
        budget: { type: 'number', description: 'Ngân sách tối đa' },
        frequency: { type: 'number', description: 'Số buổi/tuần' },
      },
    },
    handler: async ({ userId, goal, budget, frequency }) => {
      const query = [goal, budget, frequency].filter(Boolean).join(' ')
      return getSmartRecommendations({ userId, query })
    },
  },
]
