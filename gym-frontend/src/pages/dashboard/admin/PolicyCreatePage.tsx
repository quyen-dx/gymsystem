import { ArrowLeftOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { Button, Form, Input, Modal, Select, Switch, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { systemExperienceService } from '../../../services/systemExperienceService'

const normalizeCategory = (cat: string) => cat.trim().replace(/\s+/g, ' ')

interface CategoryPair {
  vi: string
  en: string
}

export default function PolicyCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [allPolicies, setAllPolicies] = useState<any[]>([])
  const [selectedCategoryVi, setSelectedCategoryVi] = useState<string | undefined>(undefined)
  const [selectedCategoryEn, setSelectedCategoryEn] = useState<string | undefined>(undefined)
  const [newCategoryVi, setNewCategoryVi] = useState('')
  const [newCategoryEn, setNewCategoryEn] = useState('')

  useEffect(() => {
    systemExperienceService.getPolicies({ includeHidden: true })
      .then((res) => setAllPolicies(res.data.policies || []))
      .catch(() => {})
  }, [])

  const existingCategoryPairs = useMemo(() => {
    const map = new Map<string, CategoryPair>()
    allPolicies.forEach((item) => {
      const vi = item.categoryVi || item.category
      const en = item.categoryEn || item.category
      if (!vi || !en) return
      const normalizedVi = normalizeCategory(vi)
      const normalizedEn = normalizeCategory(en)
      const key = normalizedVi.toLowerCase()
      if (!map.has(key)) {
        map.set(key, { vi: normalizedVi, en: normalizedEn })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.vi.localeCompare(b.vi))
  }, [allPolicies])

  const findExistingPair = (vi = '', en = '') => {
    const nvi = vi ? normalizeCategory(vi).toLowerCase() : ''
    const nen = en ? normalizeCategory(en).toLowerCase() : ''
    return existingCategoryPairs.find((pair) => (
      nvi && normalizeCategory(pair.vi).toLowerCase() === nvi
    ) || (
      nen && normalizeCategory(pair.en).toLowerCase() === nen
    ))
  }

  const getCanonicalPair = (vi: string, en: string): CategoryPair => {
    const nvi = normalizeCategory(vi)
    const nen = normalizeCategory(en)
    const existing = findExistingPair(nvi, nen)
    if (existing) return existing
    return { vi: nvi, en: nen }
  }

  const handleSelectVi = (value: string | undefined) => {
    if (!value) {
      setSelectedCategoryVi(undefined)
      setSelectedCategoryEn(undefined)
      return
    }
    const pair = existingCategoryPairs.find((p) => normalizeCategory(p.vi).toLowerCase() === normalizeCategory(value).toLowerCase())
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
    const pair = existingCategoryPairs.find((p) => normalizeCategory(p.en).toLowerCase() === normalizeCategory(value).toLowerCase())
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
    const hasAnyNew = newCategoryVi.trim() || newCategoryEn.trim()
    const hasCompleteNew = newCategoryVi.trim() && newCategoryEn.trim()

    if (hasSelected) {
      values.categoryVi = selectedCategoryVi
      values.categoryEn = selectedCategoryEn
    } else if (hasAnyNew) {
      const existing = findExistingPair(newCategoryVi, newCategoryEn)
      if (!hasCompleteNew && !existing) {
        message.error(t('system_experience.admin.category_required'))
        return
      }
      const pair = getCanonicalPair(newCategoryVi, newCategoryEn)
      values.categoryVi = pair.vi
      values.categoryEn = pair.en
    } else {
      message.error(t('system_experience.admin.category_required'))
      return
    }

    setLoading(true)
    try {
      await systemExperienceService.createPolicy(values)
      message.success(t('system_experience.admin.save_success'))
      navigate('/admin/policies')
    } catch (error: any) {
      message.error(error.response?.data?.message || t('system_experience.admin.save_failed'))
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
          {t('system_experience.admin.add_policy')}
        </h1>
        <p className="mt-1 text-sm text-[var(--gs-text-muted)]">Tạo chính sách mới</p>
      </div>

      <div style={cardStyle} className="p-6 max-[640px]:p-4">
        <Form form={form} layout="vertical" initialValues={{ isPublished: true }}>
          <Form.Item name="titleVi" label={t('system_experience.admin.title_vi')} rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="titleEn" label={t('system_experience.admin.title_en')} rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="slug" label={t('system_experience.admin.slug')}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="contentVi" label={t('system_experience.admin.content_vi')} rules={[{ required: true }]}>
            <Input.TextArea rows={6} size="large" />
          </Form.Item>
          <Form.Item name="contentEn" label={t('system_experience.admin.content_en')} rules={[{ required: true }]}>
            <Input.TextArea rows={6} size="large" />
          </Form.Item>
          <Form.Item label={t('system_experience.admin.category')}>
            <div className="grid gap-3">
              <div className="text-sm font-medium text-[var(--gs-text-soft)]">{t('system_experience.admin.category_existing_label')}</div>
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
              <div className="text-sm font-medium text-[var(--gs-text-soft)]">{t('system_experience.admin.category_new_label')}</div>
              <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                <Input
                  placeholder={t('system_experience.admin.category_new_vi_placeholder')}
                  value={newCategoryVi}
                  onChange={(e) => { setNewCategoryVi(e.target.value); if (e.target.value) { setSelectedCategoryVi(undefined); setSelectedCategoryEn(undefined) } }}
                  size="large"
                />
                <Input
                  placeholder={t('system_experience.admin.category_new_en_placeholder')}
                  value={newCategoryEn}
                  onChange={(e) => { setNewCategoryEn(e.target.value); if (e.target.value) { setSelectedCategoryVi(undefined); setSelectedCategoryEn(undefined) } }}
                  size="large"
                />
              </div>
            </div>
          </Form.Item>
          <Form.Item name="isPublished" label={t('system_experience.admin.publish')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button size="large" onClick={() => navigate('/admin/policies')}>
          Hủy
        </Button>
        <Button type="primary" size="large" loading={loading} onClick={handleSave}>
          Lưu chính sách
        </Button>
      </div>

      <div style={{ height: 40 }} />
    </DashboardLayout>
  )
}
