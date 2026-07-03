import { Button, Card, Empty, Form, Image, Input, Select, Table, Tag, Upload, message } from 'antd'
import { useEffect, useState } from 'react'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { systemExperienceService } from '../../../services/systemExperienceService'

const typeLabels: Record<string, string> = { suggestion: 'Góp ý', bug: 'Báo lỗi', complaint: 'Khiếu nại', other: 'Khác' }
const priorityLabels: Record<string, string> = { low: 'Thấp', medium: 'Trung bình', high: 'Cao', urgent: 'Khẩn cấp' }
const statusLabels: Record<string, string> = { pending: 'Chờ xử lý', reviewing: 'Đang xem xét', resolved: 'Đã giải quyết', rejected: 'Từ chối' }

export default function MyFeedbackPage() {
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
      message.success('Gửi phản hồi thành công')
      form.resetFields()
      setFileList([])
      load()
    }
    catch (error: any) { message.error(error.response?.data?.message || 'Gửi phản hồi thất bại') }
    finally { setLoading(false) }
  }
  const beforeUpload = (file: any) => {
    const validType = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'].includes(file.type)
    if (!validType) {
      message.error('Chỉ chấp nhận file ảnh')
      return Upload.LIST_IGNORE
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error('Ảnh không được quá 5MB')
      return Upload.LIST_IGNORE
    }
    if (fileList.length >= 3) {
      message.error('Tối đa 3 ảnh')
      return Upload.LIST_IGNORE
    }
    return false
  }
  const renderAttachments = (attachments: any[] = []) => {
    if (!attachments.length) return '-'
    return (
      <Image.PreviewGroup>
        <div className="flex items-center gap-2">
          <Image width={36} height={36} className="rounded object-cover" src={attachments[0].url} alt="Xem ảnh" />
          <span>{attachments.length} ảnh</span>
        </div>
        {attachments.slice(1).map((item) => <Image key={item.url} className="hidden" src={item.url} alt="Xem ảnh" />)}
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
    { title: 'STT', width: 70, align: 'center' as const, render: (_: any, __: any, index: number) => index + 1 },
    { title: 'Tiêu đề', dataIndex: 'title', width: 220 },
    { title: 'Loại', dataIndex: 'type', width: 130, render: (value: string) => typeLabels[value] || value },
    { title: 'Độ ưu tiên', dataIndex: 'priority', width: 130, render: (value: string) => priorityLabels[value] || value },
    { title: 'Trạng thái', dataIndex: 'status', width: 140, render: (value: string) => <Tag color={statusColor[value] || 'default'}>{statusLabels[value] || value}</Tag> },
    { title: 'Gửi lúc', dataIndex: 'createdAt', width: 160, render: (value: string) => value ? new Date(value).toLocaleString('vi-VN') : '-' },
    { title: 'Tệp đính kèm', dataIndex: 'attachments', width: 140, render: renderAttachments },
    { title: 'Phản hồi admin', dataIndex: 'adminReply', width: 260, render: (value: string) => value || 'Chưa có phản hồi' },
  ]

  return (
    <MemberLayout>
      <div className="member-page grid gap-5">
        <Card className="no-select" title="Gửi phản hồi">
          <Form form={form} layout="vertical" onFinish={submit} initialValues={{ type: 'suggestion', priority: 'medium' }}>
            <Form.Item name="title" label="Tiêu đề" rules={[{ required: true }]}><Input className="select-text" /></Form.Item>
            <Form.Item name="content" label="Nội dung" rules={[{ required: true }]}><Input.TextArea className="select-text" rows={4} /></Form.Item>
            <Form.Item label="Tệp đính kèm">
              <Upload
                accept="image/png,image/jpg,image/jpeg,image/webp,image/gif,image/svg+xml"
                beforeUpload={beforeUpload}
                fileList={fileList}
                listType="picture-card"
                multiple
                maxCount={3}
                onChange={({ fileList: nextList }) => setFileList(nextList.slice(0, 3))}
              >
                {fileList.length < 3 && <span>Tải ảnh lên</span>}
              </Upload>
            </Form.Item>
            <div className="grid gap-3 md:grid-cols-2">
              <Form.Item name="type" label="Loại"><Select options={['suggestion', 'bug', 'complaint', 'other'].map((v) => ({ label: typeLabels[v] || v, value: v }))} /></Form.Item>
              <Form.Item name="priority" label="Độ ưu tiên"><Select options={['low', 'medium', 'high', 'urgent'].map((v) => ({ label: priorityLabels[v] || v, value: v }))} /></Form.Item>
            </div>
            <Button className="tap-transparent no-select" type="primary" htmlType="submit" loading={loading}>Gửi phản hồi</Button>
          </Form>
        </Card>
        <Card className="no-select" title="Phản hồi của tôi">
          {items.length === 0 ? <Empty description="Chưa có phản hồi nào" /> : (
            <div className="select-text member-scroll-x">
              <Table rowKey="_id" dataSource={items} columns={columns} pagination={{ pageSize: 10 }} scroll={{ x: 1250 }} />
            </div>
          )}
        </Card>
      </div>
    </MemberLayout>
  )
}
