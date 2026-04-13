import mongoose from 'mongoose';

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên gói tập là bắt buộc'],
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
    description: {
      type: String,
      trim: true,
      default: '',
    },
    color: {
      type: String,
      default: '#3B82F6', // màu mặc định xanh
      match: [/^#[0-9A-Fa-f]{6}$/, 'Màu phải theo định dạng #RRGGBB'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Plan = mongoose.model('Plan', planSchema);
export default Plan;