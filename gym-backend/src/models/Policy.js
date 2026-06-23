import mongoose from 'mongoose'

const policySchema = new mongoose.Schema(
  {
    titleVi: { type: String, required: true, trim: true },
    titleEn: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    categoryVi: { type: String, default: 'Chung', trim: true },
    categoryEn: { type: String, default: 'General', trim: true },
    contentVi: { type: String, required: true, trim: true },
    contentEn: { type: String, required: true, trim: true },
    isPublished: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
)

const hasText = (value) => typeof value === 'string' && value.trim().length > 0

policySchema.statics.migrateLegacy = async function () {
  const docs = await this.find({
    $or: [
      { titleVi: { $exists: false } },
      { titleEn: { $exists: false } },
      { contentVi: { $exists: false } },
      { contentEn: { $exists: false } },
    ],
  }).lean()

  if (docs.length === 0) return { migrated: 0, skipped: 0 }

  let migrated = 0
  let skipped = 0

  for (const policy of docs) {
    if (hasText(policy.titleVi) && hasText(policy.titleEn) && hasText(policy.contentVi) && hasText(policy.contentEn)) {
      continue
    }

    console.log('Migrating legacy Policy:', {
      id: policy._id,
      title: policy.title,
      content: policy.content,
      category: policy.category,
    })

    if (!hasText(policy.title) || !hasText(policy.content)) {
      skipped += 1
      console.warn('Skipping invalid legacy Policy:', {
        id: policy._id,
        title: policy.title,
        content: policy.content,
        category: policy.category,
      })
      continue
    }

    const title = policy.title.trim()
    const content = policy.content.trim()
    const category = hasText(policy.category) ? policy.category.trim() : ''

    await this.updateOne(
      { _id: policy._id },
      {
        $set: {
          titleVi: title,
          titleEn: title,
          contentVi: content,
          contentEn: content,
          categoryVi: category || 'Chung',
          categoryEn: category || 'General',
        },
      },
    )
    migrated += 1
  }

  console.log('Policy legacy migration completed:', { migrated, skipped })
  return { migrated, skipped }
}

const Policy = mongoose.model('Policy', policySchema)

Policy.migrateLegacy().catch((err) => console.error('Policy migration error:', err))

export default Policy
