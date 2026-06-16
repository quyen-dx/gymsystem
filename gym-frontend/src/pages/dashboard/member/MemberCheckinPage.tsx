import {
  CloseCircleOutlined,
  CopyOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Button, Card, Progress, QRCode, Tag, Tooltip, Typography, message } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { checkInService } from '../../../services/checkInService'
import type { QRTokenResponse } from '../../../types/admin/checkin'

const { Text, Title } = Typography

export default function MemberCheckinPage() {
  const { t } = useTranslation()
  const [qrData, setQrData] = useState<QRTokenResponse | null>(null)
  const [countdown, setCountdown] = useState(30)
  const [streak, setStreak] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<number | null>(null)

  const fetchQR = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await checkInService.generateQR()
      setQrData(res.data)
      setCountdown(res.data.ttl)
      setLoading(false)
    } catch (err: any) {
      setError(err?.response?.data?.message || t('checkin_page.load_failed'))
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchQR()
  }, [fetchQR])

  useEffect(() => {
    if (qrData && countdown > 0) {
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
  }, [qrData, countdown, fetchQR])

  useEffect(() => {
    if (qrData) {
      checkInService.getStreak(qrData.memberId).then((res) => {
        setStreak(res.data.streak)
      }).catch(() => {})
    }
  }, [qrData])

  const qrValue = qrData?.token || ''

  const progressPercent = (countdown / 30) * 100

  if (loading) {
    return (
      <MemberLayout>
        <div className="member-page">
          <Card className="rounded-[24px]" style={{ textAlign: 'center', padding: 40 }}>
            <div className="text-[var(--gs-text-muted)]">{t('common.loading')}</div>
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
                message.success('Đã copy token')
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
