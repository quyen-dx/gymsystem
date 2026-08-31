import { Input, Modal, Select, message } from 'antd'
import { useEffect, useState } from 'react'
import api from '../../../services/api'
import { memberService } from '../../../services/memberService'
import type { MemberPlan } from '../../../types/admin/member'

interface Props {
  open: boolean
  memberId: string
  memberName: string
  onClose: () => void
  onSuccess: () => void
}

export default function MemberRegisterPlanModal({ open, memberId, memberName, onClose, onSuccess }: Props) {
  const [plans, setPlans] = useState<MemberPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'POS' | 'BANK_TRANSFER'>('CASH')
  const [note, setNote] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')

  useEffect(() => {
    if (open) {
      setSelectedPlanId(null)
      setPaymentMethod('CASH')
      setNote('')
      setReceiptNumber('')
      api.get<{ plans: MemberPlan[] }>('/plans', { params: { limit: 100 } })
        .then(({ data }) => setPlans(data.plans || []))
        .catch(() => message.error('Không thể tải danh sách gói tập'))
    }
  }, [open])

  const selectedPlan = plans.find(p => p._id === selectedPlanId)

  const handleRegister = async () => {
    if (!selectedPlanId) return
    setLoading(true)
    try {
      const paymentRes = await memberService.createOfflinePlanPayment(memberId, {
        planId: selectedPlanId,
        method: paymentMethod,
        confirmed: true,
        flow: 'register',
        note: note.trim(),
        receiptNumber: receiptNumber.trim(),
      })
      await memberService.registerPlan(memberId, selectedPlanId, paymentRes.data?.data?.paymentId)
      message.success('Đăng ký gói tập thành công')
      onSuccess()
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } }
      message.error(apiError?.response?.data?.message || 'Đăng ký thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={`Đăng ký gói tập — ${memberName}`}
      open={open}
      onCancel={onClose}
      onOk={handleRegister}
      confirmLoading={loading}
      okText="Đăng ký"
      cancelText="Hủy"
      destroyOnHidden
      width={480}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Chọn gói tập</label>
          <Select
            value={selectedPlanId}
            onChange={setSelectedPlanId}
            placeholder="Chọn gói tập..."
            size="large"
            style={{ width: '100%' }}
            options={plans.map(p => ({
              value: p._id,
              label: `${p.nameVi} — ${p.durationDays} ngày — ${(p.price || 0).toLocaleString('vi-VN')}đ`,
            }))}
          />
        </div>

        {selectedPlan && (
          <div style={{
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--gs-border)',
            background: 'var(--gs-card)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              {selectedPlan.nameVi}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--gs-text-muted)' }}>Thời hạn:</span>
              <span>{selectedPlan.durationDays} ngày</span>
              <span style={{ color: 'var(--gs-text-muted)' }}>Giá:</span>
              <span>{(selectedPlan.price || 0).toLocaleString('vi-VN')}đ</span>
              <span style={{ color: 'var(--gs-text-muted)' }}>Ngày bắt đầu:</span>
              <span>{new Date().toLocaleDateString('vi-VN')}</span>
              <span style={{ color: 'var(--gs-text-muted)' }}>Ngày kết thúc:</span>
              <span style={{ fontWeight: 600 }}>
                {new Date(new Date().setHours(0, 0, 0, 0) + (selectedPlan.durationDays - 1) * 86400000).toLocaleDateString('vi-VN')}
              </span>
            </div>
          </div>
        )}

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Phương thức thanh toán</label>
          <Select value={paymentMethod} onChange={setPaymentMethod} size="large" style={{ width: '100%' }} options={[
            { value: 'CASH', label: 'Tiền mặt' },
            { value: 'POS', label: 'POS / thẻ' },
            { value: 'BANK_TRANSFER', label: 'Chuyển khoản ngân hàng' },
          ]} />
        </div>
        <Input placeholder="Số biên nhận / mã hóa đơn (nếu có)" value={receiptNumber} onChange={(event) => setReceiptNumber(event.target.value)} />
        <Input.TextArea rows={2} placeholder="Ghi chú thu tiền (nếu có)" value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
    </Modal>
  )
}
