import {
  CameraOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  LockOutlined,
  LogoutOutlined,
  PhoneOutlined,
  PlusOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  StarFilled,
  StarOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Checkbox, Empty, Form, Input, Modal, Space, Tabs, message, theme } from 'antd'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateTheme, PRESET_ACCENT_COLORS, useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../hook/useAuth'
import { createAddress, deleteAddress, getAddresses, setDefaultAddress, updateAddress } from '../../services/addressService'
import { authService } from '../../services/authService'

const getUsernameFromEmail = (email?: string | null) => {
  if (!email) return ''
  return email.includes('@') ? email.split('@')[0] : email
}

const profileModalClass =
  'max-w-[560px] max-[768px]:!top-0 max-[768px]:!m-0 max-[768px]:!w-screen max-[768px]:!max-w-none max-[768px]:!pb-0 [&_.ant-modal-content]:!overflow-hidden [&_.ant-modal-content]:!p-0 [&_.ant-modal-content]:!rounded-3xl max-[768px]:[&_.ant-modal-content]:!min-h-dvh max-[768px]:[&_.ant-modal-content]:!rounded-none [&_.ant-modal-content]:!border [&_.ant-modal-content]:!border-[var(--profile-border)] [&_.ant-modal-content]:!bg-[var(--profile-bg-elevated)] [&_.ant-modal-content]:!shadow-2xl [&_.ant-modal-close]:!right-3.5 [&_.ant-modal-close]:!top-3.5 [&_.ant-modal-close]:!text-[var(--profile-text-secondary)]'

const profileModalWrapClass =
  '[&_.ant-modal-mask]:!bg-[var(--profile-mask)] [&_.ant-modal-mask]:backdrop-blur-[10px]'

const profileTabsClass =
  'sticky top-0 z-[2] bg-[var(--profile-bg-elevated)] pt-3 [&_.ant-tabs-nav]:!mb-[18px] [&_.ant-tabs-nav:before]:!border-b-[var(--profile-border)] [&_.ant-tabs-tab]:!rounded-full [&_.ant-tabs-tab]:!px-3 [&_.ant-tabs-tab]:!py-[9px] [&_.ant-tabs-tab]:!text-[var(--profile-text-secondary)] [&_.ant-tabs-tab]:!transition-colors [&_.ant-tabs-tab-active]:!bg-[var(--profile-accent-bg)] [&_.ant-tabs-tab.ant-tabs-tab-active_.ant-tabs-tab-btn]:!text-[var(--profile-accent)] [&_.ant-tabs-ink-bar]:!h-[3px] [&_.ant-tabs-ink-bar]:!rounded-full [&_.ant-tabs-ink-bar]:!bg-[var(--profile-accent)] max-[768px]:[&_.ant-tabs-nav-wrap]:overflow-x-auto max-[768px]:[&_.ant-tabs-nav-wrap]:[scrollbar-width:none] max-[768px]:[&_.ant-tabs-nav-wrap::-webkit-scrollbar]:hidden max-[768px]:[&_.ant-tabs-nav-list]:min-w-max'

const profileFormClass =
  '[&_.ant-form-item-label>label]:!font-semibold [&_.ant-form-item-label>label]:!text-[var(--profile-text)] [&_.ant-input]:!min-h-[42px] [&_.ant-input]:!rounded-[14px] [&_.ant-input]:!border-[var(--profile-border)] [&_.ant-input]:!bg-[var(--profile-bg-container)] [&_.ant-input]:!text-[var(--profile-text)] [&_.ant-input::placeholder]:!text-[var(--theme-placeholder)] [&_.ant-input-affix-wrapper]:!min-h-[42px] [&_.ant-input-affix-wrapper]:!rounded-[14px] [&_.ant-input-affix-wrapper]:!border-[var(--profile-border)] [&_.ant-input-affix-wrapper]:!bg-[var(--profile-bg-container)] [&_.ant-input-affix-wrapper_input]:!bg-transparent [&_.ant-input-affix-wrapper_input]:!text-[var(--profile-text)] [&_.ant-input-affix-wrapper_input::placeholder]:!text-[var(--theme-placeholder)] [&_.ant-input:focus]:!border-[var(--profile-accent)] [&_.ant-input:focus]:!shadow-none [&_.ant-input-focused]:!border-[var(--profile-accent)] [&_.ant-input-focused]:!shadow-none [&_.ant-input-affix-wrapper-focused]:!border-[var(--profile-accent)] [&_.ant-input-affix-wrapper-focused]:!shadow-none [&_.ant-input[disabled]]:!cursor-not-allowed [&_.ant-input[disabled]]:!bg-[var(--theme-elevated)] [&_.ant-input[disabled]]:!text-[var(--theme-muted)] [&_.ant-input-disabled]:!cursor-not-allowed [&_.ant-input-disabled]:!bg-[var(--theme-elevated)] [&_.ant-input-disabled]:!text-[var(--theme-muted)]'

const primaryButtonClass =
  '!h-11 !rounded-full !border-0 !bg-[var(--profile-accent)] !font-extrabold !text-[var(--theme-button-text)] !shadow-none hover:!bg-[var(--profile-accent-hover)]'

const outlineButtonClass =
  '!min-h-[42px] !rounded-full !border-[var(--profile-border)] !bg-transparent !font-bold !text-[var(--profile-text)] hover:!border-[var(--profile-accent-border)] hover:!text-[var(--profile-accent)]'

const addressActionButtonClass =
  'grid h-7 w-7 cursor-pointer place-items-center rounded-[7px] border border-[var(--profile-border)] bg-transparent text-[var(--profile-text-secondary)] transition-colors hover:bg-[var(--profile-bg-container)] hover:text-[var(--profile-text)] max-[480px]:h-[26px] max-[480px]:w-[26px]'

const addressEditModalClass =
  '[&_.ant-modal-content]:!rounded-3xl [&_.ant-modal-content]:!border [&_.ant-modal-content]:!border-[var(--profile-border)] [&_.ant-modal-content]:!bg-[var(--profile-bg-elevated)] [&_.ant-modal-header]:!bg-transparent [&_.ant-modal-title]:!text-[var(--profile-text)] [&_.ant-modal-close]:!text-[var(--profile-text-secondary)]'

const profileInputStyle = {
  background: 'var(--theme-input-bg)',
  borderColor: 'var(--theme-border-strong)',
  color: 'var(--theme-text)',
} as CSSProperties

const profileDisabledInputStyle = {
  background: 'var(--theme-elevated)',
  borderColor: 'var(--theme-border-strong)',
  color: 'var(--theme-muted)',
  opacity: 0.8,
} as CSSProperties

export default function AccountProfileModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { user, updateUser, logout } = useAuth()
  const { applyAccentFast, applyThemeFull, commitPending, accentColor: savedAccentColor } = useTheme()
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [addressForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('info')
  const [addresses, setAddresses] = useState<any[]>([])
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [editAddress, setEditAddress] = useState<any>(null)
  const [accentColor, setAccentColor] = useState(savedAccentColor)
  const fileRef = useRef<HTMLInputElement>(null)
  const watchedEmail = Form.useWatch('email', form)
  const previewTheme = generateTheme(accentColor)

  const hasPassword = Boolean(user?.hasPassword || user?.password)

  const goToOrders = () => {
    handleClose()
    navigate('/dashboard/member/orders')
  }

  const goToChannel = () => {
    if (!user?._id) return
    handleClose()
    navigate(`/channel/${user._id}`)
  }

  const handlePresetSelect = (hex: string) => {
    setAccentColor(hex)
    applyThemeFull(hex)
  }

  const handleAccentPreview = (hex: string) => {
    setAccentColor(hex)
    applyAccentFast(hex)
  }

  const handleAccentCommit = (hex = accentColor) => {
    setAccentColor(hex)
    applyThemeFull(hex)
  }

  const handleLogout = () => {
    logout()
  }

  const handleClose = () => {
    commitPending()
    onClose()
  }

  useEffect(() => {
    if (!open || !user) return
    form.setFieldsValue({
      name: user.name,
      email: user.email || '',
      phone: user.phone || '',
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : '',
    })
    setAvatarPreview(null)
    setActiveTab('info')
    passwordForm.resetFields()
    addressForm.resetFields()
    setEditAddress(null)
    setAddresses([])
  }, [open, user, form, passwordForm, addressForm])

  useEffect(() => {
    if (open) {
      setAccentColor(savedAccentColor)
    }
  }, [open, savedAccentColor])

  if (!user) return null

  const profileThemeStyle = {
    '--profile-bg-layout': token.colorBgLayout,
    '--profile-bg-container': 'var(--theme-input-bg)',
    '--profile-bg-elevated': token.colorBgElevated,
    '--profile-text': token.colorText,
    '--profile-text-secondary': token.colorTextSecondary,
    '--profile-border': 'var(--theme-border-strong)',
    '--profile-mask': token.colorBgMask,
    '--profile-accent': 'var(--theme-accent)',
    '--profile-accent-hover': 'var(--theme-accent-hover)',
    '--profile-accent-bg': 'var(--theme-accent-muted)',
    '--profile-accent-border': 'var(--theme-accent-border)',
    '--profile-success': token.colorSuccess,
  } as CSSProperties

  const handleSave = async (values: any) => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', values.name || '')
      if (values.email) formData.append('email', values.email)
      if (values.phone) formData.append('phone', values.phone)
      if (values.dateOfBirth) formData.append('dateOfBirth', values.dateOfBirth)
      if (fileRef.current?.files?.[0]) {
        formData.append('avatar', fileRef.current.files[0])
      }
      const { data } = await authService.updateProfile(formData)
      updateUser(data.user)
      message.success('Cập nhật tài khoản thành công')
      handleClose()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Cập nhật thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleSetPassword = async (values: any) => {
    if (values.newPassword !== values.confirm) {
      message.error('Mật khẩu không khớp')
      return
    }
    setLoading(true)
    try {
      await authService.setPassword({ newPassword: values.newPassword })
      message.success('Đặt mật khẩu thành công')
      updateUser({ ...user!, hasPassword: true, password: 'set' })
      passwordForm.resetFields()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Đặt mật khẩu thất bại')
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
      handleClose()
      window.location.href = '/dashboard/seller/products'
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Bật bán hàng thất bại')
    } finally {
      setLoading(false)
    }
  }

  const loadAddresses = async () => {
    if (!user) return
    try {
      const res = await getAddresses()
      setAddresses(res.data.data)
    } catch (err) {
      console.error(err)
    }
  }

  const openCreateAddress = () => {
    setEditAddress(null)
    addressForm.resetFields()
    setAddressModalOpen(true)
  }

  const openEditAddress = (address: any) => {
    setEditAddress(address)
    addressForm.setFieldsValue(address)
    setAddressModalOpen(true)
  }

  const handleSaveAddress = async (values: any) => {
    setLoading(true)
    try {
      if (editAddress) {
        await updateAddress(editAddress._id, values)
        message.success('Cập nhật địa chỉ thành công')
      } else {
        await createAddress({ ...values, isDefault: true })
        message.success('Đã thêm địa chỉ mới')
      }
      setAddressModalOpen(false)
      await loadAddresses()
    } catch (err: any) {
      console.error(err)
      message.error(err.response?.data?.message || 'Lưu địa chỉ thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAddress = async (addressId: string) => {
    setLoading(true)
    try {
      await deleteAddress(addressId)
      message.success('Xóa địa chỉ thành công')
      await loadAddresses()
    } catch (err: any) {
      console.error(err)
      message.error(err.response?.data?.message || 'Xóa địa chỉ thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleSetDefault = async (addressId: string) => {
    setLoading(true)
    try {
      await setDefaultAddress(addressId)
      message.success('Đã đặt địa chỉ mặc định')
      await loadAddresses()
    } catch (err: any) {
      console.error(err)
      message.error(err.response?.data?.message || 'Không thể đặt mặc định')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (values: any) => {
    if (values.newPassword !== values.confirm) {
      message.error('Mật khẩu không khớp')
      return
    }
    setLoading(true)
    try {
      await authService.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      message.success('Đổi mật khẩu thành công')
      passwordForm.resetFields()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Đổi mật khẩu thất bại')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && activeTab === 'addresses') {
      loadAddresses()
    }
  }, [open, activeTab])

  useEffect(() => {
    return () => {
      commitPending()
    }
  }, [])

  return (
    <Modal
      title={null}
      open={open}
      onCancel={handleClose}
      footer={null}
      maskClosable={false}
      destroyOnClose
      width={560}
      centered
      className={profileModalClass}
      wrapClassName={profileModalWrapClass}
      style={profileThemeStyle}
    >
      <div style={{ ...profileThemeStyle, color: token.colorText }}>
        <header
          className="grid grid-cols-[auto_1fr] items-center gap-[18px] px-6 pb-[18px] pt-6 max-[768px]:grid-cols-1 max-[768px]:justify-items-center max-[768px]:gap-3 max-[768px]:px-5 max-[768px]:pb-4 max-[768px]:pt-[26px] max-[768px]:text-center"
          style={{ backgroundColor: token.colorBgLayout }}
        >
          <div className="cursor-pointer" onClick={() => fileRef.current?.click()}>
            <div
              className="group relative grid h-[100px] w-[100px] place-items-center rounded-full p-[3px] max-[768px]:h-[92px] max-[768px]:w-[92px]"
              style={{ background: 'linear-gradient(135deg, var(--profile-accent), var(--profile-accent-bg))' }}
            >
              <Avatar
                size={92}
                src={
                  avatarPreview ||
                  user.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}`
                }
                icon={<UserOutlined />}
                className="!border-4 max-[768px]:!h-[84px] max-[768px]:!w-[84px]"
                style={{ borderColor: token.colorBgLayout }}
              />
              <span className="absolute bottom-2 right-2.5 h-4 w-4 rounded-full border-[3px]" style={{ backgroundColor: token.colorSuccess, borderColor: token.colorBgLayout }} />
              <div
                className="absolute inset-[3px] grid place-items-center rounded-full text-[22px] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                style={{ backgroundColor: token.colorBgLayout, color: token.colorText }}
              >
                <CameraOutlined />
              </div>
            </div>
          </div>
          <div>
            <h2 className="mb-2 mt-0 text-xl font-extrabold" style={{ color: token.colorText }}>Thông tin tài khoản</h2>
            <div className="text-lg font-bold" style={{ color: token.colorText }}>{user.name}</div>
            <div className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px]" style={{ color: token.colorTextSecondary }}>
              {user.email || user.phone || 'Chưa cập nhật email'}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setAvatarPreview(URL.createObjectURL(file))
            }}
          />
        </header>

        <div
          className="max-h-[min(70vh,620px)] overflow-y-auto px-6 pb-6 [scrollbar-width:thin] max-[768px]:max-h-[calc(100dvh-176px)] max-[768px]:px-4 max-[768px]:pb-5"
          style={{ scrollbarColor: `${token.colorBorder} transparent` }}
        >
          <Tabs
            className={profileTabsClass}
            style={{ color: 'var(--theme-text)' }}
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              { key: 'info', label: 'Thông tin' },
              { key: 'addresses', label: 'Địa chỉ' },
              { key: 'password', label: hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu' },
              { key: 'appearance', label: 'Giao diện' },
            ]}
          />

          {activeTab === 'info' && (
            <Form layout="vertical" form={form} onFinish={handleSave} className={profileFormClass}>
              <div className="grid grid-cols-2 gap-x-3.5 max-[768px]:grid-cols-1">
                <Form.Item label="Tên tài khoản" name="name" rules={[{ required: true, message: 'Nhập tên' }]}>
                  <Input placeholder="Tên của bạn" style={profileInputStyle} />
                </Form.Item>

                <Form.Item label="Số điện thoại" name="phone">
                  <Input placeholder="Thêm số điện thoại" style={profileInputStyle} />
                </Form.Item>

                <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    { type: 'email', message: 'Email không hợp lệ' },
                    { required: !user.email, message: 'Nhập email' },
                  ]}
                >
                  <Input disabled={!!user.email} suffix={user.email ? <LockOutlined /> : null} placeholder="Thêm email" style={user.email ? profileDisabledInputStyle : profileInputStyle} />
                </Form.Item>

                <Form.Item label="Username">
                  <Input disabled suffix={<LockOutlined />} value={getUsernameFromEmail(watchedEmail || user.email)} style={profileDisabledInputStyle} />
                </Form.Item>

                <Form.Item label="Ngày sinh" name="dateOfBirth" className="col-span-full">
                  <Input type="date" style={profileInputStyle} />
                </Form.Item>
              </div>

              <Button type="primary" htmlType="submit" block loading={loading} className={primaryButtonClass}>
                Lưu thay đổi
              </Button>

              <div className="mt-3.5 grid grid-cols-2 gap-3 max-[768px]:grid-cols-1">
                {user.role !== 'seller' && (
                  <Button
                    block
                    icon={<ShopOutlined />}
                    loading={loading}
                    onClick={handleEnableSeller}
                    className={outlineButtonClass}
                  >
                    Bật chế độ bán hàng
                  </Button>
                )}

                <Button
                  block
                  icon={<ShoppingCartOutlined />}
                  onClick={goToOrders}
                  className={outlineButtonClass}
                >
                  Các đơn hàng
                </Button>

                <Button
                  block
                  icon={<UserOutlined />}
                  onClick={goToChannel}
                  className={outlineButtonClass}
                >
                  Xem kênh
                </Button>
              </div>

              <Button
                block
                danger
                icon={<LogoutOutlined />}
                onClick={handleLogout}
                style={{
                  marginTop: 8,
                  height: 40,
                  borderRadius: 8,
                  background: 'transparent',
                  borderColor: '#e05a30',
                  color: '#e05a30',
                  fontWeight: 500,
                }}
              >
                Đăng xuất
              </Button>
            </Form>
          )}

          {activeTab === 'appearance' && (
            <div
              className="rounded-[18px] border p-4"
              style={{ backgroundColor: token.colorBgContainer, borderColor: 'var(--theme-border-strong)' }}
            >
              <div className="flex items-start justify-between gap-4 max-[560px]:flex-col">
                <div>
                  <div className="font-extrabold" style={{ color: token.colorText }}>Màu chủ đạo</div>
                  <div className="mt-[3px] text-[13px]" style={{ color: token.colorTextSecondary }}>
                    Tuỳ chỉnh màu sắc theo sở thích
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {[
                    { label: 'Nền', color: previewTheme.bg },
                    { label: 'Card', color: previewTheme.card },
                    { label: 'Text', color: previewTheme.text },
                  ].map((item) => (
                    <span
                      key={item.label}
                      className="h-8 w-8 rounded-lg border"
                      title={item.label}
                      style={{ backgroundColor: item.color, borderColor: 'var(--theme-border-strong)' }}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3 max-[560px]:flex-wrap">
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  style={{ position: 'relative', zIndex: 9999 }}
                >
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(event) => {
                      const hex = event.target.value
                      handleAccentPreview(hex)
                    }}
                    onBlur={(event) => handleAccentCommit(event.target.value)}
                    onMouseUp={(event) => handleAccentCommit(event.currentTarget.value)}
                    onPointerUp={(event) => handleAccentCommit(event.currentTarget.value)}
                    onTouchEnd={(event) => handleAccentCommit(event.currentTarget.value)}
                    className="h-11 w-16 cursor-pointer rounded-xl border bg-transparent p-1"
                    style={{ borderColor: 'var(--theme-border-strong)' }}
                    aria-label="Chọn màu chủ đạo"
                  />
                </div>
                <div className="font-semibold" style={{ color: token.colorText }}>{accentColor.toUpperCase()}</div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {PRESET_ACCENT_COLORS.map((item) => (
                  <button
                    key={item.color}
                    type="button"
                    onClick={() => handlePresetSelect(item.color)}
                    className="h-8 w-8 cursor-pointer rounded-full border transition-transform duration-150 hover:scale-110"
                    style={{
                      backgroundColor: item.color,
                      borderColor: accentColor === item.color ? '#ffffff' : token.colorBorder,
                    }}
                    aria-label={`Chọn màu ${item.label}`}
                    title={item.label}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'addresses' && (
            <div
              className={`rounded-[18px] border p-4 ${profileFormClass}`}
              style={{ backgroundColor: token.colorBgContainer, borderColor: 'var(--theme-border-strong)' }}
            >
              <div className="flex items-center justify-between gap-4 max-[768px]:flex-col max-[768px]:items-start">
                <div>
                  <div className="font-extrabold" style={{ color: token.colorText }}>Địa chỉ giao hàng</div>
                  <div className="mt-[3px] text-[13px]" style={{ color: token.colorTextSecondary }}>Thêm, sửa, xóa và đặt mặc định địa chỉ.</div>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateAddress} loading={loading} className="!rounded-lg !border-0 !bg-[var(--profile-accent)] !font-bold !text-[var(--theme-button-text)] hover:!bg-[var(--profile-accent-hover)]">
                  Thêm địa chỉ
                </Button>
              </div>

              <div className="mt-4">
                {addresses.length === 0 ? (
                  <Empty description="Chưa có địa chỉ giao hàng" />
                ) : addresses.map((address) => {
                  const fullAddress = [
                    address.street,
                    address.ward,
                    address.district,
                    address.city,
                  ].filter(Boolean).join(', ')

                  return (
                    <div
                      className="mb-2.5 flex items-start gap-3 rounded-xl border p-[14px_16px] max-[480px]:gap-2.5 max-[480px]:p-3"
                      key={address._id}
                      style={{
                        backgroundColor: token.colorBgElevated,
                        borderColor: address.isDefault ? 'var(--profile-accent-border)' : 'var(--theme-border-strong)',
                      }}
                    >
                      <div className="grid h-9 w-9 flex-none place-items-center rounded-[9px]" style={{ backgroundColor: token.colorBgContainer, color: 'var(--profile-accent)' }}>
                        <EnvironmentOutlined />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-extrabold" style={{ color: token.colorText }}>{address.fullName}</span>
                          {address.isDefault && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundColor: 'var(--profile-accent-bg)',
                                borderColor: 'var(--profile-accent-border)',
                                color: 'var(--profile-accent)',
                              }}
                            >
                              <StarFilled />
                              Mặc định
                            </span>
                          )}
                        </div>
                        <div className="mt-[7px] inline-flex items-center gap-1.5 text-[13px]" style={{ color: token.colorTextSecondary }}>
                          <PhoneOutlined />
                          <span>{address.phone}</span>
                        </div>
                        <div className="mt-1.5 text-xs leading-[1.45]" style={{ color: token.colorTextSecondary }}>{fullAddress}</div>
                      </div>
                      <div className="ml-auto flex items-center gap-1.5 max-[480px]:flex-col max-[480px]:gap-1">
                        {!address.isDefault && (
                          <button
                            className={addressActionButtonClass}
                            type="button"
                            title="Đặt mặc định"
                            onClick={() => handleSetDefault(address._id)}
                          >
                            <StarOutlined />
                          </button>
                        )}
                        <button
                          className={addressActionButtonClass}
                          type="button"
                          title="Sửa địa chỉ"
                          onClick={() => openEditAddress(address)}
                        >
                          <EditOutlined />
                        </button>
                        <button
                          className={`${addressActionButtonClass} hover:!border-[var(--profile-accent-border)] hover:!bg-[var(--profile-accent-bg)] hover:!text-[var(--profile-accent)]`}
                          type="button"
                          title="Xóa địa chỉ"
                          onClick={() => handleDeleteAddress(address._id)}
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <Modal
                title={editAddress ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}
                open={addressModalOpen}
                onCancel={() => setAddressModalOpen(false)}
                footer={null}
                destroyOnClose
                className={addressEditModalClass}
                style={profileThemeStyle}
              >
                <Form form={addressForm} layout="vertical" onFinish={handleSaveAddress} initialValues={{ isDefault: false }} className={profileFormClass}>
                  <Form.Item name="fullName" label="Tên người nhận" rules={[{ required: true, message: 'Vui lòng nhập tên người nhận' }]}>
                    <Input style={profileInputStyle} />
                  </Form.Item>
                  <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }, { pattern: /^0\d{9,10}$/, message: 'Số điện thoại không hợp lệ' }]}>
                    <Input style={profileInputStyle} />
                  </Form.Item>
                  <Form.Item name="street" label="Địa chỉ cụ thể" rules={[{ required: true, message: 'Vui lòng nhập địa chỉ cụ thể' }]}>
                    <Input style={profileInputStyle} />
                  </Form.Item>
                  <Form.Item name="ward" label="Phường / xã">
                    <Input style={profileInputStyle} />
                  </Form.Item>
                  <Form.Item name="district" label="Quận / huyện" rules={[{ required: true, message: 'Vui lòng nhập quận/huyện' }]}>
                    <Input style={profileInputStyle} />
                  </Form.Item>
                  <Form.Item name="city" label="Tỉnh / thành phố" rules={[{ required: true, message: 'Vui lòng nhập tỉnh/thành phố' }]}>
                    <Input style={profileInputStyle} />
                  </Form.Item>
                  <Form.Item name="isDefault" valuePropName="checked">
                    <Checkbox>Đặt mặc định</Checkbox>
                  </Form.Item>
                  <Form.Item>
                    <Space>
                      <Button type="primary" htmlType="submit" loading={loading}>Lưu</Button>
                      <Button onClick={() => setAddressModalOpen(false)}>Hủy</Button>
                    </Space>
                  </Form.Item>
                </Form>
              </Modal>
            </div>
          )}

          {activeTab === 'password' && !hasPassword && (
            <Form layout="vertical" form={passwordForm} onFinish={handleSetPassword} className={profileFormClass}>
              <div
                className="mb-4 rounded-xl border p-3 text-[13px]"
                style={{ backgroundColor: 'var(--profile-accent-bg)', borderColor: 'var(--profile-accent-border)', color: token.colorText }}
              >
                Tài khoản chưa có mật khẩu riêng. Đặt mật khẩu để đăng nhập bằng số điện thoại/email.
              </div>

              <Form.Item label="Mật khẩu mới" name="newPassword" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
                <Input.Password placeholder="Tối thiểu 6 ký tự" style={profileInputStyle} />
              </Form.Item>

              <Form.Item label="Xác nhận mật khẩu" name="confirm" rules={[{ required: true, message: 'Xác nhận mật khẩu' }]}>
                <Input.Password placeholder="Nhập lại mật khẩu" style={profileInputStyle} />
              </Form.Item>

              <Button type="primary" htmlType="submit" block loading={loading} className={primaryButtonClass}>
                Đặt mật khẩu
              </Button>
            </Form>
          )}

          {activeTab === 'password' && hasPassword && (
            <Form layout="vertical" form={passwordForm} onFinish={handleChangePassword} className={profileFormClass}>
              <Form.Item label="Mật khẩu hiện tại" name="currentPassword" rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}>
                <Input.Password style={profileInputStyle} />
              </Form.Item>

              <Form.Item label="Mật khẩu mới" name="newPassword" rules={[{ required: true, message: 'Nhập mật khẩu mới' }]}>
                <Input.Password placeholder="Tối thiểu 6 ký tự" style={profileInputStyle} />
              </Form.Item>

              <Form.Item label="Xác nhận mật khẩu" name="confirm" rules={[{ required: true, message: 'Xác nhận mật khẩu' }]}>
                <Input.Password placeholder="Nhập lại mật khẩu mới" style={profileInputStyle} />
              </Form.Item>

              <Button type="primary" htmlType="submit" block loading={loading} className={primaryButtonClass}>
                Đổi mật khẩu
              </Button>
            </Form>
          )}
        </div>
      </div>
    </Modal>
  )
}
