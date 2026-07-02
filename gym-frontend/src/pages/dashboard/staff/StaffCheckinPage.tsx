import {
  CameraOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FilterOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { BrowserQRCodeReader } from '@zxing/browser'
import { Button, Card, Col, DatePicker, Input, Row, Select, Space, Table, Tag, TimePicker, Typography, message } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useEffect, useRef, useState } from 'react'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { checkInService } from '../../../services/checkInService'
import type { StaffCheckinHistoryItem, VerifiedMember } from '../../../types/admin/checkin'
import { getUserDisplayName } from '../../../utils/userDisplay'

const { Text, Title } = Typography

type Step = 'scan' | 'success' | 'error' | 'already_checked'
type TimeMode = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'all' | 'custom'

export default function StaffCheckinPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)

  const [step, setStep] = useState<Step>('scan')
  const [cameraActive, setCameraActive] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [member, setMember] = useState<VerifiedMember | null>(null)
  const [streakDay, setStreakDay] = useState(0)
  const [checkins, setCheckins] = useState<StaffCheckinHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [timeMode, setTimeMode] = useState<TimeMode>('today')
  const [filterDate, setFilterDate] = useState<Dayjs | null>(dayjs())
  const [startTime, setStartTime] = useState<Dayjs | null>(null)
  const [endTime, setEndTime] = useState<Dayjs | null>(null)
  const [keyword, setKeyword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const startCamera = async () => {
    try {
      const reader = new BrowserQRCodeReader()
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current ?? undefined,
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
      message.error('Không thể mở camera')
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
    try {
      const res = await checkInService.verifyStaffCheckin({ token })
      setMember({
        _id: res.data.checkin.memberId,
        name: res.data.checkin.memberName,
        email: res.data.checkin.email || null,
        phone: res.data.checkin.phone || null,
        avatar: '',
      })
      setStreakDay(res.data.checkin.streakDay || 0)
      setStep('success')
      message.success(res.data.message || 'Check-in thành công')
      loadCheckinHistory(historyPage)
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
    const value = manualToken.trim()
    if (value.split('.').length === 3) {
      processQR(value)
      return
    }
    stopCamera()
    checkInService.verifyStaffCheckin({ memberId: value })
      .then((res) => {
        setMember({
          _id: res.data.checkin.memberId,
          name: res.data.checkin.memberName,
          email: res.data.checkin.email || null,
          phone: res.data.checkin.phone || null,
          avatar: '',
        })
        setStreakDay(res.data.checkin.streakDay || 0)
        setStep('success')
        message.success(res.data.message || 'Check-in thành công')
        loadCheckinHistory(historyPage)
      })
      .catch((error: any) => {
        const code = error?.response?.data?.code
        const msg = error?.response?.data?.message || 'Không thể check-in'
        if (code === 'ALREADY_CHECKED_IN') setStep('already_checked')
        else {
          setErrorMsg(msg)
          setStep('error')
        }
      })
  }

  const resetAll = () => {
    stopCamera()
    setManualToken('')
    setMember(null)
    setStreakDay(0)
    setErrorMsg('')
    setStep('scan')
  }

  const loadCheckinHistory = async (page = historyPage) => {
    setHistoryLoading(true)
    try {
      const query = {
        mode: timeMode,
        date: timeMode === 'custom' ? (filterDate || dayjs()).format('YYYY-MM-DD') : undefined,
        startTime: startTime ? startTime.format('HH:mm') : undefined,
        endTime: endTime ? endTime.format('HH:mm') : undefined,
        keyword: keyword.trim() || undefined,
        page,
        limit: 10,
      }
      console.log('[staff-checkin-history] frontend query:', {
        mode: query.mode,
        startTime: query.startTime,
        endTime: query.endTime,
        keyword: query.keyword,
      })
      const res = await checkInService.getStaffHistory(query)
      setCheckins(res.data.checkins || [])
      setHistoryPage(res.data.pagination?.page || page)
      setHistoryTotal(res.data.pagination?.total || 0)
    } catch {
      message.error('Không thể tải lịch sử check-in')
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    loadCheckinHistory(1)
  }, [])

  const handleResetFilters = () => {
    setTimeMode('today')
    setFilterDate(dayjs())
    setStartTime(null)
    setEndTime(null)
    setKeyword('')
    setHistoryPage(1)
    setTimeout(() => loadCheckinHistory(1), 0)
  }

  const renderScan = () => (
    <div>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">QUÉT QR CHECK-IN</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">Check-in</h1>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>
          <Card className="rounded-[24px]" style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', aspectRatio: '4/3', background: '#000', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraActive ? 'block' : 'none' }} />
              <div style={{ display: cameraActive ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, color: 'var(--gs-text-muted)' }}>
                <CameraOutlined style={{ fontSize: 48, marginBottom: 12 }} />
                <Text>Bấm "Mở camera" để bắt đầu quét QR</Text>
              </div>
            </div>
            <Space>
              {!cameraActive ? (
                <Button type="primary" icon={<CameraOutlined />} onClick={startCamera} size="large">
                  Mở camera
                </Button>
              ) : (
                <Button icon={<StopOutlined />} onClick={stopCamera} size="large">
                  Tắt camera
                </Button>
              )}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          <Card className="rounded-[24px]" style={{ marginBottom: 16 }}>
            <Text strong>Nhập thủ công</Text>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Input
                placeholder="Nhập mã QR hoặc ID hội viên"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                onPressEnter={handleManualSubmit}
              />
              <Button type="primary" onClick={handleManualSubmit}>
                Xác nhận
              </Button>
            </div>
          </Card>
          <Card className="rounded-[24px]" title="Lịch sử check-in">
            <div className="mb-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Select<TimeMode>
                  className="w-full"
                  value={timeMode}
                  onChange={(value) => {
                    setTimeMode(value)
                    if (value === 'custom' && !filterDate) setFilterDate(dayjs())
                  }}
                  options={[
                    { value: 'today', label: 'Hôm nay' },
                    { value: 'yesterday', label: 'Hôm qua' },
                    { value: 'last7days', label: '7 ngày gần đây' },
                    { value: 'last30days', label: '30 ngày gần đây' },
                    { value: 'all', label: 'Từ trước đến nay' },
                    { value: 'custom', label: 'Tùy chọn' },
                  ]}
                />
                {timeMode === 'custom' && (
                  <DatePicker
                    className="w-full"
                    value={filterDate}
                    onChange={setFilterDate}
                    format="DD/MM/YYYY"
                    placeholder="Chọn ngày"
                  />
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TimePicker
                className="w-full"
                value={startTime}
                onChange={setStartTime}
                format="HH:mm"
                placeholder="Từ giờ"
              />
              <TimePicker
                className="w-full"
                value={endTime}
                onChange={setEndTime}
                format="HH:mm"
                placeholder="Đến giờ"
              />
              </div>
              <Input
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onPressEnter={() => loadCheckinHistory(1)}
                placeholder="Tìm theo mã HV / tên / SĐT"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="primary" icon={<FilterOutlined />} onClick={() => loadCheckinHistory(1)}>Tìm kiếm</Button>
                <Button onClick={handleResetFilters}>Xóa lọc</Button>
                <Button icon={<ReloadOutlined />} onClick={() => loadCheckinHistory(historyPage)}>Tải lại</Button>
              </div>
            </div>
            <Table
              size="small"
              rowKey="checkinId"
              dataSource={checkins}
              loading={historyLoading}
              columns={[
                {
                  title: 'Thời gian',
                  dataIndex: 'checkinTime',
                  width: 92,
                  render: (value: string) => new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                },
                {
                  title: 'Mã hội viên',
                  dataIndex: 'memberCode',
                  width: 105,
                  render: (value: string) => value || '—',
                },
                {
                  title: 'Họ tên',
                  dataIndex: 'memberName',
                  ellipsis: true,
                },
                {
                  title: 'Gói tập',
                  dataIndex: 'planName',
                  ellipsis: true,
                  render: (value: string) => value || '—',
                },
                {
                  title: 'Staff thực hiện',
                  dataIndex: 'staffName',
                  ellipsis: true,
                  render: (value: string) => value || '—',
                },
                {
                  title: 'Trạng thái',
                  dataIndex: 'status',
                  width: 100,
                  render: (value: string, record: StaffCheckinHistoryItem) => (
                    <Tag color={value === 'success' ? 'success' : 'error'}>
                      {value === 'success' ? 'Thành công' : record.errorNote || 'Thất bại'}
                    </Tag>
                  ),
                },
              ]}
              pagination={{
                current: historyPage,
                pageSize: 10,
                total: historyTotal,
                showSizeChanger: false,
                onChange: (page) => loadCheckinHistory(page),
              }}
              scroll={{ x: 820 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )

  const renderSuccess = () => (
    <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
      <Card className="rounded-[24px]" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.05))' }}>
        <CheckCircleOutlined style={{ fontSize: 72, color: '#10B981' }} />
        <Title level={3} style={{ marginTop: 16 }}>Check-in thành công!</Title>
        <Text>{getUserDisplayName(member, 'Thành viên')}</Text>
        {streakDay > 1 && (
          <div style={{ marginTop: 12 }}>
            <Tag color="orange" style={{ fontSize: 16, padding: '4px 12px' }}>🔥 {streakDay} ngày liên tiếp</Tag>
          </div>
        )}
        <div style={{ marginTop: 24 }}>
          <Button type="primary" icon={<ReloadOutlined />} onClick={resetAll} size="large">
            Check-in hội viên khác
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
            Check-in hội viên khác
          </Button>
        </div>
      </Card>
    </div>
  )

  const renderError = () => (
    <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
      <Card className="rounded-[24px]">
        <CloseCircleOutlined style={{ fontSize: 72, color: '#EF4444' }} />
        <Title level={4} style={{ marginTop: 16 }}>Check-in thất bại</Title>
        <Text type="secondary">{errorMsg}</Text>
        <div style={{ marginTop: 24 }}>
          <Button type="primary" icon={<ReloadOutlined />} onClick={resetAll} size="large">
            Thử lại
          </Button>
        </div>
      </Card>
    </div>
  )

  return (
    <DashboardLayout>
      {step === 'scan' && renderScan()}
      {step === 'success' && renderSuccess()}
      {step === 'already_checked' && renderAlreadyChecked()}
      {step === 'error' && renderError()}
    </DashboardLayout>
  )
}
