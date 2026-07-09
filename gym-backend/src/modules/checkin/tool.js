import { getCheckinStats } from '../../services/checkInService.js'

export default [
  {
    name: 'getCheckinStats',
    description: 'Kiểm tra số buổi tập, ngày check-in gần nhất, và streak của người dùng.',
    subjects: ['checkin', 'progress'],
    parameters: { type: 'object', properties: {} },
    handler: async ({ userId }) => getCheckinStats({ userId }),
  },
]
