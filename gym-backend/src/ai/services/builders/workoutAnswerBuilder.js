export const hasWorkoutGoalAdviceIntent = ({ query = '', deps }) => {
  const { normalizeForIntent, hasPlanSelectionContext, hasShopIntent } = deps
  const normalized = normalizeForIntent(query)
  if (hasPlanSelectionContext(query) || hasShopIntent(query)) return false
  const goalTerms = /\b(muc tieu|goal|goals|giam can|giam mo|tang co|tang can|suc ben|khoe hon|fitness|body|lean|bulk)\b/.test(normalized)
  const adviceTerms = /\b(goi y|de xuat|nen|phu hop|the nao|huong nao|chon|dat|recommend|suggest|advice|should|suitable)\b/.test(normalized)
  const desireTerms = /\b(muon|can|thich|uu tien|want|need|prefer)\b/.test(normalized)
  const startTerms = /\b(bat dau tap|moi tap|bat dau|start training|begin training|newbie|beginner)\b/.test(normalized)
  const undecidedTerms = /\b(chua biet|khong biet|phan van|giua|hay|or)\b/.test(normalized)
  const workoutTerms = /\b(tap|tap luyen|tap gym|workout|training|fitness|bai tap)\b/.test(normalized)
  return (goalTerms && adviceTerms)
    || (goalTerms && desireTerms)
    || (startTerms && (adviceTerms || workoutTerms))
    || (undecidedTerms && goalTerms)
}

export const hasWorkoutProgressAdviceIntent = ({ query = '', normalizeForIntent }) => {
  const normalized = normalizeForIntent(query)
  return /\b(tap gi|nen tap|tap on khong|tap co on|thang nay.*tap|tien do tap|tap luyen.*on|workout progress|training progress|what should i train)\b/.test(normalized)
}

export const buildWorkoutFrequencyAnswer = ({ query, toolData, language, deps }) => {
  const { normalizeLanguage, normalizeWeeklyFrequency, normalizeForIntent } = deps
  const lang = normalizeLanguage(language)
  const frequency = normalizeWeeklyFrequency(query)
  const normalized = normalizeForIntent(query)
  const isDaily = /\btap\s+moi\s+ngay\b/.test(normalized)
  const isSteady = /\btap\s+deu\b/.test(normalized)
  const label = frequency
    ? (lang === 'en' ? `${frequency} sessions/week` : `${frequency} buổi/tuần`)
    : isDaily
      ? (lang === 'en' ? 'daily training' : 'tập mỗi ngày')
      : isSteady
        ? (lang === 'en' ? 'steady training' : 'tập đều')
        : (lang === 'en' ? 'this training frequency' : 'tần suất này')
  const answer = lang === 'en'
    ? [
        `${label} is a fairly solid training frequency.`,
        'If your goal is muscle gain, it can work well when recovery and nutrition are managed.',
        'If you are new, monitor soreness, sleep, and recovery before increasing intensity.',
        '',
        'Are you aiming for muscle gain, fat loss, or endurance?',
      ].join('\n')
    : [
        `Tần suất ${label} khá cao.`,
        'Nếu mục tiêu tăng cơ thì phù hợp.',
        'Nếu mới tập nên theo dõi hồi phục.',
        '',
        'Bạn đang muốn tăng cơ, giảm mỡ hay tăng sức bền?',
      ].join('\n')

  return {
    type: 'workout_advice',
    answer,
    data: toolData,
    cards: [],
    recommendedPlan: null,
    plans: [],
    planPayload: null,
    suggestions: lang === 'en'
      ? ['Muscle gain', 'Fat loss', 'Endurance']
      : ['Tăng cơ', 'Giảm mỡ', 'Tăng sức bền'],
    mode: 'gym',
    provider: 'rule_based',
    model: 'local',
  }
}

export const buildGenericWorkoutAdviceAnswer = ({ query, classifierResult = {}, toolData = {}, language, deps }) => {
  const {
    normalizeLanguage,
    inferGoalEntity,
    normalizeWeeklyFrequency,
    inferExperienceLevel,
    hasBodyImageAnalysisIntent,
    formatReadableAnswer,
  } = deps
  const lang = normalizeLanguage(language)
  const goal = classifierResult.entities?.goal || inferGoalEntity(query)
  const frequency = classifierResult.entities?.frequencyPerWeek || normalizeWeeklyFrequency(query)
  const level = inferExperienceLevel(query)
  const stats = toolData.workoutProgress || toolData.workout || {}
  const totalWorkouts = Number(stats.totalWorkouts ?? stats.stats?.totalWorkouts ?? 0)
  const imageAnalysis = classifierResult.action === 'analyze' || hasBodyImageAnalysisIntent(query)

  const goalLabels = {
    muscle_gain: lang === 'en' ? 'muscle gain' : 'tăng cơ',
    fat_loss: lang === 'en' ? 'fat loss' : 'giảm mỡ',
    weight_gain: lang === 'en' ? 'healthy weight gain' : 'tăng cân lành mạnh',
    general_fitness: lang === 'en' ? 'general fitness' : 'sức khỏe tổng quát',
  }

  const recommendedGoal = goal || 'general_fitness'
  const conclusion = imageAnalysis
    ? (lang === 'en'
      ? 'I can help analyze your progress image, but I need the image or body metrics first.'
      : 'Mình có thể hỗ trợ đọc ảnh tiến độ, nhưng cần bạn gửi ảnh hoặc chỉ số cơ thể trước.')
    : (lang === 'en'
      ? `Start with a ${goalLabels[recommendedGoal]} goal and make it measurable for the next 4 weeks.`
      : `Bạn nên bắt đầu với mục tiêu ${goalLabels[recommendedGoal]} và đo được trong 4 tuần tới.`)

  const reasons = []
  if (frequency) {
    reasons.push(lang === 'en'
      ? `${frequency} sessions/week is enough to build a clear training target.`
      : `${frequency} buổi/tuần là đủ để đặt mục tiêu tập rõ ràng.`)
  } else {
    reasons.push(lang === 'en'
      ? 'Because you have not given a weekly frequency, the safest first goal is consistency.'
      : 'Vì bạn chưa nói tần suất tập, mục tiêu nền tảng nên là duy trì đều trước.')
  }
  if (level === 'beginner') {
    reasons.push(lang === 'en'
      ? 'As a beginner, consistency and technique should come before high intensity.'
      : 'Nếu mới tập, độ đều và kỹ thuật nên ưu tiên trước cường độ cao.')
  } else if (level === 'experienced') {
    reasons.push(lang === 'en'
      ? 'With prior experience, you can use progressive overload or a more specific performance target.'
      : 'Nếu đã có kinh nghiệm, bạn có thể dùng tăng tải dần hoặc mục tiêu hiệu suất cụ thể hơn.')
  }
  if (totalWorkouts > 0) {
    reasons.push(lang === 'en'
      ? `GymPro has ${totalWorkouts} recent workout record(s), so the target can be adjusted from your actual rhythm.`
      : `GymPro có ${totalWorkouts} buổi tập gần đây, nên mục tiêu có thể bám theo nhịp tập thật của bạn.`)
  }
  if (!goal) {
    reasons.push(lang === 'en'
      ? 'A broad fitness goal keeps the plan flexible until you decide whether body composition or endurance matters more.'
      : 'Mục tiêu sức khỏe tổng quát giúp lịch tập linh hoạt trước khi bạn chọn ưu tiên vóc dáng hay sức bền.')
  }
  if (imageAnalysis) {
    reasons.push(lang === 'en'
      ? 'A photo can help review visible progress, but it should be combined with weight, waist, height, and training frequency.'
      : 'Ảnh có thể giúp xem tiến độ bên ngoài, nhưng nên đi kèm cân nặng, vòng eo, chiều cao và tần suất tập.')
  }

  const alternatives = lang === 'en'
    ? [
        'Fat loss: track waist, weight trend, and 3 cardio/strength sessions per week.',
        'Muscle gain: track main lifts and train each muscle group about 2 times per week.',
        'Endurance: track continuous cardio time and recovery heart rate.',
      ]
    : [
        'Giảm mỡ: theo dõi vòng eo, xu hướng cân nặng và 3 buổi cardio/sức mạnh mỗi tuần.',
        'Tăng cơ: theo dõi mức tạ chính và tập mỗi nhóm cơ khoảng 2 lần/tuần.',
        'Tăng sức bền: theo dõi thời gian cardio liên tục và nhịp hồi phục.',
      ]

  return {
    type: 'workout_advice',
    answer: formatReadableAnswer({
      conclusion,
      reasons,
      alternativeTitle: lang === 'en' ? 'Goal options' : 'Mục tiêu có thể chọn',
      alternatives: goal ? [] : alternatives,
      lang,
    }),
    data: toolData,
    cards: [],
    recommendedPlan: null,
    plans: [],
    planPayload: null,
    suggestions: lang === 'en'
      ? ['I want fat loss', 'I want muscle gain', 'I can train 3 sessions/week']
      : ['Tôi muốn giảm mỡ', 'Tôi muốn tăng cơ', 'Tôi tập được 3 buổi/tuần'],
    mode: 'gym',
    provider: 'generic_safe_answer',
    model: 'local',
    metadata: {
      intent: classifierResult.intent || 'workout_advice',
      answeredBy: 'generic_safe_answer',
      route: 'GENERIC_WORKOUT_ADVICE',
      usedFallback: true,
      classifier: classifierResult,
    },
  }
}

export const buildWorkoutAnalysisAnswer = (analysis, lang = 'vi') => {
  const s = analysis.stats
  const lines = []
  lines.push(lang === 'en' ? 'WORKOUT ANALYSIS' : 'PHÂN TÍCH TẬP LUYỆN')
  lines.push('')
  lines.push(lang === 'en'
    ? `Period: Last ${analysis.period}`
    : `Kỳ phân tích: ${analysis.periodLabel || '30 ngày qua'}`)
  lines.push(lang === 'en'
    ? `Total workouts: ${s.totalWorkouts}`
    : `Tổng số buổi: ${s.totalWorkouts}`)
  lines.push(lang === 'en'
    ? `Frequency: ~${s.frequencyPerWeek}/week`
    : `Tần suất: ~${s.frequencyPerWeek}/tuần`)
  if (s.totalDuration > 0) {
    lines.push(lang === 'en'
      ? `Total duration: ${s.totalDuration}min (avg ${s.avgDurationPerSession}min/session)`
      : `Tổng thời lượng: ${s.totalDuration}phút (TB ${s.avgDurationPerSession}phút/buổi)`)
  }
  if (s.totalCalories > 0) {
    lines.push(lang === 'en'
      ? `Calories burned: ~${s.totalCalories} kcal (${s.avgCaloriesPerSession} kcal/session)`
      : `Calo tiêu thụ: ~${s.totalCalories} kcal (${s.avgCaloriesPerSession} kcal/buổi)`)
  }
  lines.push(lang === 'en'
    ? `Active days: ${s.activeDays}/${s.daysInPeriod}`
    : `Ngày tập: ${s.activeDays}/${s.daysInPeriod}`)
  lines.push(lang === 'en'
    ? `Longest streak: ${s.longestStreak}d | Current: ${s.currentStreak}d`
    : `Chuỗi dài nhất: ${s.longestStreak} ngày | Hiện tại: ${s.currentStreak} ngày`)
  if (analysis.topWorkoutTypes?.length > 0) {
    const types = analysis.topWorkoutTypes.map((t) => `${t.label} (${t.count})`).join(' · ')
    lines.push(lang === 'en' ? `Top types: ${types}` : `Loại hình chính: ${types}`)
  }
  lines.push('')
  lines.push(lang === 'en' ? 'Strengths:' : 'Điểm mạnh:')
  analysis.strengths.forEach((s) => lines.push(`  • ${s}`))
  lines.push('')
  lines.push(lang === 'en' ? 'Can improve:' : 'Cần cải thiện:')
  analysis.improvements.forEach((imp) => lines.push(`  • ${imp}`))
  lines.push('')
  lines.push(lang === 'en' ? 'Tip:' : 'Gợi ý:')
  lines.push(`  ${analysis.tip}`)
  return lines.join('\n')
}
