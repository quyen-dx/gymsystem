import DashboardLayout from '../../../../components/layout/header/DashboardLayout'
import DashboardScaffold from '../../../../components/reports/DashboardScaffold'

export default function BookingDashboardPage() {
  return (
    <DashboardLayout>
      <DashboardScaffold
        module="booking"
        title="Dashboard Booking & Lớp học"
        subtitle="Đặt lịch, lớp, lịch trình & trạng thái booking"
        drawerType="booking"
        chartOrder={['bookingByDay', 'bookingByPt', 'bookingByHour', 'cancelRate']}
        topOrder={['topBookedPt', 'topRatedPt', 'cancelRateTop']}
        kpiToFilter={{
          total: {},
          success: {},
          cancelled: { status: 'cancelled' },
        }}
        chartPointToFilter={(chartKey, pointKey) => {
          if (chartKey === 'bookingByDay') return pointKey ? { date: String(pointKey) } : null
          if (chartKey === 'bookingByPt') return pointKey ? { ptId: String(pointKey) } : null
          return null
        }}
        topToFilter={(_topKey, itemId) => (itemId ? { ptId: itemId } : null)}
      />
    </DashboardLayout>
  )
}
