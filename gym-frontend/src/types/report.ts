export type ReportRange = 'today' | '7d' | '30d' | 'quarter' | 'year' | 'custom'

export interface ReportRangeState {
  value: ReportRange
  from?: string
  to?: string
}

export type ReportModule = 'finance' | 'members' | 'pt' | 'booking' | 'shop' | 'system'

export interface ReportRangeInfo {
  from: string
  to: string
  label: string
}

export type KpiFormat = 'money' | 'number' | 'percent' | 'rating'

export interface ReportKpi {
  key: string
  label: string
  value: number
  delta: number | null
  format: KpiFormat
  icon: string
  sparkline: number[]
}

export type ChartType = 'line' | 'bar' | 'pie' | 'area'

export interface ReportChartSeries {
  name: string
  data: number[]
}

export interface ReportChart {
  type: ChartType
  title: string
  labels: string[]
  pointKeys?: (string | number)[]
  series: ReportChartSeries[]
}

export interface TopItem {
  id?: string
  label: string
  value: number
  sub?: string
  color?: string
}

export interface TopListData {
  title: string
  items: TopItem[]
}

export interface ReportDashboard {
  range: ReportRangeInfo
  kpis: ReportKpi[]
  charts: Record<string, ReportChart>
  tops: Record<string, TopListData>
}

export interface SummaryModule {
  key: ReportModule
  label: string
  description: string
  icon: string
  color: string
  value: number
  displayValue: string
  delta: number | null
  hint: string
  route: string
}

export interface ReportSummary {
  range: ReportRangeInfo
  modules: SummaryModule[]
}

export interface TransactionRow {
  id: string
  code: string
  memberId?: string
  memberName: string
  memberEmail: string
  memberPhone: string
  memberCode: string
  plan: string
  type: string
  typeLabel: string
  typeColor: string
  paymentMethod: string
  amount: number
  discount: number
  refund: number
  status: string
  time?: string
  note: string
  staff: string
  ptName: string
}

export interface TransactionsResult {
  range: ReportRangeInfo
  rows: TransactionRow[]
  total: number
  page: number
  pageSize: number
  types: Array<{ key: string; label: string; color: string }>
}

export interface TransactionFilter {
  type?: string
  search?: string
  date?: string
  ptId?: string
  shopId?: string
  memberId?: string
  planId?: string
}

export type DrawerType = 'financial' | 'member' | 'booking' | 'pt' | 'shop' | 'system'

export type DrillFilter = Record<string, string | number | undefined>

export interface ActivityRow {
  id: string
  memberId?: string
  memberName: string
  memberCode: string
  plan: string
  activityType: string
  activityLabel: string
  detail: string
  time?: string
}

export interface BookingRow {
  id: string
  code: string
  memberId?: string
  memberName: string
  memberCode: string
  ptId?: string
  ptName: string
  date?: string
  slot: string
  trainingType?: string
  status: string
  statusLabel: string
  paymentStatus?: string
}

export interface OrderRow {
  id: string
  code: string
  memberId?: string
  memberName: string
  memberCode: string
  shopId?: string
  shopName: string
  sellerName: string
  itemCount: number
  itemsSummary: string
  total: number
  discount: number
  status: string
  statusLabel: string
  paymentStatus?: string
  time?: string
}

export interface SystemUserRow {
  id: string
  name: string
  email: string
  phone: string
  memberCode: string
  role: string
  roleLabel: string
  status: string
  registeredAt?: string
  lastActiveAt?: string
}

export const MODULE_META: Record<ReportModule, { label: string; subtitle: string }> = {
  finance: { label: 'Tài chính', subtitle: 'Doanh thu, giao dịch, hoàn tiền & lợi nhuận' },
  members: { label: 'Hội viên', subtitle: 'Đăng ký, gia hạn, check-in & hoạt động' },
  pt: { label: 'Huấn luyện viên', subtitle: 'Booking, lớp học, đánh giá & doanh thu PT' },
  booking: { label: 'Booking & Lớp học', subtitle: 'Đặt lịch, lớp mở, tỷ lệ hủy' },
  shop: { label: 'Shop', subtitle: 'Doanh thu, đơn hàng & sản phẩm' },
  system: { label: 'Hệ thống', subtitle: 'Người dùng, vai trò & hoạt động hệ thống' },
}
