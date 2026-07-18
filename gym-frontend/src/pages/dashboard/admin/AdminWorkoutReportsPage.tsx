import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  ReloadOutlined,
  StopOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import {
  Button,
  Empty,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
  Modal,
  Select,
  Tabs,
} from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { workoutService, type WorkoutReport } from '../../../services/workoutService'

const REASON_LABELS: Record<string, string> = {
  wrong_expertise: 'Sai chuyên môn',
  incorrect_content: 'Nội dung không đúng kỹ thuật',
  missing_info: 'Thiếu thông tin',
  spam: 'Spam',
  duplicate: 'Trùng lặp',
  other: 'Khác',
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ xử lý', color: 'orange' },
  reviewed: { label: 'Đã xem xét', color: 'blue' },
  resolved: { label: 'Đã xử lý', color: 'green' },
  rejected: { label: 'Đã từ chối', color: 'default' },
}

const getName = (v: unknown): string => {
  if (!v) return '-'
  if (typeof v === 'string') return v
  return (v as any).fullName || (v as any).name || '-'
}

const getWorkoutName = (v: unknown): string => {
  if (!v) return '-'
  if (typeof v === 'string') return v
  return (v as any).name || '-'
}

const getWorkoutPtId = (v: unknown): string => {
  if (!v) return ''
  if (typeof v === 'string') return ''
  const w = v as any
  if (w.ptId) {
    return typeof w.ptId === 'string' ? w.ptId : (w.ptId._id || w.ptId.name || w.ptId.fullName || '')
  }
  return ''
}

const getWorkoutTemplateStatus = (v: unknown): string => {
  if (!v) return 'published'
  if (typeof v === 'string') return 'published'
  return (v as any).templateStatus || 'published'
}

export default function AdminWorkoutReportsPage() {
  const navigate = useNavigate()
  const [reports, setReports] = useState<WorkoutReport[]>([])
  const [summary, setSummary] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [detailModal, setDetailModal] = useState<WorkoutReport | null>(null)

  const loadReports = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params: any = { page, limit: 20 }
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter
      const { data } = await workoutService.getWorkoutReports(params)
      setReports(data.reports || [])
      setPagination(data.pagination)
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể tải báo cáo')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  const loadSummary = useCallback(async () => {
    try {
      const { data } = await workoutService.getReportSummary()
      setSummary(data.summary || [])
    } catch {}
  }, [])

  useEffect(() => {
    loadReports()
    loadSummary()
  }, [loadReports, loadSummary])

  const handleResolve = async (reportId: string) => {
    try {
      await workoutService.resolveReport(reportId)
      message.success('Đã xác nhận báo cáo')
      loadReports()
      loadSummary()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể xử lý')
    }
  }

  const handleReject = async (reportId: string) => {
    try {
      await workoutService.rejectReport(reportId, { resolution: 'Báo cáo không chính xác' })
      message.success('Đã từ chối báo cáo')
      loadReports()
      loadSummary()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể xử lý')
    }
  }

  const handleHideWorkout = async (workoutId: string) => {
    try {
      await workoutService.hideWorkout(workoutId, 'Admin ẩn do vi phạm')
      message.success('Đã ẩn giáo án')
      loadReports()
      loadSummary()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể ẩn')
    }
  }

  const handleRestoreWorkout = async (workoutId: string) => {
    try {
      await workoutService.restoreWorkout(workoutId)
      message.success('Đã khôi phục giáo án')
      loadReports()
      loadSummary()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể khôi phục')
    }
  }

  const reportColumns = [
    {
      title: 'Giáo án',
      width: 200,
      render: (_: unknown, record: WorkoutReport) => (
        <div>
          <div className="font-semibold text-[var(--gs-text)]">{getWorkoutName(record.workoutTemplateId)}</div>
          <div className="text-xs text-[var(--gs-text-muted)]">
            Trạng thái: <Tag>{getWorkoutTemplateStatus(record.workoutTemplateId)}</Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'Lý do',
      width: 160,
      render: (_: unknown, record: WorkoutReport) => (
        <Tag color="red">{REASON_LABELS[record.reason] || record.reason}</Tag>
      ),
    },
    {
      title: 'Chi tiết',
      width: 200,
      render: (_: unknown, record: WorkoutReport) => (
        <span className="text-xs text-[var(--gs-text-muted)]">
          {record.detail || '-'}
        </span>
      ),
    },
    {
      title: 'Người báo cáo',
      width: 130,
      render: (_: unknown, record: WorkoutReport) => getName(record.reporterTrainerId),
    },
    {
      title: 'Thời gian',
      width: 120,
      render: (_: unknown, record: WorkoutReport) => (
        <span className="text-xs text-[var(--gs-text-muted)]">
          {record.createdAt ? dayjs(record.createdAt).format('DD/MM/YYYY HH:mm') : '-'}
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      width: 120,
      render: (_: unknown, record: WorkoutReport) => {
        const st = STATUS_MAP[record.status] || { label: record.status, color: 'default' }
        return <Tag color={st.color}>{st.label}</Tag>
      },
    },
    {
      title: 'Thao tác',
      width: 200,
      render: (_: unknown, record: WorkoutReport) => {
        const workoutId = typeof record.workoutTemplateId === 'string' ? record.workoutTemplateId : (record.workoutTemplateId as any)?._id
        const templateStatus = getWorkoutTemplateStatus(record.workoutTemplateId)
        const actions: React.ReactNode[] = []

        if (workoutId && typeof workoutId === 'string') {
          actions.push(
            <Tooltip key="view" title="Xem giáo án">
              <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/pt/workouts/view/${workoutId}`)} />
            </Tooltip>,
          )
        }

        if (record.status === 'pending') {
          actions.push(
            <Tooltip key="resolve" title="Xác nhận báo cáo">
              <Popconfirm title="Xác nhận báo cáo này?" onConfirm={() => handleResolve(record._id)} okText="Xác nhận">
                <Button size="small" icon={<CheckOutlined />} type="primary" />
              </Popconfirm>
            </Tooltip>,
          )
          actions.push(
            <Tooltip key="reject" title="Từ chối báo cáo">
              <Popconfirm title="Từ chối báo cáo này?" onConfirm={() => handleReject(record._id)} okText="Từ chối">
                <Button size="small" icon={<CloseOutlined />} danger />
              </Popconfirm>
            </Tooltip>,
          )
        }

        if (templateStatus === 'published' || templateStatus === 'under_review') {
          actions.push(
            <Tooltip key="hide" title="Ẩn giáo án">
              <Popconfirm title="Ẩn giáo án này?" onConfirm={() => handleHideWorkout(workoutId as string)} okText="Ẩn">
                <Button size="small" icon={<StopOutlined />} danger />
              </Popconfirm>
            </Tooltip>,
          )
        }

        if (templateStatus === 'hidden') {
          actions.push(
            <Tooltip key="restore" title="Khôi phục">
              <Popconfirm title="Khôi phục giáo án?" onConfirm={() => handleRestoreWorkout(workoutId as string)} okText="Khôi phục">
                <Button size="small" icon={<UndoOutlined />} />
              </Popconfirm>
            </Tooltip>,
          )
        }

        return <Space size={4}>{actions}</Space>
      },
    },
  ]

  const summaryColumns = [
    {
      title: 'Giáo án',
      dataIndex: '_id' as const,
      render: (_: unknown, record: any) => getWorkoutName(record._id),
    },
    {
      title: 'PT tạo',
      render: (_: unknown, record: any) => {
        const pt = record._id?.ptId
        return getName(pt)
      },
    },
    {
      title: 'Số báo cáo',
      dataIndex: 'reportCount' as const,
      render: (v: number) => <Tag color="red">{v}</Tag>,
    },
    {
      title: 'Lý do',
      render: (_: unknown, record: any) => {
        const reasons = record.reasons || []
        const unique = [...new Set(reasons)] as string[]
        return (
          <Space size={2} wrap>
            {unique.map((r: string) => (
              <Tag key={r} color="orange">{REASON_LABELS[r] || r}</Tag>
            ))}
          </Space>
        )
      },
    },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Quản trị</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">Quản lý báo cáo giáo án</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
          Xem xét và xử lý các báo cáo vi phạm giáo án trong thư viện dùng chung.
        </p>
      </div>

      <Tabs
        defaultActiveKey="reports"
        items={[
          {
            key: 'reports',
            label: 'Danh sách báo cáo',
            children: (
              <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <Select
                    value={statusFilter}
                    onChange={(v) => setStatusFilter(v)}
                    style={{ width: 160 }}
                    options={[
                      { value: 'all', label: 'Tất cả' },
                      { value: 'pending', label: 'Chờ xử lý' },
                      { value: 'reviewed', label: 'Đã xem xét' },
                      { value: 'resolved', label: 'Đã xử lý' },
                      { value: 'rejected', label: 'Đã từ chối' },
                    ]}
                  />
                  <Button icon={<ReloadOutlined />} onClick={() => loadReports()} loading={loading}>
                    Tải lại
                  </Button>
                </div>

                <div className="member-scroll-x">
                  <Table
                    dataSource={reports}
                    columns={reportColumns}
                    rowKey="_id"
                    loading={loading}
                    locale={{ emptyText: <Empty description="Không có báo cáo nào" /> }}
                    pagination={{
                      current: pagination.page,
                      pageSize: pagination.limit,
                      total: pagination.total,
                      showSizeChanger: false,
                      onChange: (page) => loadReports(page),
                    }}
                    scroll={{ x: 1100 }}
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'summary',
            label: 'Tổng hợp theo giáo án',
            children: (
              <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
                <Table
                  dataSource={summary}
                  columns={summaryColumns}
                  rowKey={(r: any) => r._id?._id || String(Math.random())}
                  locale={{ emptyText: <Empty description="Không có báo cáo nào" /> }}
                  pagination={{ pageSize: 10 }}
                />
              </div>
            ),
          },
        ]}
      />

      <Modal
        title="Chi tiết báo cáo"
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={null}
        width={600}
      >
        {detailModal && (
          <div className="space-y-3">
            <div>
              <strong>Giáo án:</strong> {getWorkoutName(detailModal.workoutTemplateId)}
            </div>
            <div>
              <strong>Lý do:</strong>{' '}
              <Tag color="red">{REASON_LABELS[detailModal.reason] || detailModal.reason}</Tag>
            </div>
            {detailModal.detail && (
              <div>
                <strong>Chi tiết:</strong>
                <p className="mt-1 rounded bg-[var(--theme-bg)] p-2 text-sm">{detailModal.detail}</p>
              </div>
            )}
            <div>
              <strong>Người báo cáo:</strong> {getName(detailModal.reporterTrainerId)}
            </div>
            <div>
              <strong>Thời gian:</strong>{' '}
              {detailModal.createdAt ? dayjs(detailModal.createdAt).format('DD/MM/YYYY HH:mm') : '-'}
            </div>
            {detailModal.resolution && (
              <div>
                <strong>Kết quả xử lý:</strong>
                <p className="mt-1 rounded bg-[var(--theme-bg)] p-2 text-sm">{detailModal.resolution}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  )
}
