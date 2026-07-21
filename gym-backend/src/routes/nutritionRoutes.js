import express from 'express'
import {
  createNutritionPlan,
  getNutritionPlans,
  getNutritionPlanById,
  updateNutritionPlan,
  deleteNutritionPlan,
  createFood,
  getFoods,
  getFoodById,
  updateFood,
  deleteFood,
  getFoodCategories,
  createMealLog,
  getMealLogs,
  getMealLogById,
  updateMealLog,
  deleteMealLog,
  getDailySummary,
} from '../controllers/nutritionController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'
import {
  createNutritionPlanSchema,
  updateNutritionPlanSchema,
  nutritionPlanQuerySchema,
  createFoodSchema,
  updateFoodSchema,
  foodQuerySchema,
  createMealLogSchema,
  updateMealLogSchema,
  mealLogQuerySchema,
  dailySummaryQuerySchema,
} from '../validators/nutritionValidator.js'
import { validateBody, validateQuery } from '../middlewares/validation.js'

const router = express.Router()

router.use(protect)

// Nutrition Plans
router.post('/plans', authorize('pt', 'admin', 'super_admin'), validateBody(createNutritionPlanSchema), createNutritionPlan)
router.get('/plans', authorize('member', 'pt', 'admin', 'super_admin'), validateQuery(nutritionPlanQuerySchema), getNutritionPlans)
router.get('/plans/:id', authorize('member', 'pt', 'admin', 'super_admin'), getNutritionPlanById)
router.put('/plans/:id', authorize('pt', 'admin', 'super_admin'), validateBody(updateNutritionPlanSchema), updateNutritionPlan)
router.delete('/plans/:id', authorize('pt', 'admin', 'super_admin'), deleteNutritionPlan)

// Food Library
router.post('/foods', authorize('pt', 'admin', 'super_admin'), validateBody(createFoodSchema), createFood)
router.get('/foods/categories', getFoodCategories)
router.get('/foods', authorize('member', 'pt', 'admin', 'super_admin'), validateQuery(foodQuerySchema), getFoods)
router.get('/foods/:id', authorize('member', 'pt', 'admin', 'super_admin'), getFoodById)
router.put('/foods/:id', authorize('pt', 'admin', 'super_admin'), validateBody(updateFoodSchema), updateFood)
router.delete('/foods/:id', authorize('pt', 'admin', 'super_admin'), deleteFood)

// Meal Logs
router.get('/meal-logs/daily-summary', authorize('member', 'pt', 'admin', 'super_admin'), validateQuery(dailySummaryQuerySchema), getDailySummary)
router.post('/meal-logs', authorize('member', 'pt', 'admin', 'super_admin'), validateBody(createMealLogSchema), createMealLog)
router.get('/meal-logs', authorize('member', 'pt', 'admin', 'super_admin'), validateQuery(mealLogQuerySchema), getMealLogs)
router.get('/meal-logs/:id', authorize('member', 'pt', 'admin', 'super_admin'), getMealLogById)
router.put('/meal-logs/:id', authorize('member', 'pt', 'admin', 'super_admin'), validateBody(updateMealLogSchema), updateMealLog)
router.delete('/meal-logs/:id', authorize('member', 'pt', 'admin', 'super_admin'), deleteMealLog)

export default router
