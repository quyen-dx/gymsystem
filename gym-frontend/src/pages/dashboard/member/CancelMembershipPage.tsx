import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Button, Card, Checkbox, Descriptions, Spin, Table, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { membershipService, type CancelInfo } from '../../../services/membershipService'

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('vi-VN') : '-')

const statusTag = (status: string) => {
  if (status === 'ACTIVE') return <Tag color="success">Đang hoạt động</Tag>
  if (status === 'PENDING') return <Tag color="processing">Chờ kích hoạt</Tag>
  return <Tag>{status}</Tag>
}

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
    const activePeriodId = cancelInfo?.period?._id
    if (!activePeriodId) {
      message.error('Không tìm thấy gói tập đang hoạt động')
      return
    }
    setSubmitting(true)
    try {
      await membershipService.createRefundRequest({
        periodId: activePeriodId,
        reason: reason.trim(),
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

  const { membership, pendingPeriods, periodsDetail, totalEstimatedRefund } = cancelInfo
  const remainingDays = membership.remainingDays ?? 0
  const activePeriodCount = 1
  const pendingPeriodCount = pendingPeriods.length
  const totalCancelPeriods = activePeriodCount + pendingPeriodCount

  const columns = [
    {
      title: 'Đợt',
      dataIndex: 'index',
      key: 'index',
      width: 60,
      render: (val: number) => <span className="font-medium">Đợt {val}</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (val: string) => statusTag(val),
    },
    {
      title: 'Ngày bắt đầu',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 120,
      render: (val: string) => formatDate(val),
    },
    {
      title: 'Ngày kết thúc',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 120,
      render: (val: string) => formatDate(val),
    },
    {
      title: 'Giá',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      align: 'right' as const,
      render: (val: number) => formatMoney(val || 0),
    },
  ]

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

        {/* 1. Thông tin gói đang hoạt động */}
        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-5 text-base font-semibold text-[var(--gs-text)]">Thông tin gói đang hoạt động</h3>
          <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="Tên gói">{membership.plan?.nameVi || membership.planNameVi || '-'}</Descriptions.Item>
            <Descriptions.Item label="Giá">{formatMoney(membership.price || membership.plan?.price || 0)}</Descriptions.Item>
            <Descriptions.Item label="Ngày bắt đầu">{formatDate(membership.startDate)}</Descriptions.Item>
            <Descriptions.Item label="Ngày kết thúc">{formatDate(membership.endDate)}</Descriptions.Item>
            <Descriptions.Item label="Số ngày còn lại">{remainingDays > 0 ? remainingDays : 'Đã hết hạn'}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái"><Tag color="success">Đang hoạt động</Tag></Descriptions.Item>
          </Descriptions>
        </Card>

        {/* 2. Danh sách các đợt */}
        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-5 text-base font-semibold text-[var(--gs-text)]">Danh sách các đợt</h3>
          <Table
            dataSource={periodsDetail}
            columns={columns}
            rowKey="_id"
            pagination={false}
            size="small"
            bordered
          />
        </Card>

        {/* 3. Tóm tắt yêu cầu hủy */}
        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-5 text-base font-semibold text-[var(--gs-text)]">Tóm tắt yêu cầu hủy</h3>
          <Descriptions bordered column={{ xs: 1, sm: 3 }} size="small">
            <Descriptions.Item label="Số đợt đang hoạt động">
              <span className="font-semibold text-[var(--gs-text)]">{activePeriodCount}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Số đợt chờ kích hoạt">
              <span className="font-semibold text-[var(--gs-text)]">{pendingPeriodCount}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Tổng số đợt sẽ bị hủy">
              <span className="font-semibold text-[var(--gs-error)]">{totalCancelPeriods}</span>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* 4. Hoàn tiền dự kiến */}
        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">Hoàn tiền dự kiến</h3>
          <div className="space-y-3">
            {periodsDetail.map((pd) => (
              <div
                key={pd._id}
                className={`rounded-xl border p-4 ${
                  pd.refundEligible
                    ? 'border-[var(--gs-success)] bg-[var(--gs-success-bg)]'
                    : 'border-[var(--gs-warning)] bg-[var(--gs-warning-bg)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  {pd.refundEligible ? (
                    <CheckCircleFilled className="mt-0.5 text-lg text-[var(--gs-success)]" />
                  ) : (
                    <CloseCircleFilled className="mt-0.5 text-lg text-[var(--gs-error)]" />
                  )}
                  <div className="flex-1">
                    <p className="m-0 text-sm font-semibold text-[var(--gs-text)]">
                      Đợt {pd.index} {pd.status === 'ACTIVE' ? '(đang hoạt động)' : '(chờ kích hoạt)'}
                      {' — '}
                      <span className={pd.refundEligible ? 'text-[var(--gs-success)]' : 'text-[var(--gs-error)]'}>
                        {pd.refundEligible
                          ? pd.status === 'ACTIVE'
                            ? 'Đủ điều kiện hoàn tiền'
                            : 'Chưa kích hoạt - Đủ điều kiện hoàn'
                          : 'Không đủ điều kiện hoàn tiền'}
                      </span>
                    </p>
                    {pd.refundReason && (
                      <p className="m-0 mt-1 text-xs text-[var(--gs-text-muted)]">{pd.refundReason}</p>
                    )}
                    {pd.refundEligible && (
                      <p className="m-0 mt-1 text-sm font-medium text-[var(--gs-success)]">
                        Số tiền: {formatMoney(pd.price || 0)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tổng tiền hoàn */}
          <div className="mt-5 rounded-xl border border-[var(--gs-accent)] bg-[var(--gs-accent-bg)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--gs-text)]">Tổng số tiền dự kiến được hoàn</span>
              <span className="text-lg font-bold text-[var(--gs-accent)]">
                {formatMoney(totalEstimatedRefund)}
              </span>
            </div>
          </div>
        </Card>

        {/* 5. Chính sách hoàn tiền */}
        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">Chính sách hoàn tiền</h3>
          <ul className="m-0 space-y-2 pl-5 text-sm leading-relaxed text-[var(--gs-text)]">
            <li>
              <CheckCircleFilled className="mr-2 text-[var(--gs-success)]" />
              Hoàn tiền trong vòng 07 ngày kể từ ngày kích hoạt gói.
            </li>
            <li>
              <CheckCircleFilled className="mr-2 text-[var(--gs-success)]" />
              Gói chưa được sử dụng bất kỳ quyền lợi nào sẽ được hoàn tiền theo chính sách.
            </li>
            <li>
              <CloseCircleFilled className="mr-2 text-[var(--gs-error)]" />
              Sau 07 ngày sẽ không đủ điều kiện hoàn tiền.
            </li>
            <li>
              <CloseCircleFilled className="mr-2 text-[var(--gs-error)]" />
              Nếu đã sử dụng quyền lợi của gói (check-in, sử dụng phòng tập, thuê PT hoặc các quyền lợi khác) thì sẽ không được hoàn tiền.
            </li>
          </ul>
        </Card>

        {/* 6. Cảnh báo */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-4">
          <WarningOutlined className="mt-0.5 text-lg text-[var(--gs-warning)]" />
          <div>
            <p className="m-0 text-sm font-semibold text-[var(--gs-text)]">Lưu ý quan trọng</p>
            <p className="m-0 mt-1 text-xs text-[var(--gs-text-muted)]">
              Việc gửi yêu cầu sẽ hủy toàn bộ <strong>{totalCancelPeriods} đợt</strong> bao gồm đợt đang hoạt động
              {pendingPeriodCount > 0 ? ` và ${pendingPeriodCount} đợt chưa kích hoạt` : ''} nếu yêu cầu được phê duyệt.
              Các đợt đủ điều kiện sẽ được hoàn tiền vào ví tài khoản của bạn.
            </p>
          </div>
        </div>

        {/* 7. Lý do hủy */}
        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">
            Lý do hủy <span className="text-red-500">*</span>
          </h3>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Vui lòng nhập lý do hủy gói..."
            className="w-full rounded-lg border border-[var(--gs-border)] bg-[var(--gs-elevated)] px-4 py-3 text-sm text-[var(--gs-text)] outline-none transition-colors focus:border-[var(--gs-accent)] resize-none"
          />
        </Card>

        {/* 8. Điều khoản */}
        <div className="mb-6 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
          <Checkbox checked={policyAgreed} onChange={(e) => setPolicyAgreed(e.target.checked)}>
            <span className="text-sm text-[var(--gs-text)]">
              Tôi đã đọc và đồng ý {' '}
              <a href="/policies" className="text-[var(--gs-accent)] underline hover:opacity-80">
                  chính sách hủy & hoàn tiền
              </a>
              .
            </span>
          </Checkbox>
        </div>

        {/* 9. Nút gửi */}
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <InfoCircleOutlined className="mt-0.5 text-[var(--gs-text-soft)]" />
            <div className="min-w-0">
              <p className="m-0 text-sm font-medium text-[var(--gs-text)]">Xác nhận hủy gói tập</p>
              <p className="m-0 mt-0.5 text-xs text-[var(--gs-text-muted)]">
                Yêu cầu sẽ được gửi tới nhân viên xem xét
              </p>
            </div>
          </div>
          <div className="flex gap-2">
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
      </div>
    </MemberLayout>
  )
}