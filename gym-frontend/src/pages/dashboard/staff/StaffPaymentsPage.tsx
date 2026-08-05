import { CheckCircleFilled, CloseCircleFilled, EyeOutlined, FilterOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Alert, Badge, Button, DatePicker, Descriptions, Drawer, Input, Modal, Select, Space, Table, Tabs, Tag, message } from 'antd'
import React, { useEffect , useState } from 'react'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { membershipService, type RefundRequest } from '../../../services/membershipService'
import { socketService } from '../../../services/socketService'
import { staffListAllPayments } from '../../../services/walletService'

const { RangePicker } = DatePicker

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const formatDate = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '-'

function getPaymentTypeLabel(record: any) {
  if (record.metadata?.purpose === 'WALLET_DEPOSIT') return 'Nạp ví'
  if (record.source === 'OFFLINE' && record.planId) return 'Mua gói tại quầy'
  if (record.source === 'ONLINE' && record.planId) return 'Mua gói online'
  if (record.status === 'REFUNDED' || record.status === 'refunded') return 'Hoàn tiền'
  if (record.paymentMethod === 'WALLET') return 'Thanh toán ví'
  return 'Thanh toán'
}

function getPaymentTypeColor(record: any) {
  if (record.metadata?.purpose === 'WALLET_DEPOSIT') return 'processing'
  if (record.source === 'OFFLINE') return 'purple'
  if (record.source === 'ONLINE') return 'geekblue'
  if (record.status === 'REFUNDED' || record.status === 'refunded') return 'orange'
  return 'default'
}

function getPaymentStatusMeta(status: string) {
  const upper = (status || '').toUpperCase()
  if (upper === 'PAID') return { color: 'success' as const, label: 'Đã thanh toán' }
  if (upper === 'PENDING') return { color: 'warning' as const, label: 'Chờ thanh toán' }
  if (upper === 'FAILED') return { color: 'error' as const, label: 'Thất bại' }
  if (upper === 'REFUNDED') return { color: 'orange' as const, label: 'Đã hoàn tiền' }
  if (upper === 'CANCELLED') return { color: 'default' as const, label: 'Đã hủy' }
  return { color: 'default' as const, label: status || '-' }
}

const rrStatusColors: Record<string, string> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'error', CANCELLED: 'default', REFUNDED: 'orange' }
const rrStatusLabels: Record<string, string> = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', CANCELLED: 'Đã hủy', REFUNDED: 'Đã hoàn tiền' }

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[var(--gs-text-soft)]">{label}</span>
      <span className={bold ? 'font-medium text-[var(--gs-text)]' : ''}>{value}</span>
    </div>
  )
}

export default function StaffPaymentsPage() {
  const [activeTab, setActiveTab] = useState('history')

  // --- Tab 1: Payment History ---
  const [payments, setPayments] = useState<any[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [paymentsPagination, setPaymentsPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 })
  const [historySearch, setHistorySearch] = useState('')
  const [historyStatus, setHistoryStatus] = useState('')
  const [historyDateRange, setHistoryDateRange] = useState<[any, any] | null>(null)

  // --- Tab 2: Refund history ---
  const [refundHistory, setRefundHistory] = useState<RefundRequest[]>([])
  const [loadingRefundHistory, setLoadingRefundHistory] = useState(false)
  const [rhPagination, setRhPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [rhSearch, setRhSearch] = useState('')
  const [rhStatusFilter, setRhStatusFilter] = useState('')
  const [rhDateRange, setRhDateRange] = useState<[any, any] | null>(null)

  // --- Tab 3: Refund Requests (PENDING) ---
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([])
  const [loadingRefundRequests, setLoadingRefundRequests] = useState(false)
  const [rrPagination, setRrPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [rrSearch, setRrSearch] = useState('')
  const [rrStatusFilter, setRrStatusFilter] = useState('PENDING')

  const [hasNewRefundRequest, setHasNewRefundRequest] = useState(false)
  const [pendingRefundCount, setPendingRefundCount] = useState(0)
  const [detailRR, setDetailRR] = useState<RefundRequest | null>(null)
  const [approvingRR, setApprovingRR] = useState<RefundRequest | null>(null)
  const [approvingRRNote, setApprovingRRNote] = useState('')
  const [rejectingRR, setRejectingRR] = useState<RefundRequest | null>(null)
  const [rejectingRRReason, setRejectingRRReason] = useState('')
  const [rrActionLoading, setRrActionLoading] = useState(false)

  // --- History ---
  const fetchPayments = async (page = 1) => {
    setLoadingPayments(true)
    try {
      const params: Record<string, any> = { page, limit: 50 }
      if (historySearch.trim()) params.search = historySearch.trim()
      if (historyStatus) params.status = historyStatus
      if (historyDateRange?.[0]) params.fromDate = historyDateRange[0].format('YYYY-MM-DD')
      if (historyDateRange?.[1]) params.toDate = historyDateRange[1].format('YYYY-MM-DD')
      const res = await staffListAllPayments(params)
      setPayments(res.data.data?.payments || [])
      setPaymentsPagination(res.data.data?.pagination || { total: 0, page: 1, limit: 50, totalPages: 0 })
    } catch { message.error('Không thể tải lịch sử thanh toán') }
    setLoadingPayments(false)
  }

  const fetchRefundHistory = (page = 1) => {
    setLoadingRefundHistory(true)
    const params: Record<string, any> = { page, limit: 20 }
    if (rhSearch.trim()) params.search = rhSearch.trim()
    if (rhStatusFilter) params.status = rhStatusFilter
    else params.status = 'APPROVED,REJECTED,CANCELLED,REFUNDED'
    if (rhDateRange?.[0]) params.fromDate = rhDateRange[0].format('YYYY-MM-DD')
    if (rhDateRange?.[1]) params.toDate = rhDateRange[1].format('YYYY-MM-DD')
    membershipService.getStaffRefundRequests(params)
      .then((res) => {
        setRefundHistory(res.data.refundRequests || [])
        setRhPagination(res.data.pagination || { total: 0, page: 1, limit: 20, totalPages: 0 })
      })
      .catch(() => message.error('Không thể tải lịch sử hoàn tiền'))
      .finally(() => setLoadingRefundHistory(false))
  }

  useEffect(() => {
    fetchPayments()
    fetchRefundHistory()
    fetchRefundRequests()
  }, [])

  useEffect(() => {
    socketService.connect()
    membershipService.getPendingRefundRequestCount().then(res => {
      setPendingRefundCount(res.data.count ?? 0)
    }).catch(() => {})
    const handler = (data: { count: number }) => {
      setPendingRefundCount(prev => {
        if (data.count > prev) setHasNewRefundRequest(true)
        return data.count
      })
      if (data.count === 0) setHasNewRefundRequest(false)
    }
    socketService.on('refund_request_update', handler)
    return () => {
      socketService.off('refund_request_update', handler)
    }
  }, [])

  // --- Columns ---
  const historyAllColumns = [
    { title: 'Mã giao dịch', dataIndex: '_id', width: 100, render: (id: string) => <span className="font-mono text-xs">{id.slice(-8)}</span> },
    {
      title: 'Member ID', width: 100,
      render: (_: any, r: any) => r.userId?.memberCode || r.userId?._id?.slice(-6) || '-',
    },
    {
      title: 'Họ tên', width: 160,
      render: (_: any, r: any) => r.userId?.fullName || r.userId?.name || '-',
    },
    {
      title: 'Loại giao dịch', width: 150,
      render: (_: any, r: any) => <Tag color={getPaymentTypeColor(r)}>{getPaymentTypeLabel(r)}</Tag>,
    },
    { title: 'Số tiền', dataIndex: 'amount', width: 140, render: formatMoney },
    {
      title: 'Phương thức', width: 140,
      render: (_: any, r: any) => {
        const m = r.paymentMethod || r.method || '-'
        const labels: Record<string, string> = { CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', POS: 'Quẹt thẻ', WALLET: 'Ví', STRIPE: 'Stripe', MANUAL: 'Thủ công', REFUND: 'Hoàn tiền', VNPAY: 'VNPay', INTERNATIONAL_CARD: 'Thẻ quốc tế', MANUAL_QR: 'Chuyển khoản QR' }
        return labels[m] || m
      },
    },
    {
      title: 'Trạng thái', width: 130,
      render: (_: any, r: any) => {
        const meta = getPaymentStatusMeta(r.status)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    { title: 'Thời gian', dataIndex: 'createdAt', width: 170, render: formatDate },
    {
      title: 'Người xử lý', width: 140,
      render: (_: any, r: any) => r.metadata?.staffName || r.metadata?.staffId || '-',
    },
  ]

  const renderEligibilityTag = (rr: any) => {
    const eligible = rr.refundPolicyResult === 'Đủ điều kiện hoàn tiền'
      || (rr.__source === 'cancellation' && rr.refundAmount > 0)
    return (
      <Tag color={eligible ? 'success' : 'error'} icon={eligible ? <CheckCircleFilled /> : <CloseCircleFilled />}>
        {eligible ? 'Đủ điều kiện' : 'Không đủ điều kiện'}
      </Tag>
    )
  }

  const getRefundBreakdown = (rr: RefundRequest) => {
  const hasPending = rr.pendingPeriodsCount && rr.pendingPeriodsCount > 0
  const pendingTotal = rr.pendingPeriodsTotal || 0

  // Đã từ chối/hủy: không hoàn gì cả
  if (rr.status === 'REJECTED' || rr.status === 'CANCELLED') {
    return { mainRefund: 0, pendingTotal: 0, total: 0, hasPending, pendingCount: rr.pendingPeriodsCount || 0 }
  }

  // Period-based PENDING: refundAmount = tiền gói chính (chưa gộp renewal)
  if (rr.status === 'PENDING' && !rr.__source) {
    return {
      mainRefund: rr.refundAmount || 0,
      pendingTotal,
      total: (rr.refundAmount || 0) + pendingTotal,
      hasPending,
      pendingCount: rr.pendingPeriodsCount || 0,
    }
  }

  // APPROVED/REFUNDED period-based + ALL cancellations: refundAmount = gói chính + renewal
  const mainRefund = Math.max(0, (rr.refundAmount || 0) - pendingTotal)
  return {
    mainRefund,
    pendingTotal,
    total: rr.refundAmount || 0,
    hasPending,
    pendingCount: rr.pendingPeriodsCount || 0,
  }
}

const renderBenefitsTag = (rr: RefundRequest) => {
    if (!rr.usedBenefits) return <Tag color="default">Chưa sử dụng</Tag>
    const parts: string[] = []
    if (rr.usedCheckIn) parts.push('Check-in')
    if (rr.usedPT) parts.push('PT')
    if (rr.usedGym) parts.push('Phòng tập')
    return <Tag color="warning">{parts.join(', ')}</Tag>
  }

  // --- Refund request columns (Tab 3: PENDING) ---
  const refundRequestColumns = [
    {
      title: 'Hội viên', dataIndex: 'memberId', key: 'memberId', width: 180,
      render: (member: any) => <div><div className="font-medium">{member?.fullName || member?.name || '-'}</div><div className="text-xs text-[var(--gs-text-muted)]">{member?.email}</div></div>,
    },
    {
      title: 'Gói tập', dataIndex: 'planId', key: 'planId', width: 120,
      render: (plan: any) => plan?.nameVi || '-',
    },
    {
      title: 'Kích hoạt', key: 'activationStatus', width: 120,
      render: (_: any, rr: any) => {
        if (rr.activationStatus === 'activated') return <Tag color="success">🟢 Đã hoạt động</Tag>
        return <Tag color="default">—</Tag>
      },
    },
    {
      title: 'Số tiền', key: 'refundAmount', width: 200,
      render: (_: any, rr: RefundRequest) => {
        if (rr.pendingPeriodsCount && rr.pendingPeriodsCount > 0) {
          const { mainRefund, pendingTotal, total, pendingCount } = getRefundBreakdown(rr)
          return (
            <div className="text-xs leading-relaxed">
              <div className="font-medium text-[var(--gs-accent)]">{formatMoney(total)}</div>
              <div className="text-[var(--gs-text-muted)]">
                Gói: {formatMoney(mainRefund)} + GH ({pendingCount} kỳ): {formatMoney(pendingTotal)}
              </div>
            </div>
          )
        }
        return <span className="font-medium text-[var(--gs-accent)]">{formatMoney(rr.refundAmount)}</span>
      },
    },
    {
      title: 'Đã dùng', key: 'daysUsed', width: 80,
      render: (_: any, rr: RefundRequest) => <span>{rr.daysUsedAtRequest ?? '-'} ngày</span>,
    },
    {
      title: 'Điều kiện hoàn tiền', key: 'eligibility', width: 160,
      render: (_: any, rr: RefundRequest) => (
        <Space direction="vertical" size={0}>
          {renderEligibilityTag(rr)}
          {rr.refundPolicyResult && <span className="text-xs text-[var(--gs-text-muted)]">{rr.refundPolicyResult}</span>}
        </Space>
      ),
    },
    {
      title: 'Quyền lợi', key: 'benefits', width: 120,
      render: (_: any, rr: RefundRequest) => renderBenefitsTag(rr),
    },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 110,
      render: (status: string) => <Tag color={rrStatusColors[status] || 'default'}>{rrStatusLabels[status] || status}</Tag>,
    },
    {
      title: 'Thao tác', key: 'actions', width: 200,
      render: (_: any, record: RefundRequest) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailRR(record)}>Xem</Button>
          {record.status === 'PENDING' && (
            <>
              <Button size="small" type="primary" onClick={() => setApprovingRR(record)}>Duyệt</Button>
              <Button size="small" danger onClick={() => setRejectingRR(record)}>Từ chối</Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  // --- Refund history columns (Tab 2) ---
  const refundHistoryColumns = [
    {
      title: 'Hội viên', dataIndex: 'memberId', key: 'memberId', width: 180,
      render: (member: any) => <div><div className="font-medium">{member?.fullName || member?.name || '-'}</div><div className="text-xs text-[var(--gs-text-muted)]">{member?.email || member?.memberCode || ''}</div></div>,
    },
    {
      title: 'Gói tập', dataIndex: 'planId', key: 'planId', width: 120,
      render: (plan: any) => plan?.nameVi || '-',
    },
    {
      title: 'Số tiền hoàn', key: 'refundAmount', width: 120,
      render: (_: any, rr: RefundRequest) => {
        const { total } = getRefundBreakdown(rr)
        return <span className="font-semibold text-[var(--gs-accent)]">{formatMoney(total)}</span>
      },
    },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 110,
      render: (status: string) => <Tag color={rrStatusColors[status] || 'default'}>{rrStatusLabels[status] || status}</Tag>,
    },
    {
      title: 'Ngày xử lý', key: 'processedAt', width: 150,
      render: (_: any, rr: RefundRequest) => formatDate(rr.reviewedAt || rr.requestedAt),
    },
    {
      title: 'Người xử lý', dataIndex: 'reviewedBy', key: 'reviewedBy', width: 130,
      render: (user: any) => {
        if (!user) return <span className="text-[var(--gs-text-muted)]">—</span>
        return user?.fullName || user?.name || user?.email || '—'
      },
    },
    {
      title: '', key: 'action', width: 80,
      render: (_: any, rr: RefundRequest) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailRR(rr)}>Chi tiết</Button>
      ),
    },
  ]

  const fetchRefundRequests = (page = 1) => {
    setLoadingRefundRequests(true)
    setHasNewRefundRequest(false)
    const params: Record<string, any> = { page, limit: 20 }
    if (rrStatusFilter) params.status = rrStatusFilter
    if (rrSearch.trim()) params.search = rrSearch.trim()
    membershipService.getStaffRefundRequests(params)
      .then((res) => {
        setRefundRequests(res.data.refundRequests || [])
        setRrPagination(res.data.pagination || { total: 0, page: 1, limit: 20, totalPages: 0 })
      })
      .catch(() => message.error('Không thể tải yêu cầu hoàn tiền'))
      .finally(() => setLoadingRefundRequests(false))
  }

  const submitApproveRR = async () => {
    if (!approvingRR || rrActionLoading) return
    setRrActionLoading(true)
    try {
      if (approvingRR.__source === 'cancellation') {
        await membershipService.approveCancellation(approvingRR._id, { staffNote: approvingRRNote.trim() || undefined })
        message.success('Đã phê duyệt yêu cầu hủy gói.')
      } else {
        await membershipService.approveRefundRequest(approvingRR._id, { staffNote: approvingRRNote.trim() || undefined })
        message.success('Đã phê duyệt yêu cầu hoàn tiền.')
      }
      setApprovingRR(null)
      setApprovingRRNote('')
      fetchRefundRequests(rrPagination.page)
      fetchRefundHistory(1)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Phê duyệt thất bại')
    } finally { setRrActionLoading(false) }
  }

  const submitRejectRR = async () => {
    if (!rejectingRR || rrActionLoading) return
    if (!rejectingRRReason.trim()) { message.warning('Vui lòng nhập lý do từ chối.'); return }
    setRrActionLoading(true)
    try {
      if (rejectingRR.__source === 'cancellation') {
        await membershipService.rejectCancellation(rejectingRR._id, { reason: rejectingRRReason.trim() })
        message.success('Đã từ chối yêu cầu hủy gói.')
      } else {
        await membershipService.rejectRefundRequest(rejectingRR._id, { reason: rejectingRRReason.trim() })
        message.success('Đã từ chối yêu cầu hoàn tiền.')
      }
      setRejectingRR(null)
      setRejectingRRReason('')
      fetchRefundRequests(rrPagination.page)
      fetchRefundHistory(1)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Từ chối thất bại')
    } finally { setRrActionLoading(false) }
  }

  const handleRefundHistoryReset = () => {
    setRhSearch('')
    setRhStatusFilter('')
    setRhDateRange(null)
    fetchRefundHistory(1)
  }

  return (
    <DashboardLayout>
      <div className="w-full" style={{ padding: '32px 40px' }}>
        <div className="mx-auto w-full" style={{ maxWidth: '1600px' }}>
          <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">THANH TOÁN</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <h1 className="m-0 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">Quản lý thanh toán</h1>
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
            <Tabs
              activeKey={activeTab}
              onChange={(key) => {
                setActiveTab(key)
                if (key === 'history') { fetchPayments() }
                if (key === 'refunds') fetchRefundHistory(rhPagination.page)
                if (key === 'refund-requests') { setHasNewRefundRequest(false); fetchRefundRequests(rrPagination.page) }
              }}
              items={[
                // ====== TAB 1: HISTORY ======
                {
                  key: 'history',
                  label: 'Lịch sử thanh toán',
                  children: (
                    <>
                      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
                        <div className="min-w-[200px] flex-1">
                          <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Tìm kiếm</div>
                          <Input prefix={<SearchOutlined />} placeholder="Mã HV, họ tên..." value={historySearch}
                            onChange={(e) => setHistorySearch(e.target.value)}
                            onPressEnter={() => fetchPayments(1)}
                          />
                        </div>
                        <div className="min-w-[140px]">
                          <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Trạng thái</div>
                          <Select className="w-full" value={historyStatus} onChange={(v) => setHistoryStatus(v)}
                            options={[
                              { value: '', label: 'Tất cả' },
                              { value: 'PAID', label: 'Đã thanh toán' },
                              { value: 'PENDING', label: 'Chờ thanh toán' },
                              { value: 'FAILED', label: 'Thất bại' },
                              { value: 'REFUNDED', label: 'Đã hoàn tiền' },
                              { value: 'CANCELLED', label: 'Đã hủy' },
                            ]}
                          />
                        </div>
                        <div className="min-w-[240px]">
                          <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Khoảng thời gian</div>
                          <RangePicker className="w-full" value={historyDateRange as any}
                            onChange={(dates) => setHistoryDateRange(dates as any)}
                            format="DD/MM/YYYY"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="primary" icon={<FilterOutlined />} onClick={() => fetchPayments(1)}>Lọc</Button>
                          <Button icon={<ReloadOutlined />} onClick={() => {
                            setHistorySearch(''); setHistoryStatus(''); setHistoryDateRange(null); fetchPayments(1)
                          }}>Reset</Button>
                        </div>
                      </div>
                      <div className="mb-4 flex justify-end">
                        <Button icon={<ReloadOutlined />} onClick={() => { fetchPayments() }}>Tải lại</Button>
                      </div>
                      <div className="member-scroll-x">
                        <Table
                          rowKey="_id"
                          dataSource={payments}
                          columns={historyAllColumns}
                          loading={loadingPayments}
                          pagination={{
                            current: paymentsPagination.page,
                            pageSize: paymentsPagination.limit,
                            total: paymentsPagination.total,
                            showSizeChanger: false,
                            showTotal: (total) => `Tổng: ${total}`,
                          }}
                          onChange={(pag) => fetchPayments(pag.current)}
                          scroll={{ x: 1300 }}
                        />
                      </div>
                    </>
                  ),
                },

                // ====== TAB 2: REFUND HISTORY ======
                {
                  key: 'refunds',
                  label: 'Lịch sử hoàn tiền',
                  children: (
                    <>
                      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
                        <div className="min-w-[200px] flex-1">
                          <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Tìm kiếm</div>
                          <Input prefix={<SearchOutlined />} placeholder="Tên HV, email..." value={rhSearch}
                            onChange={(e) => setRhSearch(e.target.value)}
                            onPressEnter={() => fetchRefundHistory(1)}
                          />
                        </div>
                        <div className="min-w-[140px]">
                          <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Trạng thái</div>
                          <Select className="w-full" value={rhStatusFilter} onChange={(v) => { setRhStatusFilter(v); fetchRefundHistory(1) }}
                            options={[
                              { value: 'APPROVED,REJECTED,CANCELLED,REFUNDED', label: 'Tất cả' },
                              { value: 'APPROVED', label: 'Đã duyệt' },
                              { value: 'REJECTED', label: 'Từ chối' },
                              { value: 'REFUNDED', label: 'Đã hoàn tiền' },
                              { value: 'CANCELLED', label: 'Đã hủy' },
                            ]}
                          />
                        </div>
                        <div className="min-w-[240px]">
                          <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Khoảng thời gian</div>
                          <RangePicker className="w-full" value={rhDateRange as any}
                            onChange={(dates) => setRhDateRange(dates as any)}
                            format="DD/MM/YYYY"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="primary" icon={<FilterOutlined />} onClick={() => fetchRefundHistory(1)}>Lọc</Button>
                          <Button icon={<ReloadOutlined />} onClick={handleRefundHistoryReset}>Reset</Button>
                        </div>
                      </div>
                      <div className="mb-4 flex justify-end">
                        <Button icon={<ReloadOutlined />} onClick={() => fetchRefundHistory(rhPagination.page)}>Tải lại</Button>
                      </div>
                      <div className="member-scroll-x">
                        <Table
                          rowKey="_id"
                          dataSource={refundHistory}
                          columns={refundHistoryColumns}
                          loading={loadingRefundHistory}
                          pagination={{
                            current: rhPagination.page,
                            pageSize: rhPagination.limit,
                            total: rhPagination.total,
                            showSizeChanger: false,
                            showTotal: (total) => `Tổng: ${total}`,
                          }}
                          onChange={(pag) => fetchRefundHistory(pag.current)}
                          scroll={{ x: 1300 }}
                        />
                      </div>
                    </>
                  ),
                },

                // ====== TAB 3: REFUND REQUESTS ======
                {
                  key: 'refund-requests',
                  label: <Badge count={pendingRefundCount} offset={[8, 0]} size="small">Yêu cầu hoàn tiền</Badge>,
                  children: (
                    <>
                      {hasNewRefundRequest && (
                        <Alert
                          message="Có yêu cầu hoàn tiền mới"
                          description="Nhấn Tải lại để xem yêu cầu mới nhất."
                          type="info"
                          showIcon
                          className="mb-4"
                          closable
                          onClose={() => setHasNewRefundRequest(false)}
                        />
                      )}
                      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
                        <div className="min-w-[200px] flex-1">
                          <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Tìm kiếm</div>
                          <Input prefix={<SearchOutlined />} placeholder="Tên HV, email..." value={rrSearch}
                            onChange={(e) => setRrSearch(e.target.value)}
                            onPressEnter={() => fetchRefundRequests(1)}
                          />
                        </div>
                        <div className="min-w-[140px]">
                          <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Trạng thái</div>
                          <Select className="w-full" value={rrStatusFilter} onChange={(v) => { setRrStatusFilter(v); fetchRefundRequests(1) }}
                            options={[
                              { value: 'PENDING', label: 'Chờ duyệt' },
                              { value: 'APPROVED', label: 'Đã duyệt' },
                              { value: 'REJECTED', label: 'Từ chối' },
                              { value: 'REFUNDED', label: 'Đã hoàn tiền' },
                              { value: '', label: 'Tất cả' },
                            ]}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="primary" icon={<ReloadOutlined />} onClick={() => fetchRefundRequests(1)}>Tải lại</Button>
                        </div>
                      </div>
                      <div className="member-scroll-x">
                        <Table
                          rowKey="_id"
                          dataSource={refundRequests}
                          columns={refundRequestColumns}
                          loading={loadingRefundRequests}
                          pagination={{
                            current: rrPagination.page,
                            pageSize: rrPagination.limit,
                            total: rrPagination.total,
                            showSizeChanger: false,
                            showTotal: (total) => `Tổng: ${total}`,
                          }}
                          onChange={(pag) => fetchRefundRequests(pag.current)}
                          scroll={{ x: 1300 }}
                        />
                      </div>
                    </>
                  ),
                },
              ]}
            />
          </div>

          {/* DETAIL DRAWER */}
          <Drawer
            title="Chi tiết hoàn tiền"
            open={Boolean(detailRR)}
            onClose={() => setDetailRR(null)}
            width={560}
            styles={{ body: { padding: '20px 24px' } }}
          >
            {detailRR && (() => {
              const member = detailRR.memberId || {}
              const plan = detailRR.planId || {}
              const cycle = detailRR.cycle || {}
              const { mainRefund, pendingTotal, total, hasPending, pendingCount } = getRefundBreakdown(detailRR)
              const renewalPrice = pendingCount > 0 ? pendingTotal / pendingCount : 0

              const explainText = mainRefund > 0
                ? 'Hoàn 100% gói chính vì hội viên còn trong 7 ngày kể từ ngày đăng ký và chưa sử dụng quyền lợi nào của gói.'
                : 'Gói chính không được hoàn vì hội viên đã sử dụng quyền lợi của gói hoặc đã quá 7 ngày kể từ ngày đăng ký.'

              return (
                <div className="space-y-5">

                  {/* 0. HỘI VIÊN */}
                  <section>
                    <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] overflow-hidden text-sm">
                      <div className="px-4 py-2.5 font-semibold text-[var(--gs-text)] border-b border-[var(--gs-border)]">Hội viên</div>
                      <div className="divide-y divide-[var(--gs-border)]">
                        <Row label="Họ tên" value={member.fullName || member.name || '-'} bold />
                        <Row label="Mã hội viên" value={member.memberCode || '-'} />
                        <Row label="Email" value={member.email || '-'} />
                        <Row label="SĐT" value={member.phone || '-'} />
                      </div>
                    </div>
                  </section>

                  {/* 1. GÓI CHÍNH */}
                  <section>
                    <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] overflow-hidden text-sm">
                      <div className="px-4 py-2.5 font-semibold text-[var(--gs-text)] border-b border-[var(--gs-border)]">Gói chính</div>
                      <div className="divide-y divide-[var(--gs-border)]">
                        <Row label="Tên gói" value={plan.nameVi || '-'} bold />
                        <Row label="Giá" value={formatMoney(plan.price || 0)} />
                        <Row label="Trạng thái" value={<Tag color="success" className="m-0">Đang hoạt động</Tag>} />
                      </div>
                      <div className="flex items-center justify-between px-4 py-3 bg-[var(--gs-card)] border-t border-[var(--gs-border)]">
                        <span className="font-medium text-[var(--gs-text)]">Hoàn tiền</span>
                        <span className={`font-bold ${mainRefund > 0 ? 'text-[var(--gs-success)]' : 'text-[var(--gs-text-muted)]'}`}>
                          {formatMoney(mainRefund)}
                        </span>
                      </div>
                      {explainText && (
                        <p className="px-4 py-2 text-xs text-[var(--gs-text-muted)] italic m-0 border-t border-[var(--gs-border)] leading-relaxed">
                          {explainText}
                        </p>
                      )}
                    </div>
                  </section>

                  {/* 2. GÓI GIA HẠN */}
                  {hasPending && (
                    <section>
                      <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] overflow-hidden text-sm">
                        <div className="px-4 py-2.5 font-semibold text-[var(--gs-text)] border-b border-[var(--gs-border)]">Gói gia hạn</div>
                        <div className="divide-y divide-[var(--gs-border)]">
                          <Row label="Tên gói" value={plan.nameVi || '-'} bold />
                          <Row label="Giá mỗi gói" value={formatMoney(renewalPrice)} />
                          <Row label="Số lượng" value={<span className="font-semibold">{pendingCount} gói</span>} />
                          <Row label="Trạng thái" value={<Tag color="success" className="m-0">Đang hoạt động</Tag>} />
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 bg-[var(--gs-card)] border-t border-[var(--gs-border)]">
                          <span className="font-medium text-[var(--gs-text)]">Hoàn tiền</span>
                          <span className="font-bold text-[var(--gs-success)]">{formatMoney(pendingTotal)}</span>
                        </div>
                        <div className="px-4 py-2 space-y-1 border-t border-[var(--gs-border)]">
                          <div className="text-xs text-[var(--gs-text-soft)] mb-1">Chi tiết:</div>
                          {Array.from({ length: pendingCount }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between text-xs py-1">
                              <span className="text-[var(--gs-text-soft)]">Gia hạn #{i + 1}</span>
                              <span className="font-medium text-[var(--gs-text)]">{formatMoney(renewalPrice)}</span>
                              <span className="text-[var(--gs-success)]">Được hoàn</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  )}

                  {/* 3. KẾT QUẢ HOÀN TIỀN */}
                  <section>
                    <div className="rounded-xl border-2 border-[var(--gs-accent)] bg-[var(--gs-elevated)] overflow-hidden text-sm">
                      <div className="px-4 py-2.5 font-semibold text-[var(--gs-text)] border-b border-[var(--gs-accent)]">Kết quả hoàn tiền</div>
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between py-1">
                          <span className="text-[var(--gs-text-soft)]">Gói chính</span>
                          <span className={`font-medium ${mainRefund > 0 ? 'text-[var(--gs-success)]' : 'text-[var(--gs-text-muted)]'}`}>
                            {formatMoney(mainRefund)}
                          </span>
                        </div>
                        {hasPending && (
                          <div className="flex items-center justify-between py-1">
                            <span className="text-[var(--gs-text-soft)]">Gói gia hạn</span>
                            <span className="text-right">
                              <span className="text-[var(--gs-text-soft)] text-xs">{formatMoney(renewalPrice)} × {pendingCount} = </span>
                              <span className="font-medium text-[var(--gs-success)]">{formatMoney(pendingTotal)}</span>
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between px-4 py-3.5 bg-[var(--gs-accent)] bg-opacity-10 border-t-2 border-[var(--gs-accent)]">
                        <span className="font-bold text-base text-[var(--gs-text)]">Hội viên nhận</span>
                        <span className="font-bold text-lg text-[var(--gs-success)]">{formatMoney(total)}</span>
                      </div>
                    </div>
                  </section>

                </div>
              )
            })()}
          </Drawer>

          {/* APPROVE MODAL */}
          <Modal
            title="Phê duyệt yêu cầu hoàn tiền"
            open={Boolean(approvingRR)}
            onCancel={() => { setApprovingRR(null); setApprovingRRNote('') }}
            onOk={submitApproveRR}
            confirmLoading={rrActionLoading}
            okText="Xác nhận duyệt"
            width={560}
          >
            {approvingRR && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--gs-text-soft)]">Hội viên</span>
                    <span className="font-medium">{approvingRR.memberId?.fullName || approvingRR.memberId?.name || '-'}</span>
                  </div>
                  <div className="border-t border-[var(--gs-border)] pt-2 mt-2">
                    <div className="text-xs font-semibold text-[var(--gs-text)] mb-1">Chi tiết hoàn tiền</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--gs-text-soft)]">Gói đang hoạt động</span>
                      <span className={`font-medium ${approvingRR.refundPolicyResult === 'Đủ điều kiện hoàn tiền' ? 'text-[var(--gs-accent)]' : 'text-[var(--gs-text-muted)]'}`}>
                        {(() => {
                          if (approvingRR.refundPolicyResult !== 'Đủ điều kiện hoàn tiền') return 'Không hoàn'
                          const bd = getRefundBreakdown(approvingRR)
                          return formatMoney(bd.mainRefund)
                        })()}
                      </span>
                    </div>
                    {approvingRR.refundPolicyResult !== 'Đủ điều kiện hoàn tiền' && (
                      <div className="text-[10px] text-[var(--gs-text-muted)] pl-2 leading-tight">
                        ({approvingRR.refundPolicyResult})
                      </div>
                    )}
                    {approvingRR.pendingPeriodsCount && approvingRR.pendingPeriodsCount > 0 && (
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[var(--gs-text-soft)]">Gia hạn ({approvingRR.pendingPeriodsCount} kỳ chưa bắt đầu)</span>
                        <span className="font-medium text-[var(--gs-success)]">{formatMoney(approvingRR.pendingPeriodsTotal!)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm mt-1 pt-1 border-t border-dashed border-[var(--gs-border)]">
                      <span className="font-semibold text-[var(--gs-text)]">Dự kiến tổng hoàn</span>
                      <span className="font-bold text-[var(--gs-accent)]">
                        {(() => {
                          const bd = getRefundBreakdown(approvingRR)
                          return formatMoney(bd.total)
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--gs-text-soft)]">Lý do</span>
                    <span className="font-medium">{approvingRR.reason || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--gs-text-soft)]">Điều kiện hoàn tiền (Snapshot)</span>
                    <span>
                      <Tag color={approvingRR.refundPolicyResult === 'Đủ điều kiện hoàn tiền' ? 'success' : 'error'}>
                        {approvingRR.refundPolicyResult || '-'}
                      </Tag>
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-3 text-xs text-[var(--gs-text)]">
                  Hệ thống sẽ kiểm tra lại điều kiện hoàn tiền trước khi xử lý. Nếu đủ điều kiện, tiền sẽ được hoàn vào ví hội viên.
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium text-[var(--gs-text)]">Ghi chú</div>
                  <Input.TextArea rows={3} value={approvingRRNote} onChange={(e) => setApprovingRRNote(e.target.value)} placeholder="Nhập ghi chú..." />
                </div>
              </div>
            )}
          </Modal>

          {/* REJECT MODAL */}
          <Modal
            title="Từ chối yêu cầu hoàn tiền"
            open={Boolean(rejectingRR)}
            onCancel={() => { setRejectingRR(null); setRejectingRRReason('') }}
            onOk={submitRejectRR}
            confirmLoading={rrActionLoading}
            okText="Xác nhận từ chối"
            okButtonProps={{ danger: true }}
          >
            {rejectingRR && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--gs-text-soft)]">Hội viên</span>
                    <span className="font-medium">{rejectingRR.memberId?.fullName || rejectingRR.memberId?.name || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--gs-text-soft)]">Lý do yêu cầu</span>
                    <span className="font-medium">{rejectingRR.reason || '-'}</span>
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium text-[var(--gs-text)]">Lý do từ chối <span className="text-red-500">*</span></div>
                  <Input.TextArea rows={3} value={rejectingRRReason} onChange={(e) => setRejectingRRReason(e.target.value)} placeholder="Nhập lý do từ chối..." />
                </div>
              </div>
            )}
          </Modal>
        </div>
      </div>
    </DashboardLayout>
  )
}
