import { Button, Form, Input, Modal, Select, Space, Switch, Table, message } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
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

export default function PolicyManagerPage() {
  const [items, setItems] = useState<any[]>([])
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'vi'
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [form] = Form.useForm()
  const [selectedCategoryVi, setSelectedCategoryVi] = useState<string | undefined>(undefined)
  const [selectedCategoryEn, setSelectedCategoryEn] = useState<string | undefined>(undefined)
  const [newCategoryVi, setNewCategoryVi] = useState('')
  const [newCategoryEn, setNewCategoryEn] = useState('')

  const load = () => {
    setLoading(true)
    systemExperienceService.getPolicies({ includeHidden: true })
      .then((res) => setItems(res.data.policies || []))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const existingCategoryPairs = useMemo(() => {
    const map = new Map<string, CategoryPair>()
    items.forEach((item) => {
      const vi = item.categoryVi || item.category
      const en = item.categoryEn || item.category
      if (!vi || !en) return
      const normalizedVi = normalizeCategory(vi)
      const normalizedEn = normalizeCategory(en)
      const key = normalizedVi.toLowerCase()
      if (!map.has(key)) {
        map.set(key, {
          vi: normalizedVi,
          en: normalizedEn,
        })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.vi.localeCompare(b.vi))
  }, [items])

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

  const resetCategoryFields = () => {
    setSelectedCategoryVi(undefined)
    setSelectedCategoryEn(undefined)
    setNewCategoryVi('')
    setNewCategoryEn('')
  }

  const openAddModal = () => {
    navigate('/admin/policies/create')
  }

  const openEditModal = (row: any) => {
    navigate(`/admin/policies/${row._id}/edit`)
  }

  const closeModal = () => {
    setOpen(false)
    setEditing(null)
    form.resetFields()
    resetCategoryFields()
  }

  const save = async () => {
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

    try {
      if (editing) await systemExperienceService.updatePolicy(editing._id, values)
      else await systemExperienceService.createPolicy(values)
      message.success(t('system_experience.admin.save_success'))
      closeModal()
      load()
    } catch (error: any) {
      message.error(error.response?.data?.message || t('system_experience.admin.save_failed'))
    }
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

  return (
    <DashboardLayout>
      <div className="grid gap-4">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">{t('system_experience.admin.policy_manager')}</h1><Button type="primary" onClick={openAddModal}>{t('system_experience.admin.add_policy')}</Button></div>
        <Table rowKey="_id" loading={loading} dataSource={items} columns={[
          { title: t('admin.table_no'), width: 70, align: 'center' as const, render: (_: any, __: any, index: number) => (page - 1) * 10 + index + 1 },
          { title: t('system_experience.admin.title'), dataIndex: lang === 'en' ? 'titleEn' : 'titleVi', render: (_: any, row: any) => lang === 'en' ? (row.titleEn || row.titleVi) : (row.titleVi || row.titleEn) },
          { title: t('system_experience.admin.slug'), dataIndex: 'slug' },
          { title: t('system_experience.admin.category'), dataIndex: lang === 'en' ? 'categoryEn' : 'categoryVi', render: (_: any, row: any) => lang === 'en' ? (row.categoryEn || row.categoryVi) : (row.categoryVi || row.categoryEn) },
          { title: t('system_experience.admin.publish'), dataIndex: 'isPublished', render: (v) => v ? t('system_experience.admin.published') : t('system_experience.admin.hidden') },
          { title: t('system_experience.admin.actions'), render: (_, row: any) => <Space><Button onClick={() => openEditModal(row)}>{t('system_experience.admin.edit')}</Button><Button danger onClick={() => {
              Modal.confirm({
                title: 'Xác nhận xóa chính sách',
                icon: <ExclamationCircleOutlined />,
                content: 'Bạn có chắc muốn xóa chính sách này không?',
                okText: 'Xóa',
                okType: 'danger',
                cancelText: 'Hủy',
                onOk: async () => {
                  await systemExperienceService.deletePolicy(row._id)
                  load()
                },
              })
            }}>{t('system_experience.admin.delete')}</Button></Space> },
        ]} pagination={{ current: page, pageSize: 10, onChange: setPage }} />
      </div>
      <Modal width={760} title={editing ? t('system_experience.admin.edit_policy') : t('system_experience.admin.add_policy')} open={open} onOk={save} onCancel={closeModal}>
        <Form form={form} layout="vertical" initialValues={{ isPublished: true }}>
          <Form.Item name="titleVi" label={t('system_experience.admin.title_vi')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="titleEn" label={t('system_experience.admin.title_en')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="slug" label={t('system_experience.admin.slug')}><Input /></Form.Item>
          <Form.Item name="contentVi" label={t('system_experience.admin.content_vi')} rules={[{ required: true }]}><Input.TextArea rows={6} /></Form.Item>
          <Form.Item name="contentEn" label={t('system_experience.admin.content_en')} rules={[{ required: true }]}><Input.TextArea rows={6} /></Form.Item>
          <Form.Item label={t('system_experience.admin.category')}>
            <div className="grid gap-3">
              <div className="text-sm font-medium text-[var(--gs-text-soft)]">{t('system_experience.admin.category_existing_label')}</div>
              <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                <Select placeholder="Tiếng Việt" allowClear value={selectedCategoryVi} onChange={handleSelectVi} options={existingCategoryPairs.map((p) => ({ label: p.vi, value: p.vi }))} />
                <Select placeholder="English" allowClear value={selectedCategoryEn} onChange={handleSelectEn} options={existingCategoryPairs.map((p) => ({ label: p.en, value: p.en }))} />
              </div>
              <div className="text-sm font-medium text-[var(--gs-text-soft)]">{t('system_experience.admin.category_new_label')}</div>
              <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                <Input placeholder={t('system_experience.admin.category_new_vi_placeholder')} value={newCategoryVi} onChange={(e) => { setNewCategoryVi(e.target.value); if (e.target.value) { setSelectedCategoryVi(undefined); setSelectedCategoryEn(undefined) } }} />
                <Input placeholder={t('system_experience.admin.category_new_en_placeholder')} value={newCategoryEn} onChange={(e) => { setNewCategoryEn(e.target.value); if (e.target.value) { setSelectedCategoryVi(undefined); setSelectedCategoryEn(undefined) } }} />
              </div>
            </div>
          </Form.Item>
          <Form.Item name="isPublished" label={t('system_experience.admin.publish')} valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
