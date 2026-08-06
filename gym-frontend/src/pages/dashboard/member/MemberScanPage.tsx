import { ArrowLeftOutlined, CameraOutlined, LoadingOutlined, QrcodeOutlined, ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Input, Space, Typography, message } from 'antd'
import { Html5Qrcode } from 'html5-qrcode'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { checkInService } from '../../../services/checkInService'

export default function MemberScanPage() {
  const navigate = useNavigate()
  const cameraRef = useRef<Html5Qrcode | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manualToken, setManualToken] = useState('')
  const [verifying, setVerifying] = useState(false)

  const cleanupCamera = useCallback(async () => {
    if (cameraRef.current) {
      try {
        await cameraRef.current.stop()
      } catch { /* already stopped */ }
      cameraRef.current = null
    }
    setCameraReady(false)
  }, [])

  const verifyToken = async (token: string) => {
    setVerifying(true)
    try {
      const res = await checkInService.verifyDailyQR(token)
      if (res.data.valid) {
        navigate(`/checkin/sessions?token=${encodeURIComponent(token)}`, { replace: true })
      } else {
        message.error(res.data.message || 'Mã QR không hợp lệ.')
        setVerifying(false)
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Mã QR không hợp lệ.')
      setVerifying(false)
      startCamera()
    }
  }

  const startCamera = async () => {
    setCameraError(null)
    try {
      if (cameraRef.current) {
        await cameraRef.current.stop().catch(() => {})
      }
      const oldContainer = document.getElementById('member-scanner-container')
      if (oldContainer) oldContainer.innerHTML = ''

      const qrCode = new Html5Qrcode('member-scanner-container')
      cameraRef.current = qrCode
      await qrCode.start(
        { facingMode: 'environment' },
        {
          fps: 12,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1,
        },
        async (decodedText) => {
          await cleanupCamera()
          verifyToken(decodedText)
        },
        () => {},
      )
      setCameraReady(true)
    } catch {
      setCameraReady(false)
      setCameraError('Không thể mở camera. Vui lòng kiểm tra quyền truy cập camera hoặc nhập mã thủ công.')
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => startCamera(), 300)
    return () => {
      window.clearTimeout(timer)
      if (cameraRef.current) {
        cameraRef.current.stop().catch(() => {})
        cameraRef.current = null
      }
    }
  }, [])

  const handleManualSubmit = () => {
    const token = manualToken.trim()
    if (!token) {
      message.warning('Vui lòng nhập mã QR.')
      return
    }
    cleanupCamera()
    verifyToken(token)
  }

  return (
    <MemberLayout>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/checkin')} className="mb-5">
          Quay lại
        </Button>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <Card className="rounded-2xl" styles={{ body: { padding: 20 } }}>
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--theme-accent)]/15 text-[var(--theme-accent)]">
                <CameraOutlined style={{ fontSize: 28 }} />
              </div>
              <Typography.Title level={3} className="!m-0 !text-[var(--gs-text)]">Quét mã QR</Typography.Title>
              <Typography.Paragraph className="!mb-0 !mt-2 !text-[var(--gs-text-muted)]">
                Đưa mã QR vào giữa khung hình. Hệ thống sẽ tự động nhận diện.
              </Typography.Paragraph>
            </div>

            {verifying ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-elevated)]">
                <LoadingOutlined style={{ fontSize: 48 }} />
                <Typography.Text className="mt-4">Đang xác thực mã QR...</Typography.Text>
              </div>
            ) : (
              <div className="mx-auto max-w-md">
                <div className="relative overflow-hidden rounded-3xl border border-[var(--gs-border)] bg-black/60 p-3">
                  {!cameraReady && !cameraError && (
                    <div className="flex min-h-[360px] flex-col items-center justify-center text-white">
                      <LoadingOutlined style={{ fontSize: 42 }} />
                      <Typography.Text className="mt-4 !text-white">Đang mở camera...</Typography.Text>
                    </div>
                  )}

                  {cameraError && (
                    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/30 p-8 text-center">
                      <Alert type="error" showIcon message={cameraError} />
                      <Button className="mt-4" icon={<ReloadOutlined />} onClick={() => startCamera()}>
                        Thử lại camera
                      </Button>
                    </div>
                  )}

                  <div id="member-scanner-container" className={`w-full overflow-hidden rounded-2xl ${cameraError ? 'hidden' : ''}`} />

                  {cameraReady && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-[260px] w-[260px] rounded-3xl border-4 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
                    </div>
                  )}
                </div>

                {cameraReady && (
                  <div className="mt-4 text-center text-xs text-[var(--gs-text-muted)]">
                    Giữ điện thoại ổn định và đặt QR nằm trọn trong khung.
                  </div>
                )}
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <Card title={<span><QrcodeOutlined className="mr-2" />Nhập mã thủ công</span>} className="rounded-2xl">
              <Typography.Paragraph className="!mt-0 !text-sm !text-[var(--gs-text-muted)]">
                Nếu camera không hoạt động, hãy dán mã QR hoặc nhập mã tại đây.
              </Typography.Paragraph>
              <Space.Compact className="w-full">
                <Input
                  size="large"
                  placeholder="Dán mã QR vào đây..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  onPressEnter={handleManualSubmit}
                />
                <Button size="large" type="primary" loading={verifying} onClick={handleManualSubmit}>
                  Xác nhận
                </Button>
              </Space.Compact>
            </Card>

            <Card className="rounded-2xl">
              <Typography.Title level={5} className="!m-0">Lưu ý</Typography.Title>
              <ul className="mb-0 mt-3 space-y-2 pl-4 text-sm text-[var(--gs-text-muted)]">
                <li>Cho phép trình duyệt truy cập camera khi được hỏi.</li>
                <li>Quét đúng mã QR check-in trong ngày tại phòng gym.</li>
                <li>Nếu mã hợp lệ, bạn sẽ được chuyển sang bước chọn buổi tập.</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </MemberLayout>
  )
}
