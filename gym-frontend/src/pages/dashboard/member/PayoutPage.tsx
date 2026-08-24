/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { Alert, Button, Card, Descriptions, Form, Input, InputNumber, Modal, Popconfirm, Space, Table, Tag, Typography, message } from 'antd'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { payoutService } from '../../../services/payoutService'
import { useWallet } from '../../../context/WalletProvider'

const { Text } = Typography
const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const labels: Record<string, string> = {
  PENDING_REVIEW: 'Chờ duyệt', APPROVED: 'Đã duyệt', TRANSFERRED: 'Đã chuyển',
  DISPUTED: 'Khiếu nại', COMPLETED: 'Hoàn thành', REJECTED: 'Từ chối', CANCELLED: 'Đã hủy',
}
const colors: Record<string, string> = {
  PENDING_REVIEW: 'gold', APPROVED: 'blue', TRANSFERRED: 'processing',
  DISPUTED: 'red', COMPLETED: 'green', REJECTED: 'red', CANCELLED: 'default',
}

export default function PayoutPage() {
  const [summary, setSummary] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [form] = Form.useForm()
  const { refreshWallet } = useWallet()

  const load = async () => {
    try {
      const [summaryResult, requestsResult] = await Promise.all([payoutService.getSummary(), payoutService.mine()])
      setSummary(summaryResult.data.data)
      setRequests(requestsResult.data.data || [])
    } catch {
      message.error('Không thể tải dữ liệu rút tiền')
    }
  }

  useEffect(() => { load() }, [])

  const refresh = async () => {
    await load()
    await refreshWallet()
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      await payoutService.create(values)
      message.success('Đã gửi yêu cầu rút tiền')
      setOpen(false)
      form.resetFields()
      refresh()
    } catch (error: any) {
      if (error?.response) message.error(error.response.data?.message || 'Không thể tạo yêu cầu')
    } finally {
      setLoading(false)
    }
  }

  const cancel = async (id: string) => {
    try {
      await payoutService.cancel(id)
      message.success('Đã hủy yêu cầu')
      refresh()
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Không thể hủy')
    }
  }

  const confirm = async (id: string) => {
    try {
      await payoutService.confirm(id)
      message.success('Đã xác nhận nhận tiền')
      refresh()
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Không thể xác nhận')
    }
  }

  const dispute = (id: string) => Modal.confirm({
    title: 'Báo chưa nhận tiền',
    content: <Input id="payout-dispute-reason" placeholder="Nêu lý do khiếu nại" />,
    onOk: async () => {
      const reason = (document.getElementById('payout-dispute-reason') as HTMLInputElement)?.value
      if (!reason?.trim()) throw new Error('Nhập lý do')
      await payoutService.dispute(id, reason)
      message.success('Đã gửi khiếu nại')
      refresh()
    },
  })

  return (
    <MemberLayout>
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-bold">Rút tiền từ ví</h1>
            <Text type="secondary">Yêu cầu rút tiền sẽ được Admin xử lý thủ công.</Text>
          </div>
          <Button type="primary" onClick={() => setOpen(true)}>Rút tiền</Button>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <Card><Text type="secondary">Số dư khả dụng</Text><div className="text-xl font-semibold">{money(summary?.balance)}</div></Card>
          <Card><Text type="secondary">Tiền đang chờ rút</Text><div className="text-xl font-semibold">{money(summary?.lockedBalance)}</div></Card>
          <Card><Text type="secondary">Số tiền có thể rút</Text><div className="text-xl font-semibold text-green-600">{money(summary?.withdrawableBalance)}</div></Card>
        </div>

        <Alert className="mb-4" type="info" showIcon message="Tiền thưởng/khuyến mãi không thể rút. Tiền bị khóa sẽ không thể dùng để thanh toán." />

        <Card title="Lịch sử yêu cầu">
          <Table
            rowKey="_id"
            dataSource={requests}
            pagination={{ pageSize: 10 }}
            columns={[
              { title: 'Số tiền', dataIndex: 'amount', render: money },
              { title: 'Ngân hàng', render: (_: any, row: any) => <>{row.bankSnapshot?.bankName}<br /><Text type="secondary">{row.bankSnapshot?.accountNumber}</Text></> },
              { title: 'Trạng thái', dataIndex: 'status', render: (status: string) => <Tag color={colors[status]}>{labels[status] || status}</Tag> },
              { title: 'Ngày tạo', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString('vi-VN') },
              {
                title: 'Thao tác',
                render: (_: any, row: any) => <Space>
                  <Button size="small" onClick={() => setSelectedRequest(row)}>Xem chi tiết</Button>
                  {row.status === 'PENDING_REVIEW' && <Popconfirm title="Hủy yêu cầu này?" onConfirm={() => cancel(row._id)}><Button size="small" danger>Hủy yêu cầu</Button></Popconfirm>}
                  {row.status === 'TRANSFERRED' && <><Button size="small" type="primary" onClick={() => confirm(row._id)}>Đã nhận tiền</Button><Button size="small" danger onClick={() => dispute(row._id)}>Chưa nhận được</Button></>}
                  {row.transferProof && <Button size="small" onClick={() => setProofPreview(row.transferProof)}>Xem bill</Button>}
                </Space>,
              },
            ]}
          />
        </Card>

        <Modal open={!!proofPreview} title="Bill chuyển khoản" footer={null} onCancel={() => setProofPreview(null)} centered width={760}>
          {proofPreview && <img src={proofPreview} alt="Bill chuyển khoản" className="max-h-[70vh] w-full object-contain" />}
        </Modal>

        <Modal open={!!selectedRequest} title="Chi tiết yêu cầu rút tiền" footer={null} onCancel={() => setSelectedRequest(null)}>
          {selectedRequest && <Descriptions column={1} bordered size="small" items={[
            { key: 'amount', label: 'Số tiền', children: money(selectedRequest.amount) },
            { key: 'bank', label: 'Ngân hàng', children: `${selectedRequest.bankSnapshot?.bankName || '—'} (${selectedRequest.bankSnapshot?.bankCode || '—'})` },
            { key: 'account', label: 'Tài khoản', children: `${selectedRequest.bankSnapshot?.accountNumber || '—'} — ${selectedRequest.bankSnapshot?.accountHolder || '—'}` },
            { key: 'status', label: 'Trạng thái', children: <Tag color={colors[selectedRequest.status]}>{labels[selectedRequest.status] || selectedRequest.status}</Tag> },
            { key: 'created', label: 'Thời gian gửi', children: selectedRequest.createdAt ? new Date(selectedRequest.createdAt).toLocaleString('vi-VN') : '—' },
            { key: 'reference', label: 'Mã tham chiếu', children: selectedRequest.transferReference || '—' },
            { key: 'transferred', label: 'Thời gian chuyển', children: selectedRequest.transferredAt ? new Date(selectedRequest.transferredAt).toLocaleString('vi-VN') : '—' },
            { key: 'proof', label: 'Bill chuyển khoản', children: selectedRequest.transferProof ? <Button type="link" className="!px-0" onClick={() => setProofPreview(selectedRequest.transferProof)}>Xem bill</Button> : '—' },
            { key: 'cancelReason', label: 'Lý do hủy', children: selectedRequest.cancelReason || '—' },
            { key: 'note', label: 'Ghi chú', children: selectedRequest.memberNote || '—' },
          ]} />}
        </Modal>

        <Modal open={open} title="Tạo yêu cầu rút tiền" onCancel={() => setOpen(false)} onOk={submit} confirmLoading={loading} okText="Gửi yêu cầu">
          <Form form={form} layout="vertical">
            <Form.Item name="amount" label="Số tiền" rules={[{ required: true, message: 'Nhập số tiền' }]}>
              <InputNumber className="w-full" min={10000} formatter={(value) => `${value || ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>
            <Form.Item name="bankCode" label="Mã ngân hàng" rules={[{ required: true }]}><Input placeholder="VD: MB" /></Form.Item>
            <Form.Item name="bankName" label="Tên ngân hàng" rules={[{ required: true }]}><Input placeholder="VD: MB Bank" /></Form.Item>
            <Form.Item name="accountNumber" label="Số tài khoản" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="accountHolder" label="Chủ tài khoản" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="note" label="Ghi chú"><Input.TextArea maxLength={500} /></Form.Item>
          </Form>
        </Modal>
      </div>
    </MemberLayout>
  )
}
