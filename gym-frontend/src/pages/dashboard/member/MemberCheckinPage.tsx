import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Button, Card, Progress, QRCode, Tag, Tooltip, Typography, message } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { checkInService } from '../../../services/checkInService'
import { membershipService } from '../../../services/membershipService'
import type { QRTokenResponse } from '../../../types/admin/checkin'

const { Text, Title } = Typography

function translateCheckinError(msg: string | undefined, t: ReturnType<typeof useTranslation>['t']): string {
  if (!msg) return t('checkin_page.load_failed')
  const map: Record<string, string> = {
    'Gói tập của bạn đã hết hạn hoặc không còn hiệu lực': t('checkin_page.error_plan_expired'),
    'Gói tập đã hết hạn. Vui lòng gia hạn để tiếp tục.': t('checkin_page.error_plan_expired_renew'),
    'Mã QR không hợp lệ hoặc đã hết hạn': t('checkin_page.error_qr_expired'),
  }
  return map[msg] || msg
}

export default function MemberCheckinPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [qrData, setQrData] = useState<QRTokenResponse | null>(null)
  const [countdown, setCountdown] = useState(30)
  const [streak, setStreak] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [membershipLoading, setMembershipLoading] = useState(true)
  const [canCheckin, setCanCheckin] = useState(false)
  const [checkedInToday, setCheckedInToday] = useState(false)
  const timerRef = useRef<number | null>(null)

  const fetchQR = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await checkInService.generateQR()
      const data = res.data
      if (data.checkedInToday) {
        setCheckedInToday(true)
        setStreak(data.streak || 0)
        setQrData(null)
        setLoading(false)
        return
      }
      setQrData(data)
      setCountdown(data.ttl || 30)
      setLoading(false)
    } catch (err: any) {
      setError(translateCheckinError(err?.response?.data?.message, t))
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    setMembershipLoading(true)
    membershipService.getMyMembership()
      .then((res) => {
        const membership = res.data.membership
        const allowed = membership?.status === 'active' && Number(membership.remainingDays || 0) > 0
        setCanCheckin(allowed)
        if (allowed) {
          fetchQR()
        } else {
          setLoading(false)
        }
      })
      .catch(() => {
        setCanCheckin(false)
        setError(t('checkin_page.error_load_membership'))
        setLoading(false)
      })
      .finally(() => setMembershipLoading(false))
  }, [fetchQR, t])

  useEffect(() => {
    if (canCheckin && !checkedInToday && qrData && countdown > 0) {
      timerRef.current = window.setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            fetchQR()
            return 30
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [canCheckin, checkedInToday, qrData, countdown, fetchQR])

  useEffect(() => {
    if (qrData && !checkedInToday) {
      checkInService.getStreak(qrData.memberId).then((res) => {
        setStreak(res.data.streak)
      }).catch(() => {})
    }
  }, [qrData, checkedInToday])

  const qrValue = qrData?.token || ''

  const progressPercent = (countdown / 30) * 100

  if (membershipLoading || loading) {
    return (
      <MemberLayout>
        <div className="member-page">
          <Card className="rounded-[24px]" style={{ textAlign: 'center', padding: 40 }}>
            <div className="text-[var(--gs-text-muted)]">
              {membershipLoading ? t('checkin_page.checking_membership') : t('common.loading')}
            </div>
          </Card>
        </div>
      </MemberLayout>
    )
  }

  if (!canCheckin) {
    return (
      <MemberLayout>
        <div className="member-page" style={{ maxWidth: 640, margin: '0 auto' }}>
          <Card className="rounded-[24px]" style={{ textAlign: 'center', padding: 24 }}>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-400">
              {t('checkin_page.membership_required_kicker')}
            </p>
            <Title level={3} style={{ marginTop: 12 }}>
              {t('checkin_page.membership_required_title')}
            </Title>
            <Text type="secondary">{error || t('checkin_page.membership_required_desc')}</Text>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Button type="primary" onClick={() => navigate('/plans')}>
                {t('checkin_page.view_plans')}
              </Button>
              <Button onClick={() => navigate('/my-membership')}>
                {t('checkin_page.view_my_membership')}
              </Button>
            </div>
          </Card>
        </div>
      </MemberLayout>
    )
  }

  if (error) {
    return (
      <MemberLayout>
        <div className="member-page" style={{ maxWidth: 500, margin: '0 auto' }}>
          <Card className="rounded-[24px]" style={{ textAlign: 'center' }}>
            <CloseCircleOutlined style={{ fontSize: 64, color: '#EF4444' }} />
            <Title level={4} style={{ marginTop: 16 }}>{t('checkin_page.error_title')}</Title>
            <Text type="secondary">{error}</Text>
            <div style={{ marginTop: 16 }}>
              <Button type="primary" icon={<ReloadOutlined />} onClick={fetchQR}>
                {t('checkin_page.retry')}
              </Button>
            </div>
          </Card>
        </div>
      </MemberLayout>
    )
  }

  if (checkedInToday) {
    return (
      <MemberLayout>
        <div className="member-page" style={{ maxWidth: 500, margin: '0 auto' }}>
          <Card className="rounded-[24px]" style={{ textAlign: 'center' }}>
            <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(59,130,246,0.06))] p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">{t('checkin_page.overline')}</p>
              <h1 className="mt-2 text-2xl font-semibold text-[var(--gs-text)]">{t('checkin_page.title')}</h1>
            </div>

            <CheckCircleOutlined style={{ fontSize: 72, color: '#10B981' }} />
            <Title level={3} style={{ marginTop: 16 }}>{t('checkin_page.checked_in_title')}</Title>
            <Text type="secondary">{t('checkin_page.checked_in_desc')}</Text>

            {streak > 0 && (
              <div style={{ marginTop: 16 }}>
                <Tag color="orange" style={{ fontSize: 16, padding: '4px 12px' }}>
                  🔥 {t('checkin_page.streak', { count: streak })}
                </Tag>
              </div>
            )}

            <div style={{ marginTop: 24, fontSize: 13, color: 'var(--gs-text-muted)' }}>
              {t('checkin_page.next_day_hint')}
            </div>
          </Card>
        </div>
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="member-page" style={{ maxWidth: 500, margin: '0 auto' }}>
        <Card className="rounded-[24px]" style={{ textAlign: 'center' }}>
          <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))] p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">{t('checkin_page.overline')}</p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--gs-text)]">{t('checkin_page.title')}</h1>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            {qrData?.token && (
              <QRCode value={qrValue} size={220} bordered={false} />
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <Progress
              type="circle"
              percent={progressPercent}
              format={() => `${countdown}s`}
              size={64}
              strokeColor={countdown <= 10 ? '#EF4444' : '#3B82F6'}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gs-text-muted)' }}>
              {t('checkin_page.auto_refresh')}
            </div>
          </div>

          {streak > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Tag color="orange" style={{ fontSize: 16, padding: '4px 12px' }}>
                🔥 {t('checkin_page.streak', { count: streak })}
              </Tag>
            </div>
          )}

          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 12 }}
            onClick={() => {
              if (qrData?.token) {
                navigator.clipboard.writeText(qrData.token)
                message.success(t('checkin_page.copy_success'))
              }
            }}
          >
            <code style={{ fontSize: 11, color: 'var(--gs-text-soft)', wordBreak: 'break-all', maxWidth: 280, cursor: 'pointer', userSelect: 'all' }}>
              {qrData?.token}
            </code>
            <Tooltip title="Copy token">
              <CopyOutlined style={{ color: 'var(--gs-text-muted)', cursor: 'pointer', flexShrink: 0 }} />
            </Tooltip>
          </div>

          <Button icon={<ReloadOutlined />} onClick={fetchQR}>
            {t('checkin_page.refresh')}
          </Button>
        </Card>
      </div>
    </MemberLayout>
  )
}
