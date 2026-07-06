import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Upload,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { trainerService } from '../../../services/trainerService'
import type { PT } from '../../../types/admin/trainer'
import { UploadOutlined } from '@ant-design/icons'

const SPECIALTY_OPTIONS = [
  'Yoga', 'GYM', 'Boxing', 'CrossFit', 'Pilates', 'Zumba', 'Personal Training',
  'Cardio', 'Strength Training', 'HIIT', 'Dance', 'Meditation',
]

interface Props {
  open: boolean
  pt: PT | null
  onClose: () => void
  onSuccess: () => void
}

export default function TrainerFormModal({ open, pt, onClose, onSuccess }: Props) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const isEdit = !!pt

  useEffect(() => {
    if (open) {
      if (pt) {
        form.setFieldsValue({
          name: pt.name,
          email: pt.email || '',
          phone: pt.phone || '',
          dateOfBirth: pt.dateOfBirth ? dayjs(pt.dateOfBirth) : null,
          gender: pt.gender || undefined,
          specialties: pt.specialties || [],
          bio: pt.bio || '',
          experienceYears: pt.experienceYears || 0,
          introVideoUrl: pt.introVideoUrl || '',
          oneToOnePrice: pt.oneToOnePrice || 0,
          groupPrice: pt.groupPrice || 0,
          groupCapacity: pt.groupCapacity || 5,
          certificates: pt.certificates || [],
        })
      } else {
        form.resetFields()
        setAvatarFile(null)
      }
    }
  }, [open, pt, form])

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true)
    try {
      let payload: FormData | Record<string, unknown>

      if (avatarFile) {
        const fd = new FormData()
        fd.append('avatar', avatarFile)
        fd.append('name', values.name as string)
        fd.append('email', (values.email as string) || '')
        fd.append('phone', (values.phone as string) || '')
        fd.append('bio', (values.bio as string) || '')
        fd.append('gender', (values.gender as string) || '')
        fd.append('experienceYears', String(values.experienceYears || 0))
        fd.append('introVideoUrl', (values.introVideoUrl as string) || '')
        fd.append('oneToOnePrice', String(values.oneToOnePrice || 0))
        fd.append('groupPrice', String(values.groupPrice || 0))
        fd.append('groupCapacity', String(values.groupCapacity || 5))
        fd.append('specialties', JSON.stringify(values.specialties || []))
        fd.append('certificates', JSON.stringify(values.certificates || []))
        if (values.dateOfBirth) fd.append('dateOfBirth', new Date(values.dateOfBirth as Date).toISOString())
        if (!isEdit && values.password) fd.append('password', values.password as string)
        payload = fd
      } else {
        payload = {
          name: values.name as string,
          email: (values.email as string) || '',
          phone: (values.phone as string) || '',
          bio: (values.bio as string) || '',
          gender: (values.gender as string) || undefined,
          experienceYears: values.experienceYears || 0,
          introVideoUrl: (values.introVideoUrl as string) || '',
          oneToOnePrice: values.oneToOnePrice || 0,
          groupPrice: values.groupPrice || 0,
          groupCapacity: values.groupCapacity || 5,
          specialties: values.specialties || [],
          certificates: values.certificates || [],
          dateOfBirth: values.dateOfBirth ? new Date(values.dateOfBirth as Date).toISOString() : undefined,
          ...(!isEdit && values.password ? { password: values.password as string } : {}),
        }
      }

      if (isEdit) {
        await trainerService.updatePT(pt!._id, payload)
        message.success('Cập nhật huấn luyện viên thành công')
      } else {
        await trainerService.createPT(payload)
        message.success('Thêm huấn luyện viên thành công')
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
      title={isEdit ? 'Chỉnh sửa huấn luyện viên' : 'Thêm huấn luyện viên'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText={isEdit ? 'Cập nhật' : 'Thêm mới'}
      cancelText='Hủy'
      destroyOnHidden
      width={640}
    >
      <Form layout="vertical" form={form} onFinish={handleSubmit}>
        <Form.Item
          label='Họ tên'
          name="name"
          rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
        >
          <Input placeholder='Nhập họ tên' />
        </Form.Item>

        <Form.Item label='Email' name="email">
          <Input placeholder='Nhập email' type="email" />
        </Form.Item>

        <Form.Item label='Số điện thoại' name="phone">
          <Input placeholder='Nhập số điện thoại' />
        </Form.Item>

        <Form.Item label='Giới tính' name="gender">
          <Select
            allowClear
            placeholder='Giới tính'
            options={[
              { value: 'male', label: 'Nam' },
              { value: 'female', label: 'Nữ' },
              { value: 'other', label: 'Khác' },
            ]}
          />
        </Form.Item>

        <Form.Item label='Ngày sinh' name="dateOfBirth">
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item label='Chuyên môn' name="specialties">
          <Select
            mode="tags"
            placeholder='Nhập chuyên môn'
            options={SPECIALTY_OPTIONS.map((s) => ({ value: s, label: s }))}
          />
        </Form.Item>

        <Form.Item label='Giới thiệu' name="bio">
          <Input.TextArea rows={3} placeholder='Nhập giới thiệu' />
        </Form.Item>

        <Form.Item label='Số năm kinh nghiệm' name="experienceYears">
          <InputNumber min={0} style={{ width: '100%' }} placeholder='Nhập số năm kinh nghiệm' />
        </Form.Item>

        <Form.Item label="Giá PT 1-1 / buổi" name="oneToOnePrice">
          <InputNumber
            min={0}
            step={10000}
            style={{ width: '100%' }}
            placeholder="300000"
          />
        </Form.Item>

        <Form.Item label="Giá PT 1-1 / buổi (VNĐ)" name="groupPrice">
          <InputNumber
            min={0}
            step={10000}
            style={{ width: '100%' }}
            placeholder="120000"
          />
        </Form.Item>

        <Form.Item label="Giá PT nhóm / người (VNĐ)" name="groupCapacity">
          <InputNumber
            min={1}
            max={5}
            style={{ width: '100%' }}
            placeholder="5"
          />
        </Form.Item>

        <Form.Item label='Video giới thiệu' name="introVideoUrl">
          <Input placeholder='Nhập URL video giới thiệu' />
        </Form.Item>

        <Form.Item label='Chứng chỉ' name="certificates">
          <Select
            mode="tags"
            placeholder='Nhập chứng chỉ'
          />
      </Form.Item>

        {!isEdit && (
          <Form.Item label='Mật khẩu' name="password">
            <Input.Password placeholder='Nhập mật khẩu' />
          </Form.Item>
        )}

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
              {avatarFile ? avatarFile.name : 'Tải ảnh đại diện'}
            </Button>
          </Upload>
        </Form.Item>
      </Form>
    </Modal>
  )
}
