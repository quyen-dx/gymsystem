import { Button, Descriptions, Form, Image, Input, Modal, Select, Table, Tag, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { systemExperienceService } from '../../../services/systemExperienceService'
import { getUserDisplayName } from '../../../utils/userDisplay'

export default function FeedbackManagerPage() {
  const [items, setItems] = useState<any[]>([])
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [form] = Form.useForm()
  const load = () => { setLoading(true); systemExperienceService.getAllFeedback().then((res) => setItems(res.data.feedback || [])).finally(() => setLoading(false)) }
  useEffect(load, [])

  const typeOptions = ['suggestion', 'bug', 'complaint', 'other'].map((value) => ({ label: t(`system_experience.feedback.type.${value}`), value }))
  const priorityOptions = ['low', 'medium', 'high', 'urgent'].map((value) => ({ label: t(`system_experience.feedback.priority.${value}`), value }))
  const statusOptions = ['pending', 'reviewing', 'resolved', 'rejected'].map((value) => ({ label: t(`system_experience.feedback.status.${value}`), value }))

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      const sender = getUserDisplayName(item.user, item.user?.email || '')
      const matchesSearch = !q || [item.title, item.content, sender].join(' ').toLowerCase().includes(q)
      const matchesType = !typeFilter || item.type === typeFilter
      const matchesPriority = !priorityFilter || item.priority === priorityFilter
      const matchesStatus = !statusFilter || item.status === statusFilter
      return matchesSearch && matchesType && matchesPriority && matchesStatus
    })
  }, [items, search, typeFilter, priorityFilter, statusFilter])

  const resetFilters = () => {
    setTypeFilter('')
    setPriorityFilter('')
    setStatusFilter('')
    setSearch('')
    setPage(1)
  }

  const save = async () => {
    const values = await form.validateFields()
    await systemExperienceService.updateFeedback(editing._id, values)
    message.success(t('system_experience.admin.save_success')); setEditing(null); form.resetFields(); load()
  }
  const renderAttachments = (attachments: any[] = []) => {
    if (!attachments.length) return '-'
    return (
      <Image.PreviewGroup>
        <div className="flex items-center gap-2">
          <Image width={34} height={34} className="rounded object-cover" src={attachments[0].url} alt={t('system_experience.feedback.view_image')} />
          <span>{t('system_experience.feedback.image_count', { count: attachments.length })}</span>
        </div>
        {attachments.slice(1).map((item) => <Image key={item.url} className="hidden" src={item.url} alt={t('system_experience.feedback.view_image')} />)}
      </Image.PreviewGroup>
    )
  }

  return (
    <DashboardLayout>
      <div className="grid gap-4">
        <h1 className="text-2xl font-semibold">{t('system_experience.admin.feedback_manager')}</h1>
        <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,180px)_minmax(0,200px)_minmax(0,190px)_minmax(220px,1fr)_auto]">
            <Select
              value={typeFilter}
              onChange={(value) => { setTypeFilter(value); setPage(1) }}
              options={[{ label: t('system_experience.feedback.filter_all_types'), value: '' }, ...typeOptions]}
            />
            <Select
              value={priorityFilter}
              onChange={(value) => { setPriorityFilter(value); setPage(1) }}
              options={[{ label: t('system_experience.feedback.filter_all_priorities'), value: '' }, ...priorityOptions]}
            />
            <Select
              value={statusFilter}
              onChange={(value) => { setStatusFilter(value); setPage(1) }}
              options={[{ label: t('system_experience.feedback.filter_all_statuses'), value: '' }, ...statusOptions]}
            />
            <Input.Search
              allowClear
              placeholder={t('system_experience.feedback.search_placeholder')}
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            />
            <Button onClick={resetFilters}>{t('system_experience.feedback.clear_filters')}</Button>
          </div>
          <div className="mt-3 text-sm text-[var(--theme-muted)]">
            {t('system_experience.feedback.result_count', { count: filteredItems.length })}
          </div>
        </div>
        <Table rowKey="_id" loading={loading} dataSource={filteredItems} columns={[
          { title: t('admin.table_no'), width: 70, align: 'center' as const, render: (_: any, __: any, index: number) => (page - 1) * 10 + index + 1 },
          { title: t('system_experience.admin.title'), dataIndex: 'title' },
          { title: t('system_experience.admin.sender'), render: (_, r: any) => getUserDisplayName(r.user, r.user?.email || '-') },
          { title: t('system_experience.admin.type'), dataIndex: 'type', render: (v) => t(`system_experience.feedback.type.${v}`) },
          { title: t('system_experience.admin.priority'), dataIndex: 'priority', render: (v) => t(`system_experience.feedback.priority.${v}`) },
          { title: t('system_experience.admin.status'), dataIndex: 'status', render: (v) => <Tag>{t(`system_experience.feedback.status.${v}`)}</Tag> },
          { title: t('system_experience.feedback.attachments'), dataIndex: 'attachments', render: renderAttachments },
          { title: t('system_experience.admin.actions'), render: (_, row: any) => <Button onClick={() => { setEditing(row); form.setFieldsValue(row) }}>{t('system_experience.admin.reply')}</Button> },
        ]} pagination={{ current: page, pageSize: 10, onChange: setPage }} />
      </div>
      <Modal width={760} title={t('system_experience.admin.update_feedback')} open={!!editing} onOk={save} onCancel={() => setEditing(null)}>
        {editing && (
          <Descriptions className="mb-4" bordered size="small" column={1}>
            <Descriptions.Item label={t('system_experience.admin.title')}>{editing.title}</Descriptions.Item>
            <Descriptions.Item label={t('system_experience.admin.content')}><div className="select-text whitespace-pre-wrap">{editing.content}</div></Descriptions.Item>
            <Descriptions.Item label={t('system_experience.admin.type')}>{t(`system_experience.feedback.type.${editing.type}`)}</Descriptions.Item>
            <Descriptions.Item label={t('system_experience.admin.priority')}>{t(`system_experience.feedback.priority.${editing.priority}`)}</Descriptions.Item>
            <Descriptions.Item label={t('system_experience.admin.status')}>{t(`system_experience.feedback.status.${editing.status}`)}</Descriptions.Item>
            <Descriptions.Item label={t('system_experience.feedback.attachments')}>
              {editing.attachments?.length ? (
                <Image.PreviewGroup>
                  <div className="flex flex-wrap gap-2">
                    {editing.attachments.map((item: any) => (
                      <Image key={item.url} width={86} height={86} className="rounded object-cover" src={item.url} alt={t('system_experience.feedback.view_image')} />
                    ))}
                  </div>
                </Image.PreviewGroup>
              ) : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="status" label={t('system_experience.admin.status')}><Select options={['pending', 'reviewing', 'resolved', 'rejected'].map((v) => ({ label: t(`system_experience.feedback.status.${v}`), value: v }))} /></Form.Item>
          <Form.Item name="adminReply" label={t('system_experience.admin.admin_reply')}><Input.TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
