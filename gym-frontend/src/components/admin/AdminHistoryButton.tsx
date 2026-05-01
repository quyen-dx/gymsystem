import { HistoryOutlined } from '@ant-design/icons'
import { Button, Modal, Select, Table, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import api from '../../services/api'

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

const actionLabels: Record<AuditAction, string> = {
  create: 'Thêm',
  update: 'Sửa',
  delete: 'Xóa',
}

const actionColors: Record<AuditAction, string> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
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
      message.error(err.response?.data?.message || 'Không thể tải lịch sử')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) fetchLogs()
  }, [open])

  return (
    <>
      <Button icon={<HistoryOutlined />} onClick={() => setOpen(true)}>
        Lịch sử
      </Button>

      <Modal
        title={`Lịch sử ${title}`}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={920}
        destroyOnClose
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Select
            allowClear
            placeholder="Lọc thao tác"
            style={{ width: 180 }}
            value={action || undefined}
            onChange={(value) => {
              const nextAction = (value || '') as AuditAction | ''
              setAction(nextAction)
              fetchLogs(nextAction)
            }}
            options={[
              { label: 'Thêm', value: 'create' },
              { label: 'Sửa', value: 'update' },
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
              title: 'Admin thao tác',
              render: (_: any, record: AuditLog) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{record.admin?.name || 'Admin'}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{record.admin?.email || 'Không có email'}</div>
                </div>
              ),
            },
            {
              title: 'Chi tiết',
              dataIndex: 'details',
              render: (value: string) => value || '-',
            },
          ]}
        />
      </Modal>
    </>
  )
}
