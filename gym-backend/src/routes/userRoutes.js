import express from 'express'
import { upload } from '../config/cloudinary.js'
import {
  protect,
  authorize,
  adminOnly,
  superAdminOnly,
} from '../middlewares/authMiddleware.js'
import { validateBody, validateQuery, validateParams } from '../middlewares/validation.js'
import {
  updateProfileSchema,
  changePasswordSchema,
  adminUpdateUserSchema,
  changeRoleSchema,
  adminUsersQuerySchema,
  userIdParamsSchema,
} from '../validators/userValidator.js'
import {
  getMe,
  updateMe,
  uploadAvatar,
  changePassword,
} from '../controllers/profileController.js'
import {
  getUsersList,
  getSingleUser,
  updateUser,
  updateRole,
  activateUser,
  deactivateUser,
  deleteUser,
  restoreDeletedUser,
} from '../controllers/adminController.js'

const router = express.Router()

// ── Member (self-service) ──────────────────────────────────────────

router.get('/me', protect, getMe)
router.patch('/me', protect, validateBody(updateProfileSchema), updateMe)
router.patch(
  '/me/avatar',
  protect,
  upload.single('avatar'),
  uploadAvatar,
)
router.patch('/me/password', protect, validateBody(changePasswordSchema), changePassword)

// ── Admin (user management) ────────────────────────────────────────

router.get(
  '/',
  protect,
  adminOnly,
  validateQuery(adminUsersQuerySchema),
  getUsersList,
)

router.get(
  '/:id',
  protect,
  authorize('super_admin', 'admin', 'pt', 'staff'),
  validateParams(userIdParamsSchema),
  getSingleUser,
)

router.patch(
  '/:id',
  protect,
  authorize('super_admin', 'admin'),
  validateParams(userIdParamsSchema),
  validateBody(adminUpdateUserSchema),
  updateUser,
)

router.patch(
  '/:id/role',
  protect,
  superAdminOnly,
  validateParams(userIdParamsSchema),
  validateBody(changeRoleSchema),
  updateRole,
)

router.patch(
  '/:id/activate',
  protect,
  authorize('super_admin', 'admin'),
  validateParams(userIdParamsSchema),
  activateUser,
)

router.patch(
  '/:id/deactivate',
  protect,
  authorize('super_admin', 'admin'),
  validateParams(userIdParamsSchema),
  deactivateUser,
)

router.delete(
  '/:id',
  protect,
  superAdminOnly,
  validateParams(userIdParamsSchema),
  deleteUser,
)

router.post(
  '/:id/restore',
  protect,
  superAdminOnly,
  validateParams(userIdParamsSchema),
  restoreDeletedUser,
)

export default router
