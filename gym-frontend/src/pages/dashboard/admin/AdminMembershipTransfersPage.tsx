/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { Button, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { membershipTransferService } from '../../../services/membershipTransferService'

const labels: Record<string, string> = { PENDING_RECIPIENT: 'Chờ người nhận', PENDING_REVIEW: 'Chờ duyệt', COMPLETED: 'Hoàn tất', REJECTED: 'Từ chối', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn' }
const colors: Record<string, string> = { PENDING_RECIPIENT: 'gold', PENDING_REVIEW: 'blue', COMPLETED: 'green', REJECTED: 'red', CANCELLED: 'default', EXPIRED: 'default' }
const name = (user: any) => user?.fullName || user?.name || user?.memberCode || user?.email || '—'

export default function AdminMembershipTransfersPage() {
  const [rows, setRows] = useState<any[]>([]); const [status, setStatus] = useState(''); const [loading, setLoading] = useState(false); const [rejecting, setRejecting] = useState<any>(null); const [form] = Form.useForm()
  const load = async () => { setLoading(true); try { const r = await membershipTransferService.staffList(status || undefined); setRows(r.data.data || []) } catch { message.error('Không thể tải yêu cầu chuyển nhượng') } finally { setLoading(false) } }
  useEffect(() => { load() }, [status])
  const approve = async (id: string) => { try { await membershipTransferService.approve(id); message.success('Đã duyệt và chuyển gói tập'); load() } catch (e: any) { message.error(e.response?.data?.message || 'Không thể duyệt yêu cầu') } }
  const reject = async () => { try { const { reason } = await form.validateFields(); await membershipTransferService.reject(rejecting._id, reason); message.success('Đã từ chối yêu cầu'); setRejecting(null); form.resetFields(); load() } catch (e: any) { if (e.response) message.error(e.response.data?.message || 'Không thể từ chối') } }
  return <DashboardLayout><div className="p-5 md:p-9"><div className="mb-6"><h1 className="m-0 text-3xl font-semibold">Chuyển nhượng gói tập</h1><p className="mb-0 text-[var(--gs-text-muted)]">Duyệt sau khi hội viên nhận đã xác nhận. Duyệt sẽ hủy lịch tương lai của người gửi.</p></div><Select className="mb-4 min-w-52" value={status} onChange={setStatus} options={[{ value: '', label: 'Tất cả trạng thái' }, ...Object.keys(labels).map((key) => ({ value: key, label: labels[key] }))]} /><Table rowKey="_id" loading={loading} dataSource={rows} scroll={{ x: 980 }} columns={[
    { title: 'Người gửi', dataIndex: 'senderId', render: (v: any) => <>{name(v)}<br /><small>{v?.memberCode || v?.email}</small></> },
    { title: 'Người nhận', dataIndex: 'recipientId', render: (v: any) => <>{name(v)}<br /><small>{v?.memberCode || v?.email}</small></> },
    { title: 'Gói', dataIndex: 'planId', render: (v: any) => v?.nameVi || v?.nameEn || '—' },
    { title: 'Hết hạn', dataIndex: 'sourceEndDate', render: (v: string) => new Date(v).toLocaleDateString('vi-VN') },
    { title: 'Trạng thái', dataIndex: 'status', render: (v: string) => <Tag color={colors[v]}>{labels[v] || v}</Tag> },
    { title: 'Thao tác', render: (_: any, row: any) => row.status === 'PENDING_REVIEW' ? <Space><Button type="primary" size="small" onClick={() => approve(row._id)}>Duyệt & chuyển gói</Button><Button danger size="small" onClick={() => setRejecting(row)}>Từ chối</Button></Space> : '—' },
  ]} /><Modal open={!!rejecting} title="Từ chối chuyển nhượng" onCancel={() => setRejecting(null)} onOk={reject} okText="Từ chối"><Form form={form} layout="vertical"><Form.Item name="reason" label="Lý do" rules={[{ required: true, message: 'Nhập lý do từ chối' }]}><Input.TextArea /></Form.Item></Form></Modal></div></DashboardLayout>
}
