import { ACTIVITY_MULTIPLIER } from '../constants/healthEnums.js'

const getBmiCategory = (bmi) => {
  if (bmi < 18.5) return 'underweight'
  if (bmi < 25) return 'normal'
  if (bmi < 30) return 'overweight'
  return 'obese'
}

export const calculateBmi = async (req, res) => {
  try {
    const { height, weight } = req.body
    const heightM = height / 100
    const bmi = Math.round((weight / (heightM * heightM)) * 10) / 10

    return res.status(200).json({
      height,
      weight,
      bmi,
      category: getBmiCategory(bmi),
    })
  } catch (error) {
    return res.status(400).json({ message: 'Tinh BMI that bai', error: error.message })
  }
}

export const calculateBmr = async (req, res) => {
  try {
    const { height, weight, age, gender } = req.body

    const a = age || (req.user.healthInfo?.age) || 25
    const g = gender || (req.user.gender) || 'male'

    let bmr
    if (g === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * a + 5
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * a - 161
    }

    return res.status(200).json({
      weight,
      height,
      age: a,
      gender: g,
      bmr: Math.round(bmr),
      formula: 'Mifflin-St Jeor',
    })
  } catch (error) {
    return res.status(400).json({ message: 'Tinh BMR that bai', error: error.message })
  }
}

export const calculateTdee = async (req, res) => {
  try {
    const { bmr, activityLevel } = req.body
    const multiplier = ACTIVITY_MULTIPLIER[activityLevel] || 1.2
    const tdee = Math.round(bmr * multiplier)

    return res.status(200).json({
      bmr,
      activityLevel,
      multiplier,
      tdee,
    })
  } catch (error) {
    return res.status(400).json({ message: 'Tinh TDEE that bai', error: error.message })
  }
}

export const calculateMacros = async (req, res) => {
  try {
    const { tdee, goal } = req.body

    const splits = {
      weight_loss: { protein: 0.4, carbs: 0.3, fat: 0.3 },
      muscle_gain: { protein: 0.3, carbs: 0.45, fat: 0.25 },
      maintenance: { protein: 0.3, carbs: 0.4, fat: 0.3 },
    }

    const split = splits[goal] || splits.maintenance

    const proteinCal = Math.round(tdee * split.protein)
    const carbsCal = Math.round(tdee * split.carbs)
    const fatCal = Math.round(tdee * split.fat)

    return res.status(200).json({
      tdee,
      goal,
      macros: {
        protein_g: Math.round(proteinCal / 4),
        carbs_g: Math.round(carbsCal / 4),
        fat_g: Math.round(fatCal / 9),
      },
      breakdown: {
        protein: { calories: proteinCal, percent: Math.round(split.protein * 100) },
        carbs: { calories: carbsCal, percent: Math.round(split.carbs * 100) },
        fat: { calories: fatCal, percent: Math.round(split.fat * 100) },
      },
    })
  } catch (error) {
    return res.status(400).json({ message: 'Tinh macros that bai', error: error.message })
  }
}
