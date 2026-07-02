import { HistoryOutlined } from '@ant-design/icons'
import { Button, Modal, Select, Table, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import api from '../../../services/api'

type AuditModule = 'users' | 'plans' | 'products' | 'shops'
type AuditAction = 'create' | 'update' | 'delete'

interface AuditLog {
  _id: string
  module: AuditModule
  action: AuditAction
  entityName: string
  admin?: {
    name?: string
    email?: string
  }
  details?: string
  createdAt: string
}

const actionColors: Record<AuditAction, string> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
}

function translateDetail(value: string | undefined): string {
  if (!value) return '-'

  const staticMap: Record<string, string> = {
    'Mở khóa tài khoản': 'Mở khóa tài khoản',
    'Khóa tài khoản': 'Khóa tài khoản',
    'Xóa tài khoản người dùng': 'Xóa tài khoản người dùng',
    'Thêm PT mới': 'Thêm PT mới',
    'Cập nhật thông tin PT': 'Cập nhật thông tin PT',
    'Xóa PT (vô hiệu hóa)': 'Xóa PT (vô hiệu hóa)',
    'Thêm member mới': 'Thêm member mới',
    'Cập nhật thông tin member': 'Cập nhật thông tin member',
    'Mở khóa member': 'Mở khóa member',
    'Khóa member': 'Khóa member',
    'Tạo gói tập': 'Tạo gói tập',
    'Cập nhật thông tin gói tập': 'Cập nhật thông tin gói tập',
    'Xóa gói tập': 'Xóa gói tập',
    'Kích hoạt gói tập': 'Kích hoạt gói tập',
    'Vô hiệu hóa gói tập': 'Vô hiệu hóa gói tập',
    'Thêm sản phẩm': 'Thêm sản phẩm',
    'Cập nhật thông tin sản phẩm': 'Cập nhật thông tin sản phẩm',
    'Xóa sản phẩm': 'Xóa sản phẩm',
    'Cập nhật cài đặt hệ thống toàn website': 'Cập nhật cài đặt hệ thống toàn website',
    'Reset cài đặt hệ thống về mặc định': 'Reset cài đặt hệ thống về mặc định',
  }

  if (staticMap[value]) return staticMap[value]

  const roleMatch = value.match(/^Đổi role từ (.+) sang (.+)$/)
  if (roleMatch) return `Đổi role từ ${roleMatch[1]} sang ${roleMatch[2]}`

  const registerMatch = value.match(/^Đăng ký gói tập "(.+)" cho member$/)
  if (registerMatch) return `Đăng ký gói tập "${registerMatch[1]}" cho member`

  const renewMatch = value.match(/^Gia hạn gói "(.+)" cho member \(từ (.+)\)$/)
  if (renewMatch) return `Gia hạn gói "${renewMatch[1]}" cho member (từ ${renewMatch[2]})`

  const bulkRenewMatch = value.match(/^Gia hạn hàng loạt (\d+) member với gói "(.+)"$/)
  if (bulkRenewMatch) return `Gia hạn hàng loạt ${bulkRenewMatch[1]} member với gói "${bulkRenewMatch[2]}"`

  const partnershipMatch = value.match(/^Duyệt yêu cầu hợp tác từ "(.+)" — đã tạo shop "(.+)"$/)
  if (partnershipMatch) return `Duyệt yêu cầu hợp tác từ "${partnershipMatch[1]}" — đã tạo shop "${partnershipMatch[2]}"`

  return value
}

export default function AdminHistoryButton({
  module,
  title,
}: {
  module: AuditModule
  title: string
}) {
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<AuditAction | ''>('')

  const fetchLogs = async (nextAction = action) => {
    setLoading(true)
    try {
      const { data } = await api.get('/audit-logs', {
        params: {
          module,
          action: nextAction || undefined,
          limit: 100,
        },
      })
      setLogs(data.logs || [])
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tải lịch sử thao tác')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) fetchLogs()
  }, [open])

  const actionLabels: Record<AuditAction, string> = {
    create: 'Tạo mới',
    update: 'Cập nhật',
    delete: 'Xóa',
  }

  return (
    <>
      <Button icon={<HistoryOutlined />} onClick={() => setOpen(true)}>
        Lịch sử
      </Button>

      <Modal
        title={`Lịch sử thao tác: ${title}`}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={1100}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        destroyOnHidden
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Select
            allowClear
            placeholder="Lọc theo thao tác"
            style={{ width: 180 }}
            value={action || undefined}
            onChange={(value) => {
              const nextAction = (value || '') as AuditAction | ''
              setAction(nextAction)
              fetchLogs(nextAction)
            }}
            options={[
              { label: 'Tạo mới', value: 'create' },
              { label: 'Cập nhật', value: 'update' },
              { label: 'Xóa', value: 'delete' },
            ]}
          />
        </div>

        <Table
          dataSource={logs}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: 'Thời gian',
              dataIndex: 'createdAt',
              width: 170,
              render: (value: string) => new Date(value).toLocaleString('vi-VN'),
            },
            {
              title: 'Thao tác',
              dataIndex: 'action',
              width: 90,
              render: (value: AuditAction) => (
                <Tag color={actionColors[value]}>{actionLabels[value]}</Tag>
              ),
            },
            {
              title: 'Đối tượng',
              dataIndex: 'entityName',
              width: 190,
              render: (value: string) => value || 'Không có tên',
            },
            {
              title: 'Quản trị viên',
              render: (_: any, record: AuditLog) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{record.admin?.name || 'Không có tên'}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{record.admin?.email || 'Không có email'}</div>
                </div>
              ),
            },
            {
              title: 'Chi tiết',
              dataIndex: 'details',
              render: (value: string) => translateDetail(value),
            },
          ]}
        />
      </Modal>
    </>
  )
}
