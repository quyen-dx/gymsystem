import { searchKnowledge, isVectorAvailable } from '../providers/vectorProvider.js'

const VECTOR_QUERY_DECLARATION = {
  name: 'vectorQuery',
  description: 'Truy vấn kiến thức nội bộ GymPro: chính sách, quy định, hướng dẫn, FAQ, quyền lợi, điều khoản, bài tập, dinh dưỡng, thông tin gói tập, giờ mở cửa. Dùng cho mọi câu hỏi chung về GymPro (không có "của tôi").',
  parameters: {
    type: 'OBJECT',
    properties: {
      query: {
        type: 'STRING',
        description: 'Câu hỏi về chính sách, quy định, hướng dẫn hoặc kiến thức nội bộ của GymPro.',
      },
    },
    required: ['query'],
  },
}

function validateQuery(query) {
  return typeof query === 'string' && query.trim().length > 0
}

function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  return isNaN(d.getTime()) ? date : d.toISOString().split('T')[0]
}

async function search(query) {
  if (!validateQuery(query)) {
    return {
      source: 'vector',
      success: false,
      documents: [],
      suggestions: ['Vui lòng nhập câu hỏi cụ thể về chính sách hoặc kiến thức GymPro.'],
      metadata: { query, error: 'INVALID_QUERY' },
    }
  }

  try {
    const available = await isVectorAvailable()
    if (!available) {
      return {
        source: 'vector',
        success: false,
        documents: [],
        suggestions: ['Kiến thức nội bộ chưa được đồng bộ. Vui lòng liên hệ quản trị viên.'],
        metadata: { query, error: 'NO_KNOWLEDGE_BASE' },
      }
    }

    const documents = await searchKnowledge(query.trim())

    if (!documents.length) {
      return {
        source: 'vector',
        success: true,
        documents: [],
        suggestions: ['Thử diễn đạt lại câu hỏi theo cách khác.'],
        metadata: { query, totalResults: 0 },
      }
    }

    return {
      source: 'vector',
      success: true,
      documents: documents.map(doc => ({
        title: doc.title,
        category: doc.category,
        content: doc.content,
        source: doc.source,
        updatedAt: formatDate(doc.updatedAt),
        score: Math.round(doc.score * 100) / 100,
      })),
      suggestions: [],
      metadata: { query, totalResults: documents.length },
    }
  } catch (error) {
    console.error('[VectorTool] search error:', error.message)
    return {
      source: 'vector',
      success: false,
      documents: [],
      suggestions: ['Hiện tại không thể truy vấn kiến thức nội bộ. Vui lòng thử lại sau.'],
      metadata: { query, error: 'SEARCH_ERROR' },
    }
  }
}

export { VECTOR_QUERY_DECLARATION, search as vectorQuery }
