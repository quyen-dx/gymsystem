/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { Button, Descriptions, Drawer, Form, Input, Modal, Select, Space, Table, Tag, Upload, message } from 'antd'
import { EyeOutlined, UploadOutlined } from '@ant-design/icons'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { payoutService } from '../../../services/payoutService'
import { getUserDisplayName } from '../../../utils/userDisplay'

const money = (v: number) => `${Number(v || 0).toLocaleString('vi-VN')}đ`
const labels: Record<string, string> = { PENDING_REVIEW: 'Chờ duyệt', APPROVED: 'Đã duyệt', TRANSFERRED: 'Đã chuyển', DISPUTED: 'Khiếu nại', COMPLETED: 'Hoàn thành', REJECTED: 'Từ chối', CANCELLED: 'Đã hủy' }
const colors: Record<string, string> = { PENDING_REVIEW: 'gold', APPROVED: 'blue', TRANSFERRED: 'processing', DISPUTED: 'red', COMPLETED: 'green', REJECTED: 'red', CANCELLED: 'default' }

export default function AdminPayoutRequestsPage() {
  const [rows, setRows] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [status, setStatus] = useState(''); const [search, setSearch] = useState(''); const [detail, setDetail] = useState<any>(null); const [proofPreview, setProofPreview] = useState<string | null>(null); const [action, setAction] = useState<{ type: string; row: any } | null>(null); const [form] = Form.useForm()
  const load = async () => { setLoading(true); try { const r = await payoutService.adminList({ status: status || undefined, search: search || undefined, limit: 50 }); setRows(r.data.data?.requests || []) } catch { message.error('Không thể tải yêu cầu rút tiền') } finally { setLoading(false) } }
  useEffect(() => { load() }, [status])
  const submit = async () => { if (!action) return; try { const values = await form.validateFields(); const fd = new FormData(); Object.entries(values).forEach(([k, v]) => { if (k === 'proof' && (v as any)?.file?.originFileObj) fd.append('transferProof', (v as any).file.originFileObj); else if (k !== 'proof' && v !== undefined) fd.append(k, String(v)) }); if (action.type === 'reject') await payoutService.reject(action.row._id, values.reason); else if (action.type === 'transfer') await payoutService.markTransferred(action.row._id, fd); else if (action.type === 'retransfer' || action.type === 'complete') { fd.set('action', action.type === 'retransfer' ? 'retransfer' : 'complete'); await payoutService.resolve(action.row._id, fd) } else if (action.type === 'approve') await payoutService.approve(action.row._id); message.success('Đã cập nhật yêu cầu'); setAction(null); form.resetFields(); load() } catch (e: any) { message.error(e.response?.data?.message || e.message || 'Không thể xử lý yêu cầu') } }
  const open = (type: string, row: any) => { form.resetFields(); setAction({ type, row }) }
  const actionTitle: Record<string, string> = { approve: 'Duyệt yêu cầu', reject: 'Từ chối yêu cầu', transfer: 'Đánh dấu đã chuyển khoản', retransfer: 'Chuyển khoản lại', complete: 'Xác minh đã nhận tiền' }
  return (
    <DashboardLayout>
      <div className="p-5 md:p-9">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="m-0 text-3xl font-semibold">Quản lý yêu cầu rút tiền</h1>
            <p className="mb-0 text-[var(--gs-text-muted)]">Chuyển khoản thủ công từ ví hội viên.</p>
          </div>
          <Space>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} onPressEnter={load} placeholder="Tên, email, mã hội viên" />
            <Button onClick={load}>Tìm</Button>
          </Space>
        </div>
        <div className="mb-4">
          <Select value={status} className="min-w-48" onChange={setStatus} options={[{ value: '', label: 'Tất cả' }, ...Object.keys(labels).map((key) => ({ value: key, label: labels[key] }))]} />
        </div>
        <Table
          rowKey="_id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1000 }}
          columns={[
            { title: 'Hội viên', dataIndex: 'memberId', render: (m: any) => <>{getUserDisplayName(m, '—')}<br /><small>{m?.memberCode || m?.email}</small></> },
            { title: 'Số tiền', dataIndex: 'amount', render: money },
            { title: 'Ngân hàng', render: (_: any, row: any) => <>{row.bankSnapshot?.bankName}<br /><small>{row.bankSnapshot?.accountNumber}</small></> },
            { title: 'Trạng thái', dataIndex: 'status', render: (s: string) => <Tag color={colors[s]}>{labels[s] || s}</Tag> },
            { title: 'Ngày tạo', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString('vi-VN') },
            {
              title: 'Thao tác',
              render: (_: any, row: any) => <Space wrap>
                <Button size="small" icon={<EyeOutlined />} onClick={async () => { const r = await payoutService.adminGet(row._id); setDetail(r.data.data) }}>Xem</Button>
                {row.status === 'PENDING_REVIEW' && <><Button size="small" type="primary" onClick={() => open('approve', row)}>Duyệt</Button><Button size="small" danger onClick={() => open('reject', row)}>Từ chối</Button></>}
                {row.status === 'APPROVED' && <><Button size="small" type="primary" onClick={() => open('transfer', row)}>Đã chuyển</Button><Button size="small" danger onClick={() => open('reject', row)}>Từ chối</Button></>}
                {row.status === 'DISPUTED' && <><Button size="small" onClick={() => open('retransfer', row)}>Chuyển lại</Button><Button size="small" type="primary" onClick={() => open('complete', row)}>Xác minh</Button></>}
              </Space>,
            },
          ]}
        />
        <Drawer width={560} open={!!detail} onClose={() => setDetail(null)} title="Chi tiết yêu cầu rút tiền">
          {detail && <Descriptions column={1} bordered size="small" items={[
            { key: 'member', label: 'Hội viên', children: getUserDisplayName(detail.memberId, '—') },
            { key: 'amount', label: 'Số tiền', children: money(detail.amount) },
            { key: 'bank', label: 'Ngân hàng', children: `${detail.bankSnapshot?.bankName} (${detail.bankSnapshot?.bankCode})` },
            { key: 'account', label: 'Tài khoản', children: `${detail.bankSnapshot?.accountNumber} — ${detail.bankSnapshot?.accountHolder}` },
            { key: 'status', label: 'Trạng thái', children: <Tag color={colors[detail.status]}>{labels[detail.status]}</Tag> },
            { key: 'ref', label: 'Mã giao dịch', children: detail.transferReference || '—' },
            { key: 'proof', label: 'Bill', children: detail.transferProof ? <Button type="link" className="!px-0" onClick={() => setProofPreview(detail.transferProof)}>Xem bill</Button> : '—' },
            { key: 'dispute', label: 'Khiếu nại', children: detail.disputeReason || '—' },
            { key: 'cancelReason', label: 'Lý do hủy', children: detail.cancelReason || '—' },
            { key: 'time', label: 'Thời gian chuyển', children: detail.transferredAt ? new Date(detail.transferredAt).toLocaleString('vi-VN') : '—' },
          ]} />}
        </Drawer>
        <Modal open={!!proofPreview} title="Bill chuyển khoản" footer={null} onCancel={() => setProofPreview(null)} centered width={760}>
          {proofPreview && <img src={proofPreview} alt="Bill chuyển khoản" className="max-h-[70vh] w-full object-contain" />}
        </Modal>
        <Modal open={!!action} title={action ? actionTitle[action.type] : ''} onCancel={() => setAction(null)} onOk={submit} okText="Xác nhận">
          <Form form={form} layout="vertical">
            {action?.type === 'reject' && <Form.Item name="reason" label="Lý do từ chối" rules={[{ required: true }]}><Input.TextArea /></Form.Item>}
            {['transfer', 'retransfer'].includes(action?.type || '') && <>
              <Form.Item name="transferReference" label="Mã tham chiếu" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item
                name="proof"
                label="Bill chuyển khoản"
                rules={[{ required: true, message: 'Tải bill chuyển khoản' }]}
                valuePropName="file"
                getValueProps={() => ({})}
                getValueFromEvent={(event) => event?.fileList?.length ? { file: event.fileList[0] } : undefined}
              >
                <Upload maxCount={1} accept="image/*" beforeUpload={() => false}>
                  <Button icon={<UploadOutlined />}>Chọn ảnh bill</Button>
                </Upload>
              </Form.Item>
            </>}
            {action?.type === 'complete' && <Form.Item name="resolutionNote" label="Ghi chú xác minh"><Input.TextArea /></Form.Item>}
          </Form>
        </Modal>
      </div>
    </DashboardLayout>
  )
}
