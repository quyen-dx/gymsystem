/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { membershipTransferService } from '../../../services/membershipTransferService'
import { useAuth } from '../../../hooks/useAuth'

const labels: Record<string, string> = { PENDING_RECIPIENT: 'Chờ người nhận', PENDING_REVIEW: 'Chờ duyệt', COMPLETED: 'Hoàn tất', REJECTED: 'Từ chối', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn' }
const colors: Record<string, string> = { PENDING_RECIPIENT: 'gold', PENDING_REVIEW: 'blue', COMPLETED: 'green', REJECTED: 'red', CANCELLED: 'default', EXPIRED: 'default' }

export default function MembershipTransfersPage() {
  const { user } = useAuth(); const [items, setItems] = useState<any[]>([]); const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false); const [recipientOptions, setRecipientOptions] = useState<any[]>([]); const [searchingRecipients, setSearchingRecipients] = useState(false); const [form] = Form.useForm()
  const load = async () => { try { const r = await membershipTransferService.mine(); setItems(r.data.data || []) } catch { message.error('Không thể tải yêu cầu chuyển nhượng') } }
  useEffect(() => { load() }, [])
  const create = async () => {
    try {
      const values = await form.validateFields()
      const recipient = recipientOptions.find((member) => (member.memberCode || member.email) === values.recipient)
      Modal.confirm({
        title: 'Xác nhận chuyển nhượng gói tập',
        content: <div>Bạn sẽ gửi yêu cầu chuyển nhượng cho <strong>{recipient?.fullName || recipient?.name || values.recipient}</strong>. Gói tập sẽ tạm khóa đặt lịch và gia hạn cho đến khi yêu cầu được xử lý.</div>,
        okText: 'Xác nhận gửi yêu cầu', cancelText: 'Quay lại',
        onOk: async () => {
          setLoading(true)
          try { await membershipTransferService.create(values.recipient, values.note); message.success('Đã gửi yêu cầu cho hội viên nhận'); setOpen(false); form.resetFields(); await load() }
          catch (e: any) { message.error(e.response?.data?.message || 'Không thể gửi yêu cầu'); throw e }
          finally { setLoading(false) }
        },
      })
    } catch (e: any) { if (e.response) message.error(e.response.data?.message || 'Không thể gửi yêu cầu') }
  }
  const respond = async (id: string, accept: boolean) => { try { await membershipTransferService.respond(id, accept); message.success(accept ? 'Đã xác nhận nhận gói' : 'Đã từ chối yêu cầu'); load() } catch (e: any) { message.error(e.response?.data?.message || 'Không thể xử lý') } }
  const cancel = async (id: string) => { try { await membershipTransferService.cancel(id); message.success('Đã hủy yêu cầu'); load() } catch (e: any) { message.error(e.response?.data?.message || 'Không thể hủy') } }
  const searchRecipients = async (search: string) => { if (search.trim().length < 2) { setRecipientOptions([]); return }; try { setSearchingRecipients(true); const r = await membershipTransferService.searchRecipients(search); setRecipientOptions(r.data.data || []) } catch { setRecipientOptions([]) } finally { setSearchingRecipients(false) } }
  return <MemberLayout><div className="mx-auto max-w-5xl p-4 md:p-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h1 className="m-0 text-2xl font-bold">Chuyển nhượng gói tập</h1><Typography.Text type="secondary">Chuyển phần thời hạn còn lại của gói cho một hội viên khác.</Typography.Text></div><Button type="primary" onClick={() => setOpen(true)}>Tạo yêu cầu</Button></div>
    <Alert className="mb-4" showIcon type="info" message="Khi gửi yêu cầu, gói của bạn tạm khóa đặt lịch và gia hạn cho đến khi yêu cầu được xử lý hoặc hủy." />
    <Card title="Yêu cầu của bạn"><Table rowKey="_id" dataSource={items} pagination={{ pageSize: 10 }} scroll={{ x: 760 }} columns={[
      { title: 'Gói tập', dataIndex: 'planId', render: (plan: any) => plan?.nameVi || plan?.nameEn || '—' },
      { title: 'Người gửi / nhận', render: (_: any, row: any) => String(row.senderId?._id || row.senderId) === String(user?._id) ? `Đến: ${row.recipientId?.memberCode || row.recipientId?.email || '—'}` : `Từ: ${row.senderId?.memberCode || row.senderId?.email || '—'}` },
      { title: 'Hết hạn', dataIndex: 'sourceEndDate', render: (v: string) => new Date(v).toLocaleDateString('vi-VN') },
      { title: 'Trạng thái', dataIndex: 'status', render: (v: string) => <Tag color={colors[v]}>{labels[v] || v}</Tag> },
      { title: 'Thao tác', render: (_: any, row: any) => <Space wrap>{String(row.recipientId?._id || row.recipientId) === String(user?._id) && row.status === 'PENDING_RECIPIENT' && <><Button size="small" type="primary" onClick={() => respond(row._id, true)}>Nhận gói</Button><Popconfirm title="Từ chối yêu cầu này?" onConfirm={() => respond(row._id, false)}><Button size="small" danger>Từ chối</Button></Popconfirm></>}{String(row.senderId?._id || row.senderId) === String(user?._id) && ['PENDING_RECIPIENT', 'PENDING_REVIEW'].includes(row.status) && <Popconfirm title="Hủy yêu cầu chuyển nhượng?" onConfirm={() => cancel(row._id)}><Button size="small" danger>Hủy</Button></Popconfirm>}</Space> },
    ]} /></Card>
    <Modal open={open} title="Tạo yêu cầu chuyển nhượng" onCancel={() => setOpen(false)} onOk={create} confirmLoading={loading} okText="Gửi yêu cầu"><Form form={form} layout="vertical"><Form.Item name="recipient" label="Tìm hội viên nhận gói" rules={[{ required: true, message: 'Chọn hội viên nhận' }]}><Select showSearch filterOption={false} onSearch={searchRecipients} loading={searchingRecipients} notFoundContent="Gõ ít nhất 2 ký tự để tìm theo tên, mã hoặc email" placeholder="Tìm hội viên..." options={recipientOptions.map((member) => ({ value: member.memberCode || member.email, label: `${member.fullName || member.name} — ${member.memberCode || member.email}` }))} /></Form.Item><Form.Item name="note" label="Ghi chú"><Input.TextArea maxLength={500} /></Form.Item></Form></Modal>
  </div></MemberLayout>
}
