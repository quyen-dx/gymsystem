import {
  Button,
  Checkbox,
  ColorPicker,
  Form,
  Input,
  InputNumber,
  Space,
  message,
} from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import api from '../../../services/api'
import { planFeatureService, type PlanFeature } from '../../../services/planFeatureService'
import { PRESET_COLORS } from './planColors'

export default function AdminPlanCreatePage() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [submitLoading, setSubmitLoading] = useState(false)
  const [allFeatures, setAllFeatures] = useState<PlanFeature[]>([])
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([])
  const [featuresLoading, setFeaturesLoading] = useState(true)
  const [selectedColor, setSelectedColor] = useState('#3B82F6')

  useEffect(() => {
    planFeatureService.getAll({ isActive: true })
      .then((res) => setAllFeatures(res.data.data || []))
      .catch(() => message.error('Không thể tải danh sách quyền lợi'))
      .finally(() => setFeaturesLoading(false))
  }, [])

  const updateColor = (color: string) => {
    setSelectedColor(color)
    form.setFieldsValue({ color })
  }

  const handleSubmit = async (values: any) => {
    if (selectedFeatureIds.length === 0) {
      message.warning('Vui lòng chọn ít nhất 1 quyền lợi')
      return
    }

    setSubmitLoading(true)
    try {
      const payload = {
        nameVi: values.nameVi,
        price: values.price,
        durationDays: values.durationDays,
        descriptionVi: values.descriptionVi || '',
        featureIds: selectedFeatureIds,
        isActive: true,
        color: typeof values.color === 'string' ? values.color : values.color?.toHexString?.() || '#3B82F6',
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
          initialValues={{ color: '#3B82F6' }}
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

            <Form.Item label="Màu sắc" name="color">
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

          <Form.Item label="Mô tả" name="descriptionVi">
            <Input.TextArea rows={4} placeholder="Mô tả gói tập (không bắt buộc)" />
          </Form.Item>

          <Form.Item label="Quyền lợi" required>
            {featuresLoading ? (
              <div className="text-sm text-[var(--gs-text-muted)]">Đang tải quyền lợi...</div>
            ) : allFeatures.length === 0 ? (
              <div className="text-sm text-[var(--gs-text-muted)]">
                Chưa có quyền lợi nào.{' '}
                <a href="/admin/features" className="text-[var(--theme-accent)]">Thêm quyền lợi</a>
              </div>
            ) : (
              <Checkbox.Group value={selectedFeatureIds} onChange={(v) => setSelectedFeatureIds(v as string[])}>
                <div className="grid grid-cols-1 gap-y-3">
                  {allFeatures.map((f) => (
                    <div key={f._id} className="flex items-start gap-3">
                      <Checkbox value={f._id} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-[var(--gs-text)]">{f.name}</span>
                        {f.description && (
                          <p className="m-0 mt-0.5 text-xs text-[var(--gs-text-muted)]">{f.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Checkbox.Group>
            )}
          </Form.Item>

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => navigate('/admin/plans')}>Đóng</Button>
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
