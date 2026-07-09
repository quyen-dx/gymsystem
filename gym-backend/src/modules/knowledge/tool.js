import { search, getSources } from '../../ai/services/vectorStoreService.js'

export default [
  {
    name: 'searchVectorKnowledge',
    description: 'Tra cứu kiến thức ngữ nghĩa từ toàn bộ cơ sở tri thức (FAQ, chính sách, bài tập, dinh dưỡng, tài liệu hướng dẫn). Trả về các đoạn văn bản liên quan nhất kèm độ chính xác.',
    subjects: ['faq', 'policy', 'workout', 'nutrition', 'health', 'general', 'navigation', 'membership', 'pt', 'booking', 'checkin', 'product', 'account'],
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Câu hỏi hoặc nội dung cần tra cứu' },
        topK: { type: 'number', description: 'Số kết quả tối đa (mặc định 5)' },
        sources: {
          type: 'array',
          items: { type: 'string', enum: ['faq', 'policy', 'readme', 'exercise', 'nutrition', 'knowledge', 'module_readme'] },
          description: 'Lọc theo nguồn dữ liệu. Mặc định tìm tất cả.',
        },
      },
    },
    handler: async (args) => {
      const query = args?.query || ''
      if (!query.trim()) return { results: [], message: 'Vui lòng nhập câu hỏi' }

      const results = await search(query, {
        sources: args?.sources?.length ? args.sources : undefined,
        topK: args?.topK || 5,
        minScore: 0,
      })

      return {
        query,
        total: results.length,
        results: results.map((r) => ({
          source: r.source,
          title: r.title,
          content: r.content,
          score: r.score,
          language: r.language,
        })),
      }
    },
  },
]
