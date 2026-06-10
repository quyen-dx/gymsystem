import { Button, Card, Empty, Form, Image, Input, Select, Table, Tag, Upload, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { systemExperienceService } from '../../../services/systemExperienceService'

export default function MyFeedbackPage() {
  const { t, i18n } = useTranslation()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [fileList, setFileList] = useState<any[]>([])
  const [form] = Form.useForm()
  const load = () => systemExperienceService.getMyFeedback().then((res) => setItems(res.data.feedback || []))
  useEffect(() => { load() }, [])
  const submit = async (values: any) => {
    setLoading(true)
    try {
      const payload = new FormData()
      Object.entries(values).forEach(([key, value]) => payload.append(key, String(value || '')))
      fileList.forEach((file) => payload.append('attachments', file.originFileObj))
      await systemExperienceService.createFeedback(payload)
      message.success(t('system_experience.feedback.success'))
      form.resetFields()
      setFileList([])
      load()
    }
    catch (error: any) { message.error(error.response?.data?.message || t('system_experience.feedback.failed')) }
    finally { setLoading(false) }
  }
  const beforeUpload = (file: any) => {
    const validType = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'].includes(file.type)
    if (!validType) {
      message.error(t('system_experience.feedback.image_required'))
      return Upload.LIST_IGNORE
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error(t('system_experience.feedback.image_size_limit'))
      return Upload.LIST_IGNORE
    }
    if (fileList.length >= 3) {
      message.error(t('system_experience.feedback.image_count_limit'))
      return Upload.LIST_IGNORE
    }
    return false
  }
  const renderAttachments = (attachments: any[] = []) => {
    if (!attachments.length) return '-'
    return (
      <Image.PreviewGroup>
        <div className="flex items-center gap-2">
          <Image width={36} height={36} className="rounded object-cover" src={attachments[0].url} alt={t('system_experience.feedback.view_image')} />
          <span>{t('system_experience.feedback.image_count', { count: attachments.length })}</span>
        </div>
        {attachments.slice(1).map((item) => <Image key={item.url} className="hidden" src={item.url} alt={t('system_experience.feedback.view_image')} />)}
      </Image.PreviewGroup>
    )
  }
  const statusColor: Record<string, string> = {
    pending: 'gold',
    reviewing: 'blue',
    resolved: 'green',
    rejected: 'default',
  }
  const columns = [
    { title: t('admin.table_no'), width: 70, align: 'center' as const, render: (_: any, __: any, index: number) => index + 1 },
    { title: t('system_experience.feedback.title_label'), dataIndex: 'title', width: 220 },
    { title: t('system_experience.feedback.type_label'), dataIndex: 'type', width: 130, render: (value: string) => t(`system_experience.feedback.type.${value}`) },
    { title: t('system_experience.feedback.priority_label'), dataIndex: 'priority', width: 130, render: (value: string) => t(`system_experience.feedback.priority.${value}`) },
    { title: t('system_experience.feedback.status_label'), dataIndex: 'status', width: 140, render: (value: string) => <Tag color={statusColor[value] || 'default'}>{t(`system_experience.feedback.status.${value}`)}</Tag> },
    { title: t('system_experience.feedback.sent_at'), dataIndex: 'createdAt', width: 160, render: (value: string) => value ? new Date(value).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US') : '-' },
    { title: t('system_experience.feedback.attachments'), dataIndex: 'attachments', width: 140, render: renderAttachments },
    { title: t('system_experience.feedback.admin_reply'), dataIndex: 'adminReply', width: 260, render: (value: string) => value || t('system_experience.feedback.no_admin_reply') },
  ]

  return (
    <MemberLayout>
      <div className="member-page grid gap-5">
        <Card className="no-select" title={t('system_experience.feedback.form_title')}>
          <Form form={form} layout="vertical" onFinish={submit} initialValues={{ type: 'suggestion', priority: 'medium' }}>
            <Form.Item name="title" label={t('system_experience.feedback.title_label')} rules={[{ required: true }]}><Input className="select-text" /></Form.Item>
            <Form.Item name="content" label={t('system_experience.feedback.content_label')} rules={[{ required: true }]}><Input.TextArea className="select-text" rows={4} /></Form.Item>
            <Form.Item label={t('system_experience.feedback.attachments')}>
              <Upload
                accept="image/png,image/jpg,image/jpeg,image/webp,image/gif,image/svg+xml"
                beforeUpload={beforeUpload}
                fileList={fileList}
                listType="picture-card"
                multiple
                maxCount={3}
                onChange={({ fileList: nextList }) => setFileList(nextList.slice(0, 3))}
              >
                {fileList.length < 3 && <span>{t('system_experience.feedback.upload_images')}</span>}
              </Upload>
            </Form.Item>
            <div className="grid gap-3 md:grid-cols-2">
              <Form.Item name="type" label={t('system_experience.feedback.type_label')}><Select options={['suggestion', 'bug', 'complaint', 'other'].map((v) => ({ label: t(`system_experience.feedback.type.${v}`), value: v }))} /></Form.Item>
              <Form.Item name="priority" label={t('system_experience.feedback.priority_label')}><Select options={['low', 'medium', 'high', 'urgent'].map((v) => ({ label: t(`system_experience.feedback.priority.${v}`), value: v }))} /></Form.Item>
            </div>
            <Button className="tap-transparent no-select" type="primary" htmlType="submit" loading={loading}>{t('system_experience.feedback.submit')}</Button>
          </Form>
        </Card>
        <Card className="no-select" title={t('system_experience.feedback.my_title')}>
          {items.length === 0 ? <Empty description={t('system_experience.feedback.empty')} /> : (
            <div className="select-text member-scroll-x">
              <Table rowKey="_id" dataSource={items} columns={columns} pagination={{ pageSize: 10 }} scroll={{ x: 1250 }} />
            </div>
          )}
        </Card>
      </div>
    </MemberLayout>
  )
}
