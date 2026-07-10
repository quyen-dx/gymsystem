import { searchFaqs, searchPolicies } from '../../ai/services/faqPolicySearchService.js'

export default [
  {
    name: 'searchFaqs',
    description: 'Tìm kiếm FAQ (câu hỏi thường gặp) theo nội dung câu hỏi.',
    subjects: ['faq', 'policy', 'navigation', 'account'],
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Câu hỏi cần tìm kiếm' },
        category: { type: 'string', description: 'Danh mục (optional)' },
      },
    },
    handler: async (args) => searchFaqs({ query: args?.query || '', category: args?.category || '' }),
  },
  {
    name: 'searchPolicies',
    description: 'Tìm kiếm chính sách phòng gym.',
    subjects: ['policy', 'faq'],
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Từ khóa chính sách cần tìm' },
      },
    },
    handler: async (args) => searchPolicies({ query: args?.query || '' }),
  },
]
