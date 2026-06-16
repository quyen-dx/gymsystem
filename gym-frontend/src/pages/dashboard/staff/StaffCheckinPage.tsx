import {
  CameraOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  StopOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { BrowserQRCodeReader } from '@zxing/browser'
import { Button, Card, Col, Input, Row, Space, Tag, Typography, message } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { checkInService } from '../../../services/checkInService'
import type { TodayCheckinItem, VerifiedMember, VerifiedMembership } from '../../../types/admin/checkin'

const { Text, Title } = Typography

type Step = 'scan' | 'verify' | 'confirm' | 'selfie' | 'success' | 'error' | 'already_checked'

export default function StaffCheckinPage() {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)

  const [step, setStep] = useState<Step>('scan')
  const [cameraActive, setCameraActive] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [scannedToken, setScannedToken] = useState('')
  const [member, setMember] = useState<VerifiedMember | null>(null)
  const [membership, setMembership] = useState<VerifiedMembership | null>(null)
  const [confirmedId, setConfirmedId] = useState('')
  const [streakDay, setStreakDay] = useState(0)
  const [todayCheckins, setTodayCheckins] = useState<TodayCheckinItem[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  const startCamera = async () => {
    try {
      const reader = new BrowserQRCodeReader()
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result?.getText()) {
            controls.stop()
            processQR(result.getText())
          }
        },
      )
      controlsRef.current = controls
      setCameraActive(true)
    } catch {
      message.error(t('staff.checkin.camera_error'))
    }
  }

  const stopCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.stop()
      controlsRef.current = null
    }
    setCameraActive(false)
  }

  useEffect(() => {
    return () => { stopCamera() }
  }, [])

  const processQR = async (token: string) => {
    if (!token) return
    stopCamera()
    setScannedToken(token)
    try {
      const res = await checkInService.verifyQR(token)
      setMember(res.data.member)
      setMembership(res.data.membership)
      setStep('verify')
    } catch (error: any) {
      const code = error?.response?.data?.code
      const msg = error?.response?.data?.message || 'QR không hợp lệ'
      if (code === 'ALREADY_CHECKED_IN') {
        setMember({ _id: '', name: msg, email: null, phone: null, avatar: '' })
        setStep('already_checked')
      } else {
        setErrorMsg(msg)
        setStep('error')
      }
    }
  }

  const handleManualSubmit = () => {
    if (!manualToken.trim()) return
    processQR(manualToken.trim())
  }

  const handleConfirm = async () => {
    if (!scannedToken) return
    try {
      const res = await checkInService.confirmCheckin(scannedToken)
      setConfirmedId(res.data.checkin._id)
      setStreakDay(res.data.checkin.streakDay)
      setStep('selfie')
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Xác nhận thất bại')
    }
  }

  const handleSelfieDone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      const video = document.createElement('video')
      video.srcObject = stream
      await video.play()

      const canvas = document.createElement('canvas')
      canvas.width = 320
      canvas.height = 240
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(video, 0, 0, 320, 240)
      stream.getTracks().forEach((t) => t.stop())

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg'))
      if (blob) {
        const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: 'image/jpeg' })
        await checkInService.uploadSelfie(confirmedId, file)
      }
    } catch {}
    setStep('success')
  }

  const handleSkipSelfie = () => {
    setStep('success')
  }

  const resetAll = () => {
    stopCamera()
    setManualToken('')
    setScannedToken('')
    setMember(null)
    setMembership(null)
    setConfirmedId('')
    setStreakDay(0)
    setErrorMsg('')
    setStep('scan')
  }

  const loadTodayCheckins = async () => {
    try {
      const res = await checkInService.getTodayCheckins()
      setTodayCheckins(res.data.checkins)
    } catch {}
  }

  useEffect(() => {
    loadTodayCheckins()
  }, [])

  const renderScan = () => (
    <div>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">{t('staff.checkin.overline')}</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">{t('staff.checkin.title')}</h1>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card className="rounded-[24px]" style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', aspectRatio: '4/3', background: '#000', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraActive ? 'block' : 'none' }} />
              <div style={{ display: cameraActive ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, color: 'var(--gs-text-muted)' }}>
                <CameraOutlined style={{ fontSize: 48, marginBottom: 12 }} />
                <Text>{t('staff.checkin.start_hint')}</Text>
              </div>
            </div>
            <Space>
              {!cameraActive ? (
                <Button type="primary" icon={<CameraOutlined />} onClick={startCamera} size="large">
                  {t('staff.checkin.start_camera')}
                </Button>
              ) : (
                <Button icon={<StopOutlined />} onClick={stopCamera} size="large">
                  {t('staff.checkin.stop_camera')}
                </Button>
              )}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card className="rounded-[24px]" style={{ marginBottom: 16 }}>
            <Text strong>{t('staff.checkin.manual_title')}</Text>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Input
                placeholder={t('staff.checkin.manual_placeholder')}
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                onPressEnter={handleManualSubmit}
              />
              <Button type="primary" onClick={handleManualSubmit}>
                {t('staff.checkin.manual_submit')}
              </Button>
            </div>
          </Card>
          <Card className="rounded-[24px]" title={t('staff.checkin.today_title')} style={{ maxHeight: 400, overflow: 'auto' }}>
            {todayCheckins.length === 0 ? (
              <Text type="secondary">{t('staff.checkin.no_checkins_today')}</Text>
            ) : (
              todayCheckins.slice(0, 20).map((c) => (
                <div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gs-border)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: c.memberId?.avatar ? `url(${c.memberId.avatar}) center/cover` : 'var(--gs-border)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.memberId?.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gs-text-muted)' }}>
                      {new Date(c.checkinTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {c.streakDay > 1 && <Tag color="orange">🔥{c.streakDay}</Tag>}
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )

  const renderVerify = () => (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      <Card className="rounded-[24px]" style={{ textAlign: 'center' }}>
        <div style={{ width: 100, height: 100, borderRadius: '50%', margin: '0 auto 16px', background: member?.avatar ? `url(${member.avatar}) center/cover` : 'var(--gs-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!member?.avatar && <UserOutlined style={{ fontSize: 40, color: 'var(--gs-text-muted)' }} />}
        </div>
        <Title level={3}>{member?.name}</Title>
        <Text type="secondary">{member?.phone || member?.email}</Text>

        {membership && (
          <div style={{ marginTop: 16, padding: 16, background: 'var(--gs-elevated)', borderRadius: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{membership.planName}</div>
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--gs-text-muted)' }}>
              {new Date(membership.startDate).toLocaleDateString('vi-VN')} → {new Date(membership.endDate).toLocaleDateString('vi-VN')}
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 12 }}>
          <Button icon={<CloseCircleOutlined />} onClick={resetAll}>
            {t('staff.checkin.cancel')}
          </Button>
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleConfirm} size="large">
            {t('staff.checkin.confirm')}
          </Button>
        </div>
      </Card>
    </div>
  )

  const renderSelfie = () => (
    <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
      <Card className="rounded-[24px]">
        <Title level={4}>{t('staff.checkin.selfie_title')}</Title>
        <Text type="secondary">{t('staff.checkin.selfie_hint')}</Text>
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 12 }}>
          <Button onClick={handleSkipSelfie}>{t('staff.checkin.skip')}</Button>
          <Button type="primary" icon={<CameraOutlined />} onClick={handleSelfieDone}>
            {t('staff.checkin.take_selfie')}
          </Button>
        </div>
      </Card>
    </div>
  )

  const renderSuccess = () => (
    <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
      <Card className="rounded-[24px]" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.05))' }}>
        <CheckCircleOutlined style={{ fontSize: 72, color: '#10B981' }} />
        <Title level={3} style={{ marginTop: 16 }}>{t('staff.checkin.success_title')}</Title>
        <Text>{member?.name}</Text>
        {streakDay > 1 && (
          <div style={{ marginTop: 12 }}>
            <Tag color="orange" style={{ fontSize: 16, padding: '4px 12px' }}>🔥 {streakDay} {t('staff.checkin.streak_days')}</Tag>
          </div>
        )}
        <div style={{ marginTop: 24 }}>
          <Button type="primary" icon={<ReloadOutlined />} onClick={resetAll} size="large">
            {t('staff.checkin.checkin_another')}
          </Button>
        </div>
      </Card>
    </div>
  )

  const renderAlreadyChecked = () => (
    <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
      <Card className="rounded-[24px]" style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.05))' }}>
        <CheckCircleOutlined style={{ fontSize: 72, color: '#F59E0B' }} />
        <Title level={3} style={{ marginTop: 16 }}>Đã check-in!</Title>
        <Text>Hội viên này đã check-in thành công trước đó rồi.</Text>
        <div style={{ marginTop: 24 }}>
          <Button type="primary" icon={<ReloadOutlined />} onClick={resetAll} size="large">
            {t('staff.checkin.checkin_another')}
          </Button>
        </div>
      </Card>
    </div>
  )

  const renderError = () => (
    <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
      <Card className="rounded-[24px]">
        <CloseCircleOutlined style={{ fontSize: 72, color: '#EF4444' }} />
        <Title level={4} style={{ marginTop: 16 }}>{t('staff.checkin.error_title')}</Title>
        <Text type="secondary">{errorMsg}</Text>
        <div style={{ marginTop: 24 }}>
          <Button type="primary" icon={<ReloadOutlined />} onClick={resetAll} size="large">
            {t('staff.checkin.try_again')}
          </Button>
        </div>
      </Card>
    </div>
  )

  return (
    <DashboardLayout>
      {step === 'scan' && renderScan()}
      {step === 'verify' && renderVerify()}
      {step === 'selfie' && renderSelfie()}
      {step === 'success' && renderSuccess()}
      {step === 'already_checked' && renderAlreadyChecked()}
      {step === 'error' && renderError()}
    </DashboardLayout>
  )
}
