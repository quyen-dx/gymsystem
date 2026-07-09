import { getAvailablePTs } from '../../services/ptService.js'

export default [
  {
    name: 'getAvailablePTs',
    description: 'Lấy danh sách PT. Có thể lọc theo chuyên môn hoặc tên.',
    subjects: ['pt', 'trainer'],
    parameters: {
      type: 'object',
      properties: {
        specialization: {
          type: 'string',
          description: 'Chuyên môn hoặc tên PT cần tìm (optional)',
        },
      },
    },
    handler: async (args) => getAvailablePTs(args || {}),
  },
]
