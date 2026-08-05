import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Input, Modal, Select, Table, Tag, Tooltip, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import {
  shiftChangeService,
  type AvailablePT,
  type RejectedPT,
  type ShiftChangeItem,
  type ShiftChangeRequest,
} from '../../../services/shiftChangeService'
import { getUserDisplayName } from '../../../utils/userDisplay'
import { socketService } from '../../../services/socketService'

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function errMsg(err: unknown, fallback: string): string {
  const m = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  return m || fallback
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ xử lý', color: 'orange' },
  waiting_assignment: { label: 'Chờ gán PT', color: 'purple' },
  assigned: { label: 'Đang chờ PT phản hồi', color: 'blue' },
  accepted: { label: 'Đã nhận đủ', color: 'green' },
  rejected: { label: 'Bị từ chối', color: 'red' },
  completed: { label: 'Hoàn thành', color: 'green' },
  expired: { label: 'Hết hạn', color: 'default' },
  cancelled: { label: 'Đã hủy', color: 'default' },
}

const ITEM_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chưa gán', color: 'default' },
  assigned: { label: 'Đã gán PT', color: 'blue' },
  accepted: { label: 'PT đồng ý', color: 'green' },
  rejected: { label: 'PT từ chối', color: 'red' },
}

function StatusTag({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, color: 'default' }
  return <Tag color={meta.color}>{meta.label}</Tag>
}

function ItemStatusTag({ status }: { status: string }) {
  const meta = ITEM_STATUS_META[status] || { label: status, color: 'default' }
  return <Tag color={meta.color}>{meta.label}</Tag>
}

export default function AdminShiftChangeRequestsPage() {
  const [docs, setDocs] = useState<ShiftChangeRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [availablePtsMap, setAvailablePtsMap] = useState<Record<string, { available: AvailablePT[]; rejected: RejectedPT[] }>>({})
  const [loadingPtsId, setLoadingPtsId] = useState<string | null>(null)

  const [assignTarget, setAssignTarget] = useState<{ request: ShiftChangeRequest; item: ShiftChangeItem } | null>(null)
  const [selectedPtId, setSelectedPtId] = useState<string | undefined>(undefined)
  const [assigning, setAssigning] = useState(false)

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<ShiftChangeRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await shiftChangeService.getAll({ page, limit: 10, status })
      setDocs(res.data.docs || [])
      setTotal(res.data.total || 0)
    } catch (err) {
      message.error(errMsg(err, 'Không tải được danh sách'))
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { load() }, [load])

  // Realtime: refetch khi có request mới / trạng thái thay đổi (PT gửi, admin gán, PT phản hồi)
  useEffect(() => {
    socketService.connect()
    const refresh = () => load()
    socketService.on('shift_change:new_request', refresh)
    socketService.on('shift_change:updated', refresh)
    return () => {
      socketService.off('shift_change:new_request', refresh)
      socketService.off('shift_change:updated', refresh)
    }
  }, [load])

  const openAssign = async (request: ShiftChangeRequest, item: ShiftChangeItem) => {
    setAssignTarget({ request, item })
    setSelectedPtId(item.replacementTrainerId ? String(item.replacementTrainer?._id || item.replacementTrainerId) : undefined)
    if (!availablePtsMap[item._id]) {
      setLoadingPtsId(item._id)
      try {
        const res = await shiftChangeService.getAvailablePTs(request._id, item._id)
        setAvailablePtsMap(prev => ({ ...prev, [item._id]: res.data }))
      } catch (err) {
        message.error(errMsg(err, 'Không tải được danh sách PT thay thế'))
      } finally {
        setLoadingPtsId(null)
      }
    }
  }

  const handleAssign = async () => {
    if (!assignTarget || !selectedPtId) {
      message.warning('Vui lòng chọn PT thay thế')
      return
    }
    setAssigning(true)
    try {
      await shiftChangeService.assign(assignTarget.request._id, [{ itemId: assignTarget.item._id, ptId: selectedPtId }])
      message.success('Đã gán PT thay thế, PT sẽ nhận được thông báo')
      setAssignTarget(null)
      setSelectedPtId(undefined)
      load()
    } catch (err) {
      message.error(errMsg(err, 'Gán PT thất bại'))
    } finally {
      setAssigning(false)
    }
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    setRejecting(true)
    try {
      await shiftChangeService.reject(rejectTarget._id, rejectReason)
      message.success('Đã từ chối yêu cầu')
      setRejectOpen(false)
      setRejectReason('')
      setRejectTarget(null)
      load()
    } catch (err) {
      message.error(errMsg(err, 'Từ chối thất bại'))
    } finally {
      setRejecting(false)
    }
  }

  const isOpen = (r: ShiftChangeRequest) =>
    ['pending', 'waiting_assignment', 'assigned'].includes(r.displayStatus || r.status)

  const columns = useMemo(() => [
    {
      title: 'PT gốc', key: 'pt', width: 160,
      render: (_: unknown, r: ShiftChangeRequest) => (
        <span className="text-[var(--gs-text)]">{getUserDisplayName(r.requestingPtId)}</span>
      ),
    },
    {
      title: 'Ngày', key: 'date', width: 130,
      render: (_: unknown, r: ShiftChangeRequest) => {
        const d = new Date(r.targetDate)
        return (
          <span className="text-sm text-[var(--gs-text)]">
            {DAY_LABELS[d.getDay()]}, {d.toLocaleDateString('vi-VN')}
          </span>
        )
      },
    },
    {
      title: 'Số ca', dataIndex: 'itemCount', key: 'itemCount', width: 80,
      render: (n: number) => <span className="text-sm text-[var(--gs-text)]">{n || 0} ca</span>,
    },
    {
      title: 'Trạng thái', key: 'status', width: 170,
      render: (_: unknown, r: ShiftChangeRequest) => <StatusTag status={r.displayStatus || r.status} />,
    },
    {
      title: 'Gửi lúc', dataIndex: 'createdAt', key: 'createdAt', width: 130,
      render: (c: string) => <span className="text-xs text-[var(--gs-text-muted)]">{new Date(c).toLocaleString('vi-VN')}</span>,
    },
    {
      title: 'Hành động', key: 'actions', width: 120,
      render: (_: unknown, r: ShiftChangeRequest) => (
        <div className="flex items-center gap-1">
          {isOpen(r) && (
            <Button size="small" danger onClick={() => { setRejectTarget(r); setRejectOpen(true) }}>
              Từ chối
            </Button>
          )}
        </div>
      ),
    },
  ], [])

  const renderItemRows = (r: ShiftChangeRequest) => {
    const items = r.items || []
    if (items.length === 0) return <p className="text-sm text-[var(--gs-text-muted)]">Không có ca nào</p>
    return (
      <div className="space-y-2 py-2">
        {r.reason && (
          <p className="text-sm text-[var(--gs-text-muted)]">
            <strong className="text-[var(--gs-text)]">Lý do:</strong> {r.reason}
          </p>
        )}
        {items.map(it => (
          <div key={it._id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-[var(--gs-border)] px-3 py-2">
            <span className="text-sm font-semibold text-[var(--gs-text)] w-28">{it.startTime} - {it.endTime || '--:--'}</span>
            <span className="text-sm text-[var(--gs-text)]">{it.className}</span>
            <span className="text-xs text-[var(--gs-text-muted)]">📍 {[it.floorName, it.zoneName].filter(Boolean).join(' - ') || '—'}</span>
            <ItemStatusTag status={it.replacementStatus} />
            {it.replacementTrainer && (
              <span className="text-xs text-[var(--gs-text-muted)]">→ {getUserDisplayName(it.replacementTrainer)}</span>
            )}
            {isOpen(r) && it.replacementStatus !== 'accepted' && (
              <Button size="small" type="link" onClick={() => openAssign(r, it)}>Gán PT</Button>
            )}
            {it.rejections && it.rejections.length > 0 ? (
              <div className="w-full flex flex-col gap-0.5">
                {it.rejections.map((rj, i) => (
                  <span key={i} className="text-xs text-red-400">
                    <strong className="text-red-500">{getUserDisplayName(rj.trainer || rj.trainerId, 'PT')}</strong>
                    {rj.reason ? ` đã từ chối - Lý do: ${rj.reason}` : ' đã từ chối. Không có lý do.'}
                  </span>
                ))}
              </div>
            ) : it.rejectedTrainers && it.rejectedTrainers.length > 0 ? (
              <span className="w-full text-xs text-red-400">
                {it.rejectedTrainers.map(u => getUserDisplayName(u)).join(', ')}{it.rejectReason ? ` đã từ chối - Lý do: ${it.rejectReason}` : ' đã từ chối. Không có lý do.'}
              </span>
            ) : it.rejectReason ? (
              <span className="w-full text-xs text-red-400">PT đã từ chối - Lý do: {it.rejectReason}</span>
            ) : null}
          </div>
        ))}
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--gs-text)]">Yêu cầu thay ca</h1>
            <p className="text-sm text-[var(--gs-text-muted)]">Quản lý yêu cầu đổi ca tạm thời của PT</p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              allowClear
              placeholder="Lọc trạng thái"
              style={{ width: 200 }}
              value={status}
              onChange={(v) => { setPage(1); setStatus(v) }}
              options={Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))}
            />
            <Button icon={<ReloadOutlined />} onClick={load}>Làm mới</Button>
          </div>
        </div>

        <Table
          dataSource={docs}
          columns={columns}
          rowKey="_id"
          loading={loading}
          expandable={{
            expandedRowRender: (r: ShiftChangeRequest) => renderItemRows(r),
          }}
          pagination={{
            current: page,
            pageSize: 10,
            total,
            showSizeChanger: false,
            onChange: (p) => setPage(p),
          }}
          locale={{ emptyText: 'Không có yêu cầu nào' }}
        />

        <Modal
          title={`Gán PT thay thế — ${assignTarget?.item.className || ''} ${assignTarget ? `(${assignTarget.item.startTime} - ${assignTarget.item.endTime || '--:--'})` : ''}`}
          open={!!assignTarget}
          onCancel={() => setAssignTarget(null)}
          onOk={handleAssign}
          confirmLoading={assigning}
          okText="Gán PT"
          okButtonProps={{ disabled: !selectedPtId }}
          width={520}
        >
          {assignTarget && (
            <div className="space-y-3 pt-2">
              <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card-soft)] px-3 py-2 text-sm text-[var(--gs-text-muted)]">
                <p><strong className="text-[var(--gs-text)]">Lớp:</strong> {assignTarget.item.className} {assignTarget.item.classCode ? `(${assignTarget.item.classCode})` : ''}</p>
                <p><strong className="text-[var(--gs-text)]">Thời gian:</strong> {assignTarget.item.startTime} - {assignTarget.item.endTime || '--:--'}</p>
                <p><strong className="text-[var(--gs-text)]">Địa điểm:</strong> {[assignTarget.item.floorName, assignTarget.item.zoneName].filter(Boolean).join(' - ') || '—'}</p>
                <p><strong className="text-[var(--gs-text)]">PT gốc:</strong> {getUserDisplayName(assignTarget.request.requestingPtId)}</p>
                {assignTarget.request.reason && <p><strong className="text-[var(--gs-text)]">Lý do:</strong> {assignTarget.request.reason}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--gs-text)]">Chọn PT thay thế</label>
                <Select
                  className="w-full"
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn PT (không nghỉ, không trùng giờ)..."
                  value={selectedPtId}
                  onChange={setSelectedPtId}
                  loading={loadingPtsId === assignTarget.item._id}
                  options={[
                    ...(availablePtsMap[assignTarget.item._id]?.available || []).map(p => ({
                      value: p._id,
                      label: p.name,
                    })),
                    ...(availablePtsMap[assignTarget.item._id]?.rejected || []).map(p => ({
                      value: p._id,
                      label: (
                        <Tooltip title={p.reason ? `${p.name} đã từ chối - Lý do: ${p.reason}` : `${p.name} đã từ chối. Không có lý do.`}>
                          <span className="text-[var(--gs-text-muted)]">{p.name} (đã từ chối)</span>
                        </Tooltip>
                      ),
                      disabled: true,
                    })),
                  ]}
                  notFoundContent="Không có PT phù hợp"
                />
              </div>
            </div>
          )}
        </Modal>

        <Modal
          title="Từ chối yêu cầu thay ca"
          open={rejectOpen}
          onCancel={() => { setRejectOpen(false); setRejectReason(''); setRejectTarget(null) }}
          onOk={handleReject}
          confirmLoading={rejecting}
          okText="Xác nhận"
          okButtonProps={{ danger: true }}
        >
          <Input.TextArea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Lý do từ chối (không bắt buộc)..." />
        </Modal>
      </div>
    </DashboardLayout>
  )
}
