import {
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Upload,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { memberService } from '../../../services/memberService'
import type { MemberFormData, MemberListItem } from '../../../types/admin/member'
import { UploadOutlined } from '@ant-design/icons'

const PHONE_REGEX = /^0\d{9,10}$/

interface Props {
  open: boolean
  member: MemberListItem | null
  onClose: () => void
  onSuccess: () => void
}

export default function MemberFormModal({ open, member, onClose, onSuccess }: Props) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const isEdit = !!member

  useEffect(() => {
    if (open) {
      if (member) {
        form.setFieldsValue({
          name: member.name,
          email: member.email || '',
          phone: member.phone || '',
          dateOfBirth: member.dateOfBirth ? dayjs(member.dateOfBirth) : null,
          gender: member.gender || undefined,
        })
      } else {
        form.resetFields()
        setAvatarFile(null)
      }
    }
  }, [open, member, form])

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true)
    try {
      let payload: FormData | Record<string, unknown>

      if (isEdit && avatarFile) {
        const fd = new FormData()
        fd.append('avatar', avatarFile)
        fd.append('name', values.name as string)
        fd.append('email', (values.email as string) || '')
        fd.append('phone', (values.phone as string) || '')
        if (values.gender) fd.append('gender', values.gender as string)
        if (values.dateOfBirth) fd.append('dateOfBirth', new Date(values.dateOfBirth as Date).toISOString())
        payload = fd
      } else {
        payload = {
          name: values.name as string,
          email: (values.email as string) || '',
          phone: (values.phone as string) || '',
          gender: (values.gender as string) || undefined,
          dateOfBirth: values.dateOfBirth ? new Date(values.dateOfBirth as Date).toISOString() : undefined,
        }
      }

      if (isEdit) {
        await memberService.updateMember(member!._id, payload)
        message.success('Cập nhật thành viên thành công')
      } else {
        ;(payload as unknown as MemberFormData).password = (values.password as string) || undefined
        await memberService.createMember(payload as unknown as MemberFormData)
        message.success('Thêm thành viên thành công')
      }
      onSuccess()
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } }
      message.error(apiError?.response?.data?.message || 'Thao tác thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={isEdit ? 'Chỉnh sửa thành viên' : 'Thêm thành viên'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText={isEdit ? 'Cập nhật' : 'Thêm'}
      cancelText="Hủy"
      destroyOnHidden
      width={520}
    >
      <Form layout="vertical" form={form} onFinish={handleSubmit}>
        <Form.Item
          label="Họ và tên"
          name="name"
          rules={[{ required: true, message: 'Vui lòng nhập tên thành viên' }]}
        >
          <Input placeholder="Nhập tên thành viên" />
        </Form.Item>

        <Form.Item
          label="Email"
          name="email"
          rules={[
            { type: 'email', message: 'Email không hợp lệ' },
          ]}
        >
          <Input placeholder="Nhập email" type="email" />
        </Form.Item>

        <Form.Item
          label="Số điện thoại"
          name="phone"
          rules={[
            { pattern: PHONE_REGEX, message: 'Số điện thoại không hợp lệ (VD: 0912345678)' },
          ]}
        >
          <Input placeholder="Nhập số điện thoại" />
        </Form.Item>

        <Form.Item label="Giới tính" name="gender">
          <Select
            allowClear
            placeholder="Giới tính"
            options={[
              { value: 'male', label: 'Nam' },
              { value: 'female', label: 'Nữ' },
              { value: 'other', label: 'Khác' },
            ]}
          />
        </Form.Item>

        <Form.Item label="Ngày sinh" name="dateOfBirth">
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="DD/MM/YYYY" />
        </Form.Item>

        {!isEdit && (
          <Form.Item
            label="Mật khẩu"
            name="password"
            rules={[
              { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' },
            ]}
          >
            <Input.Password placeholder="Nhập mật khẩu" />
          </Form.Item>
        )}

        {isEdit && (
          <Form.Item label="Avatar">
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => {
                setAvatarFile(file)
                return false
              }}
            >
              <Button icon={<UploadOutlined />}>
                {avatarFile ? avatarFile.name : 'Tải lên ảnh đại diện'}
              </Button>
            </Upload>
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
