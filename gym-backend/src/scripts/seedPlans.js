import mongoose from 'mongoose';
import Plan from '../models/Plan.js';

const defaultPlans = [
  {
    nameVi: 'Gói Cơ Bản',
    nameEn: 'Basic Membership',
    price: 300000,
    durationDays: 30,
    descriptionVi: 'Gói tập cơ bản dành cho hội viên mới bắt đầu.',
    descriptionEn: 'Basic plan for new members.',
    featuresVi: ['Sử dụng phòng tập', 'Check-in QR'],
    featuresEn: ['Gym access', 'QR check-in'],
    color: '#3B82F6',
    isActive: true,
  },
  {
    nameVi: 'Gói Nâng Cao',
    nameEn: 'Premium Membership',
    price: 700000,
    durationDays: 90,
    descriptionVi: 'Gói tập nâng cao với nhiều tiện ích hơn.',
    descriptionEn: 'Premium plan with additional benefits.',
    featuresVi: ['Sử dụng phòng tập', 'Check-in QR', 'Theo dõi sức khỏe'],
    featuresEn: ['Gym access', 'QR check-in', 'Health monitoring'],
    color: '#8B5CF6',
    isActive: true,
  },
  {
    nameVi: 'Gói VIP',
    nameEn: 'VIP Membership',
    price: 1500000,
    durationDays: 365,
    descriptionVi: 'Gói VIP cao cấp dành cho hội viên thân thiết.',
    descriptionEn: 'Premium VIP package for loyal members.',
    featuresVi: ['Sử dụng phòng tập', 'Check-in QR', 'Theo dõi sức khỏe', 'Ưu tiên hỗ trợ'],
    featuresEn: ['Gym access', 'QR check-in', 'Health monitoring', 'Priority support'],
    color: '#F59E0B',
    isActive: true,
  },
  {
    nameVi: 'Gói Huấn Luyện Cá Nhân',
    nameEn: 'Personal Training Package',
    price: 2000000,
    durationDays: 30,
    descriptionVi: 'Gói huấn luyện 1-1 với PT chuyên nghiệp.',
    descriptionEn: 'One-on-one training with a professional personal trainer.',
    featuresVi: ['Huấn luyện cá nhân', 'Giáo án riêng'],
    featuresEn: ['Personal trainer', 'Custom workout plan'],
    color: '#EF4444',
    isActive: true,
  },
  {
    nameVi: 'Gói Doanh Nghiệp',
    nameEn: 'Corporate Membership',
    price: 5000000,
    durationDays: 365,
    descriptionVi: 'Gói tập dành cho doanh nghiệp, quản lý nhóm nhân viên.',
    descriptionEn: 'Corporate plan for employee groups.',
    featuresVi: ['Dành cho doanh nghiệp', 'Quản lý nhóm nhân viên'],
    featuresEn: ['Corporate access', 'Employee group management'],
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
