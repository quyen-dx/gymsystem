import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, DatePicker, Input, message, Modal, Select, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { ptAssignmentEndService, type PTAssignmentEndRequest } from '../../../services/ptAssignmentEndService'
import { getUserDisplayName } from '../../../utils/userDisplay'

const REASON_LABELS: Record<string, string> = {
  MEMBER_COMPLETED: 'Hội viên hoàn thành khóa học',
  MEMBER_REQUEST_CHANGE_PT: 'Hội viên yêu cầu đổi PT',
  MEMBER_QUIT: 'Hội viên xin nghỉ tập',
  PT_NO_LONGER_TEACHES: 'PT không còn phụ trách lớp',
  OTHER: 'Khác',
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ duyệt', color: 'orange' },
  approved: { label: 'Đã phê duyệt', color: 'green' },
  rejected: { label: 'Đã từ chối', color: 'red' },
}

const getName = (v: unknown): string => {
  if (!v) return '—'
  if (typeof v === 'string') return v
  return getUserDisplayName(v as any, '—')
}

export default function AdminPTAssignmentEndRequestsPage() {
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')

  const [requests, setRequests] = useState<PTAssignmentEndRequest[]>([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [fromDate, setFromDate] = useState<string | undefined>(undefined)
  const [toDate, setToDate] = useState<string | undefined>(undefined)
  const [memberSearch, setMemberSearch] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(highlightId || null)

  // Detail modal
  const [detailModal, setDetailModal] = useState<{ open: boolean; request: PTAssignmentEndRequest | null }>({ open: false, request: null })

  // Approve confirm modal
  const [approveModal, setApproveModal] = useState<{ open: boolean; id: string }>({ open: false, id: '' })

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: string }>({ open: false, id: '' })
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')

  const load = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, limit: 20 }
      if (statusFilter) params.status = statusFilter
      if (fromDate) params.fromDate = fromDate
      if (toDate) params.toDate = toDate
      if (memberSearch.trim()) params.memberSearch = memberSearch.trim()
      const { data } = await ptAssignmentEndService.getAllRequests(params)
      setRequests(data.items || [])
      setPagination(data.pagination)
    } catch {
      message.error('Không thể tải danh sách yêu cầu')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, fromDate, toDate, memberSearch])

  useEffect(() => { load() }, [load])

  const handleApprove = async (id: string) => {
    setActionId(id)
    try {
      await ptAssignmentEndService.approve(id)
      message.success('Đã phê duyệt yêu cầu')
      setApproveModal({ open: false, id: '' })
      load()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể phê duyệt')
    } finally {
      setActionId(null)
    }
  }

  const handleReject = async () => {
    if (!rejectModal.id) return
    if (!rejectReason.trim()) {
      setRejectError('Vui lòng nhập lý do từ chối.')
      return
    }
    setRejectError('')
    setActionId(rejectModal.id)
    try {
      await ptAssignmentEndService.reject(rejectModal.id, rejectReason)
      message.success('Đã từ chối yêu cầu')
      setRejectModal({ open: false, id: '' })
      setRejectReason('')
      load()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể từ chối')
    } finally {
      setActionId(null)
    }
  }

  const openDetail = (r: PTAssignmentEndRequest) => {
    setDetailModal({ open: true, request: r })
  }

  const renderDetailContent = (r: PTAssignmentEndRequest) => {
    const member = typeof r.memberId === 'object' ? r.memberId : null
    const pt = typeof r.ptId === 'object' ? r.ptId : null
    const cls = typeof r.classId === 'object' ? r.classId : null
    const ass = typeof r.assignmentId === 'object' ? r.assignmentId : null
    const workout = ass?.workoutId && typeof ass.workoutId === 'object' ? ass.workoutId : null
    const proc = typeof r.processedBy === 'object' ? r.processedBy : null
    const scopeLabel = cls
      ? `Lớp nhóm: ${cls.name || 'Lớp đã chọn'}`
      : ass
        ? 'Phân công PT 1-1 đã chọn'
        : 'Yêu cầu cũ chưa xác định phạm vi — không nên phê duyệt tự động'

    return (
      <div className="grid grid-cols-2 gap-4 p-4 text-sm">
        <div>
          <div className="mb-1 font-medium text-[var(--gs-text-muted)]">PT gửi yêu cầu</div>
          <div className="text-[var(--gs-text)]">{getName(pt)}</div>
        </div>
        <div>
          <div className="mb-1 font-medium text-[var(--gs-text-muted)]">Hội viên</div>
          <div className="text-[var(--gs-text)]">{member ? getUserDisplayName(member, 'Thành viên') : '—'}</div>
          {member?.memberCode && <div className="text-xs text-[var(--gs-text-muted)]">Mã: {member.memberCode}</div>}
        </div>
        <div className="col-span-2 rounded-lg border border-[var(--gs-border)] bg-[var(--gs-surface-muted)] px-3 py-2">
          <div className="mb-1 font-medium text-[var(--gs-text-muted)]">Phạm vi sẽ kết thúc</div>
          <div className="font-medium text-[var(--gs-text)]">{scopeLabel}</div>
          <div className="mt-1 text-xs text-[var(--gs-text-muted)]">Chỉ phân công/lớp này bị tác động; dữ liệu PT khác của hội viên được giữ nguyên.</div>
        </div>
        {cls && (
          <div>
            <div className="mb-1 font-medium text-[var(--gs-text-muted)]">Lớp</div>
            <div className="text-[var(--gs-text)]">{cls.name}</div>
          </div>
        )}
        {workout && (
          <div>
            <div className="mb-1 font-medium text-[var(--gs-text-muted)]">Giáo án hiện tại</div>
            <div className="text-[var(--gs-text)]">{workout.name}</div>
            {workout.goal && <div className="text-xs text-[var(--gs-text-muted)]">{workout.goal}</div>}
          </div>
        )}
        <div>
          <div className="mb-1 font-medium text-[var(--gs-text-muted)]">Ngày gửi</div>
          <div className="text-[var(--gs-text)]">{dayjs(r.createdAt).format('DD/MM/YYYY HH:mm')}</div>
        </div>
        <div>
          <div className="mb-1 font-medium text-[var(--gs-text-muted)]">Lý do</div>
          <div className="text-[var(--gs-text)]">
            {r.reasonType === 'OTHER' && r.reasonDetail
              ? r.reasonDetail
              : REASON_LABELS[r.reasonType] || r.reasonType}
          </div>
        </div>
        {r.status !== 'pending' && (
          <>
            <div>
              <div className="mb-1 font-medium text-[var(--gs-text-muted)]">Admin xử lý</div>
              <div className="text-[var(--gs-text)]">{proc ? getName(proc) : '—'}</div>
            </div>
            <div>
              <div className="mb-1 font-medium text-[var(--gs-text-muted)]">Ngày xử lý</div>
              <div className="text-[var(--gs-text)]">{r.processedAt ? dayjs(r.processedAt).format('DD/MM/YYYY HH:mm') : '—'}</div>
            </div>
            {r.rejectReason && (
              <div className="col-span-2">
                <div className="mb-1 font-medium text-[var(--gs-text-muted)]">Lý do từ chối</div>
                <div className="text-[var(--gs-text)]">{r.rejectReason}</div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  const columns = [
    {
      title: 'Hội viên',
      width: 180,
      render: (_: unknown, r: PTAssignmentEndRequest) => {
        const member = typeof r.memberId === 'object' ? r.memberId : null
        return (
          <div>
            <div className="font-medium text-[var(--gs-text)]">{member ? getUserDisplayName(member, 'Thành viên') : '—'}</div>
            {member?.memberCode && <div className="text-xs text-[var(--gs-text-muted)]">{member.memberCode}</div>}
          </div>
        )
      },
    },
    {
      title: 'PT',
      width: 160,
      render: (_: unknown, r: PTAssignmentEndRequest) => (
        <span className="text-sm text-[var(--gs-text)]">{getName(r.ptId)}</span>
      ),
    },
    {
      title: 'Lớp',
      width: 140,
      render: (_: unknown, r: PTAssignmentEndRequest) => {
        const cls = typeof r.classId === 'object' ? r.classId : null
        return cls
          ? <span className="text-sm text-[var(--gs-text)]">{cls.name}</span>
          : <span className="text-sm text-[var(--gs-text-muted)]">—</span>
      },
    },
    {
      title: 'Giáo án hiện tại',
      width: 140,
      render: (_: unknown, r: PTAssignmentEndRequest) => {
        const ass = typeof r.assignmentId === 'object' ? r.assignmentId : null
        const workout = ass?.workoutId && typeof ass.workoutId === 'object' ? ass.workoutId : null
        return workout
          ? <span className="text-sm text-[var(--gs-text)]">{workout.name}</span>
          : <span className="text-sm text-[var(--gs-text-muted)]">—</span>
      },
    },
    {
      title: 'Ngày gửi yêu cầu',
      width: 140,
      render: (_: unknown, r: PTAssignmentEndRequest) => (
        <span className="text-sm text-[var(--gs-text-muted)]">{dayjs(r.createdAt).format('DD/MM/YYYY HH:mm')}</span>
      ),
    },
    {
      title: 'Lý do',
      width: 200,
      render: (_: unknown, r: PTAssignmentEndRequest) => {
        if (r.reasonType === 'OTHER' && r.reasonDetail) {
          return <span className="text-sm text-[var(--gs-text)]">{r.reasonDetail}</span>
        }
        return <span className="text-sm text-[var(--gs-text)]">{REASON_LABELS[r.reasonType] || r.reasonType}</span>
      },
    },
    {
      title: 'Trạng thái',
      width: 110,
      render: (_: unknown, r: PTAssignmentEndRequest) => {
        const st = STATUS_MAP[r.status] || { label: r.status, color: 'default' }
        return <Tag color={st.color}>{st.label}</Tag>
      },
    },
    {
      title: 'Thao tác',
      width: 100,
      render: (_: unknown, r: PTAssignmentEndRequest) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)}>
          Chi tiết
        </Button>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">
          Yêu cầu kết thúc phụ trách
        </h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">Danh sách {pagination.total} yêu cầu</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          placeholder="Lọc trạng thái"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          allowClear
          style={{ width: 160 }}
          options={[
            { value: 'pending', label: 'Chờ duyệt' },
            { value: 'approved', label: 'Đã phê duyệt' },
            { value: 'rejected', label: 'Đã từ chối' },
          ]}
        />
        <DatePicker
          placeholder="Từ ngày"
          format="DD/MM/YYYY"
          onChange={(d) => setFromDate(d?.startOf('day').toISOString() || undefined)}
        />
        <DatePicker
          placeholder="Đến ngày"
          format="DD/MM/YYYY"
          onChange={(d) => setToDate(d?.endOf('day').toISOString() || undefined)}
        />
        <Input
          placeholder="Tìm hội viên..."
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          onPressEnter={() => load(1)}
        />
        <Button type="primary" onClick={() => load(1)}>Tìm kiếm</Button>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6">
        <Table
          dataSource={requests}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            onChange: (p) => load(p),
          }}
          locale={{ emptyText: 'Chưa có yêu cầu nào' }}
        />
      </div>

      {/* Detail Modal */}
      <Modal
        title="Chi tiết yêu cầu"
        open={detailModal.open}
        onCancel={() => setDetailModal({ open: false, request: null })}
        footer={null}
        width={640}
      >
        {detailModal.request && (
          <>
            {renderDetailContent(detailModal.request)}
            {detailModal.request.status === 'pending' && (
              <div className="mt-6 flex justify-end gap-3 border-t border-[var(--gs-border)] pt-4">
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setRejectModal({ open: true, id: detailModal.request!._id })}
                >
                  Từ chối
                </Button>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={actionId === detailModal.request._id}
                  onClick={() => setApproveModal({ open: true, id: detailModal.request!._id })}
                >
                  Phê duyệt
                </Button>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Approve Confirm Modal */}
      <Modal
        title="Phê duyệt yêu cầu"
        open={approveModal.open}
        onCancel={() => setApproveModal({ open: false, id: '' })}
        okText="Phê duyệt"
        cancelText="Hủy"
        okButtonProps={{ loading: actionId === approveModal.id }}
        onOk={() => handleApprove(approveModal.id)}
      >
        <p className="text-sm text-[var(--gs-text-muted)]">
          Bạn có chắc muốn phê duyệt yêu cầu kết thúc phụ trách này?
        </p>
      </Modal>

      {/* Reject Modal */}
      <Modal
        title="Từ chối yêu cầu"
        open={rejectModal.open}
        onCancel={() => { setRejectModal({ open: false, id: '' }); setRejectError(''); setRejectReason('') }}
        okText="Xác nhận từ chối"
        cancelText="Hủy"
        okButtonProps={{ danger: true, loading: actionId === rejectModal.id }}
        onOk={handleReject}
      >
        <div className="mb-2 text-sm text-[var(--gs-text)]">
          Lý do từ chối <span className="text-red-500">*</span>
        </div>
        <Input.TextArea
          rows={3}
          value={rejectReason}
          onChange={(e) => { setRejectReason(e.target.value); setRejectError('') }}
          placeholder="Vui lòng nhập..."
        />
        {rejectError && <div className="mt-1 text-xs text-red-500">{rejectError}</div>}
      </Modal>
    </DashboardLayout>
  )
}
