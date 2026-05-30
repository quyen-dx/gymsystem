import { Button, Card, Empty, Form, Input, List, Select, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { systemExperienceService } from '../../../services/systemExperienceService'

export default function MyFeedbackPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const load = () => systemExperienceService.getMyFeedback().then((res) => setItems(res.data.feedback || []))
  useEffect(() => { load() }, [])
  const submit = async (values: any) => {
    setLoading(true)
    try { await systemExperienceService.createFeedback(values); message.success(t('system_experience.feedback.success')); form.resetFields(); load() }
    catch (error: any) { message.error(error.response?.data?.message || t('system_experience.feedback.failed')) }
    finally { setLoading(false) }
  }
  return (
    <MemberLayout>
      <div className="member-page grid gap-5">
        <Card title={t('system_experience.feedback.form_title')}>
          <Form form={form} layout="vertical" onFinish={submit} initialValues={{ type: 'suggestion', priority: 'medium' }}>
            <Form.Item name="title" label={t('system_experience.feedback.title_label')} rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="content" label={t('system_experience.feedback.content_label')} rules={[{ required: true }]}><Input.TextArea rows={4} /></Form.Item>
            <div className="grid gap-3 md:grid-cols-2">
              <Form.Item name="type" label={t('system_experience.feedback.type_label')}><Select options={['suggestion', 'bug', 'complaint', 'other'].map((v) => ({ label: t(`system_experience.feedback.type.${v}`), value: v }))} /></Form.Item>
              <Form.Item name="priority" label={t('system_experience.feedback.priority_label')}><Select options={['low', 'medium', 'high', 'urgent'].map((v) => ({ label: t(`system_experience.feedback.priority.${v}`), value: v }))} /></Form.Item>
            </div>
            <Button type="primary" htmlType="submit" loading={loading}>{t('system_experience.feedback.submit')}</Button>
          </Form>
        </Card>
        <Card title={t('system_experience.feedback.my_title')}>
          {items.length === 0 ? <Empty description={t('system_experience.feedback.empty')} /> : <List dataSource={items} renderItem={(item) => <List.Item><List.Item.Meta title={<span>{item.title} <Tag>{t(`system_experience.feedback.status.${item.status}`)}</Tag></span>} description={<div className="whitespace-pre-wrap">{item.content}{item.adminReply && <div className="mt-2 text-[var(--theme-accent)]">{t('system_experience.feedback.admin_reply')}: {item.adminReply}</div>}</div>} /></List.Item>} />}
        </Card>
      </div>
    </MemberLayout>
  )
}
