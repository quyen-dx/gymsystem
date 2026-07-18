import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PlanFeature from '../models/PlanFeature.js';

dotenv.config();

const FEATURES = [
  { code: 'GYM_ACCESS', name: 'Sử dụng phòng tập', description: 'Quyền truy cập và sử dụng phòng tập gym', isSystem: true },
  { code: 'QR_CHECKIN', name: 'Check-in QR', description: 'Check-in QR khi vào phòng tập', isSystem: true },
  { code: 'BOOK_PT_GROUP', name: 'Đặt lịch PT nhóm', description: 'Cho phép hội viên đặt lịch tập với PT theo nhóm', isSystem: true },
  { code: 'BOOK_PT_PRIVATE', name: 'Đặt lịch PT cá nhân', description: 'Cho phép hội viên đặt lịch tập cá nhân 1-1 với PT', isSystem: true },
  { code: 'WORKOUT_PLAN', name: 'Nhận giáo án tập luyện', description: 'PT thiết kế giáo án tập luyện riêng theo thể trạng', isSystem: true },
  { code: 'DIET_PLAN', name: 'Nhận giáo án dinh dưỡng', description: 'Tư vấn và thiết kế giáo án dinh dưỡng cá nhân', isSystem: true },
  { code: 'BODY_SCAN', name: 'Đo chỉ số cơ thể', description: 'Đo lường và theo dõi các chỉ số cơ thể định kỳ', isSystem: true },
  { code: 'HEALTH_TRACKING', name: 'Theo dõi sức khỏe', description: 'Theo dõi sức khỏe và tiến trình tập luyện', isSystem: false },
  { code: 'GROUP_CLASS', name: 'Tham gia lớp nhóm', description: 'Tham gia các lớp tập nhóm (Yoga, Zumba, Boxing...)', isSystem: true },
  { code: 'LOCKER', name: 'Tủ đồ cá nhân', description: 'Tủ đồ cá nhân riêng tại phòng tập', isSystem: false },
  { code: 'PARKING', name: 'Bãi gửi xe', description: 'Chỗ đỗ xe ưu tiên tại phòng tập', isSystem: false },
  { code: 'SAUNA', name: 'Xông hơi/Sauna', description: 'Sử dụng phòng xông hơi và sauna', isSystem: false },
  { code: 'PT_ONLINE', name: 'PT Online', description: 'Tập luyện trực tuyến với PT qua video call', isSystem: false },
  { code: 'SUPPORT_PRIORITY', name: 'Ưu tiên hỗ trợ', description: 'Được ưu tiên hỗ trợ từ PT và nhân viên', isSystem: true },
  { code: 'ENTERPRISE', name: 'Quản lý doanh nghiệp', description: 'Tính năng quản lý nhân viên cho doanh nghiệp', isSystem: false },
  { code: 'SHOP_ACCESS', name: 'Cửa hàng', description: 'Truy cập cửa hàng sản phẩm', isSystem: false },
];

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set in environment');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const ops = FEATURES.map((f) => ({
    updateOne: {
      filter: { code: f.code },
      update: { $set: { ...f, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      upsert: true,
    },
  }));

  const result = await PlanFeature.bulkWrite(ops);
  console.log('Seed result:', {
    inserted: result.upsertedCount,
    modified: result.modifiedCount,
    matched: result.matchedCount,
  });

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
