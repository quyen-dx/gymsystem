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
        chartPointToFilter={(_chartKey, pointKey) => (pointKey ? { date: String(pointKey) } : null)}
        topToFilter={(_topKey, itemId) => (itemId ? { memberId: itemId } : null)}
      />
    </DashboardLayout>
  )
}
