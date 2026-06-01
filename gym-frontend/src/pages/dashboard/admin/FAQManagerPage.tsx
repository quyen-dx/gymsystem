import { Button, Form, Input, Modal, Select, Space, Switch, Table, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { systemExperienceService } from '../../../services/systemExperienceService'

const normalizeCategory = (cat: string) => cat.trim().replace(/\s+/g, ' ')

interface CategoryPair {
  vi: string
  en: string
}

export default function FAQManagerPage() {
  const [items, setItems] = useState<any[]>([])
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'vi'
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
    systemExperienceService.getFaqs({ includeHidden: true })
      .then((res) => setItems(res.data.faqs || []))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const existingCategoryPairs = useMemo(() => {
    const map = new Map<string, CategoryPair>()
    items.forEach((item) => {
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
  }, [items])

  const getCanonicalPair = (vi: string, en: string): CategoryPair => {
    const nvi = normalizeCategory(vi)
    const nen = normalizeCategory(en)
    for (const item of items) {
      if (!item.categoryVi) continue
      if (normalizeCategory(item.categoryVi).toLowerCase() === nvi.toLowerCase()) {
        return {
          vi: normalizeCategory(item.categoryVi),
          en: item.categoryEn ? normalizeCategory(item.categoryEn) : nen,
        }
      }
    }
    for (const item of items) {
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

  const resetCategoryFields = () => {
    setSelectedCategoryVi(undefined)
    setSelectedCategoryEn(undefined)
    setNewCategoryVi('')
    setNewCategoryEn('')
  }

  const openAddModal = () => {
    setEditing(null)
    form.resetFields()
    resetCategoryFields()
    setOpen(true)
  }

  const openEditModal = (row: any) => {
    setEditing(row)
    form.setFieldsValue(row)
    const vi = row.categoryVi
    const en = row.categoryEn
    if (vi || en) {
      const nvi = vi ? normalizeCategory(vi) : ''
      const nen = en ? normalizeCategory(en) : ''
      const match = existingCategoryPairs.find(
        (p) => (
          nvi && normalizeCategory(p.vi).toLowerCase() === nvi.toLowerCase()
        ) || (
          nen && normalizeCategory(p.en).toLowerCase() === nen.toLowerCase()
        ),
      )
      if (match) {
        setSelectedCategoryVi(match.vi)
        setSelectedCategoryEn(match.en)
        setNewCategoryVi('')
        setNewCategoryEn('')
      } else {
        setSelectedCategoryVi(undefined)
        setSelectedCategoryEn(undefined)
        setNewCategoryVi(nvi)
        setNewCategoryEn(nen)
      }
    } else {
      resetCategoryFields()
    }
    setOpen(true)
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
    const hasNew = newCategoryVi.trim() && newCategoryEn.trim()

    if (hasSelected) {
      values.categoryVi = selectedCategoryVi
      values.categoryEn = selectedCategoryEn
    } else if (hasNew) {
      const pair = getCanonicalPair(newCategoryVi, newCategoryEn)
      values.categoryVi = pair.vi
      values.categoryEn = pair.en
    } else {
      message.error(t('system_experience.admin.category_required'))
      return
    }

    try {
      if (editing) await systemExperienceService.updateFaq(editing._id, values)
      else await systemExperienceService.createFaq(values)
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

  return (
    <DashboardLayout>
      <div className="grid gap-4">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">{t('system_experience.admin.faq_manager')}</h1><Button type="primary" onClick={openAddModal}>{t('system_experience.admin.add_faq')}</Button></div>
        <Table rowKey="_id" loading={loading} dataSource={items} columns={[
          { title: t('admin.table_no'), width: 70, align: 'center' as const, render: (_: any, __: any, index: number) => (page - 1) * 10 + index + 1 },
          { title: t('system_experience.admin.question'), dataIndex: lang === 'en' ? 'questionEn' : 'questionVi', render: (_: any, row: any) => lang === 'en' ? (row.questionEn || row.questionVi) : (row.questionVi || row.questionEn) },
          { title: t('system_experience.admin.category'), dataIndex: lang === 'en' ? 'categoryEn' : 'categoryVi', render: (_: any, row: any) => lang === 'en' ? (row.categoryEn || row.categoryVi) : (row.categoryVi || row.categoryEn) },
          { title: t('system_experience.admin.publish'), dataIndex: 'isPublished', render: (v) => v ? t('system_experience.admin.published') : t('system_experience.admin.hidden') },
          { title: t('system_experience.admin.actions'), render: (_, row: any) => <Space><Button onClick={() => openEditModal(row)}>{t('system_experience.admin.edit')}</Button><Button danger onClick={async () => { await systemExperienceService.deleteFaq(row._id); load() }}>{t('system_experience.admin.delete')}</Button></Space> },
        ]} pagination={{ current: page, pageSize: 10, onChange: setPage }} />
      </div>
      <Modal title={editing ? t('system_experience.admin.edit_faq') : t('system_experience.admin.add_faq')} open={open} onOk={save} onCancel={closeModal} width={600}>
        <Form form={form} layout="vertical" initialValues={{ isPublished: true }}>
          <Form.Item name="questionVi" label={t('system_experience.admin.question_vi')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="questionEn" label={t('system_experience.admin.question_en')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="answerVi" label={t('system_experience.admin.answer_vi')} rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="answerEn" label={t('system_experience.admin.answer_en')} rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item label={t('system_experience.admin.category')}>
            <div className="grid gap-3">
              {existingCategoryPairs.length > 0 && (
                <>
                  <div className="text-sm font-medium text-[var(--gs-text-soft)]">{t('system_experience.admin.category_existing_label')}</div>
                  <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                    <Select
                      placeholder="Tiếng Việt"
                      allowClear
                      value={selectedCategoryVi}
                      onChange={handleSelectVi}
                      options={existingCategoryPairs.map((p) => ({ label: p.vi, value: p.vi }))}
                    />
                    <Select
                      placeholder="English"
                      allowClear
                      value={selectedCategoryEn}
                      onChange={handleSelectEn}
                      options={existingCategoryPairs.map((p) => ({ label: p.en, value: p.en }))}
                    />
                  </div>
                </>
              )}
              <div className="text-sm font-medium text-[var(--gs-text-soft)]">{t('system_experience.admin.category_new_label')}</div>
              <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                <Input
                  placeholder={t('system_experience.admin.category_new_vi_placeholder')}
                  value={newCategoryVi}
                  onChange={(e) => {
                    setNewCategoryVi(e.target.value)
                    if (e.target.value) {
                      setSelectedCategoryVi(undefined)
                      setSelectedCategoryEn(undefined)
                    }
                  }}
                />
                <Input
                  placeholder={t('system_experience.admin.category_new_en_placeholder')}
                  value={newCategoryEn}
                  onChange={(e) => {
                    setNewCategoryEn(e.target.value)
                    if (e.target.value) {
                      setSelectedCategoryVi(undefined)
                      setSelectedCategoryEn(undefined)
                    }
                  }}
                />
              </div>
            </div>
          </Form.Item>
          <Form.Item name="isPublished" label={t('system_experience.admin.publish')} valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
