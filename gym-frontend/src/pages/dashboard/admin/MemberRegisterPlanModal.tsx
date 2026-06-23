import { Modal, Select, message } from 'antd'
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

  useEffect(() => {
    if (open) {
      setSelectedPlanId(null)
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
      await memberService.registerPlan(memberId, selectedPlanId)
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
              <span style={{ color: 'var(--gs-text-muted)' }}>Ngày bắt đầu:</span>
              <span>{new Date().toLocaleDateString('vi-VN')}</span>
              <span style={{ color: 'var(--gs-text-muted)' }}>Ngày kết thúc:</span>
              <span style={{ fontWeight: 600 }}>
                {new Date(Date.now() + selectedPlan.durationDays * 86400000).toLocaleDateString('vi-VN')}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
