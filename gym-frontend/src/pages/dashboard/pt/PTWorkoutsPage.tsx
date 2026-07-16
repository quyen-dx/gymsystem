import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
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
} from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import {
  workoutService,
  type WorkoutPlan,
} from '../../../services/workoutService'

export default function PTWorkoutsPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<WorkoutPlan[]>([])
  const [loading, setLoading] = useState(false)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await workoutService.getTemplates()
      setTemplates(Array.isArray(data) ? data : [])
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể tải danh sách giáo án mẫu')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const handleDelete = async (id: string) => {
    try {
      await workoutService.deleteWorkout(id)
      message.success('Đã xoá giáo án mẫu')
      loadTemplates()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể xoá giáo án mẫu')
    }
  }

  const columns = [
    {
      title: 'Tên giáo án',
      render: (_: unknown, record: WorkoutPlan) => (
        <div className="font-semibold text-[var(--gs-text)]">{record.workoutName || record.name}</div>
      ),
    },
    {
      title: 'Mục tiêu',
      width: 150,
      render: (_: unknown, record: WorkoutPlan) => <Tag>{record.goal || 'Chưa có'}</Tag>,
    },
    {
      title: 'Số buổi',
      width: 100,
      render: (_: unknown, record: WorkoutPlan) => (
        <span>{record.days?.length || record.weeks?.length || 0} buổi</span>
      ),
    },
    {
      title: 'Ngày tạo',
      width: 120,
      render: (_: unknown, record: WorkoutPlan) => (
        <span className="text-xs text-[var(--gs-text-muted)]">
          {record.createdAt ? dayjs(record.createdAt).format('DD/MM/YYYY') : '-'}
        </span>
      ),
    },
    {
      title: 'Thao tác',
      width: 160,
      render: (_: unknown, record: WorkoutPlan) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/pt/workouts/view/${record._id}`)} />
          </Tooltip>
          <Tooltip title="Sửa">
            <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/pt/workouts/edit/${record._id}`)} />
          </Tooltip>
          <Popconfirm
            title="Xoá giáo án mẫu này?"
            okText="Xoá"
            cancelText="Huỷ"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record._id)}
          >
            <Tooltip title="Xoá">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Bảng điều khiển</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">Thư viện giáo án mẫu</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
          Tạo và quản lý các giáo án mẫu để sử dụng lại cho nhiều học viên.
        </p>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <Button icon={<ReloadOutlined />} onClick={loadTemplates} loading={loading}>
            Tải lại
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/pt/workouts/create')}>
            Thêm giáo án mẫu
          </Button>
        </div>

        <div className="member-scroll-x">
          <Table
            dataSource={templates}
            columns={columns}
            rowKey="_id"
            loading={loading}
            locale={{ emptyText: <Empty description="Chưa có giáo án mẫu nào" /> }}
            pagination={{ pageSize: 10 }}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
