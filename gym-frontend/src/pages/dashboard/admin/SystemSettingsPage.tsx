import { DeleteOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Card, Input, InputNumber, Select, Space, Spin, Switch, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { SYSTEM_SETTINGS_DEFAULTS, useSystemSettings } from '../../../context/SystemSettingsContext'
import { systemSettingsService } from '../../../services/systemSettingsService'

const { Text } = Typography

const ColorPickerControl = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [local, setLocal] = useState(value)

  useEffect(() => {
    setLocal(value)
  }, [value])

  const displayHex = (local || '#DB2777').toUpperCase()

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={local || '#DB2777'}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== value) onChange(local)
        }}
        className="h-9 w-12 cursor-pointer rounded-lg border bg-transparent p-0.5"
        style={{ borderColor: 'var(--theme-border-strong)' }}
      />
      <span className="font-mono text-xs text-[var(--theme-muted)]">{displayHex}</span>
    </div>
  )
}

type SettingType = 'switch' | 'text' | 'select' | 'number' | 'slogans' | 'color'

type SettingItem = {
  path: string
  type: SettingType
  options?: { labelKey: string; value: string }[]
  min?: number
  max?: number
}

type SettingGroup = {
  key: string
  items: SettingItem[]
}

const langOptions = [
  { label: 'Tiếng Việt', value: 'vi' },
  { label: 'Tiếng Anh', value: 'en' },
]

const themeOptions = [
  { label: 'Tối', value: 'dark' },
  { label: 'Sáng', value: 'light' },
]

const SETTING_GROUPS: SettingGroup[] = [
  {
    key: 'general',
    items: [
      { path: 'general.siteName', type: 'text' },
      { path: 'general.slogans', type: 'slogans' },
      { path: 'general.logoUrl', type: 'text' },
      { path: 'general.defaultLanguage', type: 'select', options: langOptions },
      { path: 'general.defaultTheme', type: 'select', options: themeOptions },
      { path: 'general.defaultAccentColor', type: 'color' },
      { path: 'general.maintenanceMode', type: 'switch' },
      { path: 'general.maintenanceMessage.vi', type: 'text' },
      { path: 'general.maintenanceMessage.en', type: 'text' },
    ],
  },
  {
    key: 'auth',
    items: [
      { path: 'auth.allowRegistration', type: 'switch' },
      { path: 'auth.allowPhoneLogin', type: 'switch' },
      { path: 'auth.allowEmailUsernameLogin', type: 'switch' },
      { path: 'auth.googleOAuthEnabled', type: 'switch' },
      { path: 'auth.facebookOAuthEnabled', type: 'switch' },
      { path: 'auth.demoOtpEnabled', type: 'switch' },
      { path: 'auth.otpExpiresInSeconds', type: 'number', min: 30, max: 3600 },
      { path: 'auth.forgotPasswordSmsOtpEnabled', type: 'switch' },
      { path: 'auth.forgotPasswordEmailEnabled', type: 'switch' },
    ],
  },
  {
    key: 'members',
    items: [
      { path: 'members.allowProfileUpdate', type: 'switch' },
      { path: 'members.allowAvatarUpload', type: 'switch' },
      { path: 'members.allowAccountLockToggle', type: 'switch' },
      { path: 'members.protectPrimaryAdmin', type: 'switch' },
      { path: 'members.allowBulkActions', type: 'switch' },
    ],
  },
  {
    key: 'billing',
    items: [
      { path: 'billing.allowPlanPurchase', type: 'switch' },
      { path: 'billing.allowAssignPlanToMember', type: 'switch' },
      { path: 'billing.allowPlanRenewal', type: 'switch' },
      { path: 'billing.renewalThresholdDays', type: 'number', min: 1, max: 90 },
      { path: 'billing.discountCodesEnabled', type: 'switch' },
      { path: 'billing.qrPaymentEnabled', type: 'switch' },
      { path: 'billing.planMemberCountEnabled', type: 'switch' },
    ],
  },
  {
    key: 'checkin',
    items: [
      { path: 'checkin.qrCheckinEnabled', type: 'switch' },
      { path: 'checkin.qrTokenTtlSeconds', type: 'number', min: 5, max: 600 },
      { path: 'checkin.preventDuplicateWithinHour', type: 'switch' },
      { path: 'checkin.selfieRequired', type: 'switch' },
      { path: 'checkin.streakEnabled', type: 'switch' },
      { path: 'checkin.successSoundEnabled', type: 'switch' },
    ],
  },
  {
    key: 'pt',
    items: [
      { path: 'pt.moduleEnabled', type: 'switch' },
      { path: 'pt.scheduleEnabled', type: 'switch' },
      { path: 'pt.memberBookingEnabled', type: 'switch' },
      { path: 'pt.weeklyRecurringBookingEnabled', type: 'switch' },
      { path: 'pt.waitlistEnabled', type: 'switch' },
      { path: 'pt.reviewAfterSessionEnabled', type: 'switch' },
    ],
  },
  {
    key: 'workout',
    items: [
      { path: 'workout.workoutPlanEnabled', type: 'switch' },
      { path: 'workout.workoutTimerEnabled', type: 'switch' },
      { path: 'workout.healthLogEnabled', type: 'switch' },
      { path: 'workout.bmiHistoryEnabled', type: 'switch' },
      { path: 'workout.progressPhotoUploadEnabled', type: 'switch' },
      { path: 'workout.healthChartEnabled', type: 'switch' },
    ],
  },
  {
    key: 'reports',
    items: [
      { path: 'reports.revenueChartEnabled', type: 'switch' },
      { path: 'reports.checkinHeatmapEnabled', type: 'switch' },
      { path: 'reports.revenueForecastEnabled', type: 'switch' },
      { path: 'reports.churnRiskEnabled', type: 'switch' },
      { path: 'reports.excelExportEnabled', type: 'switch' },
      { path: 'reports.pdfExportEnabled', type: 'switch' },
      { path: 'reports.auditLogEnabled', type: 'switch' },
    ],
  },
  {
    key: 'notifications',
    items: [
      { path: 'notifications.systemNotificationsEnabled', type: 'switch' },
      { path: 'notifications.roleGroupNotificationsEnabled', type: 'switch' },
      { path: 'notifications.emailNotificationsEnabled', type: 'switch' },
      { path: 'notifications.readUnreadStatusEnabled', type: 'switch' },
    ],
  },
  {
    key: 'shop',
    items: [
      { path: 'shop.productStoreEnabled', type: 'switch' },
      { path: 'shop.cartEnabled', type: 'switch' },
      { path: 'shop.productReviewsEnabled', type: 'switch' },
      { path: 'shop.productDetailPageEnabled', type: 'switch' },
    ],
  },
  {
    key: 'ai',
    items: [
      { path: 'ai.systemAiEnabled', type: 'switch' },
      { path: 'ai.memberAiEnabled', type: 'switch' },
      { path: 'ai.adminAiEnabled', type: 'switch' },
    ],
  },
  {
    key: 'landing',
    items: [
      { path: 'landing.statsSectionEnabled', type: 'switch' },
      { path: 'landing.servicesSectionEnabled', type: 'switch' },
      { path: 'landing.feedbackSectionEnabled', type: 'switch' },
      { path: 'landing.partnersSectionEnabled', type: 'switch' },
      { path: 'landing.startNowButtonEnabled', type: 'switch' },
      { path: 'landing.checkinNowButtonEnabled', type: 'switch' },
    ],
  },
]

const clone = (value: any) => JSON.parse(JSON.stringify(value))

const getByPath = (source: any, path: string) => path.split('.').reduce((value, key) => value?.[key], source)

const setByPath = (source: any, path: string, value: any) => {
  const next = clone(source)
  const keys = path.split('.')
  let cursor = next
  keys.slice(0, -1).forEach((key) => {
    cursor[key] = cursor[key] || {}
    cursor = cursor[key]
  })
  cursor[keys[keys.length - 1]] = value
  return next
}

const settingLabels: Record<string, string> = {
  'general.siteName': 'Tên trang web',
  'general.slogans': 'Slogan',
  'general.logoUrl': 'URL Logo',
  'general.defaultLanguage': 'Ngôn ngữ mặc định',
  'general.defaultTheme': 'Giao diện mặc định',
  'general.defaultAccentColor': 'Màu nhấn mặc định',
  'general.maintenanceMode': 'Chế độ bảo trì',
  'general.maintenanceMessage.vi': 'Thông báo bảo trì (VI)',
  'general.maintenanceMessage.en': 'Thông báo bảo trì (EN)',
  'auth.allowRegistration': 'Cho phép đăng ký',
  'auth.allowPhoneLogin': 'Cho phép đăng nhập bằng SĐT',
  'auth.allowEmailUsernameLogin': 'Cho phép đăng nhập bằng Email',
  'auth.googleOAuthEnabled': 'Đăng nhập Google',
  'auth.facebookOAuthEnabled': 'Đăng nhập Facebook',
  'auth.demoOtpEnabled': 'OTP chế độ demo',
  'auth.otpExpiresInSeconds': 'Thời gian hết hạn OTP (giây)',
  'auth.forgotPasswordSmsOtpEnabled': 'Quên MK bằng OTP SMS',
  'auth.forgotPasswordEmailEnabled': 'Quên MK bằng Email',
  'members.allowProfileUpdate': 'Cho phép cập nhật hồ sơ',
  'members.allowAvatarUpload': 'Cho phép tải ảnh đại diện',
  'members.allowAccountLockToggle': 'Cho phép khóa/mở tài khoản',
  'members.protectPrimaryAdmin': 'Bảo vệ Admin chính',
  'members.allowBulkActions': 'Cho phép thao tác hàng loạt',
  'billing.allowPlanPurchase': 'Cho phép mua gói tập',
  'billing.allowAssignPlanToMember': 'Gán gói tập cho HV',
  'billing.allowPlanRenewal': 'Cho phép gia hạn gói tập',
  'billing.renewalThresholdDays': 'Ngày cảnh báo gia hạn',
  'billing.discountCodesEnabled': 'Mã giảm giá',
  'billing.qrPaymentEnabled': 'Thanh toán QR',
  'billing.planMemberCountEnabled': 'Số lượng HV tối đa/gói',
  'checkin.qrCheckinEnabled': 'Check-in bằng QR',
  'checkin.qrTokenTtlSeconds': 'Thời hạn token QR (giây)',
  'checkin.preventDuplicateWithinHour': 'Chống check-in trùng trong 1h',
  'checkin.selfieRequired': 'Yêu cầu chụp ảnh check-in',
  'checkin.streakEnabled': 'Streak check-in',
  'checkin.successSoundEnabled': 'Âm thanh check-in thành công',
  'pt.moduleEnabled': 'Module PT',
  'pt.scheduleEnabled': 'Lịch PT',
  'pt.memberBookingEnabled': 'HV đặt lịch PT',
  'pt.weeklyRecurringBookingEnabled': 'Đặt lịch định kỳ',
  'pt.waitlistEnabled': 'Danh sách chờ',
  'pt.reviewAfterSessionEnabled': 'Đánh giá sau buổi tập',
  'workout.workoutPlanEnabled': 'Giáo án tập luyện',
  'workout.workoutTimerEnabled': 'Đồng hồ bấm giờ',
  'workout.healthLogEnabled': 'Nhật ký sức khỏe',
  'workout.bmiHistoryEnabled': 'Lịch sử BMI',
  'workout.progressPhotoUploadEnabled': 'Ảnh tiến trình',
  'workout.healthChartEnabled': 'Biểu đồ sức khỏe',
  'reports.revenueChartEnabled': 'Biểu đồ doanh thu',
  'reports.checkinHeatmapEnabled': 'Heatmap check-in',
  'reports.revenueForecastEnabled': 'Dự báo doanh thu',
  'reports.churnRiskEnabled': 'Rủi ro rời bỏ',
  'reports.excelExportEnabled': 'Xuất Excel',
  'reports.pdfExportEnabled': 'Xuất PDF',
  'reports.auditLogEnabled': 'Nhật ký hoạt động',
  'notifications.systemNotificationsEnabled': 'Thông báo hệ thống',
  'notifications.roleGroupNotificationsEnabled': 'Thông báo theo nhóm',
  'notifications.emailNotificationsEnabled': 'Thông báo Email',
  'notifications.readUnreadStatusEnabled': 'Trạng thái đã đọc/chưa đọc',
  'shop.productStoreEnabled': 'Cửa hàng sản phẩm',
  'shop.cartEnabled': 'Giỏ hàng',
  'shop.productReviewsEnabled': 'Đánh giá sản phẩm',
  'shop.productDetailPageEnabled': 'Trang chi tiết sản phẩm',
  'ai.systemAiEnabled': 'AI hệ thống',
  'ai.memberAiEnabled': 'AI cho hội viên',
  'ai.adminAiEnabled': 'AI cho Admin',
  'landing.statsSectionEnabled': 'Phần thống kê',
  'landing.servicesSectionEnabled': 'Phần dịch vụ',
  'landing.feedbackSectionEnabled': 'Phần phản hồi',
  'landing.partnersSectionEnabled': 'Phần đối tác',
  'landing.startNowButtonEnabled': 'Nút bắt đầu ngay',
  'landing.checkinNowButtonEnabled': 'Nút check-in ngay',
}

const settingDescriptions: Record<string, string> = {
  'general.siteName': 'Tên hiển thị của trang web',
  'general.slogans': 'Các slogan hiển thị trên trang chủ',
  'general.logoUrl': 'URL hình ảnh logo',
  'general.defaultLanguage': 'Ngôn ngữ mặc định khi truy cập',
  'general.defaultTheme': 'Giao diện hiển thị mặc định',
  'general.defaultAccentColor': 'Màu nhấn chính của giao diện',
  'general.maintenanceMode': 'Bật để đưa trang web vào chế độ bảo trì',
  'general.maintenanceMessage.vi': 'Thông báo bảo trì tiếng Việt',
  'general.maintenanceMessage.en': 'Thông báo bảo trì tiếng Anh',
  'auth.allowRegistration': 'Cho phép người dùng mới đăng ký tài khoản',
  'auth.allowPhoneLogin': 'Cho phép đăng nhập bằng số điện thoại',
  'auth.allowEmailUsernameLogin': 'Cho phép đăng nhập bằng email hoặc tên đăng nhập',
  'auth.googleOAuthEnabled': 'Bật đăng nhập qua Google',
  'auth.facebookOAuthEnabled': 'Bật đăng nhập qua Facebook',
  'auth.demoOtpEnabled': 'Sử dụng OTP mặc định trong môi trường demo',
  'auth.otpExpiresInSeconds': 'Thời gian hiệu lực của mã OTP',
  'auth.forgotPasswordSmsOtpEnabled': 'Cho phép gửi OTP qua SMS để đặt lại mật khẩu',
  'auth.forgotPasswordEmailEnabled': 'Cho phép gửi email đặt lại mật khẩu',
  'members.allowProfileUpdate': 'Cho phép hội viên tự cập nhật hồ sơ',
  'members.allowAvatarUpload': 'Cho phép tải lên ảnh đại diện',
  'members.allowAccountLockToggle': 'Cho phép admin khóa/mở khóa tài khoản',
  'members.protectPrimaryAdmin': 'Ngăn không cho sửa/xóa tài khoản admin chính',
  'members.allowBulkActions': 'Cho phép thao tác hàng loạt trên danh sách hội viên',
  'billing.allowPlanPurchase': 'Cho phép hội viên mua gói tập',
  'billing.allowAssignPlanToMember': 'Cho phép admin gán gói tập cho hội viên',
  'billing.allowPlanRenewal': 'Cho phép gia hạn gói tập tự động',
  'billing.renewalThresholdDays': 'Số ngày trước khi hết hạn để cảnh báo gia hạn',
  'billing.discountCodesEnabled': 'Bật tính năng mã giảm giá',
  'billing.qrPaymentEnabled': 'Bật tính năng thanh toán qua mã QR',
  'billing.planMemberCountEnabled': 'Giới hạn số lượng hội viên tối đa cho mỗi gói',
  'checkin.qrCheckinEnabled': 'Cho phép check-in bằng mã QR',
  'checkin.qrTokenTtlSeconds': 'Thời gian hiệu lực của mã QR check-in',
  'checkin.preventDuplicateWithinHour': 'Ngăn check-in trùng trong vòng 1 giờ',
  'checkin.selfieRequired': 'Yêu cầu chụp ảnh khi check-in',
  'checkin.streakEnabled': 'Theo dõi số ngày check-in liên tiếp',
  'checkin.successSoundEnabled': 'Phát âm thanh khi check-in thành công',
  'pt.moduleEnabled': 'Bật module Huấn luyện viên cá nhân',
  'pt.scheduleEnabled': 'Bật lịch làm việc của PT',
  'pt.memberBookingEnabled': 'Cho phép hội viên đặt lịch với PT',
  'pt.weeklyRecurringBookingEnabled': 'Cho phép đặt lịch định kỳ hàng tuần',
  'pt.waitlistEnabled': 'Bật danh sách chờ cho lịch PT',
  'pt.reviewAfterSessionEnabled': 'Cho phép đánh giá sau buổi tập',
  'workout.workoutPlanEnabled': 'Bật tính năng giáo án tập luyện',
  'workout.workoutTimerEnabled': 'Bật đồng hồ bấm giờ tập luyện',
  'workout.healthLogEnabled': 'Bật nhật ký sức khỏe',
  'workout.bmiHistoryEnabled': 'Theo dõi lịch sử chỉ số BMI',
  'workout.progressPhotoUploadEnabled': 'Cho phép tải ảnh tiến trình',
  'workout.healthChartEnabled': 'Hiển thị biểu đồ sức khỏe',
  'reports.revenueChartEnabled': 'Hiển thị biểu đồ doanh thu',
  'reports.checkinHeatmapEnabled': 'Hiển thị heatmap check-in',
  'reports.revenueForecastEnabled': 'Bật dự báo doanh thu',
  'reports.churnRiskEnabled': 'Phân tích rủi ro rời bỏ',
  'reports.excelExportEnabled': 'Cho phép xuất báo cáo Excel',
  'reports.pdfExportEnabled': 'Cho phép xuất báo cáo PDF',
  'reports.auditLogEnabled': 'Ghi nhật ký hoạt động hệ thống',
  'notifications.systemNotificationsEnabled': 'Bật thông báo hệ thống',
  'notifications.roleGroupNotificationsEnabled': 'Gửi thông báo theo nhóm quyền',
  'notifications.emailNotificationsEnabled': 'Gửi thông báo qua email',
  'notifications.readUnreadStatusEnabled': 'Theo dõi trạng thái đã đọc',
  'shop.productStoreEnabled': 'Bật cửa hàng sản phẩm',
  'shop.cartEnabled': 'Bật giỏ hàng',
  'shop.productReviewsEnabled': 'Cho phép đánh giá sản phẩm',
  'shop.productDetailPageEnabled': 'Bật trang chi tiết sản phẩm',
  'ai.systemAiEnabled': 'Bật AI hệ thống',
  'ai.memberAiEnabled': 'Bật AI hỗ trợ hội viên',
  'ai.adminAiEnabled': 'Bật AI hỗ trợ quản trị',
  'landing.statsSectionEnabled': 'Hiển thị phần thống kê trên trang chủ',
  'landing.servicesSectionEnabled': 'Hiển thị phần dịch vụ trên trang chủ',
  'landing.feedbackSectionEnabled': 'Hiển thị phần phản hồi trên trang chủ',
  'landing.partnersSectionEnabled': 'Hiển thị phần đối tác trên trang chủ',
  'landing.startNowButtonEnabled': 'Hiển thị nút bắt đầu ngay',
  'landing.checkinNowButtonEnabled': 'Hiển thị nút check-in ngay',
}

const groupLabels: Record<string, string> = {
  general: 'Chung',
  auth: 'Xác thực',
  members: 'Hội viên',
  billing: 'Thanh toán',
  checkin: 'Check-in',
  pt: 'Huấn luyện viên',
  workout: 'Tập luyện',
  reports: 'Báo cáo',
  notifications: 'Thông báo',
  shop: 'Cửa hàng',
  ai: 'AI',
  landing: 'Trang chủ',
}

export default function SystemSettingsPage() {
  const { settings, loading, refresh } = useSystemSettings()
  const [draft, setDraft] = useState<any>(SYSTEM_SETTINGS_DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')

  useEffect(() => {
    setDraft(clone(settings))
  }, [settings])

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase()
    return SETTING_GROUPS
      .filter((group) => groupFilter === 'all' || group.key === groupFilter)
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!query) return true
          const label = (settingLabels[item.path] || item.path).toLowerCase()
          const description = (settingDescriptions[item.path] || '').toLowerCase()
          return label.includes(query) || description.includes(query) || item.path.toLowerCase().includes(query)
        }),
      }))
      .filter((group) => group.items.length > 0)
  }, [groupFilter, search, t])

  const save = async () => {
    const slogans = Array.isArray(draft?.general?.slogans) ? draft.general.slogans : []
    if (slogans.length < 1) {
      message.error('Cần ít nhất một slogan')
      return
    }
    const invalidIndex = slogans.findIndex((slogan: any) => !String(slogan?.vi || '').trim() || !String(slogan?.en || '').trim())
    if (invalidIndex >= 0) {
      message.error('Slogan thứ ' + (invalidIndex + 1) + ' cần có cả tiếng Việt và tiếng Anh')
      return
    }

    setSaving(true)
    try {
      const response = await systemSettingsService.update(draft)
      setDraft(response.data.settings)
      await refresh()
      message.success('Đã lưu cài đặt')
    } catch (error: any) {
      console.error('[system-settings] save failed response:', error.response?.status, error.response?.data || error.message)
      message.error(error.response?.data?.message || 'Lưu cài đặt thất bại')
    } finally {
      setSaving(false)
    }
  }

  const resetDefault = async () => {
    setResetting(true)
    try {
      const response = await systemSettingsService.resetDefault()
      setDraft(response.data.settings)
      await refresh()
      message.success('Đã khôi phục cài đặt gốc')
    } catch (error: any) {
      console.error('[system-settings] reset failed response:', error.response?.status, error.response?.data || error.message)
      message.error(error.response?.data?.message || 'Khôi phục thất bại')
    } finally {
      setResetting(false)
    }
  }

  const renderControl = (item: SettingItem) => {
    const value = getByPath(draft, item.path)
    if (item.type === 'slogans') {
      const slogans = Array.isArray(value) ? value : []
      const updateSlogans = (nextSlogans: any[]) => {
        setDraft(setByPath(draft, item.path, nextSlogans.map((slogan) => ({
          vi: slogan.vi || '',
          en: slogan.en || '',
        }))))
      }
      return (
        <div className="flex w-full flex-col gap-3">
          {slogans.map((slogan: any, index: number) => (
            <div key={`slogan-${index}`} className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                <Input
                  value={slogan.vi || ''}
                  placeholder="Slogan tiếng Việt"
                  onChange={(event) => {
                    const next = clone(slogans)
                    next[index].vi = event.target.value
                    updateSlogans(next)
                  }}
                />
                <Input
                  value={slogan.en || ''}
                  placeholder="Slogan tiếng Anh"
                  onChange={(event) => {
                    const next = clone(slogans)
                    next[index].en = event.target.value
                    updateSlogans(next)
                  }}
                />
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => updateSlogans(slogans.filter((_: any, itemIndex: number) => itemIndex !== index))}
                >
                  Xóa
                </Button>
              </div>
            </div>
          ))}
          <Button
            icon={<PlusOutlined />}
            onClick={() => updateSlogans([...slogans, { vi: '', en: '' }])}
          >
            Thêm slogan
          </Button>
        </div>
      )
    }
    if (item.type === 'switch') {
      return <Switch checked={Boolean(value)} onChange={(checked) => setDraft(setByPath(draft, item.path, checked))} />
    }
    if (item.type === 'select') {
      return (
        <Select
          value={value}
          style={{ minWidth: 160 }}
          options={(item.options || [])}
          onChange={(nextValue) => setDraft(setByPath(draft, item.path, nextValue))}
        />
      )
    }
    if (item.type === 'number') {
      return (
        <InputNumber
          value={Number(value)}
          min={item.min}
          max={item.max}
          onChange={(nextValue) => setDraft(setByPath(draft, item.path, Number(nextValue) || item.min || 0))}
        />
      )
    }
    if (item.type === 'color') {
      return (
        <ColorPickerControl
          value={value}
          onChange={(color) => setDraft(setByPath(draft, item.path, color))}
        />
      )
    }
    return <Input value={value || ''} onChange={(event) => setDraft(setByPath(draft, item.path, event.target.value))} />
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6">
        <div className="sticky top-0 z-20 -mx-4 border-b border-[var(--theme-border)] bg-[var(--theme-bg)]/95 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="m-0 text-2xl font-bold text-[var(--theme-text)]">Cài đặt hệ thống</h1>
              <p className="m-0 mt-1 text-sm text-[var(--theme-muted)]">Quản lý các cấu hình và tùy chỉnh hệ thống</p>
            </div>
            <Space wrap>
              <Button icon={<ReloadOutlined />} loading={resetting} onClick={resetDefault}>
                Khôi phục mặc định
              </Button>
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
                Lưu thay đổi
              </Button>
            </Space>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_260px]">
            <Input
              prefix={<SearchOutlined />}
              value={search}
              placeholder="Tìm kiếm cài đặt..."
              onChange={(event) => setSearch(event.target.value)}
              allowClear
            />
            <Select
              value={groupFilter}
              onChange={setGroupFilter}
              options={[
                { value: 'all', label: 'Tất cả nhóm' },
                ...SETTING_GROUPS.map((group) => ({ value: group.key, label: groupLabels[group.key] || group.key })),
              ]}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center"><Spin /></div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {groups.map((group) => (
              <Card
                key={group.key}
                title={<span className="text-[var(--theme-text)]">{groupLabels[group.key] || group.key}</span>}
                className="border border-[var(--theme-border)] bg-[var(--theme-card)]"
              >
                <div className="flex flex-col divide-y divide-[var(--theme-border)]">
                  {group.items.map((item) => (
                    <div key={item.path} className={`grid gap-3 py-4 ${item.type === 'slogans' ? '' : 'sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'}`}>
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--theme-text)]">{settingLabels[item.path] || item.path}</div>
                        <Text className="text-sm text-[var(--theme-muted)]">{settingDescriptions[item.path] || ''}</Text>
                      </div>
                      <div className={item.type === 'slogans' ? 'min-w-0' : 'sm:justify-self-end'}>{renderControl(item)}</div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
