import { useEffect, useState } from 'react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import api from '../../services/api'
import {
  Table, Button, Tag, Space, Popconfirm, message,
  Input, Select, Avatar, Modal, Form, Tooltip
} from 'antd'
import {
  DeleteOutlined, LockOutlined, UnlockOutlined, EditOutlined,
  MailOutlined, PhoneOutlined, FacebookOutlined
} from '@ant-design/icons'

interface User {
  _id: string
  name: string
  email: string | null
  phone: string | null
  facebookId?: string | null
  role: 'admin' | 'pt' | 'staff' | 'member'
  provider: string
  isActive: boolean
  isVerified: boolean
  avatar: string
  createdAt: string
}

const roleColors: Record<string, string> = {
  admin: 'red',
  pt: 'blue',
  staff: 'orange',
  member: 'green',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form] = Form.useForm()
  const [submitLoading, setSubmitLoading] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/auth/users')
      setUsers(data.users)
    } catch {
      message.error('Không thể tải danh sách người dùng')
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
      message.success('Cập nhật trạng thái thành công')
      fetchUsers()
    } catch {
      message.error('Thao tác thất bại')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/auth/users/${id}`)
      message.success('Xóa người dùng thành công')
      fetchUsers()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Xóa thất bại')
    }
  }

  const openEdit = (user: User) => {
    setEditingUser(user)
    form.setFieldsValue({ role: user.role })
  }

  const handleUpdateRole = async (values: any) => {
    if (!editingUser) return
    setSubmitLoading(true)
    try {
      await api.patch(`/auth/users/${editingUser._id}/role`, { role: values.role })
      message.success('Cập nhật role thành công')
      setEditingUser(null)
      fetchUsers()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Thất bại')
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
    return matchSearch && matchRole
  })

  const columns = [
    {
      title: 'Người dùng',
      width: 220,
      render: (_: any, u: User) => (
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
      title: 'Liên hệ',
      width: 260,
      render: (_: any, u: User) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {u.email ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <MailOutlined style={{ color: '#888' }} />
              <a href={`mailto:${u.email}`} style={{ color: 'inherit' }}>{u.email}</a>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#555' }}>
              <MailOutlined style={{ color: '#555' }} /> Chưa có email
            </div>
          )}

          {u.phone ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <PhoneOutlined style={{ color: '#888' }} />
              <span>{u.phone}</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#555' }}>
              <PhoneOutlined style={{ color: '#555' }} /> Chưa có SĐT
            </div>
          )}

          {u.facebookId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <FacebookOutlined style={{ color: '#1877F2' }} />
              <a
                href={`https://facebook.com/${u.facebookId}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#1877F2' }}
              >
                facebook.com/{u.facebookId}
              </a>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#555' }}>
              <FacebookOutlined style={{ color: '#555' }} /> Chưa liên kết Facebook
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Provider',
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
      title: 'Trạng thái',
      width: 130,
      render: (_: any, u: User) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Tag color={u.isActive ? 'success' : 'error'}>
            {u.isActive ? 'Hoạt động' : 'Đã khóa'}
          </Tag>
          <Tag color={u.isVerified ? 'blue' : 'default'}>
            {u.isVerified ? 'Đã xác minh' : 'Chưa xác minh'}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      width: 110,
      render: (d: string) => new Date(d).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Thao tác',
      width: 120,
      render: (_: any, u: User) => (
        <Space>
          <Tooltip title="Đổi role">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(u)}
            />
          </Tooltip>
          <Tooltip title={u.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}>
            <Button
              size="small"
              icon={u.isActive ? <LockOutlined /> : <UnlockOutlined />}
              onClick={() => handleToggleStatus(u._id)}
            />
          </Tooltip>
          <Popconfirm
            title="Xóa người dùng này?"
            description="Hành động này không thể hoàn tác."
            onConfirm={() => handleDelete(u._id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Tooltip title="Xóa">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))] p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Admin</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)]">Quản lý người dùng</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
          Tổng: {users.length} tài khoản
        </p>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input.Search
            placeholder="Tìm theo tên, email, số điện thoại..."
            allowClear
            style={{ maxWidth: 320 }}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            placeholder="Lọc theo role"
            allowClear
            style={{ width: 160 }}
            onChange={(val) => setRoleFilter(val || '')}
            options={[
              { label: 'Admin', value: 'admin' },
              { label: 'PT', value: 'pt' },
              { label: 'Staff', value: 'staff' },
              { label: 'Member', value: 'member' },
            ]}
          />
        </div>

        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
        />
      </div>

      {/* MODAL ĐỔI ROLE */}
      <Modal
        title={`Đổi role — ${editingUser?.name}`}
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
              ]}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitLoading}>
            Cập nhật
          </Button>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}