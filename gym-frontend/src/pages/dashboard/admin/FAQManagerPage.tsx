import { Button, Form, Input, Modal, Space, Switch, Table, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { systemExperienceService } from '../../../services/systemExperienceService'

export default function FAQManagerPage() {
  const [items, setItems] = useState<any[]>([])
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [form] = Form.useForm()

  const load = () => {
    setLoading(true)
    systemExperienceService.getFaqs({ includeHidden: true })
      .then((res) => setItems(res.data.faqs || []))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const save = async () => {
    const values = await form.validateFields()
    try {
      if (editing) await systemExperienceService.updateFaq(editing._id, values)
      else await systemExperienceService.createFaq(values)
      message.success(t('system_experience.admin.save_success'))
      setOpen(false); setEditing(null); form.resetFields(); load()
    } catch (error: any) {
      message.error(error.response?.data?.message || t('system_experience.admin.save_failed'))
    }
  }

  return (
    <DashboardLayout>
      <div className="grid gap-4">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">{t('system_experience.admin.faq_manager')}</h1><Button type="primary" onClick={() => setOpen(true)}>{t('system_experience.admin.add_faq')}</Button></div>
        <Table rowKey="_id" loading={loading} dataSource={items} columns={[
          { title: t('admin.table_no'), width: 70, align: 'center' as const, render: (_: any, __: any, index: number) => (page - 1) * 10 + index + 1 },
          { title: t('system_experience.admin.question'), dataIndex: 'question' },
          { title: t('system_experience.admin.category'), dataIndex: 'category' },
          { title: t('system_experience.admin.publish'), dataIndex: 'isPublished', render: (v) => v ? t('system_experience.admin.published') : t('system_experience.admin.hidden') },
          { title: t('system_experience.admin.actions'), render: (_, row: any) => <Space><Button onClick={() => { setEditing(row); form.setFieldsValue(row); setOpen(true) }}>{t('system_experience.admin.edit')}</Button><Button danger onClick={async () => { await systemExperienceService.deleteFaq(row._id); load() }}>{t('system_experience.admin.delete')}</Button></Space> },
        ]} pagination={{ current: page, pageSize: 10, onChange: setPage }} />
      </div>
      <Modal title={editing ? t('system_experience.admin.edit_faq') : t('system_experience.admin.add_faq')} open={open} onOk={save} onCancel={() => { setOpen(false); setEditing(null); form.resetFields() }}>
        <Form form={form} layout="vertical" initialValues={{ category: 'Chung', isPublished: true }}>
          <Form.Item name="question" label={t('system_experience.admin.question')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="answer" label={t('system_experience.admin.answer')} rules={[{ required: true }]}><Input.TextArea rows={4} /></Form.Item>
          <Form.Item name="category" label={t('system_experience.admin.category')}><Input /></Form.Item>
          <Form.Item name="isPublished" label={t('system_experience.admin.publish')} valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
