import DashboardLayout from '../../../../components/layout/header/DashboardLayout'
import DashboardScaffold from '../../../../components/reports/DashboardScaffold'

export default function ShopDashboardPage() {
  return (
    <DashboardLayout>
      <DashboardScaffold
        module="shop"
        title="Dashboard Shop"
        subtitle="Đơn hàng, sản phẩm, seller & trạng thái đơn"
        drawerType="shop"
        chartOrder={['revenueByDay', 'revenueByMonth', 'revenueByShop', 'revenueBySeller', 'categoryShare', 'returnRate']}
        topOrder={['topSellingShops', 'topShops', 'topSellers', 'topSellingProducts', 'topProducts', 'topReturned']}
        kpiToFilter={{
          revenue: {},
          orders: {},
        }}
        chartPointToFilter={(chartKey, pointKey) => {
          if (chartKey === 'revenueByDay' || chartKey === 'revenueByMonth') return pointKey ? { date: String(pointKey) } : null
          if (chartKey === 'revenueByShop') return pointKey ? { shopId: String(pointKey) } : null
          if (chartKey === 'revenueBySeller') return pointKey ? { sellerId: String(pointKey) } : null
          return null
        }}
        topToFilter={(topKey, itemId) => {
          if (!itemId) return null
          if (topKey === 'topSellers') return { sellerId: itemId }
          if (topKey === 'topSellingShops' || topKey === 'topShops') return { shopId: itemId }
          return null
        }}
      />
    </DashboardLayout>
  )
}
