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
        chartOrder={['revenueByDay', 'revenueByMonth', 'revenueSource', 'revenueByPlan', 'revenueByShop']}
        topOrder={['topPlans', 'topShops', 'topMembers']}
        kpiToFilter={{
          totalRevenue: {},
          transactions: {},
          refunds: { type: 'refund' },
          avgPerDay: {},
        }}
        chartPointToFilter={(chartKey, pointKey) => {
          if (chartKey === 'revenueByDay' || chartKey === 'revenueByMonth') return pointKey ? { date: String(pointKey) } : null
          if (chartKey === 'revenueByPlan') return pointKey ? { planId: String(pointKey) } : null
          if (chartKey === 'revenueByShop') return pointKey ? { shopId: String(pointKey) } : null
          return null
        }}
        topToFilter={(topKey, itemId) => {
          if (topKey === 'topPlans' && itemId) return { planId: itemId }
          if (topKey === 'topShops' && itemId) return { shopId: itemId }
          if (topKey === 'topMembers' && itemId) return { memberId: itemId }
          return null
        }}
      />
    </DashboardLayout>
  )
}
