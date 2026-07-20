import { CheckCircleFilled, FilterOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import {
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useEffect, useRef, useState } from 'react'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { checkInService } from '../../../services/checkInService'
import type { SearchedMember, StaffCheckinHistoryItem } from '../../../types/admin/checkin'

const { Text } = Typography

type TimeMode = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'all' | 'custom'

const checkInMethodLabels: Record<string, { label: string; color: string }> = {
  QR_SELF: { label: 'QR tự check-in', color: 'blue' },
  QR_PROJECTOR: { label: 'QR trình chiếu', color: 'cyan' },
  STAFF: { label: 'Lễ tân điểm danh', color: 'orange' },
  RECEPTION: { label: 'Lễ tân điểm danh', color: 'purple' },
  AUTO: { label: 'Auto check-in', color: 'geekblue' },
}

const reasonOptions = [
  { value: 'Hết pin', label: 'Hết pin' },
  { value: 'Quên điện thoại', label: 'Quên điện thoại' },
  { value: 'Không mở được camera', label: 'Không mở được camera' },
  { value: 'Không quét được QR', label: 'Không quét được QR' },
  { value: 'Staff xác minh trực tiếp', label: 'Staff xác minh trực tiếp' },
  { value: 'Khác', label: 'Khác' },
]

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

  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()

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
    }
    setSearching(false)
  }

  const handleSearchChange = (value: string) => {
    setSearchValue(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => doSearch(value), 400)
  }

  const handleSearchEnter = () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    doSearch(searchValue)
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
      loadCheckinHistory(historyPage)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Điểm danh thất bại.'
      if (err?.response?.data?.code === 'ALREADY_CHECKED_IN') {
        message.info(msg)
        setModalOpen(false)
        loadCheckinHistory(historyPage)
      } else {
        message.error(msg)
      }
    }
    setSubmitting(false)
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

  const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleString('vi-VN') : '-'

  const columns = [
    {
      title: 'Thời gian',
      dataIndex: 'checkinTime',
      width: 150,
      render: (v: string) => formatDate(v),
    },
    {
      title: 'Mã HV',
      dataIndex: 'memberCode',
      width: 100,
      render: (v: string) => v || '—',
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
      render: (v: string) => v || '—',
    },
    {
      title: 'Hình thức',
      dataIndex: 'checkInMethod',
      width: 130,
      render: (v: string) => {
        const meta = checkInMethodLabels[v] || { label: v || '—', color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: 'Người thực hiện',
      dataIndex: 'performedByName',
      width: 130,
      render: (v: string, r: StaffCheckinHistoryItem) => v || r.staffName || '—',
    },
    {
      title: 'Lý do',
      dataIndex: 'manualReason',
      width: 150,
      ellipsis: true,
      render: (v: string) => v || '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 100,
      render: (v: string, r: StaffCheckinHistoryItem) => (
        <Tag color={v === 'success' ? 'success' : 'error'}>
          {v === 'success' ? 'Thành công' : r.errorNote || 'Thất bại'}
        </Tag>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">CHECK-IN HỘI VIÊN</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">Điểm danh thủ công</h1>
        <p className="mt-1 text-sm text-[var(--gs-text-muted)]">
          Điểm danh thủ công khi hội viên không thể tự quét QR.
        </p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>
          <Card className="rounded-[24px]" title={<Text strong>Tìm hội viên</Text>}>
            <Input
              size="large"
              prefix={<SearchOutlined />}
              placeholder="Nhập: Email Google OAuth • Email đăng ký • Mã hội viên • Số điện thoại"
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              onPressEnter={handleSearchEnter}
              allowClear
            />

            {searching && (
              <div className="mt-4 text-center text-[var(--gs-text-muted)]">Đang tìm kiếm...</div>
            )}

            {searchError && !searching && (
              <div className="mt-4 text-center text-[var(--gs-text-muted)]">{searchError}</div>
            )}

            {searchedMember && !searching && (
              <div className="mt-4 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4">
                <div className="flex items-center gap-3">
                  <Avatar size={48} src={searchedMember.avatar || undefined}>
                    {searchedMember.fullName?.charAt(0)?.toUpperCase()}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <Text strong className="text-[var(--gs-text)] text-base block truncate">
                      {searchedMember.fullName}
                    </Text>
                    <Text className="text-[var(--gs-text-muted)] text-xs">
                      {searchedMember.memberCode}
                    </Text>
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <Text className="text-[var(--gs-text-muted)]">Email:</Text>
                    <Text className="text-[var(--gs-text)]">{searchedMember.email || '—'}</Text>
                  </div>
                  <div className="flex justify-between">
                    <Text className="text-[var(--gs-text-muted)]">SĐT:</Text>
                    <Text className="text-[var(--gs-text)]">{searchedMember.phone || '—'}</Text>
                  </div>
                  {searchedMember.membership ? (
                    <>
                      <div className="flex justify-between">
                        <Text className="text-[var(--gs-text-muted)]">Gói tập:</Text>
                        <Text className="text-[var(--gs-text)] font-medium">
                          {searchedMember.membership.planName}
                        </Text>
                      </div>
                      <div className="flex justify-between">
                        <Text className="text-[var(--gs-text-muted)]">
                          {searchedMember.membership.status === 'pending_initial_activation' ? 'Ngày mua:' : 'Hạn dùng:'}
                        </Text>
                        <Text className="text-[var(--gs-text)]">
                          {new Date(searchedMember.membership.endDate).toLocaleDateString('vi-VN')}
                        </Text>
                      </div>
                      {searchedMember.membership.price > 0 && (
                        <div className="flex justify-between">
                          <Text className="text-[var(--gs-text-muted)]">Giá gói:</Text>
                          <Text className="text-[var(--gs-text)] font-medium">
                            {searchedMember.membership.price.toLocaleString('vi-VN')}đ
                          </Text>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <Text className="text-[var(--gs-text-muted)]">Trạng thái:</Text>
                        {searchedMember.membership.status === 'active' ? (
                          <Tag color="success">Đang hoạt động</Tag>
                        ) : searchedMember.membership.status === 'pending_initial_activation' ? (
                          <Tag color="warning">Chờ kích hoạt</Tag>
                        ) : (
                          <Tag color="error">Đã hết hạn</Tag>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="mt-2">
                      <Tag color="error">Chưa có gói tập</Tag>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  {searchedMember.checkedInToday ? (
                    <div className="flex items-center justify-center gap-2 rounded-lg bg-[var(--gs-success-bg)] py-3">
                      <CheckCircleFilled style={{ color: '#22c55e' }} />
                      <Text className="text-[var(--gs-text-muted)]">Đã check-in hôm nay</Text>
                    </div>
                  ) : (
                    <Button
                      type="primary"
                      size="large"
                      block
                      disabled={!searchedMember.membership || searchedMember.membership.status === 'expired'}
                      onClick={() => setModalOpen(true)}
                    >
                      Điểm danh
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          <Card className="rounded-[24px]" title={<Text strong>Lịch sử check-in</Text>}>
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
                <Input
                  prefix={<SearchOutlined />}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onPressEnter={() => loadCheckinHistory(1)}
                  placeholder="Tìm theo mã HV / tên / SĐT"
                />
                <Space>
                  <Button type="primary" icon={<FilterOutlined />} onClick={() => loadCheckinHistory(1)}>
                    Tìm kiếm
                  </Button>
                  <Button onClick={handleResetFilters}>Xóa lọc</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => loadCheckinHistory(historyPage)}>
                    Tải lại
                  </Button>
                </Space>
              </div>
            </div>
            <Table
              size="small"
              rowKey="checkinId"
              dataSource={checkins}
              loading={historyLoading}
              columns={columns}
              pagination={{
                current: historyPage,
                pageSize: 10,
                total: historyTotal,
                showSizeChanger: false,
                onChange: (page) => loadCheckinHistory(page),
              }}
              scroll={{ x: 1000 }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="Xác nhận điểm danh thủ công"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalOpen(false)}>Hủy</Button>,
          <Button key="confirm" type="primary" loading={submitting} onClick={handleCheckin}>
            Xác nhận điểm danh
          </Button>,
        ]}
      >
        <div className="py-2">
          {searchedMember && (
            <div className="mb-4 flex items-center gap-3 rounded-lg bg-[var(--gs-card)] p-3">
              <Avatar size={40} src={searchedMember.avatar || undefined}>
                {searchedMember.fullName?.charAt(0)?.toUpperCase()}
              </Avatar>
              <div>
                <Text strong className="text-[var(--gs-text)]">{searchedMember.fullName}</Text>
                <div className="text-xs text-[var(--gs-text-muted)]">{searchedMember.memberCode}</div>
              </div>
            </div>
          )}
          <div className="mb-2 text-sm font-medium text-[var(--gs-text)]">Lý do:</div>
          <Radio.Group
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            className="w-full"
          >
            <Space direction="vertical" className="w-full">
              {reasonOptions.map((opt) => (
                <Radio key={opt.value} value={opt.value} className="text-[var(--gs-text)]">
                  {opt.label}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
          {selectedReason === 'Khác' && (
            <Input.TextArea
              className="mt-3"
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
