import mongoose from 'mongoose'

const reviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  avatar: { type: String, default: '' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' },
}, { timestamps: true })

const weightVariantSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  priceDelta: { type: Number, default: 0, min: 0 },
}, { _id: false })

const productSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  weights: [{ type: String }],
  weightVariants: [weightVariantSchema],
  images: [{ type: String }],
  descriptionImages: [{ type: String }],
  image: { type: String, default: '' },
  category: { type: String, default: 'Khác' },
  stock: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
  partner: {
    name: { type: String, default: '' },
    avatar: { type: String, default: '' },
    description: { type: String, default: '' },
  },
  reviews: [reviewSchema],
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
}, { timestamps: true })

export default mongoose.model('Product', productSchema)
