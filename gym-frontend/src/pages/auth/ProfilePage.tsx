import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hook/useAuth'
import { useTheme } from '../../context/ThemeProvider'
import { authService } from '../../services/authService'
import { Button, Input, Tabs, message, Avatar, Form } from 'antd'
import { UploadOutlined } from '@ant-design/icons'

type Tab = 'info' | 'password'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const { dark } = useTheme()

  const [tab, setTab] = useState<Tab>('info')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  })

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirm: '',
  })

  const [newPasswordOnly, setNewPasswordOnly] = useState({
    newPassword: '',
    confirm: '',
  })

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const hasPassword = !!user?.password

  const getDashboardPath = (role: string) => {
    if (role === 'admin') return '/dashboard/admin'
    if (role === 'seller') return '/dashboard/seller/products'
    if (role === 'staff') return '/dashboard/staff'
    if (role === 'pt') return '/dashboard/pt'
    return '/dashboard/member'
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleUpdateProfile = async () => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', form.name)
      if (form.phone) formData.append('phone', form.phone)
      if (fileRef.current?.files?.[0]) {
        formData.append('avatar', fileRef.current.files[0])
      }

      const { data } = await authService.updateProfile(formData)
      updateUser(data.user)
      message.success('Cập nhật thành công')

      setTimeout(() => {
        navigate(getDashboardPath(data.user.role))
      }, 1000)
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Cập nhật thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleSetPassword = async () => {
    if (newPasswordOnly.newPassword !== newPasswordOnly.confirm) {
      message.error('Mật khẩu không khớp')
      return
    }

    setLoading(true)
    try {
      await authService.setPassword({ newPassword: newPasswordOnly.newPassword })
      message.success('Đặt mật khẩu thành công. Bạn có thể đăng nhập bằng số điện thoại + mật khẩu này.')
      updateUser({ ...user!, password: 'set' })
      setNewPasswordOnly({ newPassword: '', confirm: '' })
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Đặt mật khẩu thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwords.newPassword !== passwords.confirm) {
      message.error('Mật khẩu không khớp')
      return
    }

    setLoading(true)
    try {
      await authService.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      })
      message.success('Đổi mật khẩu thành công')
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' })
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Đổi mật khẩu thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleEnableSeller = async () => {
    setLoading(true)
    try {
      const { data } = await authService.enableSellerMode()
      updateUser(data.user)
      message.success('Đã bật chế độ bán hàng')
      navigate('/dashboard/seller/products')
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Bật bán hàng thất bại')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  // Màu theo theme
  const cardBg = dark ? '#1f1f1f' : '#ffffff'
  const textColor = dark ? '#ffffff' : '#111827'
  const subTextColor = dark ? '#9ca3af' : '#6b7280'

  return (
    <div
      className="relative flex min-h-screen items-center justify-center px-4 py-12 overflow-hidden"
      style={{ background: dark ? '#141414' : '#f3f4f6' }}
    >
      {/* BACKGROUND BLUR */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1600&q=80')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(8px)',
          transform: 'scale(1.1)',
        }}
      />

      {/* OVERLAY */}
      <div
        className="absolute inset-0 z-0"
        style={{ background: dark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)' }}
      />

      {/* CARD */}
      <div
        className="relative z-10 w-full max-w-md rounded-xl p-6 shadow-lg"
        style={{ background: cardBg }}
      >
        {/* AVATAR */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <Avatar
            size={80}
            src={
              avatarPreview ||
              user.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}`
            }
            className="cursor-pointer"
            onClick={() => fileRef.current?.click()}
          />

          <Button
            icon={<UploadOutlined />}
            size="small"
            onClick={() => fileRef.current?.click()}
          >
            Thay đổi avatar
          </Button>

          <input ref={fileRef} type="file" hidden onChange={handleAvatarChange} />

          <div className="font-semibold" style={{ color: textColor }}>{user.name}</div>
          <div className="text-xs" style={{ color: subTextColor }}>{user.email || user.phone}</div>
        </div>

        {/* TABS */}
        <Tabs
          activeKey={tab}
          onChange={(key) => setTab(key as Tab)}
          items={[
            { key: 'info', label: 'Thông tin' },
            { key: 'password', label: hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu' },
          ]}
        />

        {/* INFO */}
        {tab === 'info' && (
          <Form layout="vertical" onFinish={handleUpdateProfile}>
            <Form.Item label="Tên">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Form.Item>

            <Form.Item label="Số điện thoại">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Thêm số điện thoại"
              />
            </Form.Item>

            {user.email && (
              <Form.Item label="Username">
                <Input disabled value={user.email.split('@')[0]} />
              </Form.Item>
            )}

            {user.facebookProfileUrl && (
              <Form.Item label="Facebook Profile">
                <a 
                  href={user.facebookProfileUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  Xem trang cá nhân
                </a>
              </Form.Item>
            )}

            <Button type="primary" htmlType="submit" loading={loading} block>
              Lưu thay đổi
            </Button>

            {user.role !== 'seller' && (
              <Button style={{ marginTop: 12 }} block loading={loading} onClick={handleEnableSeller}>
                Bật chế độ bán hàng
              </Button>
            )}
          </Form>
        )}

        {/* PASSWORD — chưa có mật khẩu */}
        {tab === 'password' && !hasPassword && (
          <Form layout="vertical" onFinish={handleSetPassword}>
            <div
              className="mb-4 rounded-lg p-3 text-sm"
              style={{
                background: dark ? 'rgba(234,88,12,0.15)' : '#fff7ed',
                border: `1px solid ${dark ? 'rgba(234,88,12,0.3)' : '#fed7aa'}`,
                color: dark ? '#fb923c' : '#c2410c',
              }}
            >
              Tài khoản chưa có mật khẩu. Đặt mật khẩu để có thể đăng nhập bằng số điện thoại / username.
            </div>

            <Form.Item label="Mật khẩu mới" required>
              <Input.Password
                value={newPasswordOnly.newPassword}
                onChange={(e) =>
                  setNewPasswordOnly({ ...newPasswordOnly, newPassword: e.target.value })
                }
                placeholder="Tối thiểu 6 ký tự"
              />
            </Form.Item>

            <Form.Item label="Xác nhận mật khẩu" required>
              <Input.Password
                value={newPasswordOnly.confirm}
                onChange={(e) =>
                  setNewPasswordOnly({ ...newPasswordOnly, confirm: e.target.value })
                }
                placeholder="Nhập lại mật khẩu mới"
              />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={loading} block>
              Đặt mật khẩu
            </Button>
          </Form>
        )}

        {/* PASSWORD — đã có mật khẩu */}
        {tab === 'password' && hasPassword && (
          <Form layout="vertical" onFinish={handleChangePassword}>
            <Form.Item label="Mật khẩu hiện tại" required>
              <Input.Password
                value={passwords.currentPassword}
                onChange={(e) =>
                  setPasswords({ ...passwords, currentPassword: e.target.value })
                }
              />
            </Form.Item>

            <Form.Item label="Mật khẩu mới" required>
              <Input.Password
                value={passwords.newPassword}
                onChange={(e) =>
                  setPasswords({ ...passwords, newPassword: e.target.value })
                }
              />
            </Form.Item>

            <Form.Item label="Xác nhận mật khẩu" required>
              <Input.Password
                value={passwords.confirm}
                onChange={(e) =>
                  setPasswords({ ...passwords, confirm: e.target.value })
                }
              />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={loading} block>
              Đổi mật khẩu
            </Button>
          </Form>
        )}
      </div>
    </div>
  )
}
