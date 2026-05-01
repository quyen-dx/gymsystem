import { ShopOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar, Button, Form, Input, Modal, message } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { authService } from '../../services/authService'
import { useAuth } from '../../hook/useAuth'

export default function AccountProfileModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { user, updateUser } = useAuth()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !user) return
    form.setFieldsValue({
      name: user.name,
      phone: user.phone || '',
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : '',
    })
    setAvatarPreview(null)
  }, [open, user, form])

  if (!user) return null

  const handleSave = async (values: any) => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', values.name || '')
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

  return (
    <Modal
      title="Thông tin tài khoản"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
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
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) setAvatarPreview(URL.createObjectURL(file))
            }}
          />
        </div>
      </div>

      <Form layout="vertical" form={form} onFinish={handleSave}>
        <Form.Item label="Tên tài khoản" name="name" rules={[{ required: true, message: 'Nhập tên tài khoản' }]}>
          <Input />
        </Form.Item>

        <Form.Item label="Email">
          <Input disabled value={user.email || ''} />
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
      </Form>

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
    </Modal>
  )
}
