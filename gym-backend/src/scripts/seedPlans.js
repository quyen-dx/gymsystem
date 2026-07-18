import mongoose from 'mongoose';
import Plan from '../models/Plan.js';

const defaultPlans = [
  {
    nameVi: 'Gói Cơ Bản',
    price: 300000,
    durationDays: 30,
    descriptionVi: 'Gói tập cơ bản dành cho hội viên mới bắt đầu.',
    featuresVi: ['Sử dụng phòng tập', 'Check-in QR'],
    color: '#3B82F6',
    isActive: true,
  },
  {
    nameVi: 'Gói Nâng Cao',
    price: 700000,
    durationDays: 90,
    descriptionVi: 'Gói tập nâng cao với nhiều tiện ích hơn.',
    featuresVi: ['Sử dụng phòng tập', 'Check-in QR', 'Theo dõi sức khỏe'],
    color: '#8B5CF6',
    isActive: true,
  },
  {
    nameVi: 'Gói VIP',
    price: 1500000,
    durationDays: 365,
    descriptionVi: 'Gói VIP cao cấp dành cho hội viên thân thiết.',
    featuresVi: ['Sử dụng phòng tập', 'Check-in QR', 'Theo dõi sức khỏe', 'Ưu tiên hỗ trợ'],
    color: '#F59E0B',
    isActive: true,
  },
  {
    nameVi: 'Gói Huấn Luyện Cá Nhân',
    price: 2000000,
    durationDays: 30,
    descriptionVi: 'Gói huấn luyện 1-1 với PT chuyên nghiệp.',
    featuresVi: ['Huấn luyện cá nhân', 'Giáo án riêng'],
    color: '#EF4444',
    isActive: true,
  },
  {
    nameVi: 'Gói Doanh Nghiệp',
    price: 5000000,
    durationDays: 365,
    descriptionVi: 'Gói tập dành cho doanh nghiệp, quản lý nhóm nhân viên.',
    featuresVi: ['Dành cho doanh nghiệp', 'Quản lý nhóm nhân viên'],
    color: '#10B981',
    isActive: true,
  },
];

export async function seedPlans() {
  const count = await Plan.countDocuments();
  if (count > 0) {
    console.log(`Đã có ${count} gói tập trong DB. Bỏ qua seed.`);
    return;
  }

  await Plan.insertMany(defaultPlans);
  console.log(`Đã seed ${defaultPlans.length} gói tập mặc định.`);
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
