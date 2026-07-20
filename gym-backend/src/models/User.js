import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import { extractMemberNumber, formatMemberCode, normalizeUserMemberIdentity } from '../utils/memberIdentity.js'

const emailRegex = /^\S+@\S+\.\S+$/

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Họ tên là bắt buộc'],
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (value) => value == null || value === '' || emailRegex.test(value),
        message: 'Email không hợp lệ',
      },
    },
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: (value) => value == null || value === '' || emailRegex.test(value),
        message: 'Email lien he khong hop le',
      },
    },
    facebookId: {
      type: String,
      unique: true,
      sparse: true,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    facebookProfileUrl: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      validate: {
        validator: (value) => value == null || value === '' || value.trim().length > 0,
        message: 'Số điện thoại không hợp lệ',
      },
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', ''],
      default: '',
      trim: true,
    },
    password: {
      type: String,
      default: null,
      minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự'],
      select: false,
    },
    passwordHash: {
      type: String,
      default: null,
      select: false,
    },
    provider: {
      type: String,
      enum: ['google', 'facebook', 'phone', 'email'],
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'pt', 'staff', 'member', 'seller'],
      default: 'member',
    },
    isSeller: {
      type: Boolean,
      default: false,
    },
    specialties: [{ type: String, trim: true }],
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    experienceYears: {
      type: Number,
      default: 0,
      min: 0,
    },
    bio: {
      type: String,
      default: '',
      trim: true,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      default: null,
    },
    shop_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      default: null,
    },
    avatar: {
      type: String,
      default: '',
    },
    coverImage: {
      type: String,
      default: '',
    },
    themePreference: {
      type: String,
      enum: ['system', 'light', 'dark'],
      default: 'system',
    },
    accentColor: {
      type: String,
      default: '#7C3AED',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'locked'],
      default: 'active',
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    preferredTime: {
      type: String,
      default: '',
      trim: true,
    },
    memberCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    memberNumber: {
      type: Number,
      unique: true,
      sparse: true,
      min: 1,
      index: true,
    },
    // Extended profile fields
    fullName: {
      type: String,
      default: '',
      trim: true,
    },
    nationality: {
      type: String,
      default: '',
      trim: true,
    },
    language: {
      type: String,
      default: 'vi',
      trim: true,
    },
    timezone: {
      type: String,
      default: '',
      trim: true,
    },
    country: {
      type: String,
      default: '',
      trim: true,
    },
    province: {
      type: String,
      default: '',
      trim: true,
    },
    detailedAddress: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      street: { type: String, default: '', trim: true },
      ward: { type: String, default: '', trim: true },
      district: { type: String, default: '', trim: true },
      city: { type: String, default: '', trim: true },
    },
    emergencyContact: {
      name: { type: String, default: '', trim: true },
      phone: { type: String, default: '', trim: true },
      relationship: { type: String, default: '', trim: true },
    },
    healthInfo: {
      height: { type: Number, default: null },
      weight: { type: Number, default: null },
      goals: [{ type: String, trim: true }],
      activityLevel: { type: String, default: '', trim: true },
      notes: { type: String, default: '', trim: true },
    },
    identityType: { type: String, default: '', trim: true },
    identityNumber: { type: String, default: '', trim: true },
    identityCountry: { type: String, default: '', trim: true },
    identityFrontImage: { type: String, default: '' },
    identityBackImage: { type: String, default: '' },
    identityStatus: {
      type: String,
      enum: ['', 'pending', 'approved', 'rejected'],
      default: '',
    },
    identityRejectReason: { type: String, default: '', trim: true },
    identityReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    identityReviewedAt: { type: Date, default: null },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
)

userSchema.index({ role: 1, isActive: 1 })
userSchema.index({ deletedAt: 1 }, { sparse: true })

userSchema.pre(/^find/, function (next) {
  if (!this.getQuery().includeDeleted) {
    this.where({ deletedAt: null })
  }
  next()
})

userSchema.pre('validate', function () {
  if (!this.email && !this.phone && !this.facebookId) {
    this.invalidate('email', 'Email hoặc số điện thoại là bắt buộc')
  }

  if (this.provider === 'phone' && !this.phone) {
    this.invalidate('phone', 'Tài khoản số điện thoại cần có số điện thoại')
  }

  if (this.provider === 'email' && !this.email) {
    this.invalidate('email', 'Tài khoản email cần có email')
  }
})

userSchema.pre('save', async function () {
  if (this.isModified('passwordHash') && this.passwordHash) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12)
  }

  if (this.isModified('password') && this.password && !this.passwordHash) {
    this.passwordHash = await bcrypt.hash(this.password, 12)
    this.password = undefined
  }
})

const getNextMemberNumber = async (UserModel) => {
  const [maxNumber] = await UserModel.aggregate([
    { $match: { memberNumber: { $type: 'number' } } },
    { $group: { _id: null, max: { $max: '$memberNumber' } } },
  ])

  const codedUsers = await UserModel.find({ memberCode: /^GP\d+$/i })
    .select('memberCode')
    .lean()

  const legacyNumber = codedUsers.reduce((max, user) => (
    Math.max(max, extractMemberNumber(user.memberCode) || 0)
  ), 0)
  return Math.max(Number(maxNumber?.max || 0), legacyNumber) + 1
}

userSchema.pre('save', async function () {
  const UserModel = mongoose.model('User')

  if (!this.memberNumber && this.memberCode) {
    this.memberNumber = extractMemberNumber(this.memberCode)
  }

  if (!this.memberNumber) {
    this.memberNumber = await getNextMemberNumber(UserModel)
  }

  this.memberCode = formatMemberCode(this.memberNumber)
})

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!candidatePassword) return false
  if (this.passwordHash) return bcrypt.compare(candidatePassword, this.passwordHash)
  if (this.password) return bcrypt.compare(candidatePassword, this.password)
  return false
}

userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (this.updatedAt) {
    const changedAt = Math.floor(this.updatedAt.getTime() / 1000)
    return jwtTimestamp < changedAt
  }
  return false
}

userSchema.methods.softDelete = function () {
  this.deletedAt = new Date()
  this.isActive = false
  return this.save()
}

userSchema.methods.toJSON = function () {
  const obj = normalizeUserMemberIdentity(this.toObject())
  delete obj.password
  delete obj.passwordHash
  delete obj.refreshToken
  return obj
}

const User = mongoose.model('User', userSchema)

export default User
