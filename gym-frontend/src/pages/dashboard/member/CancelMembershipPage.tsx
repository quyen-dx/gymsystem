import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Button, Card, Checkbox, Descriptions, Spin, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { membershipService, type CancelInfo } from '../../../services/membershipService'

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('vi-VN') : '-')

export default function CancelMembershipPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [cancelInfo, setCancelInfo] = useState<CancelInfo | null>(null)
  const [reason, setReason] = useState('')
  const [policyAgreed, setPolicyAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    membershipService.getCancelInfo()
      .then((res) => setCancelInfo(res.data))
      .catch(() => {
        message.error('Không thể tải thông tin gói tập')
        navigate('/my-membership')
      })
      .finally(() => setLoading(false))
  }, [navigate])

  const handleSubmitCancel = async () => {
    if (!reason.trim()) {
      message.warning('Vui lòng nhập lý do hủy')
      return
    }
    if (!policyAgreed) {
      message.warning('Vui lòng đồng ý với chính sách hủy gói')
      return
    }
    setSubmitting(true)
    try {
      await membershipService.createCancelRequest({
        reason: reason.trim(),
        policyAccepted: true,
      })
      message.success('Yêu cầu hủy đã được gửi tới nhân viên. Vui lòng chờ phê duyệt.')
      navigate('/my-membership')
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Gửi yêu cầu thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <MemberLayout>
        <div className="flex min-h-[400px] items-center justify-center"><Spin /></div>
      </MemberLayout>
    )
  }

  if (!cancelInfo) return null

  const { membership, refundInfo } = cancelInfo
  const planName = membership.plan?.nameVi || membership.planNameVi || '-'
  const planPrice = membership.price || membership.plan?.price || 0

  return (
    <MemberLayout>
      <div className="mx-auto w-full max-w-6xl px-0 py-6 sm:px-2 lg:px-4">
        <div className="mb-6 flex items-center gap-3">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/my-membership')} />
          <div>
            <p className="m-0 text-xs uppercase tracking-[0.24em] text-[var(--gs-text-soft)]">QUẢN LÝ GÓI TẬP</p>
            <h1 className="m-0 mt-1 text-2xl font-semibold text-[var(--gs-text)] max-[480px]:text-xl">Yêu cầu hủy & hoàn tiền</h1>
          </div>
        </div>

        {/* 1. Thông tin gói */}
        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-5 text-base font-semibold text-[var(--gs-text)]">Thông tin gói tập</h3>
          <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="Tên gói">{planName}</Descriptions.Item>
            <Descriptions.Item label="Giá">{formatMoney(planPrice)}</Descriptions.Item>
            {refundInfo.purchasedAt && (
              <Descriptions.Item label="Ngày đăng ký">{formatDate(refundInfo.purchasedAt)}</Descriptions.Item>
            )}
            {refundInfo.activatedAt ? (
              <Descriptions.Item label="Ngày kích hoạt">{formatDate(refundInfo.activatedAt)}</Descriptions.Item>
            ) : (
              <Descriptions.Item label="Ngày kích hoạt"><Tag color="warning">Chưa kích hoạt</Tag></Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {/* 2. Hoàn tiền */}
        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">Hoàn tiền</h3>
          <div className={`rounded-xl border p-4 ${
            refundInfo.eligibleForRefund
              ? 'border-[var(--gs-success)] bg-[var(--gs-success-bg)]'
              : 'border-[var(--gs-warning)] bg-[var(--gs-warning-bg)]'
          }`}>
            <div className="flex items-start gap-3">
              {refundInfo.eligibleForRefund ? (
                <CheckCircleFilled className="mt-0.5 text-lg text-[var(--gs-success)]" />
              ) : (
                <CloseCircleFilled className="mt-0.5 text-lg text-[var(--gs-error)]" />
              )}
              <div className="flex-1">
                <p className="m-0 text-sm font-semibold text-[var(--gs-text)]">
                  {refundInfo.eligibleForRefund ? 'Đủ điều kiện hoàn tiền' : 'Không đủ điều kiện hoàn tiền'}
                </p>
                {refundInfo.reason && (
                  <p className="mt-1 text-xs leading-relaxed text-[var(--gs-text-muted)]">{refundInfo.reason}</p>
                )}
                {refundInfo.eligibleForRefund && (
                  <p className="mt-2 text-lg font-bold text-[var(--gs-success)]">
                    {formatMoney(refundInfo.estimatedRefundAmount)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* 3. Chính sách */}
        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">Chính sách hoàn tiền</h3>
          <div className="space-y-2 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4 text-sm leading-relaxed text-[var(--gs-text)]">
            <p>• Quyền hoàn tiền được tính theo TOÀN BỘ CHU KỲ SỬ DỤNG, không tính riêng theo từng lần đổi gói.</p>
            <p>• Nếu bạn đã sử dụng bất kỳ quyền lợi nào (check-in, đặt lịch PT...) tại bất kỳ thời điểm nào trong chu kỳ, toàn bộ chu kỳ sẽ KHÔNG đủ điều kiện hoàn tiền.</p>
            <p>• Hoàn tiền chỉ áp dụng trong vòng 07 ngày kể từ ngày đăng ký gói ĐẦU TIÊN của chu kỳ, và chỉ khi chưa kích hoạt gói.</p>
            <p>• Việc đổi gói không làm reset điều kiện hoàn tiền.</p>
          </div>
        </Card>

        {/* 4. Lý do hủy */}
        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">Lý do hủy</h3>
          <textarea
            className="w-full rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 text-sm text-[var(--gs-text)] outline-none transition-colors focus:border-[var(--theme-accent)]"
            rows={4}
            placeholder="Nhập lý do hủy gói tập..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Card>

        {/* 5. Đồng ý chính sách */}
        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <Checkbox checked={policyAgreed} onChange={(e) => setPolicyAgreed(e.target.checked)}>
            <span className="text-sm text-[var(--gs-text)]">
              Tôi đã đọc và đồng ý với{' '}
              <a href="/policies" target="_blank" rel="noopener noreferrer" className="text-[var(--theme-accent)] underline">
                chính sách hủy gói & hoàn tiền
              </a>
            </span>
          </Checkbox>
        </Card>

        {/* 6. Nút gửi yêu cầu */}
        <div className="flex justify-end gap-3">
          <Button onClick={() => navigate('/my-membership')}>Quay lại</Button>
          <Button
            type="primary"
            danger
            loading={submitting}
            disabled={!reason.trim() || !policyAgreed}
            onClick={handleSubmitCancel}
          >
            Gửi yêu cầu hủy
          </Button>
        </div>
      </div>
    </MemberLayout>
  )
}
