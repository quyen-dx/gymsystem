const SPECIALIZATION_GOALS = {
  GYM: ['Tăng cơ', 'Giảm mỡ', 'Tăng sức mạnh', 'Cardio & Sức bền', 'Duy trì vóc dáng', 'Tăng cân'],
  YOGA: ['Tăng sự dẻo dai', 'Cải thiện thăng bằng', 'Tăng linh hoạt', 'Giảm căng thẳng', 'Phục hồi cơ thể', 'Duy trì sức khỏe'],
  BOXING: ['Nâng cao kỹ thuật', 'Tăng phản xạ', 'Cardio & Sức bền', 'Giảm mỡ', 'Tăng sức mạnh', 'Chuẩn bị thi đấu'],
  ZUMBA: ['Cardio & Sức bền', 'Giảm mỡ', 'Tăng linh hoạt', 'Duy trì vóc dáng', 'Giải trí & vận động'],
  PILATES: ['Tăng linh hoạt', 'Tăng sức mạnh', 'Cải thiện tư thế', 'Phục hồi cơ thể', 'Giảm căng thẳng'],
  CARDIO: ['Cardio & Sức bền', 'Giảm mỡ', 'Tăng sức bền tim mạch', 'Duy trì vóc dáng'],
  AEROBICS: ['Cardio & Sức bền', 'Giảm mỡ', 'Tăng linh hoạt', 'Duy trì sức khỏe'],
  CROSSFIT: ['Tăng sức mạnh', 'Cardio & Sức bền', 'Tăng cơ', 'Giảm mỡ', 'Nâng cao thể lực toàn diện'],
  KICKBOXING: ['Nâng cao kỹ thuật', 'Tăng phản xạ', 'Cardio & Sức bền', 'Giảm mỡ', 'Tăng sức mạnh'],
  DANCE: ['Tăng linh hoạt', 'Cardio & Sức bền', 'Duy trì vóc dáng', 'Giải trí & vận động'],
  MUAYTHAI: ['Nâng cao kỹ thuật', 'Tăng phản xạ', 'Cardio & Sức bền', 'Tăng sức mạnh', 'Chuẩn bị thi đấu'],
  FUNCTIONAL: ['Tăng sức mạnh', 'Cardio & Sức bền', 'Nâng cao thể lực toàn diện', 'Phục hồi cơ thể', 'Duy trì vóc dáng'],
  OTHER: ['Tăng cơ', 'Giảm mỡ', 'Tăng sức mạnh', 'Cardio & Sức bền', 'Duy trì vóc dáng', 'Phục hồi cơ thể', 'Khác'],
}

export const getGoalsBySpecialization = (specializationId) => {
  if (!specializationId) return []
  const key = String(specializationId).toUpperCase()
  return SPECIALIZATION_GOALS[key] || SPECIALIZATION_GOALS.OTHER || []
}

export const isValidGoalForSpecialization = (specializationId, goal) => {
  const goals = getGoalsBySpecialization(specializationId)
  return goals.includes(goal)
}

export const getAllSpecializations = () => {
  return Object.entries(SPECIALIZATION_GOALS).map(([key, goals]) => ({
    id: key,
    goals,
  }))
}

export default SPECIALIZATION_GOALS
