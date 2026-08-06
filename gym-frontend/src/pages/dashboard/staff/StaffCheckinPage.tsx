import { CheckCircleFilled, ClockCircleOutlined, FilterOutlined, IdcardOutlined, ReloadOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import {
  Alert,
  Avatar,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Empty,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  TimePicker,
  Typography,
  message,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useEffect, useMemo, useRef, useState } from 'react'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { checkInService } from '../../../services/checkInService'
import type { SearchedMember, StaffCheckinHistoryItem } from '../../../types/admin/checkin'
import { getUserDisplayName } from '../../../utils/userDisplay'

type TimeMode = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'all' | 'custom'

const checkInMethodLabels: Record<string, { label: string; color: string }> = {
  QR_SELF: { label: 'QR tự check-in', color: 'blue' },
  QR_PROJECTOR: { label: 'QR trình chiếu', color: 'cyan' },
  STAFF: { label: 'Lễ tân điểm danh', color: 'orange' },
  RECEPTION: { label: 'Lễ tân điểm danh', color: 'purple' },
  AUTO: { label: 'Tự động', color: 'geekblue' },
}

const reasonOptions = [
  { value: 'Hết pin', label: 'Hết pin' },
  { value: 'Quên điện thoại', label: 'Quên điện thoại' },
  { value: 'Không mở được camera', label: 'Không mở được camera' },
  { value: 'Không quét được QR', label: 'Không quét được QR' },
  { value: 'Staff xác minh trực tiếp', label: 'Staff xác minh trực tiếp' },
  { value: 'Khác', label: 'Khác' },
]

const formatDateTime = (value?: string) => value ? dayjs(value).format('HH:mm:ss DD/MM/YYYY') : '—'
const formatDate = (value?: string) => value ? dayjs(value).format('DD/MM/YYYY') : '—'
const formatMoney = (value?: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`

export default function StaffCheckinPage() {
  const [searchValue, setSearchValue] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchedMember, setSearchedMember] = useState<SearchedMember | null>(null)
  const [searchError, setSearchError] = useState('')

  const [checkins, setCheckins] = useState<StaffCheckinHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [timeMode, setTimeMode] = useState<TimeMode>('today')
  const [filterDate, setFilterDate] = useState<Dayjs | null>(dayjs())
  const [startTime, setStartTime] = useState<Dayjs | null>(null)
  const [endTime, setEndTime] = useState<Dayjs | null>(null)
  const [keyword, setKeyword] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedReason, setSelectedReason] = useState('Staff xác minh trực tiếp')
  const [customReason, setCustomReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const successCount = useMemo(() => checkins.filter((item) => item.status === 'success').length, [checkins])
  const staffCount = useMemo(() => checkins.filter((item) => ['STAFF', 'RECEPTION'].includes(item.checkInMethod || '')).length, [checkins])
  const qrCount = useMemo(() => checkins.filter((item) => ['QR_SELF', 'QR_PROJECTOR'].includes(item.checkInMethod || '')).length, [checkins])

  const doSearch = async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) {
      setSearchedMember(null)
      setSearchError('')
      return
    }
    setSearching(true)
    setSearchError('')
    try {
      const res = await checkInService.searchMember(trimmed)
      if (res.data.member) {
        setSearchedMember(res.data.member)
        setSearchError('')
      } else {
        setSearchedMember(null)
        setSearchError('Không tìm thấy hội viên phù hợp.')
      }
    } catch {
      setSearchedMember(null)
      setSearchError('Tìm kiếm thất bại.')
    } finally {
      setSearching(false)
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchValue(value)
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    searchTimerRef.current = window.setTimeout(() => doSearch(value), 350)
  }

  const handleSearchEnter = () => {
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    doSearch(searchValue)
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

  const handleCheckin = async () => {
    if (!searchedMember) return
    const reason = selectedReason === 'Khác' ? customReason.trim() : selectedReason
    if (selectedReason === 'Khác' && !reason) {
      message.warning('Vui lòng nhập lý do.')
      return
    }
    setSubmitting(true)
    try {
      await checkInService.verifyStaffCheckin({
        memberId: searchedMember._id,
        manualReason: reason || undefined,
      })
      message.success('Điểm danh thành công!')
      setModalOpen(false)
      setSearchedMember(null)
      setSearchValue('')
      setSelectedReason('Staff xác minh trực tiếp')
      setCustomReason('')
      loadCheckinHistory(1)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Điểm danh thất bại.'
      if (err?.response?.data?.code === 'ALREADY_CHECKED_IN') {
        message.info(msg)
        setModalOpen(false)
        loadCheckinHistory(1)
      } else {
        message.error(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      title: 'Thời gian',
      dataIndex: 'checkinTime',
      width: 170,
      render: (value: string) => <span className="font-medium">{formatDateTime(value)}</span>,
    },
    {
      title: 'Hội viên',
      width: 230,
      render: (_: any, record: StaffCheckinHistoryItem) => (
        <div>
          <div className="font-semibold text-[var(--gs-text)]">{record.memberName || '—'}</div>
          <div className="text-xs text-[var(--gs-text-muted)]">{record.memberCode || '—'} • {record.phone || record.email || '—'}</div>
        </div>
      ),
    },
    {
      title: 'Gói tập',
      dataIndex: 'planName',
      ellipsis: true,
      render: (value: string) => value || '—',
    },
    {
      title: 'Hình thức',
      dataIndex: 'checkInMethod',
      width: 150,
      render: (value: string) => {
        const meta = checkInMethodLabels[value] || { label: value || '—', color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: 'Người thực hiện',
      dataIndex: 'performedByName',
      width: 160,
      render: (value: string, record: StaffCheckinHistoryItem) => value || record.staffName || '—',
    },
    {
      title: 'Lý do',
      dataIndex: 'manualReason',
      width: 180,
      ellipsis: true,
      render: (value: string) => value || '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 120,
      render: (value: string, record: StaffCheckinHistoryItem) => (
        <Tag color={value === 'success' ? 'success' : 'error'}>
          {value === 'success' ? 'Thành công' : record.errorNote || 'Thất bại'}
        </Tag>
      ),
    },
  ]

  const canCheckin = searchedMember?.membership && searchedMember.membership.status !== 'expired' && !searchedMember.checkedInToday

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="m-0 text-xs uppercase tracking-[0.24em] text-[var(--gs-text-soft)]">CHECK-IN HỘI VIÊN</p>
              <Typography.Title level={2} className="!m-0 !mt-2 !text-[var(--gs-text)]">
                Điểm danh tại quầy
              </Typography.Title>
              <Typography.Paragraph className="!mb-0 !mt-2 !text-[var(--gs-text-muted)]">
                Tìm hội viên bằng mã, số điện thoại hoặc email để hỗ trợ check-in khi không tự quét QR được.
              </Typography.Paragraph>
            </div>
            <div className="grid grid-cols-3 gap-3 xl:min-w-[430px]">
              <Card size="small" className="rounded-xl">
                <Statistic title="Hiển thị" value={historyTotal} prefix={<ClockCircleOutlined />} valueStyle={{ fontSize: 18 }} />
              </Card>
              <Card size="small" className="rounded-xl">
                <Statistic title="Thành công" value={successCount} prefix={<CheckCircleFilled />} valueStyle={{ fontSize: 18, color: '#10B981' }} />
              </Card>
              <Card size="small" className="rounded-xl">
                <Statistic title="Tại quầy" value={staffCount} prefix={<IdcardOutlined />} valueStyle={{ fontSize: 18 }} />
              </Card>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
          <div className="space-y-4">
            <Card title="Check-in nhanh" className="rounded-2xl">
              <Input.Search
                size="large"
                prefix={<SearchOutlined />}
                placeholder="Mã hội viên, tên, SĐT hoặc email"
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                onSearch={doSearch}
                onPressEnter={handleSearchEnter}
                allowClear
                loading={searching}
              />

              {searchError && !searching && (
                <Alert className="mt-4" type="warning" showIcon message={searchError} />
              )}

              {!searchedMember && !searchError && !searching && (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--gs-border)] p-6 text-center text-sm text-[var(--gs-text-muted)]">
                  Nhập thông tin hội viên để bắt đầu điểm danh.
                </div>
              )}

              {searchedMember && !searching && (
                <div className="mt-4 rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
                  <div className="flex items-center gap-3">
                    <Avatar size={56} src={searchedMember.avatar || undefined} icon={<UserOutlined />}>
                      {getUserDisplayName(searchedMember).charAt(0)?.toUpperCase()}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold text-[var(--gs-text)]">{getUserDisplayName(searchedMember)}</div>
                      <div className="text-xs text-[var(--gs-text-muted)]">{searchedMember.memberCode || '—'}</div>
                    </div>
                    {searchedMember.checkedInToday && <Tag color="success">Đã check-in</Tag>}
                  </div>

                  <Descriptions className="mt-4" bordered size="small" column={1}>
                    <Descriptions.Item label="Email">{searchedMember.email || '—'}</Descriptions.Item>
                    <Descriptions.Item label="SĐT">{searchedMember.phone || '—'}</Descriptions.Item>
                    {searchedMember.membership ? (
                      <>
                        <Descriptions.Item label="Gói tập">{searchedMember.membership.planName}</Descriptions.Item>
                        <Descriptions.Item label="Hạn dùng">{formatDate(searchedMember.membership.endDate)}</Descriptions.Item>
                        <Descriptions.Item label="Giá gói">{formatMoney(searchedMember.membership.price)}</Descriptions.Item>
                        <Descriptions.Item label="Trạng thái">
                          {searchedMember.membership.status === 'active'
                            ? <Tag color="success">Đang hoạt động</Tag>
                            : <Tag color="error">Đã hết hạn</Tag>}
                        </Descriptions.Item>
                      </>
                    ) : (
                      <Descriptions.Item label="Gói tập"><Tag color="error">Chưa có gói tập</Tag></Descriptions.Item>
                    )}
                  </Descriptions>

                  <div className="mt-4">
                    {searchedMember.checkedInToday ? (
                      <Alert type="success" showIcon message="Hội viên đã check-in hôm nay." />
                    ) : (
                      <Button
                        type="primary"
                        size="large"
                        block
                        disabled={!canCheckin}
                        onClick={() => setModalOpen(true)}
                      >
                        Điểm danh tại quầy
                      </Button>
                    )}
                    {!searchedMember.membership && (
                      <div className="mt-2 text-xs text-[var(--gs-text-muted)]">Hội viên cần có gói tập hợp lệ trước khi check-in.</div>
                    )}
                    {searchedMember.membership?.status === 'expired' && (
                      <div className="mt-2 text-xs text-red-500">Gói tập đã hết hạn, không thể check-in.</div>
                    )}
                  </div>
                </div>
              )}
            </Card>

            <Card className="rounded-2xl">
              <div className="grid grid-cols-2 gap-3">
                <Statistic title="QR" value={qrCount} valueStyle={{ fontSize: 18 }} />
                <Statistic title="Lễ tân" value={staffCount} valueStyle={{ fontSize: 18 }} />
              </div>
            </Card>
          </div>

          <Card
            className="rounded-2xl"
            title="Lịch sử check-in"
            extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => loadCheckinHistory(historyPage)}>Tải lại</Button>}
          >
            <div className="mb-4 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <Select<TimeMode>
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
                {timeMode === 'custom' ? (
                  <DatePicker
                    value={filterDate}
                    onChange={setFilterDate}
                    format="DD/MM/YYYY"
                    placeholder="Chọn ngày"
                  />
                ) : (
                  <Input disabled value="Theo bộ lọc thời gian" />
                )}
                <Input
                  prefix={<SearchOutlined />}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onPressEnter={() => loadCheckinHistory(1)}
                  placeholder="Mã HV / tên / SĐT"
                />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
                <TimePicker value={startTime} onChange={setStartTime} format="HH:mm" placeholder="Từ giờ" className="w-full" />
                <TimePicker value={endTime} onChange={setEndTime} format="HH:mm" placeholder="Đến giờ" className="w-full" />
                <Space wrap>
                  <Button type="primary" icon={<FilterOutlined />} onClick={() => loadCheckinHistory(1)}>Tìm kiếm</Button>
                  <Button onClick={handleResetFilters}>Xóa lọc</Button>
                </Space>
              </div>
            </div>

            <Table
              size="small"
              rowKey="checkinId"
              dataSource={checkins}
              loading={historyLoading}
              columns={columns}
              locale={{ emptyText: <Empty description="Chưa có lịch sử check-in" /> }}
              pagination={{
                current: historyPage,
                pageSize: 10,
                total: historyTotal,
                showSizeChanger: false,
                onChange: (page) => loadCheckinHistory(page),
              }}
              scroll={{ x: 1100 }}
            />
          </Card>
        </div>
      </div>

      <Modal
        title="Xác nhận điểm danh tại quầy"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalOpen(false)}>Hủy</Button>,
          <Button key="confirm" type="primary" loading={submitting} onClick={handleCheckin}>
            Xác nhận điểm danh
          </Button>,
        ]}
      >
        <div className="space-y-4 py-2">
          {searchedMember && (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-3">
              <Avatar size={44} src={searchedMember.avatar || undefined} icon={<UserOutlined />}>
                {getUserDisplayName(searchedMember).charAt(0)?.toUpperCase()}
              </Avatar>
              <div>
                <div className="font-semibold text-[var(--gs-text)]">{getUserDisplayName(searchedMember)}</div>
                <div className="text-xs text-[var(--gs-text-muted)]">{searchedMember.memberCode}</div>
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 text-sm font-medium text-[var(--gs-text)]">Lý do điểm danh thủ công</div>
            <Radio.Group
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full"
            >
              <Space direction="vertical" className="w-full">
                {reasonOptions.map((option) => (
                  <Radio key={option.value} value={option.value} className="text-[var(--gs-text)]">
                    {option.label}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          </div>

          {selectedReason === 'Khác' && (
            <Input.TextArea
              rows={3}
              placeholder="Nhập lý do..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
            />
          )}
        </div>
      </Modal>
    </DashboardLayout>
  )
}
