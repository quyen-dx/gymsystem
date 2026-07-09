import { getRecommendedProducts } from '../../services/productService.js'

export default [
  {
    name: 'getRecommendedProducts',
    description: 'Lấy danh sách sản phẩm/shop được đề xuất trong phòng gym.',
    subjects: ['product', 'shop'],
    parameters: {
      type: 'object',
      properties: {
        goal: {
          type: 'string',
          description: 'Mục tiêu tập luyện của người dùng (optional)',
        },
      },
    },
    handler: async (args) => getRecommendedProducts(args || {}),
  },
]
