const normalizeLanguage = (lang) => lang === 'en' ? 'en' : 'vi'
import { planResponseStyle } from './responsePlanner.js'

// Template selector with per-call rotation for variety.
// Same query returns different templates on successive calls.
let _templateCounter = 0
const pickTemplate = (query = '', templates = []) => {
  if (templates.length === 0) return ''
  _templateCounter++
  const idx = _templateCounter % templates.length
  return templates[idx]
}

const GOAL_LABEL = {
  fat_loss: 'giảm mỡ',
  muscle_gain: 'tăng cơ',
  weight_gain: 'tăng cân',
  weight_loss: 'giảm cân',
  endurance: 'sức bền',
  health: 'sức khỏe',
  maintenance: 'duy trì',
}

// ── VI templates ──────────────────────────────────────────────

const T_VN_MUSCLE_GAIN = [
  'Để tăng cơ hiệu quả, bạn cần đủ đạm, tinh bột quanh buổi tập và thặng dư calo nhẹ. Ưu tiên thịt nạc, cá, trứng, sữa, đậu, cơm, khoai, yến mạch và rau xanh. Giấc ngủ và hồi phục cũng quan trọng không kém đâu.',
  'Khi muốn tăng cơ, năng lượng phải dư một chút. Hãy ăn đủ đạm trong mỗi bữa — ức gà, cá hồi, trứng, đậu phụ đều tốt. Tinh bột trước và sau tập sẽ giúp bạn tập nặng hơn và phục hồi nhanh hơn.',
  'Tăng cơ không chỉ là tập nặng — dinh dưỡng quyết định 70% kết quả. Mỗi bữa nên có đạm, tinh bột và rau. Uống đủ nước và ngủ đủ 7-8 tiếng mỗi đêm. Kiên trì nhé!',
  'Cốt lõi để tăng cơ là đủ calo, đủ đạm, và tập luyện có tiến triển. Bạn nên ăn khoảng 1.6-2g đạm/kg cân nặng, chia đều các bữa. Tinh bột như gạo lứt, khoai lang, yến mạch là lựa chọn tốt.',
  'Để xây cơ, cơ thể cần đạm và năng lượng. Sau tập là thời điểm vàng để nạp đạm và tinh bột — một ly sữa chuối hoặc cơm với thịt nạc sẽ giúp cơ phục hồi tốt. Đừng quên rau xanh để hỗ trợ tiêu hóa nhé.',
]

const T_VN_FAT_LOSS = [
  'Giảm mỡ hiệu quả cần thâm hụt calo nhẹ, đủ đạm và tập luyện đều. Ưu tiên đạm nạc, rau xanh, tinh bột giàu chất xơ. Đừng cắt tinh bột hoàn toàn — cơ thể cần năng lượng để vận động và đốt mỡ.',
  'Khi giảm mỡ, hãy giữ đạm cao để hạn chế mất cơ. Ăn nhiều rau trước bữa chính để no nhanh mà ít calo. Tinh bột hấp thụ chậm như gạo lứt, khoai lang, yến mạch sẽ giúp no lâu và ổn định đường huyết.',
  'Giảm mỡ không có nghĩa là nhịn đói. Chia nhỏ bữa ăn, uống đủ nước, và ưu tiên thực phẩm nguyên bản. Kết hợp cardio nhẹ và đi bộ nhiều hơn trong ngày cũng giúp tăng tiêu hao năng lượng.',
  'Bí quyết giảm mỡ bền vững: ăn đủ đạm (1.6-2g/kg), nhiều rau, tinh bột vừa phải, và kiểm soát dầu mỡ. Tập tạ giúp giữ cơ, cardio giúp đốt thêm calo. Kiên trì ít nhất 4-6 tuần để thấy thay đổi rõ rệt.',
  'Để giảm mỡ an toàn, bạn không cần ép mình vào chế độ quá khắt khe. Giảm dần đường, nước ngọt, đồ chiên rán. Tăng rau, đạm nạc và uống đủ nước. Mỗi tuần giảm 0.5-1% trọng lượng cơ thể là tốt nhất.',
]

const T_VN_WEIGHT_GAIN = [
  'Tăng cân cần thặng dư calo và đủ đạm. Thêm các bữa phụ giàu năng lượng như bơ, sữa nguyên kem, bơ đậu phộng, hạt và trái cây khô. Tập tạ đều đặn để đảm bảo số cân tăng thêm là cơ, không chỉ mỡ.',
  'Nếu bạn muốn tăng cân, hãy ăn nhiều hơn nhu cầu cơ bản khoảng 300-500 calo mỗi ngày. Chia thành 5-6 bữa nhỏ để dễ nạp hơn. Sinh tố trái cây với bơ, sữa và hạt là cách tăng calo dễ uống.',
  'Để tăng cân lành mạnh, ưu tiên thực phẩm giàu dinh dưỡng: cơm, thịt, cá, trứng, sữa, bơ, khoai lang, các loại hạt. Tránh đồ ăn vặt nhiều đường — calo rỗng không giúp bạn khỏe hơn đâu.',
  'Tăng cân khó hơn giảm cân với nhiều người. Bí quyết là ăn trước khi đói, uống sữa hoặc sinh tố giữa các bữa, và tập tạ nặng để kích thích cơ phát triển. Nghỉ ngơi đủ cũng quan trọng như tập luyện.',
]

const T_VN_PRE_WORKOUT = [
  'Trước khi tập 1-2 tiếng, bạn nên ăn nhẹ dễ tiêu — chuối với sữa chua, bánh mì nguyên cám với trứng, hoặc yến mạch với sữa. Tránh đồ nhiều dầu mỡ hoặc quá no sát giờ tập.',
  'Bữa ăn nhẹ trước tập lý tưởng nên có tinh bột hấp thụ nhanh và một ít đạm. Chuối, bánh mì, yến mạch kết hợp với trứng hoặc sữa chua Hy Lạp là lựa chọn tốt. Uống đủ nước trước buổi tập nhé.',
  'Trước tập, ưu tiên tinh bột để có năng lượng: chuối, bánh mì nguyên cám, gạo lứt hoặc yến mạch. Thêm một ít đạm (trứng, sữa) để ổn định đường huyết. Tránh đồ uống có gas hoặc nhiều đường.',
  'Nếu tập vào sáng sớm, một quả chuối hoặc bánh mì nướng với bơ đậu phộng là đủ. Nếu tập chiều, bữa chính cách giờ tập 2-3 tiếng, kèm bữa nhẹ trước tập 30-60 phút. Lắng nghe cơ thể bạn.',
]

const T_VN_POST_WORKOUT = [
  'Sau tập 30-60 phút là thời điểm vàng để nạp dinh dưỡng. Một bữa có đạm và tinh bột — như cơm với ức gà và rau, hoặc sữa chuối với bột đạm — sẽ giúp cơ phục hồi và phát triển tốt nhất.',
  'Sau buổi tập, cơ thể cần đạm để sửa chữa cơ và tinh bột để bù năng lượng. Hãy ăn trong vòng 1-2 tiếng sau tập. Cá hồi với khoai lang, ức gà với cơm, hoặc trứng với bánh mì đều là lựa chọn tốt.',
  'Đừng bỏ qua bữa sau tập! Đây là lúc cơ thể hấp thu dinh dưỡng tốt nhất. Đạm (thịt, cá, trứng, sữa) kết hợp với tinh bột (cơm, khoai, yến mạch) sẽ giúp bạn hồi phục nhanh hơn và giảm đau nhức.',
  'Sau tập nặng, uống đủ nước trước, sau đó ăn bữa có đạm và tinh bột trong vòng 2 tiếng. Nếu không có điều kiện ăn ngay, một ly sữa chocolate hoặc sữa chuối là giải pháp nhanh và tiện lợi.',
]

const T_VN_MEAL_PLAN = [
  [
    'Mình gợi ý thực đơn 1 ngày:',
    '',
    '- Sáng: trứng ốp la với bánh mì nguyên cám, hoặc yến mạch với sữa chua',
    '- Trưa: cơm gạo lứt, ức gà áp chảo, rau luộc',
    '- Phụ: trái cây tươi hoặc sữa chua không đường',
    '- Tối: cá hồi/khoai lang/xà lách, hoặc đậu phụ sốt cà chua với cơm',
  ].join('\n'),
  [
    'Thực đơn tham khảo trong ngày:',
    '',
    '- Sáng: bánh mì nguyên cám với bơ và trứng, kèm cà phê hoặc trà',
    '- Trưa: cơm trắng vừa đủ, thịt bò xào rau cải, canh rau',
    '- Phụ: hạt điều hoặc hạnh nhân, kèm trái cây',
    '- Tối: cá basa kho tộ, canh chua, rau sống, cơm nhẹ',
  ].join('\n'),
  [
    'Gợi ý bữa ăn trong ngày:',
    '',
    '- Sáng: bột yến mạch nấu với sữa tươi, thêm chuối và hạt chia',
    '- Trưa: cơm, thịt heo nạc luộc, rau muống luộc, chén canh',
    '- Phụ: sữa chua Hy Lạp với trái cây',
    '- Tối: ức gà nướng, salad rau củ, khoai lang hấp',
  ].join('\n'),
]

const GOAL_SUFFIX = {
  fat_loss: '\n\nNếu giảm mỡ, giữ tinh bột vừa phải và ưu tiên đạm nạc nhé.',
  muscle_gain: '\n\nNếu tăng cơ, tăng thêm tinh bột quanh buổi tập và giữ đủ đạm nhé.',
  weight_gain: '\n\nNếu tăng cân, thêm bữa phụ giàu năng lượng như bơ, sữa, hạt.',
}

// ── Food list style templates ───────────────────────────────────
// These list specific foods, structured as categories.

const T_VN_FOOD_MUSCLE = [
  // Template 0: Priority-based — most important foods first
  'Để tăng cơ, ưu tiên các thực phẩm sau:\n\nƯu tiên hàng đầu — Đạm chất lượng:\n• Trứng, ức gà, thịt bò, cá hồi, đậu phụ\n\nKế đến — Tinh bột cho năng lượng tập:\n• Cơm, khoai lang, yến mạch, bánh mì nguyên cám\n\nVà — Rau xanh, chất béo lành mạnh:\n• Bông cải, rau muống, bơ, dầu ô liu, hạt',
  // Template 1: Category-based (current format)
  'Nhóm thực phẩm tốt cho tăng cơ:\n\nProtein chất lượng cao:\n• Trứng, ức gà, thịt bò, cá ngừ, tôm\n• Đậu phụ, tempeh, sữa đậu nành\n\nCarb phức hợp:\n• Gạo lứt, khoai tây, bánh mì nguyên cám, yến mạch\n\nChất béo lành mạnh:\n• Bơ, hạt óc chó, hạnh nhân, dầu ô liu',
  // Template 2: Meal-based — what to eat at each meal
  'Gợi ý bữa ăn trong ngày để tăng cơ:\n\nBữa sáng:\n• Trứng ốp la + bánh mì nguyên cám + sữa tươi\n• Hoặc yến mạch nấu sữa + chuối + hạt\n\nBữa trưa & tối:\n• Cơm vừa đủ + thịt/cá/đậu phụ + rau luộc\n• Ức gà áp chảo + khoai lang + salad\n\nBữa phụ:\n• Sữa chua Hy Lạp + trái cây + hạt',
]

const T_VN_FOOD_FAT_LOSS = [
  // Template 0: Priority-based (what to eat more / less)
  'Khi giảm mỡ, hãy ưu tiên:\n\n✅ Nên ăn nhiều:\n• Rau xanh, trái cây ít ngọt, đạm nạc\n• Uống đủ 2-3 lít nước mỗi ngày\n\n❌ Nên hạn chế:\n• Đồ chiên rán, nước ngọt, bánh kẹo ngọt\n• Tinh bột trắng (cơm trắng, bánh mì trắng)\n\nMẹo: ăn rau trước bữa chính để no nhanh, giảm calo.',
  // Template 1: Category-based with food swaps
  'Thay thế thông minh khi giảm mỡ:\n\nThay vì:\n• Cơm trắng → gạo lứt, khoai lang, yến mạch\n• Thịt mỡ → ức gà, cá lóc, thịt heo nạc, đậu phụ\n• Sữa đặc → sữa chua không đường, sữa hạt\n\nGiữ đạm cao (1.6-2g/kg) để hạn chế mất cơ trong quá trình giảm mỡ.',
]

const T_VN_FOOD_WEIGHT_GAIN = [
  // Template 0: Meal-based structure
  'Muốn tăng cân, hãy ăn đủ 3 bữa chính + 2-3 bữa phụ mỗi ngày:\n\nBữa sáng:\n• Bánh mì trứng ốp la + sữa nguyên kem\n• Hoặc yến mạch nấu với sữa đặc + chuối + hạt\n\nBữa trưa & tối:\n• Cơm đầy đĩa + thịt/cá kho + canh rau\n• Thịt ba chỉ, sườn non, cá béo — không kiêng dầu mỡ\n\nBữa phụ:\n• Sinh tố bơ chuối sữa đặc, hạt điều, bơ đậu phộng',
  // Template 1: High-calorie food focus
  'Thực phẩm giàu năng lượng giúp tăng cân:\n\nCalo cao mỗi bữa:\n• Cơm, khoai lang, bơ, chuối sứ, xoài chín\n• Thịt ba chỉ, sườn, cá béo, trứng, sữa nguyên kem\n\nĐồ uống tăng calo:\n• Sinh tố bơ + sữa đặc + mật ong\n• Sữa tươi nguyên kem, sữa đậu nành, nước ép trái cây\n\nMẹo: uống sữa hoặc sinh tố sau tập — vừa hồi phục vừa tăng calo.',
]

// ── Step-by-step style templates ────────────────────────────────

const T_VN_STEP_MUSCLE = [
  'Để tăng cơ, bạn có thể làm theo các bước sau:\n\n1. Tính nhu cầu calo: cộng thêm 300-500 calo so với duy trì.\n2. Ăn đủ đạm: 1.6-2.2g/kg cân nặng, chia 4-5 bữa.\n3. Tập tạ ít nhất 3-4 buổi/tuần, ưu tiên compound.\n4. Ngủ đủ 7-8 tiếng để cơ hồi phục.\n5. Theo dõi cân nặng và tăng tải từ từ.',
  'Các bước cơ bản để tăng cơ hiệu quả:\n\n1. Xác định mức calo duy trì, ăn dư 10-15%.\n2. Mỗi bữa có đạm + tinh bột + rau.\n3. Tập trung vào các bài đa khớp: squat, deadlift, bench press.\n4. Tăng dần khối lượng tạ mỗi tuần (progressive overload).\n5. Nghỉ ngơi đầy đủ giữa các buổi tập.',
]

const T_VN_STEP_FAT_LOSS = [
  'Các bước giảm mỡ an toàn:\n\n1. Tính calo duy trì, giảm 10-20% (không dưới 1200 calo/ngày).\n2. Tăng đạm lên 1.6-2g/kg để giữ cơ.\n3. Tập tạ 3-4 buổi/tuần + cardio nhẹ 2-3 buổi.\n4. Đi bộ 7000-10000 bước/ngày.\n5. Ngủ đủ và uống nhiều nước.',
  'Lộ trình giảm mỡ từng bước:\n\n1. Ghi lại khẩu phần ăn 3 ngày để biết mình đang ăn bao nhiêu.\n2. Cắt dần đồ ngọt, nước ngọt, đồ chiên rán.\n3. Thay tinh bột trắng bằng gạo lứt, khoai lang.\n4. Tập tạ giữ cơ + cardio đốt mỡ.\n5. Kiểm tra tiến độ mỗi 2 tuần, điều chỉnh nếu cần.',
]

const T_VN_MACRO = [
  'Một mốc protein tham khảo tốt là khoảng **1.6-2.2g/kg cân nặng/ngày** nếu bạn muốn tăng cơ hoặc giảm mỡ. Bạn nên điều chỉnh theo tổng calo, sức khỏe và mức vận động của mình nha.',
  'Lượng đạm lý tưởng cho người tập gym là **1.6-2.2g/kg/ngày**. Chia đều 4-5 bữa để cơ thể hấp thu tốt nhất. Chất béo lành mạnh từ cá, hạt, bơ cũng rất quan trọng cho nội tiết và sức khỏe tổng thể.',
  'Ngoài đạm, bạn cũng cần tinh bột để có năng lượng tập luyện. Khoảng 3-5g/kg/ngày tùy mức độ vận động. Chất béo khoảng 0.8-1g/kg/ngày từ các nguồn lành mạnh như cá béo, hạt, dầu ô liu.',
]

// ── EN templates ──────────────────────────────────────────────

const T_EN_MUSCLE_GAIN = [
  'For muscle gain, eat enough protein, carbs around your workout, and a slight calorie surplus. Prioritize lean meat, fish, eggs, dairy, beans, rice, potatoes, oats, and greens. Sleep and recovery are just as important.',
  'To build muscle, aim for 1.6-2.2g protein per kg of body weight daily. Have protein and carbs after training — a chicken rice bowl or a protein shake with banana works great. Don\'t skip vegetables for micronutrients.',
  'Muscle growth needs three things: enough calories, enough protein, and progressive training. Spread your protein across 4-5 meals. Good carb sources: rice, oats, sweet potatoes. Good protein: chicken, fish, eggs, tofu.',
]

const T_EN_FAT_LOSS = [
  'For fat loss, keep a mild calorie deficit, prioritize lean protein, vegetables, and high-fiber carbs. Don\'t cut carbs entirely — your body needs energy to move and burn fat effectively.',
  'Stay hydrated, eat plenty of greens, and keep protein high to preserve muscle while losing fat. Slow-digesting carbs like brown rice and oats help keep you full. Aim for 0.5-1% body weight loss per week.',
]

const T_EN_PRE_WORKOUT = [
  'Before training, eat something light and easy to digest — banana with yogurt, or rice with lean meat. Keep fatty or heavy meals away from training time for better performance.',
  'A good pre-workout meal has fast-digesting carbs and a little protein. Try oatmeal with milk and fruit, or a banana with peanut butter. Drink enough water before you start.',
]

const T_EN_POST_WORKOUT = [
  'Within 30-60 minutes after training, have protein and carbs to help recovery. Chicken with rice, a protein shake with banana, or eggs with toast are all great options.',
  'Post-workout nutrition is key for recovery. Aim for 20-40g of protein and some carbs within 2 hours. A salmon rice bowl or a smoothie with whey and fruit works perfectly.',
]

const T_EN_MEAL_PLAN = [
  'Here is a sample day: breakfast with eggs or yogurt and oats, lunch with rice, lean protein, and vegetables, snack with fruit or yogurt, dinner with fish/chicken/tofu and vegetables.',
  'A balanced day could be: oatmeal and eggs for breakfast, chicken salad for lunch, nuts and fruit as a snack, salmon with sweet potato and greens for dinner.',
]

const T_EN_MACRO = [
  'A good protein target is **1.6-2.2g per kg of body weight per day**, especially for muscle gain or fat loss. Adjust based on your total calories and activity level.',
  'For gym-goers, 1.6-2.2g/kg protein daily is ideal. Spread across 4-5 meals. Healthy fats from fish, nuts, avocado are also important for hormones and overall health.',
]

// ── Query style detection ─────────────────────────────────────

const detectGoalFromQuery = (query = '') => {
  const n = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase()
  if (/\btang\s*co\b/.test(n)) return 'muscle_gain'
  if (/\btang\s*(can|ky)\b/.test(n)) return 'weight_gain'
  if (/\bgiam\s*(mo|can|beo)\b/.test(n)) return 'fat_loss'
  if (/\b(suc ben|endurance)\b/.test(n)) return 'endurance'
  return null
}

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

export const buildNutritionAnswer = ({ intent, goal, query = '', lang = 'vi' } = {}) => {
  const language = normalizeLanguage(lang)
  const detectedGoal = goal || detectGoalFromQuery(query)
  const isVi = language === 'vi'

  // English responses
  if (!isVi) {
    if (intent === 'nutrition_pre_workout') return pickTemplate(query, T_EN_PRE_WORKOUT)
    if (intent === 'nutrition_post_workout') return pickTemplate(query, T_EN_POST_WORKOUT)
    if (intent === 'nutrition_macro') return pickTemplate(query, T_EN_MACRO)
    if (intent === 'nutrition_meal_plan') {
      const base = pickTemplate(query, T_EN_MEAL_PLAN)
      const suffix = detectedGoal === 'fat_loss'
        ? '\n\nFor fat loss, keep carbs moderate and prioritize lean protein.'
        : detectedGoal === 'muscle_gain'
          ? '\n\nFor muscle gain, add more carbs around your workouts.'
          : ''
      return base + suffix
    }
    if (detectedGoal === 'muscle_gain') return pickTemplate(query, T_EN_MUSCLE_GAIN)
    if (detectedGoal === 'fat_loss' || detectedGoal === 'weight_loss') return pickTemplate(query, T_EN_FAT_LOSS)
    return 'For balanced nutrition, focus on whole foods: lean protein, vegetables, healthy carbs, and good fats. Stay hydrated and adjust portions based on your goal.'
  }

  // Vietnamese responses
  if (intent === 'nutrition_pre_workout') return pickTemplate(query, T_VN_PRE_WORKOUT)
  if (intent === 'nutrition_post_workout') return pickTemplate(query, T_VN_POST_WORKOUT)
  if (intent === 'nutrition_macro') return pickTemplate(query, T_VN_MACRO)

  // Use response planner to detect style from query + intent + goal
  const stylePlan = planResponseStyle({ intent, subject: 'nutrition', query, goal: detectedGoal })

  // Meal plan: detected by intent OR style detection
  if (intent === 'nutrition_meal_plan' || stylePlan.style === 'nutrition_meal_plan') {
    const result = pickTemplate(query, T_VN_MEAL_PLAN) + (GOAL_SUFFIX[detectedGoal] || '')
    console.log('[NUTRITION_FLOW]', JSON.stringify({ goal: detectedGoal, style: 'meal_plan', answerPreview: (result || '').slice(0, 60) }))
    return result
  }

  // Food list style: when user asks "ăn gì", "món nào", etc.
  if (stylePlan.style === 'nutrition_food_list') {
    let result, templateIdx
    if (detectedGoal === 'weight_gain') { result = pickTemplate(query, T_VN_FOOD_WEIGHT_GAIN); templateIdx = T_VN_FOOD_WEIGHT_GAIN.indexOf(result) }
    else if (detectedGoal === 'muscle_gain') { result = pickTemplate(query, T_VN_FOOD_MUSCLE); templateIdx = T_VN_FOOD_MUSCLE.indexOf(result) }
    else { result = pickTemplate(query, T_VN_FOOD_FAT_LOSS); templateIdx = T_VN_FOOD_FAT_LOSS.indexOf(result) }
    console.log('[NUTRITION_TEMPLATE_DEBUG]', JSON.stringify({ goal: detectedGoal, style: 'food_list', templateIdx, answerPreview: (result || '').slice(0, 60) }))
    return result
  }

  // Step-by-step style: when user asks "làm sao", "cách", etc.
  if (stylePlan.style === 'nutrition_step_by_step') {
    let result
    if (detectedGoal === 'muscle_gain' || detectedGoal === 'weight_gain') result = pickTemplate(query, T_VN_STEP_MUSCLE)
    else result = pickTemplate(query, T_VN_STEP_FAT_LOSS)
    console.log('[NUTRITION_FLOW]', JSON.stringify({ goal: detectedGoal, style: 'step_by_step', answerPreview: (result || '').slice(0, 60) }))
    return result
  }

  // Default explanation style
  let result
  if (detectedGoal === 'muscle_gain') result = pickTemplate(query, T_VN_MUSCLE_GAIN)
  else if (detectedGoal === 'weight_gain') result = pickTemplate(query, T_VN_WEIGHT_GAIN)
  else if (detectedGoal === 'fat_loss' || detectedGoal === 'weight_loss') result = pickTemplate(query, T_VN_FAT_LOSS)
  else result = pickTemplate(query, T_VN_FAT_LOSS)
  console.log('[NUTRITION_FLOW]', JSON.stringify({ goal: detectedGoal, style: stylePlan.style, answerPreview: (result || '').slice(0, 60) }))
  return result
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
