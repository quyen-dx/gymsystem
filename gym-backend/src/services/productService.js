import Product from '../models/Product.js'

const buildSearchRegex = (value = '') => {
  const terms = String(value)
    .split(/[\s,;|]+/)
    .map((term) => term.trim())
    .filter(Boolean)
  if (terms.length === 0) return /.*/i
  return new RegExp(terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i')
}

const goalMap = {
  'tăng cơ': ['whey', 'protein', 'mass', 'creatine', 'tăng cơ'],
  'giam can': ['fat burn', 'giảm cân', 'cardio', 'l-carnitine'],
  'giảm cân': ['fat burn', 'giảm cân', 'cardio', 'l-carnitine'],
  cardio: ['cardio', 'giày', 'nước', 'đai'],
}

export const getRecommendedProducts = async ({ goal = '' } = {}) => {
  const keyword = String(goal || '').trim()
  const normalized = keyword.toLowerCase()
  const terms = goalMap[normalized] || [keyword]
  const queryRegex = buildSearchRegex(terms.join(' '))

  const products = await Product.find({
    isActive: true,
    stock: { $gt: 0 },
    $or: [
      { name: queryRegex },
      { category: queryRegex },
      { description: queryRegex },
    ],
  })
    .select('name price category image images stock rating reviewCount')
    .sort({ rating: -1, stock: -1, createdAt: -1 })
    .limit(50)
    .lean()

  return {
    count: products.length,
    goal: keyword,
    products: products.map((product) => ({
      id: product._id,
      name: product.name,
      price: product.price,
      category: product.category,
      image: product.image || product.images?.[0] || '',
      stock: product.stock,
      rating: product.rating || 0,
      reviewCount: product.reviewCount || 0,
      link: `/dashboard/member/store/${product._id}`,
    })),
  }
}
