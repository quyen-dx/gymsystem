import mongoose from 'mongoose';

const planSchema = new mongoose.Schema(
  {
    nameVi: {
      type: String,
      required: [true, 'Tên gói (VI) là bắt buộc'],
      trim: true,
    },
    nameEn: {
      type: String,
      required: [true, 'Plan name (EN) is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Giá gói tập là bắt buộc'],
      min: [0, 'Giá không được âm'],
    },
    durationDays: {
      type: Number,
      required: [true, 'Số ngày là bắt buộc'],
      min: [1, 'Số ngày phải ít nhất là 1'],
    },
    descriptionVi: {
      type: String,
      trim: true,
      default: '',
    },
    descriptionEn: {
      type: String,
      trim: true,
      default: '',
    },
    featuresVi: {
      type: [String],
      default: [],
    },
    featuresEn: {
      type: [String],
      default: [],
    },
    color: {
      type: String,
      default: '#3B82F6',
      match: [/^#[0-9A-Fa-f]{6}$/, 'Màu phải theo định dạng #RRGGBB'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    applicableSpecializations: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const Plan = mongoose.model('Plan', planSchema);
export default Plan;
