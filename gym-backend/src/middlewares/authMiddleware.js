import User from '../models/User.js';
import { verifyAccessToken } from '../utils/generateToken.js';

// Xác thực JWT
export const protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ message: 'Bạn chưa đăng nhập' });
        }

        const decoded = verifyAccessToken(token);
        if (!decoded) {
            return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
        }
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ message: 'Token không hợp lệ' });
        }

        if (!user.isActive) {
            return res.status(403).json({ message: 'Tài khoản đã bị khóa' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token đã hết hạn', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ message: 'Token không hợp lệ' });
    }
};

// Phân quyền theo role
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Bạn không có quyền thực hiện hành động này. Yêu cầu role: ${roles.join(', ')}`,
            });
        }
        next();
    };
};

// Shorthand middlewares
export const adminOnly = authorize('admin');
export const adminOrStaff = authorize('admin', 'staff');
export const adminOrPT = authorize('admin', 'pt');
export const allRoles = authorize('admin', 'pt', 'staff', 'member');