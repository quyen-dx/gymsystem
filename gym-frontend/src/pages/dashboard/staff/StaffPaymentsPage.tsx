import { CheckOutlined, CloseOutlined, FilterOutlined, ReloadOutlined, SearchOutlined, UserAddOutlined } from '@ant-design/icons'
import { Button, DatePicker, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, Tooltip, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { membershipService } from '../../../services/membershipService'

const { RangePicker } = DatePicker

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const formatDate = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '-'

const useStaffLabels = (t: any) => ({
  registrationStatus: {
    pending: { color: 'warning', label: t('staff_payments.reg_status_pending') },
    confirmed: { color: 'success', label: t('staff_payments.reg_status_confirmed') },
    cancelled: { color: 'error', label: t('staff_payments.reg_status_cancelled') },
  } as Record<string, { color: string; label: string }>,
  cancellationStatusMeta: {
    pending: { color: 'warning', label: t('staff_payments.cancel_status_pending') },
    approved: { color: 'success', label: t('staff_payments.cancel_status_approved') },
    rejected: { color: 'error', label: t('staff_payments.cancel_status_rejected') },
  } as Record<string, { color: string; label: string }>,
  refundMethodLabels: {
    WALLET: t('staff_payments.refund_method_wallet'),
    BANK_TRANSFER: t('staff_payments.refund_method_bank'),
    CASH_COUNTER: t('staff_payments.refund_method_cash'),
    NONE: t('staff_payments.refund_method_none'),
  } as Record<string, string>,
  refundStatusLabels: {
    PENDING: { color: 'warning', label: t('staff_payments.refund_status_pending') },
    COMPLETED: { color: 'success', label: t('staff_payments.refund_status_completed') },
    NOT_APPLICABLE: { color: 'default', label: t('staff_payments.refund_status_not_applicable') },
  } as Record<string, { color: string; label: string }>,
  paymentFilterOptions: [
    { value: '', label: t('staff_payments.filter_all') },
    { value: 'paid', label: t('staff_payments.pay_status_paid') },
    { value: 'unpaid', label: t('staff_payments.pay_status_unpaid') },
  ],
  statusFilterOptions: [
    { value: '', label: t('staff_payments.filter_all') },
    { value: 'pending', label: t('staff_payments.reg_status_pending') },
    { value: 'confirmed', label: t('staff_payments.reg_status_confirmed') },
    { value: 'cancelled', label: t('staff_payments.reg_status_cancelled') },
  ],
  cancellationStatusOptions: [
    { value: '', label: t('staff_payments.filter_all') },
    { value: 'pending', label: t('staff_payments.cancel_status_pending') },
    { value: 'approved', label: t('staff_payments.cancel_status_approved') },
    { value: 'rejected', label: t('staff_payments.cancel_status_rejected') },
  ],
  refundFilterOptions: [
    { value: '', label: t('staff_payments.filter_all') },
    { value: 'eligible', label: t('staff_payments.filter_eligible') },
    { value: 'not-eligible', label: t('staff_payments.filter_not_eligible') },
  ],
})

export default function StaffPaymentsPage() {
  const { t } = useTranslation()
  const labels = useStaffLabels(t)
  const navigate = useNavigate()
  const [registrations, setRegistrations] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [cancellations, setCancellations] = useState<any[]>([])
  const [loadingRegistrations, setLoadingRegistrations] = useState(false)
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [loadingCancellations, setLoadingCancellations] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<any | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [cancellationPagination, setCancellationPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 })

  const [searchKeyword, setSearchKeyword] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateRange, setDateRange] = useState<[any, any] | null>(null)

  const [cancelSearchKeyword, setCancelSearchKeyword] = useState('')
  const [cancelStatusFilter, setCancelStatusFilter] = useState('')
  const [refundFilter, setRefundFilter] = useState('')
  const [cancelDateRange, setCancelDateRange] = useState<[any, any] | null>(null)

  const [approving, setApproving] = useState<any | null>(null)
  const [approveRefund, setApproveRefund] = useState<number>(0)
  const [approveNote, setApproveNote] = useState('')
  const [rejectingCancel, setRejectingCancel] = useState<any | null>(null)
  const [rejectCancelReason, setRejectCancelReason] = useState('')

  const [markingRefund, setMarkingRefund] = useState<any | null>(null)
  const [markRefundNote, setMarkRefundNote] = useState('')

  const buildParams = (page = 1) => {
    const params: Record<string, any> = { page, limit: 20 }
    if (searchKeyword.trim()) params.search = searchKeyword.trim()
    if (paymentFilter) params.paymentStatus = paymentFilter
    if (statusFilter) params.status = statusFilter
    if (dateRange?.[0]) params.fromDate = dateRange[0].format('YYYY-MM-DD')
    if (dateRange?.[1]) params.toDate = dateRange[1].format('YYYY-MM-DD')
    return params
  }

  const fetchRegistrations = (page = 1) => {
    setLoadingRegistrations(true)
    const params = buildParams(page)
    membershipService.getRegistrations(params)
      .then((res) => {
        setRegistrations(res.data.registrations || [])
        setPagination(res.data.pagination || { total: 0, page: 1, limit: 20, totalPages: 0 })
      })
      .catch(() => message.error(t('staff_payments.toast_reg_fetch_error')))
      .finally(() => setLoadingRegistrations(false))
  }

  const fetchPayments = () => {
    setLoadingPayments(true)
    membershipService.getPayments({ limit: 50 })
      .then((res) => setPayments(res.data.payments || []))
      .catch(() => message.error(t('staff_payments.toast_pay_fetch_error')))
      .finally(() => setLoadingPayments(false))
  }

  const buildCancelParams = (page = 1) => {
    const params: Record<string, any> = { page, limit: 20 }
    if (cancelSearchKeyword.trim()) params.search = cancelSearchKeyword.trim()
    if (cancelStatusFilter) params.status = cancelStatusFilter
    if (refundFilter) params.refundFilter = refundFilter
    if (cancelDateRange?.[0]) params.fromDate = cancelDateRange[0].format('YYYY-MM-DD')
    if (cancelDateRange?.[1]) params.toDate = cancelDateRange[1].format('YYYY-MM-DD')
    return params
  }

  const fetchCancellations = (page = 1) => {
    setLoadingCancellations(true)
    const params = buildCancelParams(page)
    membershipService.getStaffCancellations(params)
      .then((res) => {
        setCancellations(res.data.cancellations || [])
        setCancellationPagination(res.data.pagination || { total: 0, page: 1, limit: 20, totalPages: 0 })
      })
      .catch(() => message.error(t('staff_payments.toast_cancel_fetch_error')))
      .finally(() => setLoadingCancellations(false))
  }

  useEffect(() => {
    fetchRegistrations()
    fetchPayments()
    fetchCancellations()
  }, [])

  const handleApplyFilter = () => {
    fetchRegistrations(1)
  }

  const handleResetFilter = () => {
    setSearchKeyword('')
    setPaymentFilter('')
    setStatusFilter('')
    setDateRange(null)
    fetchRegistrations(1)
  }

  const handleCancelApplyFilter = () => {
    fetchCancellations(1)
  }

  const handleCancelResetFilter = () => {
    setCancelSearchKeyword('')
    setCancelStatusFilter('')
    setRefundFilter('')
    setCancelDateRange(null)
    fetchCancellations(1)
  }

  const handleTableChange = (pag: any) => {
    fetchRegistrations(pag.current)
  }

  const handleCancelTableChange = (pag: any) => {
    fetchCancellations(pag.current)
  }

  const confirmRegistration = async (id: string) => {
    setActionLoadingId(id)
    try {
      await membershipService.confirmRegistration(id)
      message.success(t('staff_payments.toast_reg_confirm_success'))
      fetchRegistrations(pagination.page)
    } catch (error: any) {
      message.error(error.response?.data?.message || t('staff_payments.toast_reg_confirm_failed'))
    } finally {
      setActionLoadingId(null)
    }
  }

  const submitReject = async () => {
    if (!rejecting) return
    setActionLoadingId(rejecting._id)
    try {
      await membershipService.cancelRegistration(rejecting._id, rejectReason)
      message.success(t('staff_payments.toast_reg_reject_success'))
      setRejecting(null)
      setRejectReason('')
      fetchRegistrations(pagination.page)
    } catch (error: any) {
      message.error(error.response?.data?.message || t('staff_payments.toast_reg_reject_failed'))
    } finally {
      setActionLoadingId(null)
    }
  }

  const submitApproveCancellation = async () => {
    if (!approving) return
    setActionLoadingId(approving._id)
    try {
      await membershipService.approveCancellation(approving._id, {
        finalRefundAmount: approveRefund,
        staffNote: approveNote.trim() || undefined,
      })
      message.success(t('staff_payments.toast_cancel_approve_success'))
      setApproving(null)
      setApproveRefund(0)
      setApproveNote('')
      fetchCancellations(cancellationPagination.page)
    } catch (error: any) {
      message.error(error.response?.data?.message || t('staff_payments.toast_cancel_approve_failed'))
    } finally {
      setActionLoadingId(null)
    }
  }

  const submitRejectCancellation = async () => {
    if (!rejectingCancel) return
    setActionLoadingId(rejectingCancel._id)
    try {
      await membershipService.rejectCancellation(rejectingCancel._id, {
        reason: rejectCancelReason.trim(),
      })
      message.success(t('staff_payments.toast_cancel_reject_success'))
      setRejectingCancel(null)
      setRejectCancelReason('')
      fetchCancellations(cancellationPagination.page)
    } catch (error: any) {
      message.error(error.response?.data?.message || t('staff_payments.toast_cancel_reject_failed'))
    } finally {
      setActionLoadingId(null)
    }
  }

  const submitMarkRefund = async () => {
    if (!markingRefund) return
    setActionLoadingId(markingRefund._id)
    try {
      await membershipService.markRefundCompleted(markingRefund._id, {
        staffNote: markRefundNote.trim() || undefined,
      })
      message.success(t('staff_payments.toast_cancel_mark_refund_success'))
      setMarkingRefund(null)
      setMarkRefundNote('')
      fetchCancellations(cancellationPagination.page)
    } catch (error: any) {
      message.error(error.response?.data?.message || t('staff_payments.toast_cancel_mark_refund_failed'))
    } finally {
      setActionLoadingId(null)
    }
  }

  const openApproveModal = (record: any) => {
    setApproving(record)
    setApproveRefund(record.refundEligible ? record.estimatedRefundAmount : 0)
    setApproveNote('')
  }

  const isPaid = (record: any) => record.paymentStatus === 'PAID' || record.paymentStatus === 'paid'

  const registrationColumns = [
    {
      title: t('staff_payments.col_member_id'),
      render: (_: unknown, record: any) => record.userId?.memberCode || record.userId?._id || record.userId,
    },
    {
      title: t('staff_payments.col_full_name'),
      render: (_: unknown, record: any) => record.userId?.fullName || record.userId?.name || '-',
    },
    {
      title: t('staff_payments.col_email_phone'),
      render: (_: unknown, record: any) => record.userId?.email || record.userId?.phone || '-',
    },
    {
      title: t('staff_payments.col_plan_name'),
      render: (_: unknown, record: any) => record.planId?.nameVi || record.planId?.nameEn || '-',
    },
    {
      title: t('staff_payments.col_amount'),
      render: (_: unknown, record: any) => formatMoney(record.planId?.price || 0),
    },
    {
      title: t('staff_payments.col_date'),
      dataIndex: 'createdAt',
      render: formatDate,
    },
    {
      title: t('staff_payments.col_payment_status'),
      render: (_: unknown, record: any) => {
        const paid = isPaid(record)
        return (
          <Tag color={paid ? 'success' : 'default'}>
            {paid ? t('staff_payments.pay_status_paid') : t('staff_payments.pay_status_unpaid')}
          </Tag>
        )
      },
    },
    {
      title: t('staff_payments.col_status'),
      dataIndex: 'status',
      render: (status: string) => {
        const meta = labels.registrationStatus[status] || labels.registrationStatus.pending
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: t('staff_payments.col_actions'),
      width: 220,
      render: (_: unknown, record: any) => {
        if (record.status === 'confirmed') return null
        if (record.status === 'cancelled') return null

        const paid = isPaid(record)

        return (
          <Space>
            {paid ? (
              <>
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={actionLoadingId === record._id}
                  onClick={() => confirmRegistration(record._id)}
                >
                  {t('staff_payments.action_confirm')}
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => setRejecting(record)}
                >
                  {t('staff_payments.action_reject')}
                </Button>
              </>
            ) : (
              <Tag color="default">{t('staff_payments.action_wait_payment')}</Tag>
            )}
          </Space>
        )
      },
    },
  ]

  const paymentColumns = [
    {
      title: t('staff_payments.col_member_id'),
      render: (_: unknown, record: any) => record.userId?.memberCode || record.userId?._id || record.userId,
    },
    {
      title: t('staff_payments.col_full_name'),
      render: (_: unknown, record: any) => record.userId?.fullName || record.userId?.name || '-',
    },
    {
      title: t('staff_payments.col_plan_name'),
      render: (_: unknown, record: any) => record.planId?.nameVi || record.planId?.nameEn || '-',
    },
    {
      title: t('staff_payments.col_amount'),
      dataIndex: 'amount',
      render: formatMoney,
    },
    {
      title: t('staff_payments.col_status'),
      dataIndex: 'status',
      render: (status: string) => {
        const label = status === 'PAID' || status === 'paid' ? t('staff_payments.pay_status_paid')
          : status === 'PENDING' || status === 'pending' ? t('staff_payments.pay_status_pending')
          : status === 'FAILED' || status === 'failed' ? t('staff_payments.pay_status_failed')
          : status === 'REFUNDED' || status === 'refunded' ? t('staff_payments.pay_status_refunded')
          : status
        const color = status === 'PAID' || status === 'paid' ? 'success'
          : status === 'PENDING' || status === 'pending' ? 'warning'
          : status === 'FAILED' || status === 'failed' ? 'error'
          : 'default'
        return <Tag color={color}>{label}</Tag>
      },
    },
    {
      title: t('staff_payments.col_payment_method'),
      render: (_: unknown, record: any) => {
        const methodLabels: Record<string, string> = {
          WALLET: t('staff_payments.pay_method_wallet'),
          CASH: t('staff_payments.pay_method_cash'),
          BANK_TRANSFER: t('staff_payments.pay_method_bank'),
          POS: t('staff_payments.pay_method_pos'),
          STRIPE: t('staff_payments.pay_method_stripe'),
          MANUAL: t('staff_payments.pay_method_manual'),
          REFUND: t('staff_payments.pay_method_refund'),
        }
        return methodLabels[record.paymentMethod] || record.paymentMethod || '—'
      },
    },
    {
      title: t('staff_payments.col_source'),
      render: (_: unknown, record: any) => (
        <Tag color={record.source === 'OFFLINE' ? 'processing' : 'default'}>
          {record.source === 'OFFLINE' ? t('staff_payments.source_offline') : t('staff_payments.source_online')}
        </Tag>
      ),
    },
    {
      title: t('staff_payments.col_paid_at'),
      dataIndex: 'paidAt',
      render: formatDate,
    },
  ]

  const cancellationColumns = [
    {
      title: t('staff_payments.col_member_id'),
      render: (_: unknown, record: any) => record.memberId?.memberCode || record.memberId?._id || '-',
    },
    {
      title: t('staff_payments.col_full_name'),
      render: (_: unknown, record: any) => record.memberId?.fullName || record.memberId?.name || '-',
    },
    {
      title: t('staff_payments.col_email_phone'),
      render: (_: unknown, record: any) => record.memberId?.email || record.memberId?.phone || '-',
    },
    {
      title: t('staff_payments.col_plan_name'),
      render: (_: unknown, record: any) => record.planId?.nameVi || record.planId?.nameEn || '-',
    },
    {
      title: t('staff_payments.col_cancel_date'),
      dataIndex: 'createdAt',
      render: formatDate,
    },
    {
      title: t('staff_payments.col_estimated_refund'),
      render: (_: unknown, record: any) => {
        if (!record.refundEligible) return <Tag>{t('staff_payments.cancel_refund_no')}</Tag>
        return <span className="font-medium text-[var(--gs-success)]">{formatMoney(record.estimatedRefundAmount)}</span>
      },
    },
    {
      title: t('staff_payments.col_refund_method'),
      render: (_: unknown, record: any) => {
        if (record.refundMethod === 'NONE' || !record.refundEligible) return <Tag>{t('staff_payments.cancel_refund_none')}</Tag>
        const label = labels.refundMethodLabels[record.refundMethod] || record.refundMethod
        if (record.refundMethod === 'BANK_TRANSFER' && record.bankAccountNumber) {
          return (
            <Tooltip
              title={
                <div>
                  <div>{t('staff_payments.modal_approve_bank_label')}{record.bankName || '—'}</div>
                  <div>{t('staff_payments.modal_approve_bank_account')}{record.bankAccountNumber || '—'}</div>
                  <div>{t('staff_payments.modal_approve_bank_holder')}{record.bankAccountName || '—'}</div>
                  {record.bankNote && <div>{t('staff_payments.modal_approve_bank_note')}{record.bankNote}</div>}
                </div>
              }
            >
              <Tag color="processing" className="cursor-pointer">{label}</Tag>
            </Tooltip>
          )
        }
        return <Tag color="processing">{label}</Tag>
      },
    },
    {
      title: t('staff_payments.col_refund_status'),
      render: (_: unknown, record: any) => {
        if (!record.refundEligible || record.refundMethod === 'NONE') {
          return <Tag>{t('staff_payments.cancel_refund_not_applicable')}</Tag>
        }
        const meta = labels.refundStatusLabels[record.refundStatus] || { color: 'default', label: record.refundStatus }
        const label = record.refundMethod === 'CASH_COUNTER' && record.refundStatus === 'PENDING'
          ? t('staff_payments.cancel_refund_cash_pending')
          : meta.label
        return <Tag color={meta.color}>{label}</Tag>
      },
    },
    {
      title: t('staff_payments.col_cancel_status'),
      dataIndex: 'status',
      render: (status: string) => {
        const meta = labels.cancellationStatusMeta[status] || labels.cancellationStatusMeta.pending
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: t('staff_payments.col_actions'),
      width: 240,
      render: (_: unknown, record: any) => {
        if (record.status === 'pending') {
          return (
            <Space>
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => openApproveModal(record)}
              >
                {t('staff_payments.action_confirm_cancel')}
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => setRejectingCancel(record)}
              >
                {t('staff_payments.action_reject')}
              </Button>
            </Space>
          )
        }
        if (record.status === 'approved' && record.refundEligible && record.refundStatus === 'PENDING') {
          return (
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => {
                setMarkingRefund(record)
                setMarkRefundNote('')
              }}
            >
              {record.refundMethod === 'CASH_COUNTER' ? t('staff_payments.action_mark_refund_cash') : t('staff_payments.action_mark_refund_done')}
            </Button>
          )
        }
        return null
      },
    },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">{t('staff_payments.page_subtitle')}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="m-0 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">{t('staff_payments.title')}</h1>
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => navigate('/staff/payments/offline-register')}>
            {t('staff_payments.offline_register_btn')}
          </Button>
        </div>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <Tabs
          onChange={(key) => {
            if (key === 'cancellations') fetchCancellations(cancellationPagination.page)
            if (key === 'payments') fetchPayments()
          }}
          items={[
            {
              key: 'registrations',
              label: t('staff_payments.tab_registrations'),
              children: (
                <>
                  <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
                    <div className="min-w-[200px] flex-1">
                      <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">{t('staff_payments.filter_search')}</div>
                      <Input
                        prefix={<SearchOutlined />}
                        placeholder={t('staff_payments.filter_search_placeholder')}
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        onPressEnter={() => handleApplyFilter()}
                      />
                    </div>
                    <div className="min-w-[140px]">
                      <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">{t('staff_payments.filter_payment')}</div>
                      <Select
                        className="w-full"
                        value={paymentFilter}
                        onChange={(v) => setPaymentFilter(v)}
                        options={labels.paymentFilterOptions}
                      />
                    </div>
                    <div className="min-w-[140px]">
                      <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">{t('staff_payments.filter_status')}</div>
                      <Select
                        className="w-full"
                        value={statusFilter}
                        onChange={(v) => setStatusFilter(v)}
                        options={labels.statusFilterOptions}
                      />
                    </div>
                    <div className="min-w-[240px]">
                      <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">{t('staff_payments.filter_date_registration')}</div>
                      <RangePicker
                        className="w-full"
                        value={dateRange as any}
                        onChange={(dates) => setDateRange(dates as any)}
                        format="DD/MM/YYYY"
                        placeholder={[t('staff_payments.filter_date_from'), t('staff_payments.filter_date_to')]}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="primary" icon={<FilterOutlined />} onClick={handleApplyFilter}>
                        {t('staff_payments.filter_apply')}
                      </Button>
                      <Button icon={<ReloadOutlined />} onClick={handleResetFilter}>
                        {t('staff_payments.filter_reset')}
                      </Button>
                    </div>
                  </div>

                  <div className="mb-4 flex justify-end">
                    <Button icon={<ReloadOutlined />} onClick={() => fetchRegistrations(pagination.page)}>{t('staff_payments.reload')}</Button>
                  </div>
                  <div className="member-scroll-x">
                    <Table
                      rowKey="_id"
                      dataSource={registrations}
                      columns={registrationColumns}
                      loading={loadingRegistrations}
                      pagination={{
                        current: pagination.page,
                        pageSize: pagination.limit,
                        total: pagination.total,
                        showSizeChanger: false,
                        showTotal: (total: number) => t('staff_payments.total', { count: total }),
                      }}
                      onChange={handleTableChange}
                    />
                  </div>
                </>
              ),
            },
            {
              key: 'cancellations',
              label: t('staff_payments.tab_cancellations'),
              children: (
                <>
                  <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
                    <div className="min-w-[200px] flex-1">
                      <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">{t('staff_payments.filter_search')}</div>
                      <Input
                        prefix={<SearchOutlined />}
                        placeholder={t('staff_payments.filter_search_placeholder')}
                        value={cancelSearchKeyword}
                        onChange={(e) => setCancelSearchKeyword(e.target.value)}
                        onPressEnter={() => handleCancelApplyFilter()}
                      />
                    </div>
                    <div className="min-w-[140px]">
                      <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">{t('staff_payments.filter_status')}</div>
                      <Select
                        className="w-full"
                        value={cancelStatusFilter}
                        onChange={(v) => setCancelStatusFilter(v)}
                        options={labels.cancellationStatusOptions}
                      />
                    </div>
                    <div className="min-w-[140px]">
                      <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">{t('staff_payments.filter_refund')}</div>
                      <Select
                        className="w-full"
                        value={refundFilter}
                        onChange={(v) => setRefundFilter(v)}
                        options={labels.refundFilterOptions}
                      />
                    </div>
                    <div className="min-w-[240px]">
                      <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">{t('staff_payments.filter_date_cancel')}</div>
                      <RangePicker
                        className="w-full"
                        value={cancelDateRange as any}
                        onChange={(dates) => setCancelDateRange(dates as any)}
                        format="DD/MM/YYYY"
                        placeholder={[t('staff_payments.filter_date_from'), t('staff_payments.filter_date_to')]}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="primary" icon={<FilterOutlined />} onClick={handleCancelApplyFilter}>
                        {t('staff_payments.filter_apply')}
                      </Button>
                      <Button icon={<ReloadOutlined />} onClick={handleCancelResetFilter}>
                        {t('staff_payments.filter_reset')}
                      </Button>
                    </div>
                  </div>

                  <div className="mb-4 flex justify-end">
                    <Button icon={<ReloadOutlined />} onClick={() => fetchCancellations(cancellationPagination.page)}>{t('staff_payments.reload')}</Button>
                  </div>
                  <div className="member-scroll-x">
                    <Table
                      rowKey="_id"
                      dataSource={cancellations}
                      columns={cancellationColumns}
                      loading={loadingCancellations}
                      pagination={{
                        current: cancellationPagination.page,
                        pageSize: cancellationPagination.limit,
                        total: cancellationPagination.total,
                        showSizeChanger: false,
                        showTotal: (total: number) => t('staff_payments.total', { count: total }),
                      }}
                      onChange={handleCancelTableChange}
                    />
                  </div>
                </>
              ),
            },
            {
              key: 'payments',
              label: t('staff_payments.tab_payments'),
              children: (
                <>
                  <div className="mb-4 flex justify-end">
                    <Button icon={<ReloadOutlined />} onClick={fetchPayments}>{t('staff_payments.reload')}</Button>
                  </div>
                  <div className="member-scroll-x">
                    <Table
                      rowKey="_id"
                      dataSource={payments}
                      columns={paymentColumns}
                      loading={loadingPayments}
                    />
                  </div>
                </>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={t('staff_payments.modal_reject_reg_title')}
        open={Boolean(rejecting)}
        onCancel={() => {
          setRejecting(null)
          setRejectReason('')
        }}
        onOk={submitReject}
        confirmLoading={Boolean(actionLoadingId)}
        okText={t('staff_payments.modal_reject_reg_ok')}
        okButtonProps={{ danger: true }}
      >
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          placeholder={t('staff_payments.modal_reject_reg_placeholder')}
        />
      </Modal>

      <Modal
        title={t('staff_payments.modal_approve_cancel_title')}
        open={Boolean(approving)}
        onCancel={() => {
          setApproving(null)
          setApproveRefund(0)
          setApproveNote('')
        }}
        onOk={submitApproveCancellation}
        confirmLoading={Boolean(actionLoadingId)}
        okText={t('staff_payments.modal_approve_cancel_ok')}
        okButtonProps={{ danger: true }}
        width={800}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        className="max-[640px]:!m-4"
      >
        {approving && (
          <div className="space-y-5">
            <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-5">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">{t('staff_payments.modal_approve_label_member')}</div>
                  <div className="mt-0.5 text-base font-semibold text-[var(--gs-text)]">
                    {approving.memberId?.fullName || approving.memberId?.name || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">{t('staff_payments.modal_approve_label_plan')}</div>
                  <div className="mt-0.5 text-base font-semibold text-[var(--gs-text)]">
                    {approving.planId?.nameVi || approving.planId?.nameEn || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">{t('staff_payments.modal_approve_label_used')}</div>
                  <div className="mt-0.5 text-base font-semibold text-[var(--gs-text)]">
                    {t('staff_payments.used_days_format', { days: approving.usedDays, percent: approving.usedPercent })}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">{t('staff_payments.modal_approve_label_refund_method')}</div>
                  <div className="mt-0.5 text-base font-semibold text-[var(--gs-text)]">
                    {labels.refundMethodLabels[approving.refundMethod] || approving.refundMethod}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">{t('staff_payments.modal_approve_label_est_refund')}</div>
                  <div
                    className={`mt-0.5 text-base font-semibold ${
                      approving.refundEligible ? 'text-[var(--gs-success)]' : 'text-[var(--gs-text-muted)]'
                    }`}
                  >
                    {approving.refundEligible ? formatMoney(approving.estimatedRefundAmount) : t('staff_payments.cancel_refund_none')}
                  </div>
                </div>
              </div>
            </div>

            {approving.refundMethod === 'BANK_TRANSFER' && (
              <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--gs-text-soft)]">
                  {t('staff_payments.modal_approve_bank_section')}
                </p>
                <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  <div className="text-sm">
                    <span className="text-[var(--gs-text-muted)]">{t('staff_payments.modal_approve_bank_label')}</span>
                    <span className="font-medium">{approving.bankName || '—'}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-[var(--gs-text-muted)]">{t('staff_payments.modal_approve_bank_account')}</span>
                    <span className="font-medium">{approving.bankAccountNumber || '—'}</span>
                  </div>
                  <div className="text-sm sm:col-span-2">
                    <span className="text-[var(--gs-text-muted)]">{t('staff_payments.modal_approve_bank_holder')}</span>
                    <span className="font-medium">{approving.bankAccountName || '—'}</span>
                  </div>
                  {approving.bankNote && (
                    <div className="text-sm sm:col-span-2">
                      <span className="text-[var(--gs-text-muted)]">{t('staff_payments.modal_approve_bank_note')}</span>
                      <span className="font-medium">{approving.bankNote}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {approving.refundMethod === 'CASH_COUNTER' && (
              <div className="rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-4 text-sm text-[var(--gs-text)]">
                {t('staff_payments.modal_approve_cash_note')}
              </div>
            )}

            {approving.refundMethod === 'WALLET' && (
              <div className="rounded-xl border border-[var(--gs-success)] bg-[var(--gs-success-bg)] p-4 text-sm text-[var(--gs-text)]">
                {t('staff_payments.modal_approve_wallet_note')}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--gs-text)]">{t('staff_payments.modal_approve_refund_input_label')}</label>
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                value={approveRefund}
                onChange={(v) => setApproveRefund(v || 0)}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(value) => Number(value?.replace(/[^0-9]/g, '') || '0')}
                addonAfter={t('staff_payments.currency_suffix')}
                size="large"
              />
              <p className="mt-1 text-xs text-[var(--gs-text-muted)]">
                {t('staff_payments.modal_approve_refund_input_helper')}
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--gs-text)]">{t('staff_payments.modal_approve_note_label')}</label>
              <Input.TextArea
                rows={4}
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder={t('staff_payments.modal_approve_note_placeholder')}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={t('staff_payments.modal_reject_cancel_title')}
        open={Boolean(rejectingCancel)}
        onCancel={() => {
          setRejectingCancel(null)
          setRejectCancelReason('')
        }}
        onOk={submitRejectCancellation}
        confirmLoading={Boolean(actionLoadingId)}
        okText={t('staff_payments.modal_reject_cancel_ok')}
        okButtonProps={{ danger: true }}
      >
        <Input.TextArea
          rows={4}
          value={rejectCancelReason}
          onChange={(e) => setRejectCancelReason(e.target.value)}
          placeholder={t('staff_payments.modal_reject_cancel_placeholder')}
        />
      </Modal>

      <Modal
        title={t('staff_payments.modal_mark_refund_title')}
        open={Boolean(markingRefund)}
        onCancel={() => {
          setMarkingRefund(null)
          setMarkRefundNote('')
        }}
        onOk={submitMarkRefund}
        confirmLoading={Boolean(actionLoadingId)}
        okText={t('staff_payments.modal_mark_refund_ok')}
        okButtonProps={{ type: 'primary' }}
      >
        {markingRefund && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4 text-sm">
              <div className="mb-2">
                <span className="text-[var(--gs-text-muted)]">{t('staff_payments.modal_mark_refund_member')}</span>
                <span className="font-semibold">{markingRefund.memberId?.fullName || markingRefund.memberId?.name || '-'}</span>
              </div>
              <div className="mb-2">
                <span className="text-[var(--gs-text-muted)]">{t('staff_payments.modal_mark_refund_amount')}</span>
                <span className="font-semibold text-[var(--gs-success)]">{formatMoney(markingRefund.finalRefundAmount)}</span>
              </div>
              <div>
                <span className="text-[var(--gs-text-muted)]">{t('staff_payments.modal_mark_refund_method')}</span>
                <span className="font-semibold">{labels.refundMethodLabels[markingRefund.refundMethod]}</span>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t('staff_payments.modal_mark_refund_note_label')}</label>
              <Input.TextArea
                rows={3}
                value={markRefundNote}
                onChange={(e) => setMarkRefundNote(e.target.value)}
                placeholder={t('staff_payments.modal_mark_refund_note_placeholder')}
              />
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  )
}
