import mongoose from 'mongoose'

const faqSchema = new mongoose.Schema(
  {
    questionVi: { type: String, required: true, trim: true },
    questionEn: { type: String, required: true, trim: true },
    answerVi: { type: String, required: true, trim: true },
    answerEn: { type: String, required: true, trim: true },
    categoryVi: { type: String, default: 'Chung', trim: true, index: true },
    categoryEn: { type: String, default: 'General', trim: true, index: true },
    isPublished: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
)

faqSchema.index({ questionVi: 'text', questionEn: 'text', answerVi: 'text', answerEn: 'text' })

const hasText = (value) => typeof value === 'string' && value.trim().length > 0

faqSchema.statics.migrateLegacy = async function () {
  const docs = await this.collection.find({
    $or: [
      { questionVi: { $exists: false } },
      { questionEn: { $exists: false } },
      { answerVi: { $exists: false } },
      { answerEn: { $exists: false } },
    ],
  }).toArray()

  if (docs.length === 0) return { migrated: 0, skipped: 0 }

  let migrated = 0
  let skipped = 0

  for (const faq of docs) {
    if (hasText(faq.questionVi) && hasText(faq.questionEn) && hasText(faq.answerVi) && hasText(faq.answerEn)) {
      continue
    }

    console.log('Migrating legacy FAQ:', {
      id: faq._id,
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
    })

    if (!hasText(faq.question) || !hasText(faq.answer)) {
      skipped += 1
      console.warn('Skipping invalid legacy FAQ:', {
        id: faq._id,
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
      })
      continue
    }

    const question = faq.question.trim()
    const answer = faq.answer.trim()
    const category = hasText(faq.category) ? faq.category.trim() : ''

    await this.collection.updateOne(
      { _id: faq._id },
      {
        $set: {
          questionVi: question,
          questionEn: question,
          answerVi: answer,
          answerEn: answer,
          categoryVi: category || 'Chung',
          categoryEn: category || 'General',
        },
      },
    )
    migrated += 1
  }

  console.log('FAQ legacy migration completed:', { migrated, skipped })
  return { migrated, skipped }
}

const Faq = mongoose.model('Faq', faqSchema)

Faq.migrateLegacy().catch((err) => console.error('FAQ migration error:', err))

export default Faq
