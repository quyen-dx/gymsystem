export interface PTSchedule {
  _id: string
  ptId: string
  dayOfWeek: number
  shift: 'morning' | 'afternoon' | 'evening'
  startTime?: string
  endTime?: string
  status?: 'active' | 'cancelled'
}

export interface PT {
  _id: string
  name: string
  fullName?: string
  email: string | null
  phone: string | null
  avatar: string
  dateOfBirth: string | null
  gender: string
  isActive: boolean
  status: string
  specialties: string[]
  bio: string
  experienceYears: number
  certificates: string[]
  rating: number
  introVideoUrl: string
  totalSessions: number
  totalStudents: number
  oneToOnePrice?: number | null
  groupPrice?: number | null
  ptId: string | null
  schedules: PTSchedule[]
  busyBookings?: Array<{ date: string; slot: string }>
  bookingCount: number
  createdAt: string
}

export interface PTBooking {
  _id: string
  memberId: { _id: string; name: string; avatar: string; phone: string }
  date: string
  slot: string
  status: string
  note: string
}

export interface PTDaySchedule {
  date: string
  dayOfWeek: number
  bookings: PTBooking[]
}

export interface PTFormData {
  name: string
  email?: string
  phone?: string
  password?: string
  dateOfBirth?: string
  gender?: string
  specialties?: string[]
  bio?: string
  experienceYears?: number
  certificates?: string[]
  introVideoUrl?: string
}
