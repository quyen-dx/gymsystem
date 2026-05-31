import { Button, Form, Input, Modal, Select, Table, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { systemExperienceService } from '../../../services/systemExperienceService'

export default function FeedbackManagerPage() {
  const [items, setItems] = useState<any[]>([])
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [form] = Form.useForm()
  const load = () => { setLoading(true); systemExperienceService.getAllFeedback().then((res) => setItems(res.data.feedback || [])).finally(() => setLoading(false)) }
  useEffect(load, [])
  const save = async () => {
    const values = await form.validateFields()
    await systemExperienceService.updateFeedback(editing._id, values)
    message.success(t('system_experience.admin.save_success')); setEditing(null); form.resetFields(); load()
  }
  return (
    <DashboardLayout>
      <div className="grid gap-4">
        <h1 className="text-2xl font-semibold">{t('system_experience.admin.feedback_manager')}</h1>
        <Table rowKey="_id" loading={loading} dataSource={items} columns={[
          { title: t('admin.table_no'), width: 70, align: 'center' as const, render: (_: any, __: any, index: number) => (page - 1) * 10 + index + 1 },
          { title: t('system_experience.admin.title'), dataIndex: 'title' },
          { title: t('system_experience.admin.sender'), render: (_, r: any) => r.user?.name || r.user?.email || '-' },
          { title: t('system_experience.admin.type'), dataIndex: 'type', render: (v) => t(`system_experience.feedback.type.${v}`) },
          { title: t('system_experience.admin.priority'), dataIndex: 'priority', render: (v) => t(`system_experience.feedback.priority.${v}`) },
          { title: t('system_experience.admin.status'), dataIndex: 'status', render: (v) => <Tag>{t(`system_experience.feedback.status.${v}`)}</Tag> },
          { title: t('system_experience.admin.actions'), render: (_, row: any) => <Button onClick={() => { setEditing(row); form.setFieldsValue(row) }}>{t('system_experience.admin.reply')}</Button> },
        ]} pagination={{ current: page, pageSize: 10, onChange: setPage }} />
      </div>
      <Modal title={t('system_experience.admin.update_feedback')} open={!!editing} onOk={save} onCancel={() => setEditing(null)}>
        <p className="mb-2 whitespace-pre-wrap">{editing?.content}</p>
        <Form form={form} layout="vertical">
          <Form.Item name="status" label={t('system_experience.admin.status')}><Select options={['pending', 'reviewing', 'resolved', 'rejected'].map((v) => ({ label: t(`system_experience.feedback.status.${v}`), value: v }))} /></Form.Item>
          <Form.Item name="adminReply" label={t('system_experience.admin.admin_reply')}><Input.TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
