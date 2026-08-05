import { ArrowLeftOutlined } from '@ant-design/icons'
import { Button, Form, Input, Select, Switch, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { systemExperienceService } from '../../../services/systemExperienceService'

const normalizeCategory = (cat: string) => cat.trim().replace(/\s+/g, ' ')

export default function PolicyCreatePage() {
  const navigate = useNavigate()
  const { policyId } = useParams()
  const isEdit = Boolean(policyId)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(false)
  const [allPolicies, setAllPolicies] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined)
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    systemExperienceService.getPolicies({ includeHidden: true })
      .then((res) => setAllPolicies(res.data.policies || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!policyId) return
    setInitialLoading(true)
    systemExperienceService.getPolicy(policyId)
      .then((res) => {
        const policy = res.data.policy
        form.setFieldsValue(policy)
        const vi = policy.categoryVi || policy.category
        if (vi) setNewCategory(normalizeCategory(vi))
      })
      .catch((error) => {
        message.error(error.response?.data?.message || 'Lưu thất bại')
        navigate('/admin/policies', { replace: true })
      })
      .finally(() => setInitialLoading(false))
  }, [policyId, form, navigate])

  const existingCategories = useMemo(() => {
    const set = new Set<string>()
    allPolicies.forEach((item) => {
      const vi = item.categoryVi || item.category
      if (vi) set.add(normalizeCategory(vi))
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [allPolicies])

  const getCanonicalCategory = (value: string) => {
    const normalized = normalizeCategory(value)
    const existing = allPolicies.find((item) => {
      const vi = item.categoryVi || item.category
      return vi && normalizeCategory(vi).toLowerCase() === normalized.toLowerCase()
    })
    const existingVi = existing?.categoryVi || existing?.category
    return existingVi ? normalizeCategory(existingVi) : normalized
  }

  const handleSelectCategory = (value: string | undefined) => {
    if (!value) {
      setSelectedCategory(undefined)
      return
    }
    setSelectedCategory(value)
    setNewCategory('')
  }

  const handleSave = async () => {
    const values = await form.validateFields()

    if (selectedCategory) {
      values.categoryVi = getCanonicalCategory(selectedCategory)
    } else if (newCategory.trim()) {
      values.categoryVi = getCanonicalCategory(newCategory)
    } else {
      message.error('Vui lòng chọn hoặc nhập danh mục')
      return
    }

    setLoading(true)
    try {
      if (policyId) await systemExperienceService.updatePolicy(policyId, values)
      else await systemExperienceService.createPolicy(values)
      message.success('Lưu thành công')
      navigate('/admin/policies')
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lưu thất bại')
    } finally {
      setLoading(false)
    }
  }

  const cardStyle: React.CSSProperties = {
    borderRadius: 24,
    border: '1px solid var(--gs-border)',
    background: 'var(--gs-card)',
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center gap-3">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/admin/policies')}
          style={{ color: 'var(--gs-text)', fontSize: 15 }}
        >
          ← Quay lại danh sách chính sách
        </Button>
      </div>

      <div
        className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] px-8 py-6 max-[640px]:px-5 max-[640px]:py-5"
        style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent, #b6462f) 14%, transparent), transparent)' }}
      >
        <h1 className="text-3xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">
          {isEdit ? 'Chỉnh sửa chính sách' : 'Thêm chính sách'}
        </h1>
        <p className="mt-1 text-sm text-[var(--gs-text-muted)]">{isEdit ? 'Cập nhật nội dung chính sách' : 'Tạo chính sách mới'}</p>
      </div>

      <div style={cardStyle} className="p-6 max-[640px]:p-4">
        <Form form={form} layout="vertical" initialValues={{ isPublished: true }} disabled={initialLoading}>
          <Form.Item name="titleVi" label="Tiêu đề" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="slug" label="Slug">
            <Input size="large" />
          </Form.Item>
          <Form.Item name="contentVi" label="Nội dung" rules={[{ required: true }]}>
            <Input.TextArea rows={6} size="large" />
          </Form.Item>
          <Form.Item label="Danh mục">
            <div className="grid gap-3">
              {existingCategories.length > 0 && (
                <>
                  <div className="text-sm font-medium text-[var(--gs-text-soft)]">Chọn danh mục có sẵn</div>
                  <Select
                    placeholder="Chọn danh mục"
                    allowClear
                    value={selectedCategory}
                    onChange={handleSelectCategory}
                    options={existingCategories.map((c) => ({ label: c, value: c }))}
                    size="large"
                  />
                </>
              )}
              <div className="text-sm font-medium text-[var(--gs-text-soft)]">Hoặc thêm danh mục mới</div>
              <Input
                placeholder="Tên danh mục"
                value={newCategory}
                onChange={(e) => {
                  setNewCategory(e.target.value)
                  if (e.target.value) setSelectedCategory(undefined)
                }}
                size="large"
              />
            </div>
          </Form.Item>
          <Form.Item name="isPublished" label="Xuất bản" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button size="large" onClick={() => navigate('/admin/policies')}>
          Hủy
        </Button>
        <Button type="primary" size="large" loading={loading} onClick={handleSave}>
          {isEdit ? 'Cập nhật chính sách' : 'Lưu chính sách'}
        </Button>
      </div>

      <div style={{ height: 40 }} />
    </DashboardLayout>
  )
}
