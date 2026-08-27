import DashboardLayout from '../../../../components/layout/header/DashboardLayout'
import DashboardScaffold from '../../../../components/reports/DashboardScaffold'

export default function FinanceDashboardPage() {
  return (
    <DashboardLayout>
      <DashboardScaffold
        module="finance"
        title="Dashboard Tài chính"
        subtitle="Doanh thu, giao dịch, ví, hoàn tiền & dòng tiền"
        drawerType="financial"
        chartOrder={['revenueByDay', 'revenueByMonth', 'revenueByPlan']}
        topOrder={['topPlans', 'topMembers']}
        kpiToFilter={{
          totalRevenue: { type: 'membership' },
          transactions: {},
          refunds: { type: 'refund' },
          avgPerDay: { type: 'membership' },
        }}
        chartPointToFilter={(chartKey, pointKey) => {
          if (chartKey === 'revenueByDay' || chartKey === 'revenueByMonth') return pointKey ? { date: String(pointKey), type: 'membership' } : null
          if (chartKey === 'revenueByPlan') return pointKey ? { planId: String(pointKey), type: 'membership' } : null
          return null
        }}
        topToFilter={(topKey, itemId) => {
          if (topKey === 'topPlans' && itemId) return { planId: itemId, type: 'membership' }
          if (topKey === 'topMembers' && itemId) return { memberId: itemId, type: 'membership' }
          return null
        }}
      />
    </DashboardLayout>
  )
}
