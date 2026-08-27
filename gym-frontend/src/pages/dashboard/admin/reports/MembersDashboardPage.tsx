import DashboardLayout from '../../../../components/layout/header/DashboardLayout'
import DashboardScaffold from '../../../../components/reports/DashboardScaffold'

export default function MembersDashboardPage() {
  return (
    <DashboardLayout>
      <DashboardScaffold
        module="members"
        title="Dashboard Hội viên"
        subtitle="Đăng ký mới, gia hạn, đổi gói, hủy membership & check-in"
        drawerType="member"
        chartOrder={['growth', 'renewRate', 'cancelRate']}
        topOrder={['topWorkout', 'topCheckIn']}
        kpiToFilter={{
          new: { activityType: 'register' },
          renew: { activityType: 'renew' },
          changes: { activityType: 'change' },
          cancels: { activityType: 'cancel' },
          checkins: { activityType: 'checkin' },
        }}
        chartPointToFilter={(chartKey, pointKey) => {
          if (!pointKey) return null
          if (chartKey === 'growth') return { date: String(pointKey), activityType: 'register' }
          if (chartKey === 'renewRate') return { date: String(pointKey), activityType: 'renew' }
          if (chartKey === 'cancelRate') return { date: String(pointKey), activityType: 'cancel' }
          return null
        }}
        topToFilter={(topKey, itemId) => (topKey === 'topCheckIn' && itemId ? { memberId: itemId, activityType: 'checkin' } : null)}
      />
    </DashboardLayout>
  )
}
