import mongoose from 'mongoose';
import Plan from '../models/Plan.js';
import PlanFeature from '../models/PlanFeature.js';

async function resolveFeatureCodes(codes) {
  const features = await PlanFeature.find({ code: { $in: codes } }).lean()
  const missing = codes.filter(c => !features.find(f => f.code === c))
  if (missing.length) {
    console.warn(`⚠  Không tìm thấy PlanFeature codes: ${missing.join(', ')}`)
  }
  return features.map(f => f._id)
}

const defaultPlanDefs = [
  {
    nameVi: 'Gói Cơ Bản', price: 300000, durationDays: 30,
    descriptionVi: 'Gói tập cơ bản dành cho hội viên mới bắt đầu.',
    featureCodes: ['GYM_ACCESS', 'QR_CHECKIN'],
    color: '#3B82F6', isActive: true,
  },
  {
    nameVi: 'Gói Nâng Cao', price: 700000, durationDays: 90,
    descriptionVi: 'Gói tập nâng cao với nhiều tiện ích hơn.',
    featureCodes: ['GYM_ACCESS', 'QR_CHECKIN', 'HEALTH_TRACKING'],
    color: '#8B5CF6', isActive: true,
  },
  {
    nameVi: 'Gói VIP', price: 1500000, durationDays: 365,
    descriptionVi: 'Gói VIP cao cấp dành cho hội viên thân thiết.',
    featureCodes: ['GYM_ACCESS', 'QR_CHECKIN', 'HEALTH_TRACKING', 'SUPPORT_PRIORITY'],
    color: '#F59E0B', isActive: true,
  },
  {
    nameVi: 'Gói Huấn Luyện Cá Nhân', price: 2000000, durationDays: 30,
    descriptionVi: 'Gói huấn luyện 1-1 với PT chuyên nghiệp.',
    featureCodes: ['BOOK_PT_PRIVATE', 'WORKOUT_PLAN'],
    color: '#EF4444', isActive: true,
  },
  {
    nameVi: 'Gói Doanh Nghiệp', price: 5000000, durationDays: 365,
    descriptionVi: 'Gói tập dành cho doanh nghiệp, quản lý nhóm nhân viên.',
    featureCodes: ['ENTERPRISE', 'GROUP_CLASS'],
    color: '#10B981', isActive: true,
  },
];

export async function seedPlans() {
  const count = await Plan.countDocuments();
  if (count > 0) {
    console.log(`Đã có ${count} gói tập trong DB. Bỏ qua seed.`);
    return;
  }

  const plans = await Promise.all(defaultPlanDefs.map(async (def) => {
    const { featureCodes, ...rest } = def
    return { ...rest, featureIds: await resolveFeatureCodes(featureCodes) }
  }))

  await Plan.insertMany(plans);
  console.log(`Đã seed ${plans.length} gói tập mặc định.`);
}

// Chạy độc lập: node src/scripts/seedPlans.js
const isMainModule = process.argv[1]?.endsWith('seedPlans.js');
if (isMainModule) {
  const connectDB = (await import('../config/db.js')).default;
  await connectDB();
  await seedPlans();
  await mongoose.disconnect();
  console.log('Done.');
}
