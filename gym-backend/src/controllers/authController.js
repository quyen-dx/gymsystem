import User from '../models/User.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/generateToken.js';
import { generateOTP, sendOTPEmail } from '../utils/emailService.js';

// ==================== ĐĂNG KÝ ====================
export const register = async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
console.log('req.body:', req.body);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email đã được sử dụng' });
    }

    const user = await User.create({ email, password, name, phone, role: 'member' });

    const accessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    res.status(201).json({
      message: 'Đăng ký thành công',
      accessToken,
      refreshToken: newRefreshToken,
      user,
    });
  } catch (error) {
    console.error('register error:', error)
    res.status(500).json({ message: error.message });
  }
};

// ==================== ĐĂNG NHẬP ====================
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Tài khoản đã bị khóa. Liên hệ admin để được hỗ trợ.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    const accessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({
      message: 'Đăng nhập thành công',
      accessToken,
      refreshToken: newRefreshToken,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==================== REFRESH TOKEN ====================
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Refresh token là bắt buộc' });
    }

    const decoded = verifyRefreshToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
    }

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
    }

    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    res.status(401).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
  }
};

// ==================== ĐĂNG XUẤT ====================
export const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    res.json({ message: 'Đăng xuất thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==================== LẤY THÔNG TIN BẢN THÂN ====================
export const getMe = async (req, res) => {
  res.json({ user: req.user });
};

// ==================== CẬP NHẬT THÔNG TIN CÁ NHÂN ====================
export const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;

    if (req.file) {
      updateData.avatar = req.file.path;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    });

    res.json({ message: 'Cập nhật thông tin thành công', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==================== ĐỔI MẬT KHẨU ====================
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==================== QUÊN MẬT KHẨU — GỬI OTP ====================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: 'Nếu email tồn tại, mã OTP đã được gửi' });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpires = otpExpires;
    await user.save({ validateBeforeSave: false });

    await sendOTPEmail(email, otp, user.name);

    res.json({ message: 'Mã OTP đã được gửi đến email của bạn' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi gửi email. Vui lòng thử lại.' });
  }
};

// ==================== ĐẶT LẠI MẬT KHẨU BẰNG OTP ====================
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email }).select(
      '+resetPasswordOTP +resetPasswordOTPExpires'
    );

    if (!user || !user.resetPasswordOTP) {
      return res.status(400).json({ message: 'OTP không hợp lệ' });
    }

    if (user.resetPasswordOTPExpires < Date.now()) {
      return res.status(400).json({ message: 'OTP đã hết hạn. Vui lòng yêu cầu mã mới.' });
    }

    if (user.resetPasswordOTP !== otp) {
      return res.status(400).json({ message: 'OTP không đúng' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;
    await user.save();

    res.json({ message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }

};
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Cập nhật role user
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!['admin', 'pt', 'staff', 'member'].includes(role)) {
      return res.status(400).json({ message: 'Role không hợp lệ' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });

    res.json({ message: 'Cập nhật role thành công', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Khóa / mở khóa user
export const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      message: `Tài khoản đã được ${user.isActive ? 'mở khóa' : 'khóa'}`,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Xóa user
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });

    res.json({ message: 'Xóa user thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};