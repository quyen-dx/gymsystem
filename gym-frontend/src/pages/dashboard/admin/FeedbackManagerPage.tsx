import { Button, Descriptions, Form, Image, Input, Modal, Select, Table, Tag, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { systemExperienceService } from '../../../services/systemExperienceService'
import { getUserDisplayName } from '../../../utils/userDisplay'

export default function FeedbackManagerPage() {
  const [items, setItems] = useState<any[]>([])
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

  const typeLabels: Record<string, string> = {
    suggestion: 'Góp ý',
    bug: 'Lỗi',
    complaint: 'Khiếu nại',
    other: 'Khác',
  }
  const priorityLabels: Record<string, string> = {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
    urgent: 'Khẩn cấp',
  }
  const statusLabels: Record<string, string> = {
    pending: 'Chờ xử lý',
    reviewing: 'Đang xem xét',
    resolved: 'Đã giải quyết',
    rejected: 'Từ chối',
  }

  const typeOptions = ['suggestion', 'bug', 'complaint', 'other'].map((value) => ({ label: typeLabels[value], value }))
  const priorityOptions = ['low', 'medium', 'high', 'urgent'].map((value) => ({ label: priorityLabels[value], value }))
  const statusOptions = ['pending', 'reviewing', 'resolved', 'rejected'].map((value) => ({ label: statusLabels[value], value }))

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
    message.success('Lưu thành công'); setEditing(null); form.resetFields(); load()
  }
  const renderAttachments = (attachments: any[] = []) => {
    if (!attachments.length) return '-'
    return (
      <Image.PreviewGroup>
        <div className="flex items-center gap-2">
          <Image width={34} height={34} className="rounded object-cover" src={attachments[0].url} alt="Xem ảnh" />
          <span>{attachments.length} ảnh</span>
        </div>
        {attachments.slice(1).map((item) => <Image key={item.url} className="hidden" src={item.url} alt="Xem ảnh" />)}
      </Image.PreviewGroup>
    )
  }

  return (
    <DashboardLayout>
      <div className="grid gap-4">
        <h1 className="text-2xl font-semibold">Quản lý phản hồi</h1>
        <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,180px)_minmax(0,200px)_minmax(0,190px)_minmax(220px,1fr)_auto]">
            <Select
              value={typeFilter}
              onChange={(value) => { setTypeFilter(value); setPage(1) }}
              options={[{ label: 'Tất cả loại', value: '' }, ...typeOptions]}
            />
            <Select
              value={priorityFilter}
              onChange={(value) => { setPriorityFilter(value); setPage(1) }}
              options={[{ label: 'Tất cả mức độ', value: '' }, ...priorityOptions]}
            />
            <Select
              value={statusFilter}
              onChange={(value) => { setStatusFilter(value); setPage(1) }}
              options={[{ label: 'Tất cả trạng thái', value: '' }, ...statusOptions]}
            />
            <Input.Search
              allowClear
              placeholder="Tìm kiếm phản hồi..."
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            />
            <Button onClick={resetFilters}>Xóa bộ lọc</Button>
          </div>
          <div className="mt-3 text-sm text-[var(--theme-muted)]">
            Có {filteredItems.length} kết quả
          </div>
        </div>
        <Table rowKey="_id" loading={loading} dataSource={filteredItems} columns={[
          { title: 'STT', width: 70, align: 'center' as const, render: (_: any, __: any, index: number) => (page - 1) * 10 + index + 1 },
          { title: 'Tiêu đề', dataIndex: 'title' },
          { title: 'Người gửi', render: (_, r: any) => getUserDisplayName(r.user, r.user?.email || '-') },
          { title: 'Loại', dataIndex: 'type', render: (v) => typeLabels[v] || v },
          { title: 'Mức độ', dataIndex: 'priority', render: (v) => priorityLabels[v] || v },
          { title: 'Trạng thái', dataIndex: 'status', render: (v) => <Tag>{statusLabels[v] || v}</Tag> },
          { title: 'Tệp đính kèm', dataIndex: 'attachments', render: renderAttachments },
          { title: 'Thao tác', render: (_, row: any) => <Button onClick={() => { setEditing(row); form.setFieldsValue(row) }}>Phản hồi</Button> },
        ]} pagination={{ current: page, pageSize: 10, onChange: setPage }} />
      </div>
      <Modal width={760} title="Cập nhật phản hồi" open={!!editing} onOk={save} onCancel={() => setEditing(null)}>
        {editing && (
          <Descriptions className="mb-4" bordered size="small" column={1}>
            <Descriptions.Item label="Tiêu đề">{editing.title}</Descriptions.Item>
            <Descriptions.Item label="Nội dung"><div className="select-text whitespace-pre-wrap">{editing.content}</div></Descriptions.Item>
            <Descriptions.Item label="Loại">{typeLabels[editing.type] || editing.type}</Descriptions.Item>
            <Descriptions.Item label="Mức độ">{priorityLabels[editing.priority] || editing.priority}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">{statusLabels[editing.status] || editing.status}</Descriptions.Item>
            <Descriptions.Item label="Tệp đính kèm">
              {editing.attachments?.length ? (
                <Image.PreviewGroup>
                  <div className="flex flex-wrap gap-2">
                    {editing.attachments.map((item: any) => (
                      <Image key={item.url} width={86} height={86} className="rounded object-cover" src={item.url} alt="Xem ảnh" />
                    ))}
                  </div>
                </Image.PreviewGroup>
              ) : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="status" label="Trạng thái"><Select options={['pending', 'reviewing', 'resolved', 'rejected'].map((v) => ({ label: statusLabels[v], value: v }))} /></Form.Item>
          <Form.Item name="adminReply" label="Phản hồi của quản trị viên"><Input.TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
