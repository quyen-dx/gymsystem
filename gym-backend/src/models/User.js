import bcrypt from 'bcrypt'
import mongoose from 'mongoose'

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
    facebookId: {
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
    password: {
      type: String,
      default: null,
      minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự'],
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
      enum: ['admin', 'pt', 'staff', 'member', 'seller'],
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
  },
  { timestamps: true },
)

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
  if (!this.isModified('password') || !this.password) return
  if (this.$locals?.skipPasswordHashing) return
  this.password = await bcrypt.hash(this.password, 12)
})

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password || !candidatePassword) return false
  return bcrypt.compare(candidatePassword, this.password)
}

userSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.password
  delete obj.refreshToken
  return obj
}

const User = mongoose.model('User', userSchema)

export default User
