const normalizeLanguage = (lang) => lang === 'en' ? 'en' : 'vi'

export const buildGoalAnswer = ({ intent, goal, lang = 'vi' } = {}) => {
  const language = normalizeLanguage(lang)
  if (language === 'en') {
    if (intent === 'fitness_goal_selection' && goal) {
      return `Your current goal is set to **${goal.replace('_', ' ')}**. You can track your progress weekly from your profile — I will help you stay on target.`
    }
    return [
      'Here are the training goals you can choose from:',
      '',
      '- Fat loss',
      '- Muscle gain',
      '- Endurance',
      '- Better health',
      '- Physique maintenance',
      '',
      'Pick the one that matches what you want to focus on right now.'
    ].join('\n')
  }

  if (intent === 'fitness_goal_selection' && goal) {
    const names = {
      fat_loss: 'Giảm mỡ',
      muscle_gain: 'Tăng cơ',
      endurance: 'Tăng sức bền',
      health: 'Cải thiện sức khỏe',
      maintenance: 'Duy trì vóc dáng',
    }
    return `Mục tiêu phù hợp với bạn hiện tại là **${names[goal] || 'Cải thiện sức khỏe'}**. Bạn có thể lưu lại và mình sẽ giúp theo dõi tiến độ theo tuần nhé.`
  }

  return [
    'Bạn có thể chọn một trong các mục tiêu tập luyện sau:',
    '',
    '- Giảm mỡ',
    '- Tăng cơ',
    '- Tăng sức bền',
    '- Cải thiện sức khỏe',
    '- Duy trì vóc dáng',
    '',
    'Hãy chọn mục tiêu gần nhất với điều bạn muốn ưu tiên nhất hiện tại.'
  ].join('\n')
}

export const buildNutritionAnswer = ({ intent, goal, lang = 'vi' } = {}) => {
  const language = normalizeLanguage(lang)
  if (language === 'en') {
    if (intent === 'nutrition_pre_workout') return 'Before training, go for something light and easy to digest — banana with yogurt, or rice with lean meat. Keep fatty or heavy meals away from training time for better performance.'
    if (intent === 'nutrition_macro') return 'A good protein target to aim for is about **1.6-2.2g per kg of body weight per day**, especially for muscle gain or fat loss. Adjust based on your total calories, health, and activity level.'
    if (intent === 'nutrition_meal_plan') return 'Here is a sample day: breakfast with eggs or yogurt and oats, lunch with rice, lean protein, and vegetables, snack with fruit or yogurt, dinner with fish/chicken/tofu and vegetables.'
    return 'For fat loss, focus on lean protein, plenty of vegetables, high-fiber carbs, and a moderate calorie deficit. For muscle gain, keep protein high and add enough carbs around your training sessions.'
  }

  if (intent === 'nutrition_pre_workout') {
    return 'Trước khi tập, bạn nên ăn nhẹ, dễ tiêu — như chuối với sữa chua, hoặc cơm với thịt nạc. Tránh đồ nhiều dầu mỡ sát giờ tập để không bị nặng bụng nhé.'
  }
  if (intent === 'nutrition_macro') {
    return 'Một mốc protein tham khảo tốt là khoảng **1.6-2.2g/kg cân nặng/ngày** nếu bạn muốn tăng cơ hoặc giảm mỡ. Bạn nên điều chỉnh theo tổng calo, sức khỏe và mức vận động của mình nha.'
  }
  if (intent === 'nutrition_meal_plan') {
    return [
      'Mình gợi ý thực đơn 1 ngày như sau:',
      '',
      '- Sáng: trứng hoặc sữa chua Hy Lạp với yến mạch',
      '- Trưa: cơm vừa đủ, thịt nạc/cá/đậu phụ và nhiều rau',
      '- Phụ: trái cây hoặc sữa chua không đường',
      '- Tối: cá/gà/đậu phụ, rau và tinh bột vừa phải',
      '',
      goal === 'fat_loss' ? 'Nếu giảm cân, bạn giữ tinh bột vừa phải và ưu tiên đạm nạc nhé.' : 'Nếu tăng cơ, bạn tăng thêm tinh bột quanh buổi tập và giữ đủ đạm.'
    ].join('\n')
  }
  return goal === 'muscle_gain'
    ? 'Để tăng cơ hiệu quả, bạn nên ăn đủ đạm, bổ sung tinh bột quanh buổi tập và duy trì thặng dư calo nhẹ. Ưu tiên thịt nạc, cá, trứng, sữa, đậu, cơm/khoai/yến mạch và rau xanh.'
    : 'Để giảm cân hoặc giảm mỡ, bạn hãy ưu tiên đạm nạc, rau xanh, tinh bột giàu chất xơ và kiểm soát tổng calo. Đừng tự cắt toàn bộ tinh bột nhé — dễ giảm hiệu suất tập lắm.'
}

export const buildWorkoutDomainAnswer = ({ intent, goal, lang = 'vi' } = {}) => {
  const language = normalizeLanguage(lang)
  if (language === 'en') {
    if (intent === 'workout_safety') return 'If your back hurts during squats, stop the set, reduce the load, and check your bracing and depth. Do not push through sharp pain. If the pain lingers or radiates, it is best to see a professional or PT to check your form.'
    if (intent === 'workout_plan') return 'A balanced 4-day week could look like: upper body, lower body, rest or light cardio, upper body, lower body, then recovery. Adjust the volume to match your current level.'
    if (intent === 'workout_exercise_detail') return 'For chest day, you could do: a press movement, incline press, fly variation, push-ups or dips, then some light shoulder and scapular work to keep things balanced.'
    return 'For fat loss, combine strength training 3-4 times a week with moderate cardio and daily steps. For muscle gain, focus on progressive overload, compound lifts, enough recovery, and consistent volume.'
  }

  if (intent === 'workout_safety') {
    return 'Nếu bạn bị đau lưng khi squat, hãy dừng set lại, giảm tải, kiểm tra gồng core và độ sâu khi xuống. Đừng cố tập tiếp nếu đau nhói hoặc tê lan — lúc đó nên gặp PT hoặc chuyên viên y tế để kiểm tra form nhé.'
  }
  if (intent === 'workout_plan') {
    return [
      'Mình gợi ý lịch 4 buổi/tuần như sau:',
      '',
      '- Buổi 1: Thân trên',
      '- Buổi 2: Thân dưới',
      '- Buổi 3: Nghỉ hoặc cardio nhẹ',
      '- Buổi 4: Thân trên',
      '- Buổi 5: Thân dưới',
      '',
      'Nhớ giữ 1-2 ngày hồi phục và tăng tải từ từ theo khả năng của bạn nhé.'
    ].join('\n')
  }
  if (intent === 'workout_exercise_detail') {
    return [
      'Nếu hôm nay tập ngực, bạn có thể tham khảo:',
      '',
      '- Đẩy ngực ngang',
      '- Đẩy ngực dốc lên',
      '- Ép ngực hoặc fly',
      '- Chống đẩy hoặc dips tùy trình độ',
      '- Bài phụ cho vai sau/xương bả vai để cân bằng cơ',
      '',
      'Chọn mức tạ mà bạn kiểm soát được kỹ thuật tốt nhất nhé.'
    ].join('\n')
  }
  return goal === 'muscle_gain'
    ? 'Để tăng cơ, bạn nên ưu tiên bài compound (nhiều khớp), tăng tải dần dần, tập mỗi nhóm cơ 2 lần/tuần nếu hồi phục tốt và ngủ đủ giấc. Nhớ giữ kỹ thuật ổn định trước khi tăng tạ nhé.'
    : 'Để giảm cân, bạn hãy kết hợp tập sức mạnh 3-4 buổi/tuần, cardio vừa phải và tăng số bước đi bộ hằng ngày. Tập tạ giúp giữ cơ, cardio hỗ trợ đốt năng lượng — cả hai đều quan trọng.'
}

export const buildBookingAnswer = ({ intent, lang = 'vi' } = {}) => {
  if (lang === 'en') return 'I do not have booking data available for this request right now. Try asking about available trainers or schedules.'
  if (intent === 'booking_create') return 'Bạn có thể đặt lịch với PT trong khu vực đặt lịch trên ứng dụng. Mình cần xem lịch trống của PT trước, để mình kiểm tra giúp bạn nhé.'
  if (intent === 'booking_cancel') return 'Bạn có thể hủy lịch ở trang lịch đã đặt, nếu lịch còn trong thời gian cho phép hủy. Mình sẽ không tự động hủy nếu chưa có xác nhận từ bạn đâu.'
  return 'Hiện mình chưa có dữ liệu lịch đặt phù hợp. Bạn muốn đặt lịch mới hay xem lại lịch cũ?'
}
