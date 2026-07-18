import { LoadingOutlined, QrcodeOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Card, message, QRCode, Spin } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { checkInService } from '../../../services/checkInService'

const formatDate = (d: string | Date) => new Date(d).toLocaleDateString('vi-VN', {
  year: 'numeric', month: 'long', day: 'numeric',
})

const formatTime = (d: string | Date) => new Date(d).toLocaleTimeString('vi-VN', {
  hour: '2-digit', minute: '2-digit',
})

export default function AdminDailyQRPage() {
  const [qrData, setQrData] = useState<{ token: string; date: string; expiresAt: string; createdAt: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const fetchActive = useCallback(async () => {
    setLoading(true)
    try {
      const res = await checkInService.getActiveDailyQR()
      setQrData(res.data.qrCode)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchActive() }, [fetchActive])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await checkInService.generateDailyQR()
      setQrData(res.data.qrCode)
      message.success(res.data.message || 'Đã tạo mã QR thành công')
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Tạo mã QR thất bại')
    }
    setGenerating(false)
  }

  return (
    <DashboardLayout>
      <div className="w-full" style={{ padding: '32px 40px' }}>
        <div className="mx-auto w-full" style={{ maxWidth: 1200 }}>
          <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">CHECK-IN QR</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <h1 className="m-0 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">Mã QR trình chiếu</h1>
            </div>
          </div>

          <Spin spinning={loading}>
            <Card className="rounded-[24px]">
              {!qrData ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-6">
                  <QrcodeOutlined style={{ fontSize: 72, color: 'var(--gs-text-muted)' }} />
                  <p className="text-lg text-[var(--gs-text-muted)]">Chưa có mã QR cho hôm nay</p>
                  <p className="text-sm text-[var(--gs-text-soft)]">Bấm nút bên dưới để tạo mã QR trình chiếu lên màn hình lớn</p>
                  <Button type="primary" size="large" icon={<QrcodeOutlined />} onClick={handleGenerate} loading={generating}>
                    Tạo mã QR cho hôm nay
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[var(--gs-text-soft)] uppercase tracking-wider">MÃ QR HÔM NAY</p>
                      <p className="text-2xl font-semibold">{formatDate(qrData.date)}</p>
                      <p className="text-xs text-[var(--gs-text-muted)]">
                        Hiệu lực đến {formatTime(qrData.expiresAt)} • Đã tạo lúc {formatTime(qrData.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button icon={<ReloadOutlined />} onClick={fetchActive}>Tải lại</Button>
                      <Button type="primary" icon={<QrcodeOutlined />} onClick={handleGenerate} loading={generating}>
                        Tạo mã mới
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-center py-8">
                    <div className="bg-white p-8 rounded-2xl shadow-lg" style={{ maxWidth: 500 }}>
                      <QRCode
                        value={qrData.token}
                        size={380}
                        level="L"
                        includeMargin
                      />
                      <p className="text-center text-sm text-gray-500 mt-4 font-mono break-all">
                        {qrData.token}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-4 text-sm">
                    <strong>Lưu ý:</strong> Mã QR này chỉ có hiệu lực đến 23:59:59 hôm nay. Hội viên cần có mặt tại phòng gym để quét mã.
                    Mỗi ngày chỉ có 1 mã QR hoạt động. Nếu tạo mã mới, mã cũ trong ngày sẽ bị vô hiệu hóa.
                  </div>
                </>
              )}
            </Card>
          </Spin>
        </div>
      </div>
    </DashboardLayout>
  )
}
