import {
  DeleteOutlined,
  EditOutlined,
  FacebookOutlined,
  LockOutlined,
  MailOutlined, PhoneOutlined,
  UnlockOutlined
} from '@ant-design/icons'
import {
  Avatar,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message
} from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { useAuth } from '../../../hooks/useAuth'
import api from '../../../services/api'
import type { AdminUser } from '../../../types/admin/user'
import AdminHistoryButton from './AdminHistoryButton'

const roleColors: Record<string, string> = {
  admin: 'red',
  pt: 'blue',
  staff: 'orange',
  member: 'green',
  user: 'green',
  seller: 'purple',
}
const PROTECTED_ADMIN_EMAIL = 'daoxuanquyen333@gmail.com'

export default function AdminUsersPage() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [form] = Form.useForm()
  const [submitLoading, setSubmitLoading] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/auth/users')
      setUsers(data.users)
    } catch {
      message.error(t('admin.users.messages.fetch_failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleToggleStatus = async (id: string) => {
    try {
      await api.patch(`/auth/users/${id}/toggle-status`)
      message.success(t('admin.users.messages.toggle_success'))
      fetchUsers()
    } catch {
      message.error(t('admin.users.messages.action_failed'))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/auth/users/${id}`)
      message.success(t('admin.users.messages.delete_success'))
      fetchUsers()
    } catch (err: any) {
      message.error(err.response?.data?.message || t('admin.users.messages.delete_failed'))
    }
  }

  const openEdit = (user: AdminUser) => {
    if (user._id === currentUser?._id) {
      message.warning(t('admin.users.messages.no_self_edit'))
      return
    }

    if (user.email?.toLowerCase() === PROTECTED_ADMIN_EMAIL) {
      message.warning(t('admin.users.messages.no_edit_protected'))
      return
    }

    setEditingUser(user)
    form.setFieldsValue({ role: user.role })
  }

  const handleUpdateRole = async (values: any) => {
    if (!editingUser) return
    setSubmitLoading(true)
    try {
      await api.patch(`/auth/users/${editingUser._id}/role`, { role: values.role })
      message.success(t('admin.users.messages.role_updated'))
      setEditingUser(null)
      fetchUsers()
    } catch (err: any) {
      message.error(err.response?.data?.message || t('admin.users.messages.update_failed'))
    } finally {
      setSubmitLoading(false)
    }
  }

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.includes(search)
    const matchRole = roleFilter ? u.role === roleFilter : true
    const matchStatus = statusFilter === 'active' ? u.isActive : statusFilter === 'locked' ? !u.isActive : true
    return matchSearch && matchRole && matchStatus
  })

  const isSelf = (userId: string) => userId === currentUser?._id
  const isProtectedAdmin = (user: AdminUser) => user.email?.toLowerCase() === PROTECTED_ADMIN_EMAIL

  const columns = [
    {
      title: t('admin.table_no'),
      width: 70,
      align: 'center' as const,
      render: (_: any, __: AdminUser, index: number) => (page - 1) * 10 + index + 1,
    },
    {
      title: t('admin.users.columns.user'),
      width: 220,
      render: (_: any, u: AdminUser) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            size={40}
            src={
              u.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'U')}`
            }
          />
          <div>
            <div style={{ fontWeight: 600 }}>{u.name}</div>
            <Tag style={{ marginTop: 2 }} color={roleColors[u.role]}>
              {u.role.toUpperCase()}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: t('admin.users.columns.contact'),
      width: 260,
      render: (_: any, u: AdminUser) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {u.email ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <MailOutlined style={{ color: '#888' }} />
              <a href={`mailto:${u.email}`} style={{ color: 'inherit' }}>{u.email}</a>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#555' }}>
              <MailOutlined style={{ color: '#555' }} /> {t('admin.users.contact.no_email')}
            </div>
          )}

          {u.phone ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <PhoneOutlined style={{ color: '#888' }} />
              <span>{u.phone}</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#555' }}>
              <PhoneOutlined style={{ color: '#555' }} /> {t('admin.users.contact.no_phone')}
            </div>
          )}

          {(u.facebookProfileUrl || u.facebookId) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <FacebookOutlined style={{ color: '#1877F2' }} />
              <a
                href={u.facebookProfileUrl || `https://facebook.com/${u.facebookId}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#1877F2', textDecoration: 'underline' }}
              >
                {t('admin.users.contact.facebook_profile')}
              </a>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#555' }}>
              <FacebookOutlined style={{ color: '#555' }} /> {t('admin.users.contact.no_facebook')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: t('admin.users.columns.provider'),
      dataIndex: 'provider',
      width: 100,
      render: (p: string) => {
        const colorMap: Record<string, string> = {
          google: 'volcano',
          facebook: 'geekblue',
          phone: 'cyan',
        }
        return <Tag color={colorMap[p] || 'default'}>{p}</Tag>
      },
    },
    {
      title: t('admin.users.columns.status'),
      width: 130,
      render: (_: any, u: AdminUser) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Tag color={u.isActive ? 'success' : 'error'}>
            {u.isActive ? t('admin.users.status.active') : t('admin.users.status.locked')}
          </Tag>
          <Tag color={u.isVerified ? 'blue' : 'default'}>
            {u.isVerified ? t('admin.users.status.verified') : t('admin.users.status.unverified')}
          </Tag>
        </div>
      ),
    },
    {
      title: t('admin.users.columns.created_at'),
      dataIndex: 'createdAt',
      width: 110,
      render: (d: string) => new Date(d).toLocaleDateString('vi-VN'),
    },
    {
      title: t('admin.users.columns.actions'),
      width: 120,
      render: (_: any, u: AdminUser) => {
        const selfAccount = isSelf(u._id)
        const protectedAccount = isProtectedAdmin(u)
        const disabledActions = selfAccount || protectedAccount
        const disabledTooltip = selfAccount
          ? t('admin.users.tooltips.no_self_action')
          : t('admin.users.tooltips.protected_admin')

        return (
          <Space>
            <Tooltip title={disabledActions ? disabledTooltip : t('admin.users.tooltips.change_role')}>
              <span>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  disabled={disabledActions}
                  onClick={() => openEdit(u)}
                />
              </span>
            </Tooltip>
            <Tooltip title={disabledActions ? disabledTooltip : (u.isActive ? t('admin.users.tooltips.lock') : t('admin.users.tooltips.unlock'))}>
              <span>
                <Button
                  size="small"
                  icon={u.isActive ? <LockOutlined /> : <UnlockOutlined />}
                  disabled={disabledActions}
                  onClick={() => handleToggleStatus(u._id)}
                />
              </span>
            </Tooltip>
            <Popconfirm
              title="Xóa người dùng này?"
              description="Hành động này không thể hoàn tác."
              onConfirm={() => handleDelete(u._id)}
              okText="Xóa"
              cancelText="Hủy"
              disabled={disabledActions}
            >
              <Tooltip title={disabledActions ? disabledTooltip : t('admin.users.tooltips.delete')}>
                <span>
                  <Button size="small" danger icon={<DeleteOutlined />} disabled={disabledActions} />
                </span>
              </Tooltip>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Admin</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">{t('admin.users.title')}</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
          {t('admin.users.total', { count: users.length })}
        </p>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
            <Input.Search
              placeholder={t('admin.users.search_placeholder')}
              allowClear
              className="dashboard-search-input"
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            <Select
              placeholder={t('admin.users.filter_role')}
              allowClear
              style={{ minWidth: 160 }}
              onChange={(val) => {
                setRoleFilter(val || '')
                setPage(1)
              }}
              options={[
                { label: 'Admin', value: 'admin' },
                { label: 'PT', value: 'pt' },
                { label: 'Staff', value: 'staff' },
                { label: 'Member', value: 'member' },
                { label: 'Seller', value: 'seller' },
              ]}
            />
            <Select
              placeholder={t('admin.users.status.filter_all')}
              allowClear
              style={{ minWidth: 160 }}
              onChange={(val) => {
                setStatusFilter(val || '')
                setPage(1)
              }}
              options={[
                { label: t('admin.users.status.active'), value: 'active' },
                { label: t('admin.users.status.locked'), value: 'locked' },
              ]}
            />
          </div>
          <AdminHistoryButton module="users" title="người dùng" />
        </div>

        <div className="member-scroll-x">
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="_id"
            loading={loading}
            pagination={{
              current: page,
              pageSize: 10,
              onChange: setPage,
            }}
            scroll={{ x: 900 }}
          />
        </div>
      </div>

      <Modal
        title={t('admin.users.edit_role_title', { name: editingUser?.name })}
        open={!!editingUser}
        onCancel={() => setEditingUser(null)}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" form={form} onFinish={handleUpdateRole}>
          <Form.Item label="Role" name="role" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Admin', value: 'admin' },
                { label: 'PT', value: 'pt' },
                { label: 'Staff', value: 'staff' },
                { label: 'Member', value: 'member' },
                { label: 'Seller', value: 'seller' },
              ]}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitLoading}>
            {t('admin.users.update')}
          </Button>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
