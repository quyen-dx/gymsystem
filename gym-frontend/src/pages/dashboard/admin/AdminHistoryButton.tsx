import { HistoryOutlined } from '@ant-design/icons'
import { Button, Modal, Select, Table, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

export default function AdminHistoryButton({
  module,
  title,
}: {
  module: AuditModule
  title: string
}) {
  const { t } = useTranslation()
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
      message.error(err.response?.data?.message || t('admin_history.messages.fetch_failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) fetchLogs()
  }, [open])

  const actionLabels: Record<AuditAction, string> = {
    create: t('admin_history.actions.create'),
    update: t('admin_history.actions.update'),
    delete: t('admin_history.actions.delete'),
  }

  return (
    <>
      <Button icon={<HistoryOutlined />} onClick={() => setOpen(true)}>
        {t('admin_history.button')}
      </Button>

      <Modal
        title={t('admin_history.title', { subject: title })}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={1100}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        destroyOnClose
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Select
            allowClear
            placeholder={t('admin_history.filter_placeholder')}
            style={{ width: 180 }}
            value={action || undefined}
            onChange={(value) => {
              const nextAction = (value || '') as AuditAction | ''
              setAction(nextAction)
              fetchLogs(nextAction)
            }}
            options={[
              { label: t('admin_history.actions.create'), value: 'create' },
              { label: t('admin_history.actions.update'), value: 'update' },
              { label: t('admin_history.actions.delete'), value: 'delete' },
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
              title: t('admin_history.columns.time'),
              dataIndex: 'createdAt',
              width: 170,
              render: (value: string) => new Date(value).toLocaleString('vi-VN'),
            },
            {
              title: t('admin_history.columns.action'),
              dataIndex: 'action',
              width: 90,
              render: (value: AuditAction) => (
                <Tag color={actionColors[value]}>{actionLabels[value]}</Tag>
              ),
            },
            {
              title: t('admin_history.columns.entity'),
              dataIndex: 'entityName',
              width: 190,
              render: (value: string) => value || t('admin_history.fallback.no_entity_name'),
            },
            {
              title: t('admin_history.columns.admin'),
              render: (_: any, record: AuditLog) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{record.admin?.name || t('admin_history.fallback.admin')}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{record.admin?.email || t('admin_history.fallback.no_email')}</div>
                </div>
              ),
            },
            {
              title: t('admin_history.columns.details'),
              dataIndex: 'details',
              render: (value: string) => value || '-',
            },
          ]}
        />
      </Modal>
    </>
  )
}
