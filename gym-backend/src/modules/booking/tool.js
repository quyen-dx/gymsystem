import { getUpcomingBookings, createBookingRequest } from '../../services/bookingService.js'

export default [
  {
    name: 'getUpcomingBookings',
    description: 'Lấy danh sách lịch tập sắp tới của người dùng.',
    subjects: ['booking', 'schedule'],
    parameters: { type: 'object', properties: {} },
    handler: async ({ userId }) => getUpcomingBookings({ userId }),
  },
  {
    name: 'createBookingRequest',
    description: 'Đặt lịch tập với PT.',
    subjects: ['booking'],
    parameters: {
      type: 'object',
      properties: {
        ptId: { type: 'string', description: 'ID của PT' },
        date: { type: 'string', description: 'Ngày muốn đặt (YYYY-MM-DD)' },
        slot: { type: 'string', description: 'Khung giờ (VD: "08:00-09:00")' },
        note: { type: 'string', description: 'Ghi chú thêm (optional)' },
      },
      required: ['ptId', 'date', 'slot'],
    },
    handler: async (args) => createBookingRequest(args),
  },
]
