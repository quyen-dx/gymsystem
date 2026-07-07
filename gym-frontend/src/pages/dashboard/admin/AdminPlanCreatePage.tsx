import { PlusOutlined } from '@ant-design/icons'
import {
  Button,
  Checkbox,
  ColorPicker,
  Form,
  Input,
  InputNumber,
  Space,
  message
} from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import api from '../../../services/api'
import { DEFAULT_FEATURES, DEFAULT_SPECIALIZATIONS, PRESET_COLORS } from './plan/constants'

export default function AdminPlanCreatePage() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [submitLoading, setSubmitLoading] = useState(false)
  const [allFeatures, setAllFeatures] = useState<string[]>(DEFAULT_FEATURES)
  const [newFeatureInput, setNewFeatureInput] = useState('')
  const [allSpecializations, setAllSpecializations] = useState<string[]>(DEFAULT_SPECIALIZATIONS)
  const [newSpecializationInput, setNewSpecializationInput] = useState('')
  const [selectedColor, setSelectedColor] = useState('#3B82F6')

  const updateColor = (color: string) => {
    setSelectedColor(color)
    form.setFieldsValue({ color })
  }

  const handleAddFeature = () => {
    const val = newFeatureInput.trim()
    if (!val) return
    if (allFeatures.includes(val)) {
      message.info('Quyền lợi này đã có trong danh sách')
      setNewFeatureInput('')
      return
    }
    setAllFeatures((prev) => [...prev, val])
    const current = form.getFieldValue('featuresVi') || []
    form.setFieldsValue({ featuresVi: [...current, val] })
    setNewFeatureInput('')
  }

  const handleAddSpecialization = () => {
    const val = newSpecializationInput.trim()
    if (!val) return
    if (allSpecializations.includes(val)) {
      message.info('Chuyên môn này đã có trong danh sách')
      setNewSpecializationInput('')
      return
    }
    setAllSpecializations((prev) => [...prev, val])
    const current = form.getFieldValue('applicableSpecializations') || []
    form.setFieldsValue({ applicableSpecializations: [...current, val] })
    setNewSpecializationInput('')
  }

  const handleSubmit = async (values: any) => {
    setSubmitLoading(true)
    try {
      const features = values.featuresVi || []
      if (features.length === 0) {
        message.warning('Vui lòng chọn ít nhất 1 quyền lợi')
        setSubmitLoading(false)
        return
      }

      const payload = {
        nameVi: values.nameVi,
        nameEn: values.nameVi,
        price: values.price,
        durationDays: values.durationDays,
        descriptionVi: values.descriptionVi || '',
        descriptionEn: values.descriptionVi || '',
        featuresVi: features,
        featuresEn: features,
        applicableSpecializations: values.applicableSpecializations || [],
        isActive: true,
        color: typeof values.color === 'string'
          ? values.color
          : values.color?.toHexString?.() || '#3B82F6',
      }

      await api.post('/plans', payload)
      message.success('Tạo gói tập thành công')
      navigate('/admin/plans')
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tạo gói tập')
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Admin</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Tạo gói tập mới</h1>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <Form layout="vertical" form={form} onFinish={handleSubmit}
          initialValues={{ color: '#3B82F6', featuresVi: [], applicableSpecializations: [] }}
        >
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item
              label="Tên gói tập"
              name="nameVi"
              rules={[{ required: true, message: 'Vui lòng nhập tên gói tập' }]}
            >
              <Input placeholder="VD: Gói Cơ Bản" />
            </Form.Item>

            <Form.Item
              label="Giá"
              name="price"
              rules={[{ required: true, message: 'Vui lòng nhập giá gói tập' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                addonAfter="VNĐ"
                placeholder="250000"
              />
            </Form.Item>

            <Form.Item
              label="Thời hạn"
              name="durationDays"
              rules={[{ required: true, message: 'Vui lòng nhập số ngày sử dụng' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                addonAfter="ngày"
                placeholder="30"
              />
            </Form.Item>

            <Form.Item
              label="Màu sắc"
              name="color"
            >
              <div className="flex items-center gap-2">
                {PRESET_COLORS.map((c) => (
                  <div
                    key={c}
                    onClick={() => updateColor(c)}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: selectedColor === c ? '3px solid #fff' : '2px solid transparent',
                      boxShadow: selectedColor === c ? `0 0 0 2px ${c}` : 'none',
                    }}
                  />
                ))}
                <ColorPicker format="hex" value={selectedColor} onChange={(c) => updateColor(c.toHexString())} />
              </div>
            </Form.Item>
          </div>

          <Form.Item
            label="Mô tả ngắn"
            name="descriptionVi"
          >
            <Input.TextArea rows={4} placeholder="Mô tả gói tập (không bắt buộc)" />
          </Form.Item>

          <Form.Item
            label="Quyền lợi"
            name="featuresVi"
            rules={[{ required: true, type: 'array', min: 1, message: 'Vui lòng chọn ít nhất 1 quyền lợi' }]}
          >
            <Checkbox.Group>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {allFeatures.map((f) => (
                  <Checkbox key={f} value={f}>{f}</Checkbox>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>

          <div className="flex items-center gap-2 mb-4">
            <Input
              size="small"
              style={{ width: 260 }}
              placeholder="Nhập quyền lợi mới..."
              value={newFeatureInput}
              onChange={(e) => setNewFeatureInput(e.target.value)}
              onPressEnter={handleAddFeature}
            />
            <Button size="small" icon={<PlusOutlined />} onClick={handleAddFeature}>
              Thêm quyền lợi mới
            </Button>
          </div>

          <Form.Item
            label="Chuyên môn áp dụng"
            name="applicableSpecializations"
            rules={[{ required: true, message: 'Vui lòng chọn chuyên môn' }]}
          >
            <Checkbox.Group>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {allSpecializations.map((s) => (
                  <Checkbox key={s} value={s}>{s}</Checkbox>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>

          <div className="flex items-center gap-2 mb-4">
            <Input
              size="small"
              style={{ width: 260 }}
              placeholder="Nhập chuyên môn mới..."
              value={newSpecializationInput}
              onChange={(e) => setNewSpecializationInput(e.target.value)}
              onPressEnter={handleAddSpecialization}
            />
            <Button size="small" icon={<PlusOutlined />} onClick={handleAddSpecialization}>
              Thêm chuyên môn mới
            </Button>
          </div>

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => navigate('/admin/plans')}>
                Đóng
              </Button>
              <Button type="primary" htmlType="submit" loading={submitLoading}>
                Tạo gói tập
              </Button>
            </Space>
          </div>
        </Form>
      </div>
    </DashboardLayout>
  )
}
