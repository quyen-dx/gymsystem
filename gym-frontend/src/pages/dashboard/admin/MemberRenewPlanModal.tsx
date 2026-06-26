import { Modal, Radio, Select, message } from 'antd'
import { useEffect, useState } from 'react'
import api from '../../../services/api'
import { memberService } from '../../../services/memberService'
import type { MemberPlan } from '../../../types/admin/member'

interface Props {
  open: boolean
  memberId: string
  memberName: string
  currentEndDate?: string
  onClose: () => void
  onSuccess: () => void
}

export default function MemberRenewPlanModal({ open, memberId, memberName, currentEndDate, onClose, onSuccess }: Props) {
  const [plans, setPlans] = useState<MemberPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [renewFrom, setRenewFrom] = useState<'today' | 'endDate'>('endDate')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedPlanId(null)
      setRenewFrom('endDate')
      api.get<{ plans: MemberPlan[] }>('/plans', { params: { limit: 100 } })
        .then(({ data }) => setPlans(data.plans || []))
        .catch(() => message.error('Không thể tải danh sách gói tập'))
    }
  }, [open])

  const selectedPlan = plans.find(p => p._id === selectedPlanId)

  const handleRenew = async () => {
    if (!selectedPlanId) return
    setLoading(true)
    try {
      const paymentRes = await memberService.createOfflinePlanPayment(memberId, {
        planId: selectedPlanId,
        method: 'CASH',
        confirmed: true,
        flow: 'renew',
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

  const calculateNewEndDate = () => {
    if (!selectedPlan) return null
    const baseDate = renewFrom === 'today' ? new Date() : (currentEndDate ? new Date(currentEndDate) : new Date())
    return new Date(baseDate.getTime() + selectedPlan.durationDays * 86400000)
  }

  const newEndDate = calculateNewEndDate()

  return (
    <Modal
      title={`Gia hạn gói tập — ${memberName}`}
      open={open}
      onCancel={onClose}
      onOk={handleRenew}
      confirmLoading={loading}
      okText="Gia hạn"
      cancelText="Hủy"
      destroyOnClose
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
              label: `${p.nameVi || p.nameEn} — ${p.durationDays} ngày — ${(p.price || 0).toLocaleString('vi-VN')}đ`,
            }))}
          />
        </div>

        {selectedPlan && (
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Gia hạn từ</label>
            <Radio.Group value={renewFrom} onChange={e => setRenewFrom(e.target.value)}>
              <Radio value="endDate">Nối tiếp (từ ngày hết hạn cũ)</Radio>
              <Radio value="today">Tính từ hôm nay</Radio>
            </Radio.Group>
          </div>
        )}

        {selectedPlan && (
          <div style={{
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--gs-border)',
            background: 'var(--gs-card)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              {selectedPlan.nameVi || selectedPlan.nameEn}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--gs-text-muted)' }}>Thời hạn:</span>
              <span>{selectedPlan.durationDays} ngày</span>
              <span style={{ color: 'var(--gs-text-muted)' }}>Giá:</span>
              <span>{(selectedPlan.price || 0).toLocaleString('vi-VN')}đ</span>
              <span style={{ color: 'var(--gs-text-muted)' }}>Ngày hết hạn cũ:</span>
              <span>{currentEndDate ? new Date(currentEndDate).toLocaleDateString('vi-VN') : '—'}</span>
              <span style={{ color: 'var(--gs-text-muted)' }}>Ngày kết thúc mới:</span>
              <span style={{ fontWeight: 600, color: '#10B981' }}>
                {newEndDate?.toLocaleDateString('vi-VN')}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
