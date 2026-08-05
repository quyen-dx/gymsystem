import DashboardLayout from '../../../../components/layout/header/DashboardLayout'
import DashboardScaffold from '../../../../components/reports/DashboardScaffold'

export default function SystemDashboardPage() {
  return (
    <DashboardLayout>
      <DashboardScaffold
        module="system"
        title="Dashboard Hệ thống"
        subtitle="Người dùng, vai trò, đăng ký & hoạt động hệ thống"
        drawerType="system"
        chartOrder={['userByRole', 'signupByDay']}
        topOrder={['roles']}
        chartPointToFilter={(chartKey, pointKey) => {
          if (chartKey === 'signupByDay') return pointKey ? { date: String(pointKey) } : null
          if (chartKey === 'userByRole') return pointKey ? { role: String(pointKey) } : null
          return null
        }}
        topToFilter={(_topKey, itemId) => (itemId ? { role: itemId } : null)}
      />
    </DashboardLayout>
  )
}
