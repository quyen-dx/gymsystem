import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
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
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { useAuth } from '../../../hooks/useAuth'
import api from '../../../services/api'
import type { AdminUser } from '../../../types/admin/user'
import { getUserDisplayName, getUserInitialName } from '../../../utils/userDisplay'
import AdminHistoryButton from './AdminHistoryButton'

const roleColors: Record<string, string> = {
  super_admin: 'gold',
  admin: 'red',
  pt: 'blue',
  staff: 'orange',
  member: 'green',
  user: 'green',
  seller: 'purple',
}
const PROTECTED_ADMIN_EMAIL = 'daoxuanquyen333@gmail.com'

export default function AdminUsersPage() {
  const navigate = useNavigate()
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
      message.error(err.response?.data?.message || 'Không thể xóa người dùng')
    }
  }

  const openEdit = (user: AdminUser) => {
    if (user._id === currentUser?._id) {
      message.warning('Không thể tự chỉnh sửa tài khoản của chính mình')
      return
    }

    if (currentUser?.role !== 'super_admin' && (user.role === 'super_admin' || user.role === 'admin')) {
      message.warning('Không có quyền chỉnh sửa quản trị viên')
      return
    }

    if (user.email?.toLowerCase() === PROTECTED_ADMIN_EMAIL) {
      message.warning('Không thể chỉnh sửa tài khoản được bảo vệ')
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
      message.success('Cập nhật vai trò thành công')
      setEditingUser(null)
      fetchUsers()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Cập nhật thất bại')
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

  // Disable action on admin/super_admin targets for non-super_admin users
  const cannotManageAdmin = (u: AdminUser) =>
    currentUser?.role !== 'super_admin' && (u.role === 'super_admin' || u.role === 'admin')

  const columns = [
    {
      title: 'STT',
      width: 70,
      align: 'center' as const,
      render: (_: any, __: AdminUser, index: number) => (page - 1) * 10 + index + 1,
    },
    {
      title: 'Mã thành viên',
      dataIndex: 'memberCode',
      width: 120,
      render: (code: string) => code || '—',
    },
    {
      title: 'Người dùng',
      width: 200,
      render: (_: any, u: AdminUser) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            size={36}
            src={
              u.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(getUserInitialName(u, 'U'))}`
            }
          />
          <div>
            <div style={{ fontWeight: 600 }}>{getUserDisplayName(u, 'Người dùng')}</div>
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
      render: (_: any, u: AdminUser) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {u.email ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <MailOutlined style={{ color: '#888' }} />
              <a href={`mailto:${u.email}`} style={{ color: 'inherit' }}>{u.email}</a>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#555' }}>
              <MailOutlined style={{ color: '#555' }} /> Không có email
            </div>
          )}

          {u.phone ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <PhoneOutlined style={{ color: '#888' }} />
              <span>{u.phone}</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#555' }}>
              <PhoneOutlined style={{ color: '#555' }} /> Không có số điện thoại
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
                Facebook
              </a>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#555' }}>
              <FacebookOutlined style={{ color: '#555' }} /> Không có Facebook
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Nhà cung cấp',
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
      render: (_: any, u: AdminUser) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Tag color={u.isActive ? 'success' : 'error'}>
            {u.isActive ? 'Đang hoạt động' : 'Đã khóa'}
          </Tag>
          <Tag color={u.isVerified ? 'blue' : 'default'}>
            {u.isVerified ? 'Đã xác thực' : 'Chưa xác thực'}
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
      width: 160,
      render: (_: any, u: AdminUser) => {
        const selfAccount = isSelf(u._id)
        const protectedAccount = isProtectedAdmin(u)
        const noAdminPermission = cannotManageAdmin(u)
        const disabledActions = selfAccount || protectedAccount || noAdminPermission
        const disabledTooltip = selfAccount
          ? 'Không thể thao tác trên chính mình'
          : protectedAccount
          ? 'Tài khoản được bảo vệ'
          : noAdminPermission
          ? 'Không có quyền thao tác với quản trị viên'
          : ''

        return (
          <Space>
            <Tooltip title={disabledActions && (u.role === 'admin' || u.role === 'super_admin') ? disabledTooltip : 'Xem chi tiết'}>
              <span>
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  disabled={disabledActions && (u.role === 'admin' || u.role === 'super_admin')}
                  onClick={() => navigate(`/admin/users/${u._id}`)}
                />
              </span>
            </Tooltip>
            <Tooltip title={disabledActions ? disabledTooltip : 'Đổi vai trò'}>
              <span>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  disabled={disabledActions}
                  onClick={() => openEdit(u)}
                />
              </span>
            </Tooltip>
            <Tooltip title={disabledActions ? disabledTooltip : (u.isActive ? 'Khóa' : 'Mở khóa')}>
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
              title="Xác nhận xóa"
              description="Bạn có chắc chắn muốn xóa người dùng này?"
              onConfirm={() => handleDelete(u._id)}
              okText="Xóa"
              cancelText="Hủy"
              disabled={disabledActions}
            >
              <Tooltip title={disabledActions ? disabledTooltip : 'Xóa'}>
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
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Quản lý người dùng</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
          Tổng số người dùng: {users.length}
        </p>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
            <Input.Search
              placeholder="Tìm kiếm người dùng..."
              allowClear
              className="dashboard-search-input"
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            <Select
              placeholder="Lọc theo vai trò"
              allowClear
              style={{ minWidth: 160 }}
              onChange={(val) => {
                setRoleFilter(val || '')
                setPage(1)
              }}
              options={[
                { label: 'Super Admin', value: 'super_admin' },
                { label: 'Admin', value: 'admin' },
                { label: 'PT', value: 'pt' },
                { label: 'Staff', value: 'staff' },
                { label: 'Member', value: 'member' },
                { label: 'Seller', value: 'seller' },
              ]}
            />
            <Select
              placeholder="Tất cả trạng thái"
              allowClear
              style={{ minWidth: 160 }}
              onChange={(val) => {
                setStatusFilter(val || '')
                setPage(1)
              }}
              options={[
                { label: 'Đang hoạt động', value: 'active' },
                { label: 'Đã khóa', value: 'locked' },
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
        title={`Chỉnh sửa vai trò: ${editingUser?.name}`}
        open={!!editingUser}
        onCancel={() => setEditingUser(null)}
        footer={null}
        destroyOnHidden
      >
        <Form layout="vertical" form={form} onFinish={handleUpdateRole}>
          <Form.Item label="Role" name="role" rules={[{ required: true }]}>
            <Select
              options={
                currentUser?.role === 'super_admin'
                  ? [
                      { label: 'Super Admin', value: 'super_admin' },
                      { label: 'Admin', value: 'admin' },
                      { label: 'PT', value: 'pt' },
                      { label: 'Staff', value: 'staff' },
                      { label: 'Member', value: 'member' },
                      { label: 'Seller', value: 'seller' },
                    ]
                  : [
                      { label: 'PT', value: 'pt' },
                      { label: 'Staff', value: 'staff' },
                      { label: 'Member', value: 'member' },
                      { label: 'Seller', value: 'seller' },
                    ]
              }
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
