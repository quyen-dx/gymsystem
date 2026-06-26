import { CheckOutlined, CloseOutlined, FilterOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, DatePicker, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, Tooltip, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { membershipService } from '../../../services/membershipService'
import { staffListAllPayments, staffListAllTransactions } from '../../../services/walletService'

const { RangePicker } = DatePicker

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const formatDate = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '-'

function getPaymentTypeLabel(record: any, lang: string) {
  if (record.metadata?.purpose === 'WALLET_DEPOSIT') return lang === 'vi' ? 'Nạp ví' : 'Wallet Topup'
  if (record.source === 'OFFLINE' && record.planId) return lang === 'vi' ? 'Mua gói tại quầy' : 'Offline Plan Purchase'
  if (record.source === 'ONLINE' && record.planId) return lang === 'vi' ? 'Mua gói online' : 'Online Plan Purchase'
  if (record.status === 'REFUNDED' || record.status === 'refunded') return lang === 'vi' ? 'Hoàn tiền' : 'Refund'
  if (record.paymentMethod === 'WALLET') return lang === 'vi' ? 'Thanh toán ví' : 'Wallet Payment'
  return lang === 'vi' ? 'Thanh toán' : 'Payment'
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

function getTransactionTypeLabel(type: string, metadata?: any) {
  if (metadata?.source === 'system') return 'Nạp ví (HT)'
  if (type === 'REFUND_TO_WALLET') return 'Hoàn ví GymPro'
  if (type === 'deposit') return 'Nạp ví'
  if (type === 'payment') return 'Thanh toán'
  if (type === 'refund') return 'Hoàn tiền'
  if (type === 'transfer') return 'Chuyển tiền'
  if (type === 'payout') return 'Rút tiền'
  return type || '-'
}

const errorStatuses = ['FAILED', 'CANCELLED', 'failed', 'cancelled']
const pendingStatuses = ['PENDING', 'pending']

export default function StaffPaymentsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  const [activeTab, setActiveTab] = useState('history')

  // --- Tab 1: Payment History ---
  const [payments, setPayments] = useState<any[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [paymentsPagination, setPaymentsPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 })
  const [historySearch, setHistorySearch] = useState('')
  const [historyStatus, setHistoryStatus] = useState('')
  const [historyDateRange, setHistoryDateRange] = useState<[any, any] | null>(null)

  // --- Tab 2: Refunds (cancellations) ---
  const [cancellations, setCancellations] = useState<any[]>([])
  const [loadingCancellations, setLoadingCancellations] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [cancelPagination, setCancelPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [cancelSearch, setCancelSearch] = useState('')
  const [cancelStatusFilter, setCancelStatusFilter] = useState('')
  const [refundFilter, setRefundFilter] = useState('')
  const [cancelDateRange, setCancelDateRange] = useState<[any, any] | null>(null)

  // Modals for cancellations
  const [approving, setApproving] = useState<any | null>(null)
  const [approveRefund, setApproveRefund] = useState<number>(0)
  const [approveNote, setApproveNote] = useState('')
  const [rejectingCancel, setRejectingCancel] = useState<any | null>(null)
  const [rejectCancelReason, setRejectCancelReason] = useState('')

  // --- Tab 3: Failed Transactions ---
  const [errorTxns, setErrorTxns] = useState<any[]>([])
  const [loadingErrorTxns, setLoadingErrorTxns] = useState(false)
  const [errorPagination, setErrorPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 })
  const [errorSearch, setErrorSearch] = useState('')
  const [errorStatusFilter, setErrorStatusFilter] = useState('')

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

  // --- Cancellations (Refunds) ---
  const buildCancelParams = (page = 1) => {
    const params: Record<string, any> = { page, limit: 20 }
    if (cancelSearch.trim()) params.search = cancelSearch.trim()
    if (cancelStatusFilter) params.status = cancelStatusFilter
    if (refundFilter) params.refundFilter = refundFilter
    if (cancelDateRange?.[0]) params.fromDate = cancelDateRange[0].format('YYYY-MM-DD')
    if (cancelDateRange?.[1]) params.toDate = cancelDateRange[1].format('YYYY-MM-DD')
    return params
  }

  const fetchCancellations = (page = 1) => {
    setLoadingCancellations(true)
    membershipService.getStaffCancellations(buildCancelParams(page))
      .then((res) => {
        setCancellations(res.data.cancellations || [])
        setCancelPagination(res.data.pagination || { total: 0, page: 1, limit: 20, totalPages: 0 })
      })
      .catch(() => message.error('Không thể tải danh sách hoàn tiền'))
      .finally(() => setLoadingCancellations(false))
  }

  const submitApproveCancellation = async () => {
    if (!approving) return
    setActionLoadingId(approving._id)
    try {
      await membershipService.approveCancellation(approving._id, {
        finalRefundAmount: approveRefund,
        staffNote: approveNote.trim() || undefined,
      })
      message.success('Xác nhận hoàn tiền thành công')
      setApproving(null)
      setApproveRefund(0)
      setApproveNote('')
      fetchCancellations(cancelPagination.page)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Xác nhận hoàn tiền thất bại')
    } finally { setActionLoadingId(null) }
  }

  const submitRejectCancellation = async () => {
    if (!rejectingCancel) return
    setActionLoadingId(rejectingCancel._id)
    try {
      await membershipService.rejectCancellation(rejectingCancel._id, {
        reason: rejectCancelReason.trim(),
      })
      message.success('Từ chối hoàn tiền thành công')
      setRejectingCancel(null)
      setRejectCancelReason('')
      fetchCancellations(cancelPagination.page)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Từ chối thất bại')
    } finally { setActionLoadingId(null) }
  }

  // --- Failed Transactions ---
  const fetchErrorTransactions = async (page = 1) => {
    setLoadingErrorTxns(true)
    try {
      const params: Record<string, any> = { page, limit: 50 }
      if (errorSearch.trim()) params.search = errorSearch.trim()
      if (errorStatusFilter) params.status = errorStatusFilter
      const res = await staffListAllTransactions(params)
      const all = res.data.data?.transactions || []
      const filtered = all.filter((t: any) =>
        errorStatuses.includes(t.status) || pendingStatuses.includes(t.status)
      )
      setErrorTxns(filtered)
      setErrorPagination((prev) => ({ ...prev, page, total: res.data.data?.pagination?.total || 0 }))
    } catch { message.error('Không thể tải giao dịch lỗi') }
    setLoadingErrorTxns(false)
  }

  useEffect(() => {
    fetchPayments()

    fetchCancellations()
    fetchErrorTransactions()
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
      render: (_: any, r: any) => <Tag color={getPaymentTypeColor(r)}>{getPaymentTypeLabel(r, lang)}</Tag>,
    },
    { title: 'Số tiền', dataIndex: 'amount', width: 140, render: formatMoney },
    {
      title: 'Phương thức', width: 140,
      render: (_: any, r: any) => {
        const m = r.paymentMethod || r.method || '-'
        const labels: Record<string, string> = { CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', POS: 'Quẹt thẻ', WALLET: 'Ví', STRIPE: 'Stripe', MANUAL: 'Thủ công', REFUND: 'Hoàn tiền' }
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

  const refundMethodLabels: Record<string, string> = {
    WALLET: 'Cộng ví GymPro',
    NONE: 'Không hoàn',
  }

  const refundStatusMeta = (status: string) => {
    if (status === 'PENDING') return { color: 'warning' as const, label: 'Chờ xử lý' }
    if (status === 'COMPLETED') return { color: 'success' as const, label: 'Đã hoàn tiền' }
    return { color: 'default' as const, label: 'Không áp dụng' }
  }

  const renderRefundPolicy = (record: any) => {
    const code = record.policyCode || (record.refundEligible ? 'REFUND_50' : 'NO_REFUND')
    const color = code === 'REFUND_100' ? 'success' : code === 'REFUND_50' ? 'processing' : 'default'
    const label = code === 'REFUND_100' ? 'Hoàn 100%' : code === 'REFUND_50' ? 'Hoàn 50%' : 'Không hoàn'
    return <Tag color={color}>{label}</Tag>
  }

  const cancellationColumns = [
    {
      title: 'Member ID', width: 100,
      render: (_: any, r: any) => r.memberId?.memberCode || r.memberId?._id?.slice(-6) || '-',
    },
    {
      title: 'Họ tên', width: 160,
      render: (_: any, r: any) => r.memberId?.fullName || r.memberId?.name || '-',
    },
    {
      title: 'Gói tập', width: 140,
      render: (_: any, r: any) => r.planId?.nameVi || r.planId?.nameEn || '-',
    },
    {
      title: 'Số tiền gốc', width: 120,
      render: (_: any, r: any) => formatMoney(r.planId?.price || 0),
    },
    {
      title: 'Đã dùng', width: 80,
      render: (_: any, r: any) => `${r.usedDays || 0}/${r.totalDays || '-'} ngày`,
    },
    {
      title: 'Hoàn dự kiến', width: 130,
      render: (_: any, r: any) => r.refundEligible
        ? <span className="font-medium text-green-600">{formatMoney(r.estimatedRefundAmount)}</span>
        : <Tag>Không hoàn</Tag>,
    },
    {
      title: 'Phương thức hoàn', width: 140,
      render: (_: any, r: any) => {
        const method = r.refundMethod
        if (!method || method === 'NONE') return <Tag>—</Tag>
        const label = refundMethodLabels[method] || method
        return <Tag color="processing">{label}</Tag>
      },
    },
    {
      title: 'Lý do', width: 150,
      render: (_: any, r: any) => (
        <Tooltip title={r.reason}>
          <span className="line-clamp-1 max-w-[140px] inline-block">{r.reason || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Trạng thái', width: 110,
      render: (_: any, r: any) => {
        const meta = r.status === 'pending' ? { color: 'warning' as const, label: 'Chờ xử lý' }
          : r.status === 'approved' ? { color: 'success' as const, label: 'Đã duyệt' }
          : { color: 'error' as const, label: 'Từ chối' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: 'Refund status', width: 120,
      render: (_: any, r: any) => {
        if (!r.refundEligible || r.refundMethod === 'NONE') return <Tag>N/A</Tag>
        const meta = refundStatusMeta(r.refundStatus)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    { title: 'Ngày yêu cầu', dataIndex: 'createdAt', width: 160, render: formatDate },
    {
      title: 'Thao tác', width: 200, fixed: 'right' as const,
      render: (_: any, r: any) => {
        if (r.status === 'pending') {
          return (
            <Space>
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => {
                setApproving(r)
                setApproveRefund(r.refundEligible ? r.estimatedRefundAmount : 0)
                setApproveNote('')
              }}>Xác nhận</Button>
              <Button size="small" danger icon={<CloseOutlined />} onClick={() => {
                setRejectingCancel(r)
                setRejectCancelReason('')
              }}>Từ chối</Button>
            </Space>
          )
        }
        return null
      },
    },
  ]

  const errorColumns = [
    { title: 'Mã GD', dataIndex: '_id', width: 100, render: (id: string) => <span className="font-mono text-xs">{id.slice(-8)}</span> },
    {
      title: 'Member ID', width: 100,
      render: (_: any, r: any) => r.userInfo?.memberCode || r.userId?.toString().slice(-6) || '-',
    },
    {
      title: 'Loại GD', width: 120,
      render: (_: any, r: any) => <Tag>{getTransactionTypeLabel(r.type, r.metadata)}</Tag>,
    },
    { title: 'Số tiền', dataIndex: 'amount', width: 130, render: formatMoney },
    {
      title: 'Phương thức', width: 120,
      render: (_: any, r: any) => r.metadata?.paymentMethod || r.provider || '-',
    },
    {
      title: 'Trạng thái', width: 110,
      render: (_: any, r: any) => {
        const upper = (r.status || '').toUpperCase()
        const color = upper === 'FAILED' ? 'error' : upper === 'CANCELLED' ? 'default' : 'warning'
        const label = upper === 'FAILED' ? 'Thất bại' : upper === 'CANCELLED' ? 'Đã hủy' : upper === 'PENDING' ? 'Chờ xử lý' : r.status
        return <Tag color={color}>{label}</Tag>
      },
    },
    { title: 'Thời gian', dataIndex: 'createdAt', width: 160, render: formatDate },
    {
      title: 'Lỗi / Ghi chú', width: 180,
      render: (_: any, r: any) => (
        <Tooltip title={r.metadata?.error || r.metadata?.staffNote || r.description || '-'}>
          <span className="line-clamp-1 max-w-[170px] inline-block">{r.metadata?.error || r.metadata?.staffNote || r.description || '-'}</span>
        </Tooltip>
      ),
    },
  ]

  const renderRefundDetail = (record: any) => (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-5">
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--theme-muted)]">Hội viên</div>
            <div className="mt-0.5 text-base font-semibold">{record.memberId?.fullName || record.memberId?.name || '-'}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--theme-muted)]">Gói tập</div>
            <div className="mt-0.5 text-base font-semibold">{record.planId?.nameVi || record.planId?.nameEn || '-'}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--theme-muted)]">Đã dùng</div>
            <div className="mt-0.5 text-base font-semibold">{record.usedDays || 0} / {record.totalDays || '-'} ngày ({record.usedPercent || 0}%)</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--theme-muted)]">Chính sách hoàn</div>
            <div className="mt-0.5">{renderRefundPolicy(record)}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--theme-muted)]">Phương thức hoàn</div>
            <div className="mt-0.5 text-base font-semibold">{refundMethodLabels[record.refundMethod] || record.refundMethod || '-'}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--theme-muted)]">Hoàn dự kiến</div>
            <div className={`mt-0.5 text-base font-semibold ${record.refundEligible ? 'text-green-600' : 'text-gray-400'}`}>
              {record.refundEligible ? formatMoney(record.estimatedRefundAmount) : 'Không hoàn'}
            </div>
          </div>
        </div>
      </div>
      {record.reason && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Lý do hủy</p>
          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-3 text-sm">{record.reason}</div>
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-sm font-medium">Số tiền hoàn thực tế</label>
        <InputNumber
          style={{ width: '100%' }} size="large"
          min={0} value={approveRefund}
          onChange={(v) => setApproveRefund(v || 0)}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(v) => Number(v?.replace(/,/g, '')) || 0}
          addonAfter="đ"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Ghi chú xử lý</label>
        <Input.TextArea rows={4} value={approveNote} onChange={(e) => setApproveNote(e.target.value)} placeholder="Nhập ghi chú..." />
      </div>
    </div>
  )

  const handleCancelResetFilter = () => {
    setCancelSearch('')
    setCancelStatusFilter('')
    setRefundFilter('')
    setCancelDateRange(null)
    fetchCancellations(1)
  }

  return (
    <DashboardLayout>
      <div className="w-full" style={{ padding: '32px 40px' }}>
        <div className="mx-auto w-full" style={{ maxWidth: '1600px' }}>
          <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">{t('staff_payments.page_subtitle')}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <h1 className="m-0 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">{t('staff_payments.title')}</h1>
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
            <Tabs
              activeKey={activeTab}
              onChange={(key) => {
                setActiveTab(key)
                if (key === 'history') { fetchPayments() }
                if (key === 'refunds') fetchCancellations(cancelPagination.page)
                if (key === 'errors') fetchErrorTransactions()
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

                // ====== TAB 2: REFUNDS ======
                {
                  key: 'refunds',
                  label: 'Hoàn tiền',
                  children: (
                    <>
                      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
                        <div className="min-w-[200px] flex-1">
                          <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Tìm kiếm</div>
                          <Input prefix={<SearchOutlined />} placeholder="Mã HV, họ tên..." value={cancelSearch}
                            onChange={(e) => setCancelSearch(e.target.value)}
                            onPressEnter={() => { fetchCancellations(1) }}
                          />
                        </div>
                        <div className="min-w-[140px]">
                          <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Trạng thái</div>
                          <Select className="w-full" value={cancelStatusFilter} onChange={(v) => setCancelStatusFilter(v)}
                            options={[
                              { value: '', label: 'Tất cả' },
                              { value: 'pending', label: 'Chờ xử lý' },
                              { value: 'approved', label: 'Đã duyệt' },
                              { value: 'rejected', label: 'Từ chối' },
                            ]}
                          />
                        </div>
                        <div className="min-w-[140px]">
                          <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Hoàn tiền</div>
                          <Select className="w-full" value={refundFilter} onChange={(v) => setRefundFilter(v)}
                            options={[
                              { value: '', label: 'Tất cả' },
                              { value: 'eligible', label: 'Đủ điều kiện' },
                              { value: 'not-eligible', label: 'Không đủ đk' },
                            ]}
                          />
                        </div>
                        <div className="min-w-[240px]">
                          <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Khoảng thời gian</div>
                          <RangePicker className="w-full" value={cancelDateRange as any}
                            onChange={(dates) => setCancelDateRange(dates as any)}
                            format="DD/MM/YYYY"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="primary" icon={<FilterOutlined />} onClick={() => fetchCancellations(1)}>Lọc</Button>
                          <Button icon={<ReloadOutlined />} onClick={handleCancelResetFilter}>Reset</Button>
                        </div>
                      </div>
                      <div className="mb-4 flex justify-end">
                        <Button icon={<ReloadOutlined />} onClick={() => fetchCancellations(cancelPagination.page)}>Tải lại</Button>
                      </div>
                      <div className="member-scroll-x">
                        <Table
                          rowKey="_id"
                          dataSource={cancellations}
                          columns={cancellationColumns}
                          loading={loadingCancellations}
                          pagination={{
                            current: cancelPagination.page,
                            pageSize: cancelPagination.limit,
                            total: cancelPagination.total,
                            showSizeChanger: false,
                            showTotal: (total) => `Tổng: ${total}`,
                          }}
                          onChange={(pag) => fetchCancellations(pag.current)}
                          scroll={{ x: 1800 }}
                        />
                      </div>
                    </>
                  ),
                },

                // ====== TAB 3: ERROR TRANSACTIONS ======
                {
                  key: 'errors',
                  label: 'Giao dịch lỗi',
                  children: (
                    <>
                      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
                        <div className="min-w-[200px] flex-1">
                          <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Tìm kiếm</div>
                          <Input prefix={<SearchOutlined />} placeholder="Mã HV, họ tên..." value={errorSearch}
                            onChange={(e) => setErrorSearch(e.target.value)}
                            onPressEnter={() => fetchErrorTransactions(1)}
                          />
                        </div>
                        <div className="min-w-[140px]">
                          <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Trạng thái</div>
                          <Select className="w-full" value={errorStatusFilter} onChange={(v) => setErrorStatusFilter(v)}
                            options={[
                              { value: '', label: 'Tất cả' },
                              { value: 'PENDING', label: 'Chờ quá lâu' },
                              { value: 'FAILED', label: 'Thất bại' },
                              { value: 'CANCELLED', label: 'Đã hủy' },
                            ]}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="primary" icon={<FilterOutlined />} onClick={() => fetchErrorTransactions(1)}>Lọc</Button>
                          <Button icon={<ReloadOutlined />} onClick={() => {
                            setErrorSearch(''); setErrorStatusFilter(''); fetchErrorTransactions(1)
                          }}>Reset</Button>
                        </div>
                      </div>
                      <div className="mb-4 flex justify-end">
                        <Button icon={<ReloadOutlined />} onClick={() => fetchErrorTransactions()}>Tải lại</Button>
                      </div>
                      <div className="member-scroll-x">
                        <Table
                          rowKey="_id"
                          dataSource={errorTxns}
                          columns={errorColumns}
                          loading={loadingErrorTxns}
                          pagination={{
                            current: errorPagination.page,
                            pageSize: 50,
                            total: errorPagination.total,
                            showSizeChanger: false,
                            showTotal: (total) => `Tổng: ${total}`,
                          }}
                          onChange={(pag) => fetchErrorTransactions(pag.current)}
                          scroll={{ x: 1000 }}
                        />
                      </div>
                    </>
                  ),
                },
              ]}
            />
          </div>

          {/* APPROVE REFUND MODAL */}
          <Modal
            title="Xác nhận hoàn tiền"
            open={Boolean(approving)}
            onCancel={() => { setApproving(null); setApproveRefund(0); setApproveNote('') }}
            onOk={submitApproveCancellation}
            confirmLoading={Boolean(actionLoadingId)}
            okText="Xác nhận hoàn"
            okButtonProps={{ danger: true }}
            width={720}
            style={{ maxWidth: 'calc(100vw - 32px)' }}
          >
            {approving && renderRefundDetail(approving)}
          </Modal>

          {/* REJECT REFUND MODAL */}
          <Modal
            title="Từ chối hoàn tiền"
            open={Boolean(rejectingCancel)}
            onCancel={() => { setRejectingCancel(null); setRejectCancelReason('') }}
            onOk={submitRejectCancellation}
            confirmLoading={Boolean(actionLoadingId)}
            okText="Xác nhận từ chối"
            okButtonProps={{ danger: true }}
          >
            <p className="mb-3 text-sm text-[var(--gs-text-soft)]">Vui lòng nhập lý do từ chối:</p>
            <Input.TextArea rows={4} value={rejectCancelReason}
              onChange={(e) => setRejectCancelReason(e.target.value)}
              placeholder="Nhập lý do từ chối..."
            />
          </Modal>
        </div>
      </div>
    </DashboardLayout>
  )
}
