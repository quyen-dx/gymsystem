import { useEffect, useState } from 'react'
import { Table, Button, Select, Modal, Input, message } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { trainerReplacementService, type TrainerReplacementRequest } from '../../../services/trainerReplacementService'
import { trainerService } from '../../../services/trainerService'
import { getUserDisplayName } from '../../../utils/userDisplay'

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

export default function AdminReplacementRequestsPage() {
  const [requests, setRequests] = useState<TrainerReplacementRequest[]>([])
  const [trainers, setTrainers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectId, setRejectId] = useState<string>('')
  const [rejectReason, setRejectReason] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [rRes, ptRes] = await Promise.all([
        trainerReplacementService.getAllPending(),
        trainerService.getPTs({ pageSize: 100 }),
      ])
      setRequests(rRes.data.requests || [])
      setTrainers(ptRes.data?.pts || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleApprove = async (id: string, replacementTrainerId: string) => {
    setActionId(id)
    try {
      await trainerReplacementService.approve(id, replacementTrainerId)
      message.success('Đã duyệt yêu cầu thay ca')
      load()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Lỗi')
    } finally {
      setActionId(null)
    }
  }

  const handleReject = async () => {
    try {
      await trainerReplacementService.reject(rejectId, rejectReason)
      message.success('Đã từ chối yêu cầu')
      setRejectOpen(false)
      setRejectReason('')
      load()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Lỗi')
    }
  }

  const columns = [
    {
      title: 'PT gốc', dataIndex: 'originalTrainerId', key: 'originalTrainerId', width: 150,
      render: (t: any) => <span className="text-[var(--gs-text)]">{getUserDisplayName(t)}</span>,
    },
    {
      title: 'Ngày', dataIndex: 'date', key: 'date', width: 110,
      render: (d: string) => <span className="text-sm text-[var(--gs-text)]">{new Date(d).toLocaleDateString('vi-VN')}</span>,
    },
    {
      title: 'Lý do', dataIndex: 'reason', key: 'reason',
      render: (r: string) => <span className="text-sm text-[var(--gs-text-muted)]">{r}</span>,
    },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 90,
      render: (s: string) => {
        const map: Record<string, [string, string]> = { pending: ['orange', 'Chờ'], approved: ['green', 'Đã duyệt'], rejected: ['red', 'Từ chối'] }
        return <Tag color={map[s]?.[0]}>{map[s]?.[1]}</Tag>
      },
    },
    {
      title: 'Duyệt', key: 'approve', width: 220,
      render: (_: any, r: TrainerReplacementRequest) => {
        if (r.status !== 'pending') return null
        return (
          <Select
            size="small"
            style={{ width: 180 }}
            placeholder="Chọn PT thay thế..."
            loading={actionId === r._id}
            onChange={(val) => handleApprove(r._id, val)}
            options={trainers.filter((t: any) => t._id !== (r.originalTrainerId as any)._id).map((t: any) => ({
              label: getUserDisplayName(t),
              value: t._id,
            }))}
          />
        )
      },
    },
    {
      title: '', key: 'reject', width: 60,
      render: (_: any, r: TrainerReplacementRequest) => {
        if (r.status !== 'pending') return null
        return (
          <Button size="small" danger onClick={() => { setRejectId(r._id); setRejectOpen(true) }}>
            <CloseCircleOutlined />
          </Button>
        )
      },
    },
  ]

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-bold text-[var(--gs-text)] mb-4">Yêu cầu thay ca</h1>
        <Table dataSource={requests} columns={columns} rowKey="_id" loading={loading} pagination={false} locale={{ emptyText: 'Không có yêu cầu nào' }} />

        <Modal title="Từ chối yêu cầu" open={rejectOpen} onOk={handleReject} onCancel={() => setRejectOpen(false)} okText="Xác nhận" cancelText="Hủy" okButtonProps={{ danger: true }}>
          <Input.TextArea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Lý do từ chối..." />
        </Modal>
      </div>
    </DashboardLayout>
  )
}

function Tag({ children, color }: { children: React.ReactNode; color?: string }) {
  const colorMap: Record<string, string> = { orange: 'bg-orange-500/10 text-orange-600', green: 'bg-green-500/10 text-green-600', red: 'bg-red-500/10 text-red-600' }
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${colorMap[color || ''] || 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]'}`}>{children}</span>
}
