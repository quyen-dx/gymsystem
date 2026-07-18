import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Plan from '../models/Plan.js';
import PlanFeature from '../models/PlanFeature.js';

async function migratePlansToFeatures() {
  await connectDB();

  let migratedCount = 0;
  let skippedCount = 0;
  let totalFeaturesMatched = 0;

  const plans = await Plan.find({});
  console.log(`Found ${plans.length} plans total`);

  for (const plan of plans) {
    let modified = false;

    if (plan.featureIds && plan.featureIds.length > 0) {
      skippedCount++;
      continue;
    }

    if (plan.featuresVi && plan.featuresVi.length > 0) {
      const matchedFeatures = await PlanFeature.find({
        name: { $in: plan.featuresVi.map((f) => new RegExp(`^${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) },
      }).lean();

      if (matchedFeatures.length > 0) {
        plan.featureIds = matchedFeatures.map((f) => f._id);
        totalFeaturesMatched += matchedFeatures.length;
        console.log(`  Plan "${plan.nameVi}": matched ${matchedFeatures.length} features`);
        modified = true;
      }
    }

    if (modified) {
      await plan.save();
      migratedCount++;
    }
  }

  console.log('\n=== Migration Summary ===');
  console.log(`Plans migrated: ${migratedCount}`);
  console.log(`Plans skipped (already have featureIds): ${skippedCount}`);
  console.log(`Total features matched: ${totalFeaturesMatched}`);

  await mongoose.disconnect();
  console.log('Done.');
}

migratePlansToFeatures().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
