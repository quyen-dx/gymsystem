import { getActivePlans } from '../../services/planService.js'
import { getMembershipInfo, createMembership as createMembershipService } from '../../services/membershipService.js'

export default [
  {
    name: 'getAvailablePlans',
    description: 'Lấy danh sách tất cả các gói tập gym (membership plans) đang được cung cấp tại phòng tập.',
    subjects: ['plan', 'membership', 'pricing'],
    parameters: { type: 'object', properties: {} },
    handler: async () => getActivePlans(),
  },
  {
    name: 'getMembershipInfo',
    description: 'Kiểm tra tình trạng gói tập hiện tại của người dùng.',
    subjects: ['membership'],
    parameters: { type: 'object', properties: {} },
    handler: async ({ userId }) => getMembershipInfo({ userId }),
  },
  {
    name: 'createMembership',
    description: 'Đăng ký hoặc gia hạn gói tập cho người dùng.',
    subjects: ['membership'],
    parameters: {
      type: 'object',
      properties: {
        planId: { type: 'string', description: 'ID của gói tập' },
      },
      required: ['planId'],
    },
    handler: async ({ userId, planId }) => createMembershipService({ userId, planId }),
  },
]
