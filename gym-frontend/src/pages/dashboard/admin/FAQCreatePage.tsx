import { ArrowLeftOutlined } from '@ant-design/icons'
import { Button, Form, Input, Select, Switch, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { systemExperienceService } from '../../../services/systemExperienceService'

const normalizeCategory = (cat: string) => cat.trim().replace(/\s+/g, ' ')

interface CategoryPair {
  vi: string
  en: string
}

export default function FAQCreatePage() {
  const navigate = useNavigate()
  const { faqId } = useParams()
  const isEdit = Boolean(faqId)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(false)
  const [allFaqs, setAllFaqs] = useState<any[]>([])
  const [selectedCategoryVi, setSelectedCategoryVi] = useState<string | undefined>(undefined)
  const [selectedCategoryEn, setSelectedCategoryEn] = useState<string | undefined>(undefined)
  const [newCategoryVi, setNewCategoryVi] = useState('')
  const [newCategoryEn, setNewCategoryEn] = useState('')

  useEffect(() => {
    systemExperienceService.getFaqs({ includeHidden: true })
      .then((res) => setAllFaqs(res.data.faqs || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!faqId) return
    setInitialLoading(true)
    systemExperienceService.getFaq(faqId)
      .then((res) => {
        const faq = res.data.faq
        form.setFieldsValue(faq)
        const vi = faq.categoryVi
        const en = faq.categoryEn
        if (vi || en) {
          setNewCategoryVi(normalizeCategory(vi || ''))
          setNewCategoryEn(normalizeCategory(en || ''))
        }
      })
      .catch((error) => {
        message.error(error.response?.data?.message || 'Lưu thất bại')
        navigate('/admin/faqs', { replace: true })
      })
      .finally(() => setInitialLoading(false))
  }, [faqId, form, navigate])

  const existingCategoryPairs = useMemo(() => {
    const map = new Map<string, CategoryPair>()
    allFaqs.forEach((item) => {
      const vi = item.categoryVi
      if (!vi) return
      const key = normalizeCategory(vi).toLowerCase()
      if (!map.has(key)) {
        map.set(key, {
          vi: normalizeCategory(vi),
          en: item.categoryEn ? normalizeCategory(item.categoryEn) : '',
        })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.vi.localeCompare(b.vi))
  }, [allFaqs])

  const getCanonicalPair = (vi: string, en: string): CategoryPair => {
    const nvi = normalizeCategory(vi)
    const nen = normalizeCategory(en)
    for (const item of allFaqs) {
      if (!item.categoryVi) continue
      if (normalizeCategory(item.categoryVi).toLowerCase() === nvi.toLowerCase()) {
        return {
          vi: normalizeCategory(item.categoryVi),
          en: item.categoryEn ? normalizeCategory(item.categoryEn) : nen,
        }
      }
    }
    for (const item of allFaqs) {
      if (!item.categoryEn) continue
      if (normalizeCategory(item.categoryEn).toLowerCase() === nen.toLowerCase()) {
        return {
          vi: item.categoryVi ? normalizeCategory(item.categoryVi) : nvi,
          en: normalizeCategory(item.categoryEn),
        }
      }
    }
    return { vi: nvi, en: nen }
  }

  const handleSelectVi = (value: string | undefined) => {
    if (!value) {
      setSelectedCategoryVi(undefined)
      setSelectedCategoryEn(undefined)
      return
    }
    const pair = existingCategoryPairs.find(
      (p) => normalizeCategory(p.vi).toLowerCase() === normalizeCategory(value).toLowerCase(),
    )
    if (pair) {
      setSelectedCategoryVi(pair.vi)
      setSelectedCategoryEn(pair.en)
      setNewCategoryVi('')
      setNewCategoryEn('')
    }
  }

  const handleSelectEn = (value: string | undefined) => {
    if (!value) {
      setSelectedCategoryVi(undefined)
      setSelectedCategoryEn(undefined)
      return
    }
    const pair = existingCategoryPairs.find(
      (p) => normalizeCategory(p.en).toLowerCase() === normalizeCategory(value).toLowerCase(),
    )
    if (pair) {
      setSelectedCategoryVi(pair.vi)
      setSelectedCategoryEn(pair.en)
      setNewCategoryVi('')
      setNewCategoryEn('')
    }
  }

  const handleSave = async () => {
    const values = await form.validateFields()

    const hasSelected = selectedCategoryVi && selectedCategoryEn
    const hasNew = newCategoryVi.trim() && newCategoryEn.trim()

    if (hasSelected) {
      values.categoryVi = selectedCategoryVi
      values.categoryEn = selectedCategoryEn
    } else if (hasNew) {
      const pair = getCanonicalPair(newCategoryVi, newCategoryEn)
      values.categoryVi = pair.vi
      values.categoryEn = pair.en
    } else {
      message.error('Vui lòng chọn hoặc nhập danh mục')
      return
    }

    setLoading(true)
    try {
      if (faqId) await systemExperienceService.updateFaq(faqId, values)
      else await systemExperienceService.createFaq(values)
      message.success('Lưu thành công')
      navigate('/admin/faqs')
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
          onClick={() => navigate('/admin/faqs')}
          style={{ color: 'var(--gs-text)', fontSize: 15 }}
        >
          ← Quay lại danh sách FAQ
        </Button>
      </div>

      <div
        className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] px-8 py-6 max-[640px]:px-5 max-[640px]:py-5"
        style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent, #b6462f) 14%, transparent), transparent)' }}
      >
        <h1 className="text-3xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">
          {isEdit ? 'Chỉnh sửa FAQ' : 'Thêm FAQ'}
        </h1>
        <p className="mt-1 text-sm text-[var(--gs-text-muted)]">{isEdit ? 'Cập nhật câu hỏi thường gặp' : 'Tạo câu hỏi thường gặp mới'}</p>
      </div>

      <div style={cardStyle} className="p-6 max-[640px]:p-4">
        <Form form={form} layout="vertical" initialValues={{ isPublished: true }} disabled={initialLoading}>
          <Form.Item name="questionVi" label="Câu hỏi (Tiếng Việt)" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="questionEn" label="Câu hỏi (Tiếng Anh)" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="answerVi" label="Câu trả lời (Tiếng Việt)" rules={[{ required: true }]}>
            <Input.TextArea rows={3} size="large" />
          </Form.Item>
          <Form.Item name="answerEn" label="Câu trả lời (Tiếng Anh)" rules={[{ required: true }]}>
            <Input.TextArea rows={3} size="large" />
          </Form.Item>
          <Form.Item label="Danh mục">
            <div className="grid gap-3">
              {existingCategoryPairs.length > 0 && (
                <>
                  <div className="text-sm font-medium text-[var(--gs-text-soft)]">
                    Chọn danh mục có sẵn
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                    <Select
                      placeholder="Tiếng Việt"
                      allowClear
                      value={selectedCategoryVi}
                      onChange={handleSelectVi}
                      options={existingCategoryPairs.map((p) => ({ label: p.vi, value: p.vi }))}
                      size="large"
                    />
                    <Select
                      placeholder="English"
                      allowClear
                      value={selectedCategoryEn}
                      onChange={handleSelectEn}
                      options={existingCategoryPairs.map((p) => ({ label: p.en, value: p.en }))}
                      size="large"
                    />
                  </div>
                </>
              )}
              <div className="text-sm font-medium text-[var(--gs-text-soft)]">
                Hoặc tạo danh mục mới
              </div>
              <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                <Input
                  placeholder="Tên danh mục (Tiếng Việt)"
                  value={newCategoryVi}
                  onChange={(e) => {
                    setNewCategoryVi(e.target.value)
                    if (e.target.value) {
                      setSelectedCategoryVi(undefined)
                      setSelectedCategoryEn(undefined)
                    }
                  }}
                  size="large"
                />
                <Input
                  placeholder="Tên danh mục (Tiếng Anh)"
                  value={newCategoryEn}
                  onChange={(e) => {
                    setNewCategoryEn(e.target.value)
                    if (e.target.value) {
                      setSelectedCategoryVi(undefined)
                      setSelectedCategoryEn(undefined)
                    }
                  }}
                  size="large"
                />
              </div>
            </div>
          </Form.Item>
          <Form.Item name="isPublished" label="Xuất bản" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button size="large" onClick={() => navigate('/admin/faqs')}>
          Hủy
        </Button>
        <Button type="primary" size="large" loading={loading} onClick={handleSave}>
          {isEdit ? 'Cập nhật FAQ' : 'Lưu FAQ'}
        </Button>
      </div>

      <div style={{ height: 40 }} />
    </DashboardLayout>
  )
}
