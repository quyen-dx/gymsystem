import express from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { protect,adminOnly  } from '../middlewares/authMiddleware.js';
import { upload } from '../config/cloudinary.js';
import { getAllUsers, updateUserRole, toggleUserStatus, deleteUser } from '../controllers/authController.js';
const router = express.Router();

router.get('/users', protect, adminOnly, getAllUsers);
router.patch('/users/:id/role', protect, adminOnly, updateUserRole);
router.patch('/users/:id/toggle-status', protect, adminOnly, toggleUserStatus);
router.delete('/users/:id', protect, adminOnly, deleteUser);
// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes (cần đăng nhập)
router.get('/me', protect, getMe);
router.put('/update-profile', protect, upload.single('avatar'), updateProfile);
router.put('/change-password', protect, changePassword);
router.post('/logout', protect, logout);
router.delete('/delete-all', async (req, res) => {
  await User.deleteMany({});
  res.json({ message: 'Đã xóa hết' });
});
export default router;