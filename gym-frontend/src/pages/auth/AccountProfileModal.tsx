import { ShopOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar, Button, Checkbox, Form, Input, Modal, Space, Table, Tabs, Tag, message } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hook/useAuth'
import { createAddress, deleteAddress, getAddresses, setDefaultAddress, updateAddress } from '../../services/addressService'
import { authService } from '../../services/authService'

const getUsernameFromEmail = (email?: string | null) => {
  if (!email) return ''
  return email.includes('@') ? email.split('@')[0] : email
}

export default function AccountProfileModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { user, updateUser } = useAuth()
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
      title="Thông tin tài khoản"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={640}
      style={{ maxWidth: 'calc(100vw - 24px)' }}
    >
      {/* AVATAR */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <div style={{ textAlign: 'center' }}>
          <Avatar
            size={84}
            src={
              avatarPreview ||
              user.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}`
            }
            icon={<UserOutlined />}
            style={{ cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()}
          />
          <div style={{ marginTop: 10 }}>
            <Button size="small" icon={<UploadOutlined />} onClick={() => fileRef.current?.click()}>
              Đổi avatar
            </Button>
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
        </div>
      </div>

      {/* TABS */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'info', label: 'Thông tin' },
          { key: 'addresses', label: 'Địa chỉ' },
          { key: 'password', label: hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu' },
        ]}
      />

      {/* TAB THÔNG TIN */}
      {activeTab === 'info' && (
        <Form layout="vertical" form={form} onFinish={handleSave}>
          <Form.Item label="Tên tài khoản" name="name" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[
              { type: 'email', message: 'Email không hợp lệ' },
              { required: !user.email, message: 'Nhập email' },
            ]}
          >
            <Input disabled={!!user.email} placeholder="Thêm email" />
          </Form.Item>

          <Form.Item label="Username">
            <Input disabled value={getUsernameFromEmail(watchedEmail || user.email)} />
          </Form.Item>

          <Form.Item label="Số điện thoại" name="phone">
            <Input placeholder="Thêm số điện thoại" />
          </Form.Item>

          <Form.Item label="Ngày sinh" name="dateOfBirth">
            <Input type="date" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={loading}>
            Lưu thay đổi
          </Button>

          {user.role !== 'seller' && (
            <Button
              block
              icon={<ShopOutlined />}
              loading={loading}
              onClick={handleEnableSeller}
              style={{ marginTop: 12 }}
            >
              Bật chế độ bán hàng
            </Button>
          )}
        </Form>
      )}

      {/* TAB ĐỊA CHỈ */}
      {activeTab === 'addresses' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Địa chỉ giao hàng</div>
              <div style={{ color: '#888' }}>Thêm, sửa, xóa và đặt mặc định địa chỉ.</div>
            </div>
            <Button type="primary" onClick={openCreateAddress} loading={loading}>
              Thêm địa chỉ
            </Button>
          </div>

          <Table
            rowKey="_id"
            dataSource={addresses}
            loading={loading}
            pagination={false}
            scroll={{ x: 720 }}
            columns={[
              {
                title: 'Người nhận',
                dataIndex: 'fullName',
                key: 'fullName',
              },
              {
                title: 'SĐT',
                dataIndex: 'phone',
                key: 'phone',
              },
              {
                title: 'Địa chỉ',
                key: 'address',
                render: (_: any, record: any) => (
                  <div>
                    <div>{record.street}{record.ward ? `, ${record.ward}` : ''}</div>
                    <div>{record.district}, {record.city}</div>
                  </div>
                ),
              },
              {
                title: 'Mặc định',
                key: 'isDefault',
                render: (_: any, record: any) => record.isDefault ? <Tag color="green">Mặc định</Tag> : null,
              },
              {
                title: 'Hành động',
                key: 'actions',
                render: (_: any, record: any) => (
                  <Space>
                    <Button type="link" onClick={() => openEditAddress(record)}>Sửa</Button>
                    <Button type="link" danger onClick={() => handleDeleteAddress(record._id)}>Xóa</Button>
                    {!record.isDefault && (
                      <Button type="link" onClick={() => handleSetDefault(record._id)}>Đặt mặc định</Button>
                    )}
                  </Space>
                ),
              },
            ]}
          />

          <Modal
            title={editAddress ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}
            open={addressModalOpen}
            onCancel={() => setAddressModalOpen(false)}
            footer={null}
            destroyOnClose
          >
            <Form form={addressForm} layout="vertical" onFinish={handleSaveAddress} initialValues={{ isDefault: false }}>
              <Form.Item
                name="fullName"
                label="Tên người nhận"
                rules={[{ required: true, message: 'Vui lòng nhập tên người nhận' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="phone"
                label="Số điện thoại"
                rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }, { pattern: /^0\d{9,10}$/, message: 'Số điện thoại không hợp lệ' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="street"
                label="Địa chỉ cụ thể"
                rules={[{ required: true, message: 'Vui lòng nhập địa chỉ cụ thể' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="ward" label="Phường / xã">
                <Input />
              </Form.Item>
              <Form.Item
                name="district"
                label="Quận / huyện"
                rules={[{ required: true, message: 'Vui lòng nhập quận/huyện' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="city"
                label="Tỉnh / thành phố"
                rules={[{ required: true, message: 'Vui lòng nhập tỉnh/thành phố' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="isDefault" valuePropName="checked">
                <Checkbox>Đặt mặc định</Checkbox>
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    Lưu
                  </Button>
                  <Button onClick={() => setAddressModalOpen(false)}>Hủy</Button>
                </Space>
              </Form.Item>
            </Form>
          </Modal>
        </div>
      )}

      {/* TAB MẬT KHẨU — chưa có */}
      {activeTab === 'password' && !hasPassword && (
        <Form layout="vertical" form={passwordForm} onFinish={handleSetPassword}>
          <div style={{
            marginBottom: 16, padding: 12, borderRadius: 8,
            background: 'rgba(234,88,12,0.1)', border: '1px solid rgba(234,88,12,0.3)',
            color: '#c2410c', fontSize: 13,
          }}>
            Tài khoản chưa có mật khẩu riêng. Đặt mật khẩu để đăng nhập bằng số điện thoại/email.
          </div>

          <Form.Item label="Mật khẩu mới" name="newPassword" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password placeholder="Tối thiểu 6 ký tự" />
          </Form.Item>

          <Form.Item label="Xác nhận mật khẩu" name="confirm" rules={[{ required: true, message: 'Xác nhận mật khẩu' }]}>
            <Input.Password placeholder="Nhập lại mật khẩu" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={loading}>
            Đặt mật khẩu
          </Button>
        </Form>
      )}

      {/* TAB MẬT KHẨU — đã có */}
      {activeTab === 'password' && hasPassword && (
        <Form layout="vertical" form={passwordForm} onFinish={handleChangePassword}>
          <Form.Item label="Mật khẩu hiện tại" name="currentPassword" rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}>
            <Input.Password />
          </Form.Item>

          <Form.Item label="Mật khẩu mới" name="newPassword" rules={[{ required: true, message: 'Nhập mật khẩu mới' }]}>
            <Input.Password placeholder="Tối thiểu 6 ký tự" />
          </Form.Item>

          <Form.Item label="Xác nhận mật khẩu" name="confirm" rules={[{ required: true, message: 'Xác nhận mật khẩu' }]}>
            <Input.Password placeholder="Nhập lại mật khẩu mới" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={loading}>
            Đổi mật khẩu
          </Button>
        </Form>
      )}
    </Modal>
  )
}
