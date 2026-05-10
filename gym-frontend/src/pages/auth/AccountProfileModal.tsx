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
import { Avatar, Button, Checkbox, Empty, Form, Input, Modal, Space, Switch, Tabs, message } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeProvider'
import { useAuth } from '../../hook/useAuth'
import { createAddress, deleteAddress, getAddresses, setDefaultAddress, updateAddress } from '../../services/addressService'
import { authService } from '../../services/authService'

const getUsernameFromEmail = (email?: string | null) => {
  if (!email) return ''
  return email.includes('@') ? email.split('@')[0] : email
}

const profileModalClass =
  'max-w-[560px] max-[768px]:!top-0 max-[768px]:!m-0 max-[768px]:!w-screen max-[768px]:!max-w-none max-[768px]:!pb-0 [&_.ant-modal-content]:!overflow-hidden [&_.ant-modal-content]:!p-0 [&_.ant-modal-content]:!rounded-3xl max-[768px]:[&_.ant-modal-content]:!min-h-dvh max-[768px]:[&_.ant-modal-content]:!rounded-none [&_.ant-modal-content]:!border [&_.ant-modal-content]:!border-black/10 dark:[&_.ant-modal-content]:!border-white/[0.08] [&_.ant-modal-content]:!bg-white dark:[&_.ant-modal-content]:!bg-gray-900 [&_.ant-modal-content]:!shadow-2xl [&_.ant-modal-close]:!right-3.5 [&_.ant-modal-close]:!top-3.5 [&_.ant-modal-close]:!text-gray-500 dark:[&_.ant-modal-close]:!text-gray-400'

const profileModalWrapClass =
  '[&_.ant-modal-mask]:!bg-black/35 dark:[&_.ant-modal-mask]:!bg-black/60 [&_.ant-modal-mask]:backdrop-blur-[10px]'

const profileTabsClass =
  'sticky top-0 z-[2] bg-white pt-3 dark:bg-gray-900 [&_.ant-tabs-nav]:!mb-[18px] [&_.ant-tabs-nav:before]:!border-b-black/10 dark:[&_.ant-tabs-nav:before]:!border-b-white/[0.08] [&_.ant-tabs-tab]:!rounded-full [&_.ant-tabs-tab]:!px-3 [&_.ant-tabs-tab]:!py-[9px] [&_.ant-tabs-tab]:!text-gray-500 dark:[&_.ant-tabs-tab]:!text-gray-400 [&_.ant-tabs-tab]:!transition-colors [&_.ant-tabs-tab-active]:!bg-[#e53935]/10 [&_.ant-tabs-tab.ant-tabs-tab-active_.ant-tabs-tab-btn]:!text-[#e53935] [&_.ant-tabs-ink-bar]:!h-[3px] [&_.ant-tabs-ink-bar]:!rounded-full [&_.ant-tabs-ink-bar]:!bg-[#e53935] max-[768px]:[&_.ant-tabs-nav-wrap]:overflow-x-auto max-[768px]:[&_.ant-tabs-nav-wrap]:[scrollbar-width:none] max-[768px]:[&_.ant-tabs-nav-wrap::-webkit-scrollbar]:hidden max-[768px]:[&_.ant-tabs-nav-list]:min-w-max'

const profileFormClass =
  '[&_.ant-form-item-label>label]:!font-semibold [&_.ant-form-item-label>label]:!text-gray-900 dark:[&_.ant-form-item-label>label]:!text-gray-100 [&_.ant-input]:!min-h-[42px] [&_.ant-input]:!rounded-[14px] [&_.ant-input]:!border-black/10 dark:[&_.ant-input]:!border-white/[0.08] [&_.ant-input]:!bg-gray-100 dark:[&_.ant-input]:!bg-gray-800 [&_.ant-input]:!text-gray-900 dark:[&_.ant-input]:!text-gray-100 [&_.ant-input::placeholder]:!text-gray-500 dark:[&_.ant-input::placeholder]:!text-gray-400 [&_.ant-input-affix-wrapper]:!min-h-[42px] [&_.ant-input-affix-wrapper]:!rounded-[14px] [&_.ant-input-affix-wrapper]:!border-black/10 dark:[&_.ant-input-affix-wrapper]:!border-white/[0.08] [&_.ant-input-affix-wrapper]:!bg-gray-100 dark:[&_.ant-input-affix-wrapper]:!bg-gray-800 [&_.ant-input-affix-wrapper_input]:!bg-transparent [&_.ant-input-affix-wrapper_input]:!text-gray-900 dark:[&_.ant-input-affix-wrapper_input]:!text-gray-100 [&_.ant-input-affix-wrapper_input::placeholder]:!text-gray-500 dark:[&_.ant-input-affix-wrapper_input::placeholder]:!text-gray-400 [&_.ant-input:focus]:!border-[#e53935] [&_.ant-input:focus]:!shadow-[0_0_0_3px_rgba(229,57,53,0.16)] [&_.ant-input-focused]:!border-[#e53935] [&_.ant-input-focused]:!shadow-[0_0_0_3px_rgba(229,57,53,0.16)] [&_.ant-input-affix-wrapper-focused]:!border-[#e53935] [&_.ant-input-affix-wrapper-focused]:!shadow-[0_0_0_3px_rgba(229,57,53,0.16)] [&_.ant-input[disabled]]:!cursor-not-allowed [&_.ant-input[disabled]]:!bg-gray-100 dark:[&_.ant-input[disabled]]:!bg-gray-800 [&_.ant-input[disabled]]:!text-gray-500 dark:[&_.ant-input[disabled]]:!text-gray-400 [&_.ant-input-disabled]:!cursor-not-allowed [&_.ant-input-disabled]:!bg-gray-100 dark:[&_.ant-input-disabled]:!bg-gray-800 [&_.ant-input-disabled]:!text-gray-500 dark:[&_.ant-input-disabled]:!text-gray-400'

const primaryButtonClass =
  '!h-11 !rounded-full !border-0 !bg-[#e53935] !font-extrabold shadow-[0_14px_32px_rgba(229,57,53,0.22)] hover:!bg-[#c62828]'

const outlineButtonClass =
  '!min-h-[42px] !rounded-full !border-black/10 !bg-transparent !font-bold !text-gray-900 hover:!border-[#e53935]/30 hover:!text-[#e53935] dark:!border-white/[0.08] dark:!text-gray-100'

const addressActionButtonClass =
  'grid h-7 w-7 cursor-pointer place-items-center rounded-[7px] border border-black/10 bg-transparent text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-white/[0.08] dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 max-[480px]:h-[26px] max-[480px]:w-[26px]'

const addressEditModalClass =
  '[&_.ant-modal-content]:!rounded-3xl [&_.ant-modal-content]:!border [&_.ant-modal-content]:!border-black/10 dark:[&_.ant-modal-content]:!border-white/[0.08] [&_.ant-modal-content]:!bg-white dark:[&_.ant-modal-content]:!bg-gray-900 [&_.ant-modal-header]:!bg-transparent [&_.ant-modal-title]:!text-gray-900 dark:[&_.ant-modal-title]:!text-gray-100 [&_.ant-modal-close]:!text-gray-500 dark:[&_.ant-modal-close]:!text-gray-400'

export default function AccountProfileModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { user, updateUser, logout } = useAuth()
  const { dark, toggleTheme } = useTheme()
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
  const fileRef = useRef<HTMLInputElement>(null)
  const watchedEmail = Form.useWatch('email', form)

  const hasPassword = Boolean(user?.hasPassword || user?.password)

  const goToOrders = () => {
    onClose()
    navigate('/dashboard/member/orders')
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

  if (!user) return null

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
      onClose()
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
      onClose()
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

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={560}
      centered
      className={profileModalClass}
      wrapClassName={profileModalWrapClass}
    >
      <div className="text-gray-900 dark:text-gray-100">
        <header className="grid grid-cols-[auto_1fr] items-center gap-[18px] bg-gray-100 px-6 pb-[18px] pt-6 dark:bg-gray-950 max-[768px]:grid-cols-1 max-[768px]:justify-items-center max-[768px]:gap-3 max-[768px]:px-5 max-[768px]:pb-4 max-[768px]:pt-[26px] max-[768px]:text-center">
          <div className="cursor-pointer" onClick={() => fileRef.current?.click()}>
            <div className="group relative grid h-[100px] w-[100px] place-items-center rounded-full bg-[linear-gradient(135deg,#e53935,rgba(229,57,53,0.12))] p-[3px] max-[768px]:h-[92px] max-[768px]:w-[92px]">
              <Avatar
                size={92}
                src={
                  avatarPreview ||
                  user.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}`
                }
                icon={<UserOutlined />}
                className="!border-4 !border-gray-100 dark:!border-gray-950 max-[768px]:!h-[84px] max-[768px]:!w-[84px]"
              />
              <span className="absolute bottom-2 right-2.5 h-4 w-4 rounded-full border-[3px] border-gray-100 bg-[#22c55e] dark:border-gray-950" />
              <div className="absolute inset-[3px] grid place-items-center rounded-full bg-white/70 text-[22px] text-gray-900 opacity-0 transition-opacity duration-150 group-hover:opacity-100 dark:bg-gray-950/70 dark:text-gray-100">
                <CameraOutlined />
              </div>
            </div>
          </div>
          <div>
            <h2 className="mb-2 mt-0 text-xl font-extrabold text-gray-900 dark:text-gray-100">Thông tin tài khoản</h2>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{user.name}</div>
            <div className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-gray-500 dark:text-gray-400">
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

        <div className="max-h-[min(70vh,620px)] overflow-y-auto px-6 pb-6 [scrollbar-color:rgba(0,0,0,0.10)_transparent] [scrollbar-width:thin] dark:[scrollbar-color:rgba(255,255,255,0.08)_transparent] max-[768px]:max-h-[calc(100dvh-176px)] max-[768px]:px-4 max-[768px]:pb-5">
          <Tabs
            className={profileTabsClass}
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
                  <Input placeholder="Tên của bạn" />
                </Form.Item>

                <Form.Item label="Số điện thoại" name="phone">
                  <Input placeholder="Thêm số điện thoại" />
                </Form.Item>

                <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    { type: 'email', message: 'Email không hợp lệ' },
                    { required: !user.email, message: 'Nhập email' },
                  ]}
                >
                  <Input disabled={!!user.email} suffix={user.email ? <LockOutlined /> : null} placeholder="Thêm email" />
                </Form.Item>

                <Form.Item label="Username">
                  <Input disabled suffix={<LockOutlined />} value={getUsernameFromEmail(watchedEmail || user.email)} />
                </Form.Item>

                <Form.Item label="Ngày sinh" name="dateOfBirth" className="col-span-full">
                  <Input type="date" />
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
              </div>

              <Button
                block
                danger
                icon={<LogoutOutlined />}
                onClick={logout}
                className="!mt-[18px] !h-[42px] !rounded-full !border-[#e53935] !font-extrabold !text-[#e53935] hover:!border-[#e53935] hover:!bg-[#e53935]/10 hover:!text-[#e53935]"
              >
                Đăng xuất
              </Button>
            </Form>
          )}

          {activeTab === 'appearance' && (
            <div className="flex items-center justify-between gap-4 rounded-[18px] border border-black/10 bg-gray-100 p-4 dark:border-white/[0.08] dark:bg-gray-800 max-[768px]:flex-col max-[768px]:items-start">
              <div>
                <div className="font-extrabold text-gray-900 dark:text-gray-100">Chế độ giao diện</div>
                <div className="mt-[3px] text-[13px] text-gray-500 dark:text-gray-400">
                  {dark ? 'Đang dùng giao diện tối' : 'Đang dùng giao diện sáng'}
                </div>
              </div>
              <Switch
                checked={dark}
                checkedChildren="Tối"
                unCheckedChildren="Sáng"
                onChange={toggleTheme}
              />
            </div>
          )}

          {activeTab === 'addresses' && (
            <div className={`rounded-[18px] border border-black/10 bg-gray-100 p-4 dark:border-white/[0.08] dark:bg-gray-800 ${profileFormClass}`}>
              <div className="flex items-center justify-between gap-4 max-[768px]:flex-col max-[768px]:items-start">
                <div>
                  <div className="font-extrabold text-gray-900 dark:text-gray-100">Địa chỉ giao hàng</div>
                  <div className="mt-[3px] text-[13px] text-gray-500 dark:text-gray-400">Thêm, sửa, xóa và đặt mặc định địa chỉ.</div>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateAddress} loading={loading} className="!rounded-lg !border-0 !bg-[#e53935] !font-bold !text-white hover:!bg-[#c62828]">
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
                      className={`mb-2.5 flex items-start gap-3 rounded-xl border bg-white p-[14px_16px] dark:bg-gray-900 max-[480px]:gap-2.5 max-[480px]:p-3 ${address.isDefault ? 'border-[#e53935]/30' : 'border-black/10 dark:border-white/[0.08]'}`}
                      key={address._id}
                    >
                      <div className="grid h-9 w-9 flex-none place-items-center rounded-[9px] bg-gray-100 text-[#e53935] dark:bg-gray-800">
                        <EnvironmentOutlined />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-extrabold text-gray-900 dark:text-gray-100">{address.fullName}</span>
                          {address.isDefault && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#e53935]/30 bg-[#e53935]/10 px-2 py-0.5 text-[10px] font-medium text-[#e53935]">
                              <StarFilled />
                              Mặc định
                            </span>
                          )}
                        </div>
                        <div className="mt-[7px] inline-flex items-center gap-1.5 text-[13px] text-gray-500 dark:text-gray-400">
                          <PhoneOutlined />
                          <span>{address.phone}</span>
                        </div>
                        <div className="mt-1.5 text-xs leading-[1.45] text-gray-500 dark:text-gray-400">{fullAddress}</div>
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
                          className={`${addressActionButtonClass} hover:!border-[#e53935]/30 hover:!bg-[#e53935]/10 hover:!text-[#e53935]`}
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
              >
                <Form form={addressForm} layout="vertical" onFinish={handleSaveAddress} initialValues={{ isDefault: false }} className={profileFormClass}>
                  <Form.Item name="fullName" label="Tên người nhận" rules={[{ required: true, message: 'Vui lòng nhập tên người nhận' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }, { pattern: /^0\d{9,10}$/, message: 'Số điện thoại không hợp lệ' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="street" label="Địa chỉ cụ thể" rules={[{ required: true, message: 'Vui lòng nhập địa chỉ cụ thể' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="ward" label="Phường / xã">
                    <Input />
                  </Form.Item>
                  <Form.Item name="district" label="Quận / huyện" rules={[{ required: true, message: 'Vui lòng nhập quận/huyện' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="city" label="Tỉnh / thành phố" rules={[{ required: true, message: 'Vui lòng nhập tỉnh/thành phố' }]}>
                    <Input />
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
              <div className="mb-4 rounded-xl border border-[#e53935]/30 bg-[#e53935]/10 p-3 text-[13px] text-gray-900 dark:text-gray-100">
                Tài khoản chưa có mật khẩu riêng. Đặt mật khẩu để đăng nhập bằng số điện thoại/email.
              </div>

              <Form.Item label="Mật khẩu mới" name="newPassword" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
                <Input.Password placeholder="Tối thiểu 6 ký tự" />
              </Form.Item>

              <Form.Item label="Xác nhận mật khẩu" name="confirm" rules={[{ required: true, message: 'Xác nhận mật khẩu' }]}>
                <Input.Password placeholder="Nhập lại mật khẩu" />
              </Form.Item>

              <Button type="primary" htmlType="submit" block loading={loading} className={primaryButtonClass}>
                Đặt mật khẩu
              </Button>
            </Form>
          )}

          {activeTab === 'password' && hasPassword && (
            <Form layout="vertical" form={passwordForm} onFinish={handleChangePassword} className={profileFormClass}>
              <Form.Item label="Mật khẩu hiện tại" name="currentPassword" rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}>
                <Input.Password />
              </Form.Item>

              <Form.Item label="Mật khẩu mới" name="newPassword" rules={[{ required: true, message: 'Nhập mật khẩu mới' }]}>
                <Input.Password placeholder="Tối thiểu 6 ký tự" />
              </Form.Item>

              <Form.Item label="Xác nhận mật khẩu" name="confirm" rules={[{ required: true, message: 'Xác nhận mật khẩu' }]}>
                <Input.Password placeholder="Nhập lại mật khẩu mới" />
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
