import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const membershipPeriodSchema = new mongoose.Schema({}, { strict: false, collection: 'membershipperiods' });
const MembershipPeriod = mongoose.model('MembershipPeriod', membershipPeriodSchema);

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const memberId = new mongoose.Types.ObjectId("69f3090dfc07b8327e5bc8a4");

  const periods = await MembershipPeriod.find({ memberId }).lean();
  console.log('--- ALL PERIODS FOR THIS MEMBER ---');
  console.log(JSON.stringify(periods, null, 2));

  await mongoose.disconnect();
}

check().catch(console.error);
