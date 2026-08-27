import DashboardLayout from '../../../../components/layout/header/DashboardLayout'
import DashboardScaffold from '../../../../components/reports/DashboardScaffold'

export default function CheckinDashboardPage() {
  return (
    <DashboardLayout>
      <DashboardScaffold
        module="checkin"
        title="Dashboard Check-in"
        subtitle="Theo dõi lượt vào phòng tập, tần suất và cách hội viên check-in"
        drawerType="checkin"
        exportEnabled={false}
        chartOrder={['checkinsByDay', 'checkinsByHour', 'checkinMethod', 'sessionType']}
        topOrder={['topMembers', 'topPlans']}
        kpiToFilter={{
          total: { status: 'success' },
          members: { status: 'success' },
          avgPerDay: { status: 'success' },
          scheduled: { status: 'success', sessionType: 'SCHEDULED' },
          freeTraining: { status: 'success', sessionType: 'FREE_TRAINING' },
        }}
        chartPointToFilter={(chartKey, pointKey) => {
          if (chartKey === 'checkinsByDay') return pointKey ? { date: String(pointKey), status: 'success' } : null
          if (chartKey === 'checkinMethod') return pointKey ? { method: String(pointKey), status: 'success' } : null
          if (chartKey === 'sessionType') return pointKey ? { sessionType: String(pointKey), status: 'success' } : null
          return null
        }}
        topToFilter={(topKey, itemId) => {
          if (!itemId) return null
          if (topKey === 'topMembers') return { memberId: itemId, status: 'success' }
          if (topKey === 'topPlans') return { planId: itemId, status: 'success' }
          return null
        }}
      />
    </DashboardLayout>
  )
}
