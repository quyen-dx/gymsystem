import Plan from '../models/Plan.js'

export const getActivePlans = async () => {
  const plans = await Plan.find({ isActive: true })
    .select('nameVi price durationDays descriptionVi featureIds color updatedAt')
    .populate('featureIds')
    .sort({ price: 1 })
    .lean()

  return {
    count: plans.length,
    plans: plans.map((p) => ({
      id: p._id,
      _id: p._id,
      name: p.nameVi,
      nameVi: p.nameVi,
      price: p.price,
      duration: `${p.durationDays} ngày`,
      durationDays: p.durationDays,
      description: p.descriptionVi,
      descriptionVi: p.descriptionVi,
      features: p.featureIds || [],
      color: p.color || '#000',
      updatedAt: p.updatedAt,
    })),
  }
}
