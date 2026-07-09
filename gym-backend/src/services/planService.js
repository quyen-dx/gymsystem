import Plan from '../models/Plan.js'

export const getActivePlans = async () => {
  const plans = await Plan.find({ isActive: true })
    .select('name nameVi nameEn price durationDays description descriptionVi descriptionEn featuresVi featuresEn color updatedAt')
    .sort({ price: 1 })
    .lean()

  return {
    count: plans.length,
    plans: plans.map((p) => ({
      id: p._id,
      _id: p._id,
      name: p.name || p.nameVi || p.nameEn,
      nameVi: p.nameVi || p.name,
      nameEn: p.nameEn || p.name,
      price: p.price,
      duration: `${p.durationDays} ngày`,
      durationDays: p.durationDays,
      description: p.description,
      descriptionVi: p.descriptionVi || p.description,
      descriptionEn: p.descriptionEn || p.description,
      featuresVi: p.featuresVi || [],
      featuresEn: p.featuresEn || [],
      color: p.color || '#000',
      updatedAt: p.updatedAt,
    })),
  }
}
