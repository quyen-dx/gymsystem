import DashboardLayout from '../../../../components/layout/header/DashboardLayout'
import DashboardScaffold from '../../../../components/reports/DashboardScaffold'

export default function PtDashboardPage() {
  return (
    <DashboardLayout>
      <DashboardScaffold
        module="pt"
        title="Dashboard Huấn luyện viên"
        subtitle="Booking, lớp học, học viên, đánh giá & giờ dạy của PT"
        drawerType="pt"
        chartOrder={['bookingByPt', 'ratingByPt']}
        topOrder={['topBooking', 'topStudents', 'topRating', 'topSessions', 'topCancelled', 'topShiftChanges']}
        kpiToFilter={{
          bookings: {},
        }}
        chartPointToFilter={(chartKey, pointKey) => (chartKey === 'bookingByPt' && pointKey ? { ptId: String(pointKey) } : null)}
        topToFilter={(topKey, itemId) => {
          if (topKey === 'topBooking' && itemId) return { ptId: itemId }
          if (topKey === 'topCancelled' && itemId) return { ptId: itemId, status: 'cancelled' }
          return null
        }}
      />
    </DashboardLayout>
  )
}
