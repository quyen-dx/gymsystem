import { CheckCircleFilled, ClockCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { Button, Card, Divider, Tag, Typography, message } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { checkInService } from '../../../services/checkInService'

export default function MemberSessionSelectPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [freeCheckedIn, setFreeCheckedIn] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchSessions = useCallback(async () => {
    if (!token) {
      setError('Thiếu mã QR. Vui lòng quét mã QR tại phòng gym.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await checkInService.verifyDailyQR(token)
      if (!res.data.valid) {
        setError(res.data.message || 'Mã QR không hợp lệ.')
        return
      }
      setSessions(res.data.sessions || [])
      setFreeCheckedIn(res.data.freeWorkoutCheckedIn || null)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Không thể tải danh sách buổi tập.')
    }
    setLoading(false)
  }, [token])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const handleCheckin = async (scheduleId?: string, sessionIndex?: number) => {
    if (!token) return
    setSubmitting(true)
    try {
      const body: any = { token }
      if (scheduleId && scheduleId !== 'free') {
        body.scheduleId = scheduleId
        body.sessionIndex = sessionIndex
      }
      const res = await checkInService.submitDailyQRCheckin(body)
      message.success(res.data.message || 'Check-in thành công!')
      fetchSessions()
    } catch (err: any) {
      const data = err?.response?.data || {}
      const msg = data.message || 'Check-in thất bại.'

      if (data.suggestFreeWorkout) {
        message.warning(msg)
        return
      }

      if (data.alreadyCheckedIn) {
        message.info(msg)
        return
      }

      message.error(msg)
    }
    setSubmitting(false)
  }

  const allCheckedIn = sessions.every(s => s.alreadyCheckedIn) && !!freeCheckedIn
  const hasSessions = sessions.length > 0

  if (loading) {
    return (
      <MemberLayout>
        <div className="flex items-center justify-center py-24">
          <LoadingOutlined style={{ fontSize: 48 }} />
        </div>
      </MemberLayout>
    )
  }

  if (error) {
    return (
      <MemberLayout>
        <div className="mx-auto w-full max-w-lg px-4 py-12">
          <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center">
            <Typography.Title level={4} className="m-0" style={{ color: '#dc2626' }}>Mã QR không hợp lệ</Typography.Title>
            <Typography.Paragraph className="mt-2" style={{ color: '#b91c1c' }}>{error}</Typography.Paragraph>
            <Button type="primary" onClick={() => navigate('/checkin/scan')} className="mt-2">
              Quét lại mã QR
            </Button>
          </div>
        </div>
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <div className="text-center mb-6">
          <Typography.Title level={3} className="m-0">Chọn buổi tập</Typography.Title>
          <Typography.Text type="secondary">
            Chọn đúng buổi bạn đang đến tập hôm nay
          </Typography.Text>
        </div>

        {allCheckedIn && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center mb-6">
            <CheckCircleFilled style={{ fontSize: 48, color: '#22c55e' }} />
            <Typography.Title level={4} className="mt-3" style={{ color: '#16a34a' }}>Đã check-in hôm nay</Typography.Title>
            <Typography.Paragraph style={{ color: '#15803d' }}>
              Bạn đã check-in tất cả các buổi tập hôm nay.
            </Typography.Paragraph>
          </div>
        )}

        <Card className="rounded-2xl">
          <div className="space-y-3">
            {sessions.map((s, idx) => (
              <div key={`${s.scheduleId}-${s.sessionIndex}`}
                className={`rounded-xl border p-4 ${
                  s.alreadyCheckedIn
                    ? 'border-green-200 bg-green-50'
                    : 'border-[var(--gs-border)] bg-[var(--gs-card)]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--gs-text)] truncate">
                      {s.title || `Buổi ${idx + 1}`}
                    </div>
                    {s.muscleGroup && (
                      <div className="text-sm text-[var(--gs-text-soft)]">{s.muscleGroup}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-sm text-[var(--gs-text-muted)]">
                      <ClockCircleOutlined />
                      <span>{s.time} - {s.endTime}</span>
                    </div>
                    {(s.className || s.classCode) && (
                      <Tag className="mt-1" color="blue">
                        [{s.classCode}] {s.className}
                      </Tag>
                    )}
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    {s.alreadyCheckedIn ? (
                      <div className="text-center">
                        <CheckCircleFilled style={{ fontSize: 24, color: '#22c55e' }} />
                        <div className="text-xs text-green-600 mt-1">Đã check-in</div>
                      </div>
                    ) : (
                      <Button type="primary" size="small"
                        onClick={() => handleCheckin(s.scheduleId, s.sessionIndex)}
                        loading={submitting}
                      >
                        Check-in
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {hasSessions && <Divider className="my-3" />}

            <div className={`rounded-xl border p-4 ${
              freeCheckedIn
                ? 'border-green-200 bg-green-50'
                : 'border-dashed border-[var(--gs-border)] bg-[var(--gs-card)]'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[var(--gs-text)]">Tập tự do</div>
                  <div className="text-sm text-[var(--gs-text-muted)]">Không theo lịch PT</div>
                </div>
                <div className="ml-3 flex-shrink-0">
                  {freeCheckedIn ? (
                    <div className="text-center">
                      <CheckCircleFilled style={{ fontSize: 24, color: '#22c55e' }} />
                      <div className="text-xs text-green-600 mt-1">Đã check-in</div>
                    </div>
                  ) : (
                    <Button onClick={() => handleCheckin('free')} loading={submitting}>
                      Check-in
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {!hasSessions && !freeCheckedIn && (
              <div className="text-center py-4 text-[var(--gs-text-muted)] text-sm">
                {'Hôm nay bạn không có buổi tập theo lịch.'}
              </div>
            )}
          </div>
        </Card>

        <div className="mt-6 text-center">
          <Button onClick={() => navigate('/checkin/scan')}>Quét lại mã QR</Button>
        </div>
      </div>
    </MemberLayout>
  )
}
