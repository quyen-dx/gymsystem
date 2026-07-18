import { ArrowLeftOutlined, CheckCircleFilled, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { Button, Card, Descriptions, Radio, Spin, Statistic, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { useWallet } from '../../../context/WalletProvider'
import { membershipService, type MyMembership } from '../../../services/membershipService'

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('vi-VN') : '-')

export default function RenewMembershipPage() {
  const navigate = useNavigate()
  const { wallet, refreshWallet } = useWallet()
  const [membership, setMembership] = useState<MyMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedMultiplier, setSelectedMultiplier] = useState(1)

  const planDays = membership?.durationDays || membership?.plan?.durationDays || 0
  const planPrice = membership?.price || membership?.plan?.price || 0
  const currentBalance = Number(wallet?.balance || 0)
  const balanceSufficient = currentBalance >= planPrice * selectedMultiplier
  const balanceAfter = currentBalance - planPrice * selectedMultiplier

  const currentEnd = membership?.endDate
  const now = new Date()
  const isStillActive = currentEnd ? new Date(currentEnd) >= now : false

  const calcNewEndDate = (multiplier: number) => {
    if (!currentEnd) return ''
    const base = isStillActive ? new Date(currentEnd) : now
    const end = new Date(base)
    end.setDate(end.getDate() + planDays * multiplier)
    return formatDate(end.toISOString())
  }

  const newEndDate = calcNewEndDate(selectedMultiplier)

  const multiplierOptions = [1, 2, 3]

  useEffect(() => {
    setLoading(true)
    Promise.all([
      membershipService.getMyMembership(),
      refreshWallet(),
    ])
      .then(([res]) => {
        const m = res.data.membership
        if (!m) {
          message.error('Không tìm thấy gói tập')
          navigate('/my-membership')
          return
        }
        if (m.status === 'cancelled') {
          message.error('Gói tập đã bị hủy')
          navigate('/my-membership')
          return
        }
        // cancellation check handled by API
        setMembership(m)
      })
      .catch(() => {
        message.error('Lỗi khi tải thông tin gói tập')
        navigate('/my-membership')
      })
      .finally(() => setLoading(false))
  }, [navigate, refreshWallet])

  const planName = membership?.plan?.nameVi || membership?.planNameVi || '-'

  const handleRenew = async () => {
    setSubmitting(true)
    try {
      const res = await membershipService.renewPlanWithDuration(selectedMultiplier)
      message.success(res.data?.message || 'Gia hạn thành công!')
      await refreshWallet()
      navigate('/my-membership')
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Gia hạn thất bại')
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

  if (!membership) return null

  return (
    <MemberLayout>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
        <div className="mb-6 flex items-center gap-3">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/my-membership')} />
          <div>
            <p className="m-0 text-xs uppercase tracking-[0.24em] text-[var(--gs-text-soft)]">QUẢN LÝ GÓI TẬP</p>
            <h1 className="m-0 mt-1 text-2xl font-semibold text-[var(--gs-text)] max-[480px]:text-xl">Gia hạn gói tập</h1>
          </div>
        </div>

        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-5 text-base font-semibold text-[var(--gs-text)]">Gói tập hiện tại</h3>
          <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="Tên gói tập">{planName}</Descriptions.Item>
            <Descriptions.Item label="Giá gói">{formatMoney(planPrice)}</Descriptions.Item>
            <Descriptions.Item label="Thời hạn">{`${planDays} ngày`}</Descriptions.Item>
            <Descriptions.Item label="Ngày kết thúc hiện tại">{formatDate(currentEnd)}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">Chọn thời gian gia hạn</h3>
          <div className="mb-4 flex flex-col gap-2">
            <Radio.Group
              value={selectedMultiplier}
              onChange={(e) => setSelectedMultiplier(e.target.value)}
              className="w-full"
            >
              {multiplierOptions.map((m) => {
                const days = planDays * m
                const endDate = calcNewEndDate(m)
                return (
                  <Radio.Button
                    key={m}
                    value={m}
                    className="!flex !h-auto !w-full !items-center !px-4 !py-3 [&:not(:first-child)]:!border-t-0"
                    style={{ border: '1px solid var(--gs-border)', borderRadius: 0 }}
                  >
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="text-sm font-semibold text-[var(--gs-success)]">
                        +{days} ngày
                      </span>
                      <span className="text-xs text-[var(--gs-text-soft)] whitespace-nowrap">
                        Hết hạn: {endDate}
                      </span>
                    </div>
                  </Radio.Button>
                )
              })}
            </Radio.Group>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Statistic
              title="Ngày kết thúc mới"
              value={newEndDate}
              valueStyle={{ fontSize: 16, fontWeight: 600 }}
            />
            <Statistic
              title="Tổng tiền"
              value={formatMoney(planPrice * selectedMultiplier)}
              valueStyle={{ fontSize: 16, fontWeight: 600, color: 'var(--gs-success)' }}
            />
            <Statistic
              title="Số dư hiện tại"
              value={formatMoney(currentBalance)}
              valueStyle={{ fontSize: 16, fontWeight: 600 }}
            />
          </div>
          <div className={`mt-4 rounded-xl border p-4 ${
            balanceSufficient
              ? 'border-[var(--gs-success)] bg-[var(--gs-success-bg)]'
              : 'border-[var(--gs-warning)] bg-[var(--gs-warning-bg)]'
          }`}>
            <div className="flex items-center gap-2">
              {balanceSufficient ? (
                <CheckCircleFilled className="text-[var(--gs-success)]" />
              ) : (
                <WarningOutlined className="text-[var(--gs-warning)]" />
              )}
              <span className={`font-medium ${balanceSufficient ? 'text-[var(--gs-success)]' : 'text-[var(--gs-warning)]'}`}>
                {balanceSufficient
                  ? `Số dư sau giao dịch: ${formatMoney(balanceAfter)}`
                  : `Còn thiếu ${formatMoney(Math.abs(balanceAfter))}`
                }
              </span>
            </div>
          </div>
        </Card>

        {!balanceSufficient && (
          <div className="mb-6 rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-4">
            <div className="flex gap-2">
              <InfoCircleOutlined className="mt-0.5 text-[var(--gs-warning)]" />
              <div className="text-sm text-[var(--gs-text)]">Vui lòng nạp thêm tiền vào ví để gia hạn gói tập</div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="m-0 text-sm font-medium text-[var(--gs-text)]">Xác nhận gia hạn</p>
            <p className="m-0 mt-0.5 text-xs text-[var(--gs-text-muted)]">Giao dịch sẽ được thực hiện ngay sau khi bạn xác nhận</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button onClick={() => navigate('/my-membership')}>Quay lại</Button>
            <Button
              type="primary"
              loading={submitting}
              disabled={!balanceSufficient}
              onClick={handleRenew}
            >
              Gia hạn
            </Button>
          </div>
        </div>
      </div>
    </MemberLayout>
  )
}
