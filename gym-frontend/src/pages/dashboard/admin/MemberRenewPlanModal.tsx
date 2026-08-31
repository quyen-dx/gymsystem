import { Input, Modal, Radio, Select, message } from 'antd'
import { useEffect, useState } from 'react'
import api from '../../../services/api'
import { memberService } from '../../../services/memberService'
import type { MemberPlan } from '../../../types/admin/member'

interface Props {
  open: boolean
  memberId: string
  memberName: string
  currentEndDate?: string
  currentStartDate?: string
  currentPlanName?: string
  currentPlanId?: string
  onClose: () => void
  onSuccess: () => void
}

export default function MemberRenewPlanModal({ open, memberId, memberName, currentEndDate, currentStartDate, currentPlanName, currentPlanId, onClose, onSuccess }: Props) {
  const [plans, setPlans] = useState<MemberPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [renewFrom, setRenewFrom] = useState<'today' | 'endDate'>('endDate')
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'POS' | 'BANK_TRANSFER'>('CASH')
  const [note, setNote] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')

  useEffect(() => {
    if (open) {
      setRenewFrom('endDate')
      setPaymentMethod('CASH')
      setNote('')
      setReceiptNumber('')
      if (currentPlanId) {
        setSelectedPlanId(currentPlanId)
      }
      api.get<{ plans: MemberPlan[] }>('/plans', { params: { limit: 100 } })
        .then(({ data }) => {
          const loadedPlans = data.plans || []
          setPlans(loadedPlans)
          if (!currentPlanId && loadedPlans.length === 1) {
            setSelectedPlanId(loadedPlans[0]._id)
          }
        })
        .catch(() => message.error('Không thể tải danh sách gói tập'))
    }
  }, [open, currentPlanId])

  const selectedPlan = currentPlanId
    ? plans.find(p => p._id === currentPlanId)
    : plans.find(p => p._id === selectedPlanId)

  const handleRenew = async () => {
    if (!selectedPlanId) return
    setLoading(true)
    try {
      const paymentRes = await memberService.createOfflinePlanPayment(memberId, {
        planId: selectedPlanId,
        method: paymentMethod,
        confirmed: true,
        flow: 'renew',
        note: note.trim(),
        receiptNumber: receiptNumber.trim(),
      })
      await memberService.renewPlan(memberId, selectedPlanId, paymentRes.data?.data?.paymentId, renewFrom)
      message.success('Gia hạn gói tập thành công')
      onSuccess()
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } }
      message.error(apiError?.response?.data?.message || 'Gia hạn thất bại')
    } finally {
      setLoading(false)
    }
  }

  const calculateRemainingDays = () => {
    if (!currentEndDate) return 0
    const now = new Date()
    const end = new Date(currentEndDate)
    const diff = end.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const calculateNewEndDate = () => {
    if (!selectedPlan) return null
    const baseDate = renewFrom === 'today'
      ? new Date(new Date().setHours(0, 0, 0, 0))
      : (currentEndDate ? new Date(currentEndDate) : new Date())
    const offset = renewFrom === 'today' ? selectedPlan.durationDays - 1 : selectedPlan.durationDays
    return new Date(baseDate.getTime() + offset * 86400000)
  }

  const remainingDays = calculateRemainingDays()
  const newEndDate = calculateNewEndDate()
  const planLabel = selectedPlan ? `${selectedPlan.nameVi} (${selectedPlan.durationDays} ngày)` : ''

  return (
    <Modal
      title={`Gia hạn gói tập — ${memberName}`}
      open={open}
      onCancel={onClose}
      onOk={handleRenew}
      confirmLoading={loading}
      okText="Gia hạn"
      cancelText="Hủy"
      destroyOnHidden
      width={480}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          padding: 16,
          borderRadius: 12,
          border: '1px solid var(--gs-border)',
          background: 'var(--gs-card)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--gs-text)' }}>
            Thông tin gói hiện tại
          </div>
          <div style={{ fontSize: 13, lineHeight: 2 }}>
            <div>
              <span style={{ color: 'var(--gs-text-muted)', display: 'inline-block', width: 130 }}>Tên gói:</span>
              <span style={{ fontWeight: 500 }}>{currentPlanName || selectedPlan?.nameVi || '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--gs-text-muted)', display: 'inline-block', width: 130 }}>Ngày bắt đầu:</span>
              <span>{currentStartDate ? new Date(currentStartDate).toLocaleDateString('vi-VN') : '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--gs-text-muted)', display: 'inline-block', width: 130 }}>Ngày hết hạn:</span>
              <span>{currentEndDate ? new Date(currentEndDate).toLocaleDateString('vi-VN') : '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--gs-text-muted)', display: 'inline-block', width: 130 }}>Số ngày còn lại:</span>
              <span style={{ fontWeight: 500 }}>{remainingDays} ngày</span>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', color: 'var(--gs-text-muted)', fontSize: 13 }}>———————————</div>

        <div style={{
          padding: 16,
          borderRadius: 12,
          border: '1px solid var(--gs-border)',
          background: 'var(--gs-card)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--gs-text)' }}>
            Gia hạn
          </div>
          <div style={{ fontSize: 13, lineHeight: 2 }}>
            <div>
              <span style={{ color: 'var(--gs-text-muted)', display: 'inline-block', width: 130 }}>Gói gia hạn:</span>
              <span style={{ fontWeight: 500 }}>{planLabel || '—'}</span>
            </div>
          </div>

          {selectedPlan && (
            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Gia hạn từ</label>
              <Radio.Group value={renewFrom} onChange={e => setRenewFrom(e.target.value)}>
                <Radio value="endDate">Nối tiếp (từ ngày hết hạn cũ)</Radio>
                <Radio value="today">Tính từ hôm nay</Radio>
              </Radio.Group>
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 2 }}>
            <div>
              <span style={{ color: 'var(--gs-text-muted)', display: 'inline-block', width: 130 }}>Ngày hết hạn mới:</span>
              <span style={{ fontWeight: 600, color: '#10B981' }}>
                {newEndDate?.toLocaleDateString('vi-VN') || '—'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontWeight: 500, fontSize: 13 }}>Phương thức thanh toán</label>
          <Select value={paymentMethod} onChange={setPaymentMethod} options={[
            { value: 'CASH', label: 'Tiền mặt' },
            { value: 'POS', label: 'POS / thẻ' },
            { value: 'BANK_TRANSFER', label: 'Chuyển khoản ngân hàng' },
          ]} />
          <Input placeholder="Số biên nhận / mã hóa đơn (nếu có)" value={receiptNumber} onChange={(event) => setReceiptNumber(event.target.value)} />
          <Input.TextArea rows={2} placeholder="Ghi chú thu tiền (nếu có)" value={note} onChange={(event) => setNote(event.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
