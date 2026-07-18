import { LoadingOutlined } from '@ant-design/icons'
import { Button, Input, Space, Typography, message } from 'antd'
import { Html5Qrcode } from 'html5-qrcode'
import { useEffect, useRef, useState } from 'react'
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

  useEffect(() => {
    startCamera()
    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const startCamera = async () => {
    setCameraError(null)
    try {
      const qrCode = new Html5Qrcode('member-scanner-container')
      cameraRef.current = qrCode
      await qrCode.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1,
        },
        (decodedText) => {
          qrCode.stop().catch(() => {})
          setCameraReady(false)
          verifyToken(decodedText)
        },
        () => {},
      )
      setCameraReady(true)
    } catch {
      setCameraError('Không thể mở camera. Vui lòng kiểm tra quyền truy cập hoặc nhập mã thủ công.')
    }
  }

  const stopCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.stop().catch(() => {})
      cameraRef.current = null
    }
    setCameraReady(false)
  }

  const verifyToken = async (token: string) => {
    setVerifying(true)
    try {
      const res = await checkInService.verifyDailyQR(token)
      if (res.data.valid) {
        navigate(`/checkin/sessions?token=${encodeURIComponent(token)}`)
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Mã QR không hợp lệ.')
      // Allow re-scan after error
      setVerifying(false)
      startCamera()
    }
  }

  const handleManualSubmit = () => {
    const t = manualToken.trim()
    if (!t) { message.warning('Vui lòng nhập mã QR.'); return }
    verifyToken(t)
  }

  return (
    <MemberLayout>
      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <div className="text-center mb-6">
          <Typography.Title level={3} className="m-0">Quét mã QR</Typography.Title>
          <Typography.Text type="secondary">
            Đưa mã QR vào khung hình để tự động quét
          </Typography.Text>
        </div>

        {verifying ? (
          <div className="flex flex-col items-center py-20">
            <LoadingOutlined style={{ fontSize: 48 }} />
            <Typography.Text className="mt-4">Đang xác thực...</Typography.Text>
          </div>
        ) : (
          <>
            {/* Camera view */}
            <div className="relative mx-auto max-w-sm">
              {cameraError && (
                <div className="rounded-2xl border-2 border-dashed border-[var(--gs-border)] p-12 text-center">
                  <Typography.Text type="danger">{cameraError}</Typography.Text>
                </div>
              )}

              {!cameraReady && !cameraError && (
                <div className="flex flex-col items-center py-20">
                  <LoadingOutlined style={{ fontSize: 48 }} />
                  <Typography.Text className="mt-4">Đang mở camera...</Typography.Text>
                </div>
              )}

              <div id="member-scanner-container" className={`w-full rounded-2xl overflow-hidden ${cameraError ? 'hidden' : ''}`} />

              {/* Scan frame overlay */}
              {cameraReady && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="border-2 border-white/60 rounded-xl" style={{ width: 280, height: 280 }} />
                </div>
              )}

              {cameraReady && (
                <div className="mt-4 flex justify-center">
                  <Button onClick={stopCamera}>Đóng camera</Button>
                </div>
              )}
            </div>

            {/* Manual fallback */}
            <div className="mt-6 border-t border-[var(--gs-border)] pt-6">
              <Typography.Text type="secondary" className="block text-center mb-3">
                Camera không hoạt động? Nhập mã thủ công
              </Typography.Text>
              <Space.Compact className="w-full">
                <Input
                  placeholder="Dán mã QR vào đây..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  onPressEnter={handleManualSubmit}
                />
                <Button type="primary" onClick={handleManualSubmit}>Xác nhận</Button>
              </Space.Compact>
              {cameraError && (
                <div className="mt-3 text-center">
                  <Button type="link" onClick={() => { stopCamera(); startCamera() }}>
                    Thử lại camera
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </MemberLayout>
  )
}
