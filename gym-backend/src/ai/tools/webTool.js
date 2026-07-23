import { search as webSearch } from '../../services/webSearchService.js'

export const WEB_QUERY_DECLARATION = {
  name: 'webQuery',
  description: 'Tìm kiếm trên web để trả lời các câu hỏi về kiến thức tổng quát, dinh dưỡng, sức khỏe, thể thao, gym. KHÔNG dùng cho dữ liệu tài khoản cá nhân (ví, gói tập, lịch tập, thông báo).',
  parameters: {
    type: 'OBJECT',
    properties: {
      query: {
        type: 'STRING',
        description: 'Câu hỏi hoặc từ khóa cần tìm kiếm trên web (tiếng Việt hoặc tiếng Anh).',
      },
    },
    required: ['query'],
  },
}

export async function webQuery(query) {
  try {
    const results = await webSearch(query)
    if (!results.length) {
      return { error: 'NO_RESULT' }
    }
    return { results }
  } catch (err) {
    console.error('[AI][webQuery] error:', err.message)
    return { error: 'NO_RESULT' }
  }
}
