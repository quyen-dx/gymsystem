import { z } from 'zod'

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  fullName: z.string().max(100).trim().optional(),
  phone: z.string().regex(/^[0-9]{9,11}$/, 'Số điện thoại không hợp lệ').optional().nullable(),
  dateOfBirth: z.string().datetime().optional().nullable(),
  gender: z.enum(['male', 'female', 'other', '']).optional(),
  avatar: z.string().max(500).optional(),
  coverImage: z.string().max(500).optional(),
  nationality: z.string().max(100).trim().optional(),
  language: z.string().max(10).trim().optional(),
  timezone: z.string().max(50).trim().optional(),
  country: z.string().max(100).trim().optional(),
  province: z.string().max(100).trim().optional(),
  detailedAddress: z.string().max(500).trim().optional(),
  bio: z.string().max(1000).trim().optional(),
  themePreference: z.enum(['system', 'light', 'dark']).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Mã màu không hợp lệ').optional(),
  preferredTime: z.string().max(50).trim().optional(),
  address: z.object({
    street: z.string().max(200).trim().optional(),
    ward: z.string().max(100).trim().optional(),
    district: z.string().max(100).trim().optional(),
    city: z.string().max(100).trim().optional(),
  }).optional(),
  emergencyContact: z.object({
    name: z.string().max(100).trim().optional(),
    phone: z.string().max(20).trim().optional(),
    relationship: z.string().max(50).trim().optional(),
  }).optional(),
  healthInfo: z.object({
    height: z.number().min(0).max(300).optional().nullable(),
    weight: z.number().min(0).max(500).optional().nullable(),
    goals: z.array(z.string().trim()).optional(),
    activityLevel: z.string().max(50).trim().optional(),
    notes: z.string().max(1000).trim().optional(),
  }).optional(),
}).strict()

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mật khẩu hiện tại là bắt buộc'),
  newPassword: z.string().min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự')
    .regex(/[A-Z]/, 'Mật khẩu mới phải có ít nhất 1 chữ hoa')
    .regex(/[a-z]/, 'Mật khẩu mới phải có ít nhất 1 chữ thường')
    .regex(/[0-9]/, 'Mật khẩu mới phải có ít nhất 1 chữ số'),
}).strict()

export const adminUpdateUserSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  fullName: z.string().max(100).trim().optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  phone: z.string().regex(/^[0-9]{9,11}$/, 'Số điện thoại không hợp lệ').optional().nullable(),
  dateOfBirth: z.string().datetime().optional().nullable(),
  gender: z.enum(['male', 'female', 'other', '']).optional(),
  isActive: z.boolean().optional(),
  role: z.enum(['super_admin', 'admin', 'pt', 'staff', 'member', 'seller']).optional(),
  nationality: z.string().max(100).trim().optional(),
  language: z.string().max(10).trim().optional(),
  timezone: z.string().max(50).trim().optional(),
  country: z.string().max(100).trim().optional(),
  province: z.string().max(100).trim().optional(),
  detailedAddress: z.string().max(500).trim().optional(),
  bio: z.string().max(1000).trim().optional(),
}).strict()

export const changeRoleSchema = z.object({
  role: z.enum(['super_admin', 'admin', 'pt', 'staff', 'member', 'seller'], {
    errorMap: () => ({ message: 'Vai trò không hợp lệ' }),
  }),
}).strict()

export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().max(100).optional(),
  role: z.enum(['super_admin', 'admin', 'pt', 'staff', 'member', 'seller']).optional(),
  status: z.enum(['active', 'locked']).optional(),
  isActive: z.coerce.boolean().optional(),
  sort: z.string().regex(/^-?[a-zA-Z_]+(,-?[a-zA-Z_]+)*$/).optional().default('-createdAt'),
  includeDeleted: z.coerce.boolean().optional(),
})

export const userIdParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID người dùng không hợp lệ'),
})
