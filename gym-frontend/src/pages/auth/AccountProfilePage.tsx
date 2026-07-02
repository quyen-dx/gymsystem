import {
  ArrowLeftOutlined,
  BgColorsOutlined,
  CameraOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  HeartOutlined,
  InfoCircleOutlined,
  LockOutlined,
  LogoutOutlined,
  MenuOutlined,
  PhoneOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  StarFilled,
  StarOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Checkbox, Drawer, Empty, Form, Grid, Input, message, Modal, Select, Space, Tag, theme } from 'antd'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import DashboardLayout from '../../components/layout/header/DashboardLayout'
import MemberLayout from '../../components/layout/header/MemberLayout'
import { useSystemSettings } from '../../context/SystemSettingsContext'
import { generateTheme, PRESET_ACCENT_COLORS, resolveEffectiveTheme, useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../hooks/useAuth'
import { createAddress, deleteAddress, getAddresses, setDefaultAddress, updateAddress } from '../../services/addressService'
import { authService } from '../../services/authService'
import { getUserDisplayName, getUserInitialName } from '../../utils/userDisplay'

const profileFormClass =
  '[&_.ant-form-item-label>label]:!text-xs [&_.ant-form-item-label>label]:!font-medium [&_.ant-form-item-label>label]:!uppercase [&_.ant-form-item-label>label]:!tracking-[0.06em] [&_.ant-form-item-label>label]:!text-[var(--theme-muted)] [&_.ant-input]:!h-[42px] [&_.ant-input]:!rounded-[12px] [&_.ant-input]:!border-[var(--profile-border)] [&_.ant-input]:!bg-[var(--profile-bg-container)] [&_.ant-input]:!text-[var(--profile-text)] [&_.ant-input::placeholder]:!text-[var(--theme-placeholder)] [&_.ant-input-affix-wrapper]:!h-[42px] [&_.ant-input-affix-wrapper]:!flex [&_.ant-input-affix-wrapper]:!items-center [&_.ant-input-affix-wrapper]:!rounded-[12px] [&_.ant-input-affix-wrapper]:!border-[var(--profile-border)] [&_.ant-input-affix-wrapper]:!bg-[var(--profile-bg-container)] [&_.ant-input-affix-wrapper_.ant-input]:!border-none [&_.ant-input-affix-wrapper_.ant-input]:!rounded-none [&_.ant-input-affix-wrapper_.ant-input]:!h-auto [&_.ant-input-affix-wrapper_.ant-input]:!shadow-none [&_.ant-input-affix-wrapper_.ant-input]:!bg-transparent [&_.ant-input-affix-wrapper_.ant-input]:!text-[var(--profile-text)] [&_.ant-input-affix-wrapper_.ant-input::placeholder]:!text-[var(--theme-placeholder)] [&_.ant-input:focus]:!border-[var(--profile-accent)] [&_.ant-input:focus]:!shadow-none [&_.ant-input-focused]:!border-[var(--profile-accent)] [&_.ant-input-focused]:!shadow-none [&_.ant-input-affix-wrapper-focused]:!border-[var(--profile-accent)] [&_.ant-input-affix-wrapper-focused]:!shadow-none [&_.ant-input[disabled]]:!cursor-not-allowed [&_.ant-input[disabled]]:!bg-[var(--theme-elevated)] [&_.ant-input[disabled]]:!text-[var(--theme-muted)] [&_.ant-input-disabled]:!cursor-not-allowed [&_.ant-input-disabled]:!bg-[var(--theme-elevated)] [&_.ant-input-disabled]:!text-[var(--theme-muted)] [&_.ant-select-single]:!h-[42px] [&_.ant-select-single_.ant-select-selector]:!h-[42px] [&_.ant-select-single_.ant-select-selector]:!min-h-[42px] [&_.ant-select-single_.ant-select-selector]:!flex [&_.ant-select-single_.ant-select-selector]:!items-center [&_.ant-select-single_.ant-select-selector]:!rounded-[12px] [&_.ant-select-single_.ant-select-selector]:!border-[var(--profile-border)] [&_.ant-select-single_.ant-select-selector]:!bg-[var(--profile-bg-container)] [&_.ant-select-selection-item]:!leading-[42px] [&_.ant-select-selection-item]:!flex [&_.ant-select-selection-item]:!items-center [&_.ant-select-selection-placeholder]:!leading-[42px] [&_.ant-select-selection-placeholder]:!flex [&_.ant-select-selection-placeholder]:!items-center [&_.ant-picker]:!h-[42px] [&_.ant-picker]:!flex [&_.ant-picker]:!items-center [&_.ant-picker]:!rounded-[12px] [&_.ant-picker]:!border-[var(--profile-border)] [&_.ant-picker]:!bg-[var(--profile-bg-container)] [&_.ant-btn-link]:!text-[var(--theme-text)] [&_.ant-btn-link:hover]:!text-[var(--theme-accent)]'

const primaryButtonClass =
  '!h-11 !rounded-full !border-0 !bg-[var(--theme-button-bg)] !font-extrabold !text-[var(--theme-button-text)] !shadow-none hover:!bg-[var(--theme-accent-hover)]'

const addressActionButtonClass =
  'grid h-7 w-7 cursor-pointer place-items-center rounded-[7px] border border-[var(--profile-border)] bg-transparent text-[var(--profile-text-secondary)] transition-colors hover:bg-[var(--profile-bg-container)] hover:text-[var(--profile-text)] max-[480px]:h-[26px] max-[480px]:w-[26px]'

const addressEditModalClass =
  '[&_.ant-modal-content]:!rounded-3xl [&_.ant-modal-content]:!border [&_.ant-modal-content]:!border-[var(--profile-border)] [&_.ant-modal-content]:!bg-[var(--profile-bg-elevated)] [&_.ant-modal-header]:!bg-transparent [&_.ant-modal-title]:!text-[var(--profile-text)] [&_.ant-modal-close]:!text-[var(--profile-text-secondary)]'

const profileInputStyle = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  background: 'var(--theme-input-bg)',
  borderColor: 'var(--theme-border-strong)',
  color: 'var(--theme-text)',
} as CSSProperties

const profileDisabledInputStyle = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  background: 'var(--theme-elevated)',
  borderColor: 'var(--theme-border-strong)',
  color: 'var(--theme-muted)',
  opacity: 0.8,
} as CSSProperties

const profilePasswordInputStyle = {
  ...profileInputStyle,
  minHeight: 46,
} as CSSProperties

const sectionCardStyle = {
  background: 'var(--theme-elevated)',
  border: '1px solid var(--theme-border)',
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
} as CSSProperties

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 16,
  paddingBottom: 12,
  borderBottom: '1px solid var(--theme-border)',
} as CSSProperties

const sectionIconStyle = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: 'var(--theme-accent-muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--theme-accent)',
  fontSize: 16,
  flexShrink: 0,
} as CSSProperties

type ProfileTabKey = 'account' | 'personal' | 'contact' | 'health' | 'verification' | 'gym' | 'address' | 'password' | 'appearance'
type PersonalSubTab = 'basic' | 'contact' | 'emergency' | 'verification'

type ProfileTabItem = {
  key: ProfileTabKey
  label: string
  icon: ReactNode
}

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80'

const ProfileHeader = ({
  user,
  avatarPreview,
  fileRef,
  coverPreview,
  coverRef,
  contactText,
  onCopyContact,
  onAvatarChange,
  onCoverChange,
  onCoverRemove,
  mediaUploading,
}: {
  user: any
  avatarPreview: string | null
  fileRef: React.RefObject<HTMLInputElement | null>
  coverPreview: string | null
  coverRef: React.RefObject<HTMLInputElement | null>
  contactText: string
  onCopyContact: () => void
  onAvatarChange: (file: File) => void
  onCoverChange: (file: File) => void
  onCoverRemove: () => void
  mediaUploading: 'avatar' | 'cover' | 'cover-remove' | null
}) => {
  const displayName = getUserDisplayName(user, 'Người dùng')
  const avatarName = getUserInitialName(user, 'U')
  const coverSrc = coverPreview !== null && coverPreview !== ''
    ? coverPreview
    : coverPreview === ''
      ? null
      : user?.coverImage || DEFAULT_COVER

  return (
    <header className="profile-header">
      <div className="profile-cover-bg" style={{ backgroundImage: coverSrc ? `url(${coverSrc})` : undefined }}>
        {!coverSrc && <div className="profile-cover-placeholder" />}
      </div>
      <div className="profile-cover-overlay" />

      <div className="profile-cover-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" disabled={mediaUploading === 'cover'}
          onClick={() => coverRef.current?.click()}
          className="profile-cover-btn"
          title={mediaUploading === 'cover' ? undefined : 'Thay đổi ảnh bìa'}
        >
          <CameraOutlined />
          <span className="profile-cover-btn-label">{mediaUploading === 'cover' ? 'Đang tải...' : 'Thay đổi ảnh bìa'}</span>
        </button>
        {(coverPreview || user?.coverImage) && coverPreview !== '' && (
          <button type="button" disabled={mediaUploading === 'cover-remove'}
            onClick={() => onCoverRemove()}
            className="profile-cover-btn profile-cover-btn-remove"
            title={mediaUploading === 'cover-remove' ? undefined : 'Xóa'}
          >
            <DeleteOutlined />
            <span className="profile-cover-btn-label">{mediaUploading === 'cover-remove' ? 'Đang tải...' : 'Xóa'}</span>
          </button>
        )}
        <input ref={coverRef} type="file" hidden accept="image/*"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) onCoverChange(file) }} />
      </div>

      <div className="profile-header-content">
        <div className="profile-avatar-wrap" onClick={() => mediaUploading !== 'avatar' && fileRef.current?.click()}>
          <Avatar
            src={avatarPreview || user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}`}
            icon={<UserOutlined />}
            className="profile-avatar-img"
          />
          <div className="profile-avatar-edit" onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}>
            {mediaUploading === 'avatar' ? (
              <span style={{ fontSize: 10, lineHeight: 1.2, textAlign: 'center' }}>{'Đang tải...'}</span>
            ) : (
              <CameraOutlined />
            )}
          </div>
        </div>
        <div className="profile-header-text">
          <h2 className="profile-header-name">{displayName}</h2>
          {user.memberCode && <div className="profile-header-id">ID: {user.memberCode}</div>}
          <button type="button" className="profile-header-contact" onClick={onCopyContact}>
            <span>{contactText}</span>
            {(user.email || user.phone) && <CopyOutlined style={{ fontSize: 13 }} />}
          </button>
        </div>
      </div>
      <input ref={fileRef} type="file" hidden accept="image/*"
        onChange={(event) => { const file = event.target.files?.[0]; if (file) onAvatarChange(file) }} />
    </header>
  )
}

const SidebarTabs = ({
  tabs,
  activeTab,
  onChange,
  onLogout,
}: {
  tabs: ProfileTabItem[]
  activeTab: ProfileTabKey
  onChange: (tab: ProfileTabKey) => void
  onLogout: () => void
}) => (
  <aside className="profile-desktop-tabs" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
    <div style={{ padding: '0 4px 12px', fontSize: 20, fontWeight: 700, color: 'var(--theme-text)' }}>
      {'Cài đặt'}
    </div>
    <div style={{ flex: 1, minHeight: 0 }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key
        return (
          <button
            key={tab.key}
            type="button"
            className={`profile-side-tab${isActive ? ' active' : ''}`}
            onClick={() => onChange(tab.key)}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        )
      })}
    </div>
    <div style={{ borderTop: '1px solid var(--theme-border)', paddingTop: 8, marginTop: 4 }}>
      <button
        type="button"
        className="profile-side-tab"
        onClick={onLogout}
        style={{ color: '#ef4444' }}
      >
        <span style={{ color: '#ef4444' }}><LogoutOutlined /></span>
        {'Đăng xuất'}
      </button>
    </div>
  </aside>
)

const MobileMenuDrawer = ({
  tabs,
  activeTab,
  onChange,
  onLogout,
  open,
  onClose,
}: {
  tabs: ProfileTabItem[]
  activeTab: ProfileTabKey
  onChange: (tab: ProfileTabKey) => void
  onLogout: () => void
  open: boolean
  onClose: () => void
}) => (
  <Drawer
    title={<span style={{ fontSize: 16, fontWeight: 700 }}>{'Cài đặt'}</span>}
    placement="left"
    open={open}
    onClose={onClose}
    size={280}
    styles={{ body: { padding: '8px 0' } }}
  >
    {tabs.map((tab) => {
      const isActive = activeTab === tab.key
      return (
        <button
          key={tab.key}
          type="button"
          className={`profile-side-tab${isActive ? ' active' : ''}`}
          style={{ width: '100%', textAlign: 'left', borderRadius: 0, padding: '12px 20px' }}
          onClick={() => { onChange(tab.key); onClose() }}
        >
          <span>{tab.icon}</span>
          {tab.label}
        </button>
      )
    })}
    <div style={{ borderTop: '1px solid var(--theme-border)', marginTop: 8, paddingTop: 8 }}>
      <button
        type="button"
        className="profile-side-tab"
        onClick={() => { onLogout(); onClose() }}
        style={{ width: '100%', textAlign: 'left', borderRadius: 0, padding: '12px 20px', color: '#ef4444' }}
      >
        <span style={{ color: '#ef4444' }}><LogoutOutlined /></span>
        {'Đăng xuất'}
      </button>
    </div>
  </Drawer>
)

const TabContent = ({
  activeTab,
  children,
}: {
  activeTab: ProfileTabKey
  children: ReactNode
}) => (
  <div className="profile-tab-content" key={activeTab} data-active-tab={activeTab}>
    {children}
  </div>
)

function ProfileContent() {
  const { user, updateUser, refreshUser, logout } = useAuth()
  const { applyAccentFast, applyThemeFull, applyThemeMode, commitPending, accentColor: savedAccentColor } = useTheme()
  const { settings: systemSettings } = useSystemSettings()
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [addressForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverRemoved, setCoverRemoved] = useState(false)
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('account')
  const [personalSubTab, setPersonalSubTab] = useState<PersonalSubTab>('basic')
  const [addresses, setAddresses] = useState<any[]>([])
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [editAddress, setEditAddress] = useState<any>(null)
  const [accentColor, setAccentColor] = useState(savedAccentColor)
  const [mediaUploading, setMediaUploading] = useState<'avatar' | 'cover' | 'cover-remove' | null>(null)
  const [identityFrontFile, setIdentityFrontFile] = useState<File | null>(null)
  const [identityBackFile, setIdentityBackFile] = useState<File | null>(null)
  const [identityFrontPreview, setIdentityFrontPreview] = useState<string | null>(null)
  const [identityBackPreview, setIdentityBackPreview] = useState<string | null>(null)
  const [dismissBanner, setDismissBanner] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [changeEmailModalOpen, setChangeEmailModalOpen] = useState(false)
  const [emailChangeStep, setEmailChangeStep] = useState<'email' | 'otp'>('email')
  const [newEmail, setNewEmail] = useState('')
  const [otpValue, setOtpValue] = useState('')
  const [emailChangeLoading, setEmailChangeLoading] = useState(false)
  const [forgotPasswordModalOpen, setForgotPasswordModalOpen] = useState(false)
  const [forgotPasswordMethod, setForgotPasswordMethod] = useState<'email' | 'phone' | null>(null)
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'method' | 'reset'>('method')
  const [forgotPasswordOtp, setForgotPasswordOtp] = useState('')
  const [forgotPasswordNewPassword, setForgotPasswordNewPassword] = useState('')
  const [forgotPasswordConfirmPassword, setForgotPasswordConfirmPassword] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpSendingMethod, setOtpSendingMethod] = useState<'email' | 'phone' | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileSubTabPicker, setMobileSubTabPicker] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)
  const preventCloseRef = useRef(false)
  const previewTheme = generateTheme(
    accentColor,
    resolveEffectiveTheme(systemSettings.general.defaultTheme === 'light' ? 'light' : 'dark', user?.themePreference),
  )

  const hasPassword = Boolean(user?.hasPassword || user?.password)
  const contactText = user?.email || user?.phone || 'Chưa có email'

  useEffect(() => {
    if (user?.accentColor) {
      setAccentColor(user.accentColor)
    }
  }, [user?.accentColor])

  const handlePresetSelect = (hex: string) => {
    void saveAccentColor(hex)
  }

  const handleAccentPreview = (hex: string) => {
    setAccentColor(hex)
    applyAccentFast(hex)
  }

  const handleAccentCommit = (hex = accentColor) => {
    void saveAccentColor(hex)
  }

  const handleThemePreferenceChange = async (preference: 'system' | 'light' | 'dark') => {
    if (!user || loading) return
    preventCloseRef.current = true
    const previousPreference = user.themePreference || 'system'
    const systemTheme = systemSettings.general.defaultTheme === 'light' ? 'light' : 'dark'
    const payload = { themePreference: preference }
    applyThemeMode(resolveEffectiveTheme(systemTheme, preference))
    updateUser({ ...user, themePreference: preference })

    setLoading(true)
    try {
      await authService.updateProfile(payload)
      const freshUser = await refreshUser()
      applyThemeMode(resolveEffectiveTheme(systemTheme, freshUser?.themePreference || preference))
      message.success('Cập nhật giao diện thành công')
    } catch (err: any) {
      applyThemeMode(resolveEffectiveTheme(systemTheme, previousPreference))
      updateUser({ ...user, themePreference: previousPreference })
      message.error(err.response?.data?.message || 'Cập nhật giao diện thất bại')
    } finally {
      setLoading(false)
      preventCloseRef.current = false
    }
  }

  const saveAccentColor = async (hex: string) => {
    if (!user || loading) return
    const previousAccent = user.accentColor || savedAccentColor
    const systemDefault = systemSettings.general.defaultAccentColor || '#DB2777'
    const nextAccent = hex ? hex.toUpperCase() : ''
    const displayColor = nextAccent || systemDefault
    const payload = { accentColor: nextAccent }
    preventCloseRef.current = true
    setAccentColor(displayColor)
    applyThemeFull(displayColor)
    updateUser({ ...user, accentColor: nextAccent })

    setLoading(true)
    try {
      await authService.updateProfile(payload)
      const freshUser = await refreshUser()
      const persistedAccent = freshUser?.accentColor || systemDefault
      setAccentColor(persistedAccent)
      applyThemeFull(persistedAccent)
      message.success('Cập nhật giao diện thành công')
    } catch (err: any) {
      setAccentColor(previousAccent)
      applyThemeFull(previousAccent)
      updateUser({ ...user, accentColor: previousAccent })
      message.error(err.response?.data?.message || 'Cập nhật giao diện thất bại')
    } finally {
      setLoading(false)
      preventCloseRef.current = false
    }
  }

  const handleLogout = () => {
    logout()
  }

  const handleAvatarFileChange = async (file: File) => {
    if (!user || mediaUploading) return
    const previousPreview = avatarPreview
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
    setMediaUploading('avatar')

    const formData = new FormData()
    formData.append('avatar', file)

    try {
      await authService.updateProfile(formData)
      await refreshUser()
      setAvatarPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      message.success('Cập nhật ảnh đại diện thành công')
    } catch (err: any) {
      setAvatarPreview(previousPreview)
      message.error(err.response?.data?.message || 'Cập nhật ảnh đại diện thất bại')
    } finally {
      URL.revokeObjectURL(previewUrl)
      setMediaUploading(null)
    }
  }

  const handleCoverFileChange = async (file: File) => {
    if (!user || mediaUploading) return
    const previousPreview = coverPreview
    const previousRemoved = coverRemoved
    const previewUrl = URL.createObjectURL(file)
    setCoverPreview(previewUrl)
    setCoverRemoved(false)
    setMediaUploading('cover')

    const formData = new FormData()
    formData.append('coverImage', file)

    try {
      await authService.updateProfile(formData)
      await refreshUser()
      setCoverPreview(null)
      setCoverRemoved(false)
      if (coverRef.current) coverRef.current.value = ''
      message.success('Cập nhật ảnh bìa thành công')
    } catch (err: any) {
      setCoverPreview(previousPreview)
      setCoverRemoved(previousRemoved)
      message.error(err.response?.data?.message || 'Cập nhật ảnh bìa thất bại')
    } finally {
      URL.revokeObjectURL(previewUrl)
      setMediaUploading(null)
    }
  }

  const handleCoverRemove = async () => {
    if (!user || mediaUploading) return
    const previousPreview = coverPreview
    const previousRemoved = coverRemoved
    setCoverPreview('')
    setCoverRemoved(true)
    setMediaUploading('cover-remove')

    const formData = new FormData()
    formData.append('removeCoverImage', 'true')

    try {
      await authService.updateProfile(formData)
      await refreshUser()
      setCoverPreview(null)
      setCoverRemoved(false)
      if (coverRef.current) coverRef.current.value = ''
      message.success('Cập nhật ảnh bìa thành công')
    } catch (err: any) {
      setCoverPreview(previousPreview)
      setCoverRemoved(previousRemoved)
      message.error(err.response?.data?.message || 'Cập nhật ảnh bìa thất bại')
    } finally {
      setMediaUploading(null)
    }
  }

  useEffect(() => {
    if (!user) return
    const profileFullName = user.fullName || user.name || ''
    form.setFieldsValue({
      name: user.name || profileFullName,
      email: user.email || '',
      phone: user.phone || '',
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : '',
      fullName: profileFullName,
      gender: user.gender || '',
      nationality: user.nationality || '',
      language: user.language || 'vi',
      timezone: user.timezone || '',
      country: user.country || '',
      province: user.province || '',
      detailedAddress: user.detailedAddress || '',
      emergencyName: user.emergencyContact?.name || '',
      emergencyPhone: user.emergencyContact?.phone || '',
      emergencyRelationship: user.emergencyContact?.relationship || '',
      emergencyContactCountry: user.emergencyContact?.country || '',
      height: user.healthInfo?.height || '',
      weight: user.healthInfo?.weight || '',
      goals: user.healthInfo?.goals || [],
      activityLevel: user.healthInfo?.activityLevel || '',
      healthNotes: user.healthInfo?.notes || '',
      identityType: user.identityType || user.identityVerification?.documentType || '',
      identityNumber: user.identityNumber || user.identityVerification?.documentNumber || '',
      identityCountry: user.identityCountry || '',
    })
    setAvatarPreview(null)
    setCoverPreview(null)
    setCoverRemoved(false)
    setActiveTab('account')
    passwordForm.resetFields()
    addressForm.resetFields()
    setEditAddress(null)
    setAddresses([])
  }, [form, passwordForm, addressForm])

  useEffect(() => {
    setAccentColor(savedAccentColor)
  }, [savedAccentColor])

  const profileThemeStyle = {
    '--profile-bg-layout': 'var(--gs-bg)',
    '--profile-bg-container': 'var(--gs-input-bg)',
    '--profile-bg-elevated': 'var(--gs-card)',
    '--profile-text': 'var(--gs-text)',
    '--profile-text-secondary': 'var(--gs-muted)',
    '--profile-border': 'var(--gs-border)',
    '--profile-mask': token.colorBgMask,
    '--profile-accent': 'var(--theme-accent)',
    '--profile-accent-hover': 'var(--theme-accent-hover)',
    '--profile-accent-bg': 'var(--theme-accent-muted)',
    '--profile-accent-border': 'var(--theme-accent-border)',
    '--profile-success': token.colorSuccess,
  } as CSSProperties

  const calcProfileCompletion = (u: typeof user) => {
    if (!u) return 0
    let score = 0
    if (u.fullName || u.name) score += 10
    if (u.phone) score += 10
    if (u.dateOfBirth) score += 10
    if (u.gender) score += 5
    if (u.nationality) score += 10
    if (u.detailedAddress) score += 15
    if (u.emergencyContact?.name && u.emergencyContact?.phone) score += 15
    if (u.identityType && u.identityNumber) score += 25
    return score
  }

  const handleSave = async (values: any) => {
    setLoading(true)
    try {
      const payload: Record<string, any> = {}
      const submittedFullName = values.fullName || values.name || ''
      payload.name = values.name || submittedFullName
      if (values.email) payload.email = values.email
      if (values.phone) payload.phone = values.phone
      if (values.dateOfBirth) payload.dateOfBirth = values.dateOfBirth
      payload.fullName = submittedFullName
      if (values.gender) payload.gender = values.gender
      if (values.nationality) payload.nationality = values.nationality
      if (values.language) payload.language = values.language
      if (values.timezone) payload.timezone = values.timezone
      if (values.country) payload.country = values.country
      if (values.province) payload.province = values.province
      if (values.detailedAddress) payload.detailedAddress = values.detailedAddress
      payload.emergencyName = values.emergencyName || ''
      payload.emergencyPhone = values.emergencyPhone || ''
      payload.emergencyRelationship = values.emergencyRelationship || ''
      payload.emergencyContactCountry = values.emergencyContactCountry || ''
      payload.height = values.height || ''
      payload.weight = values.weight || ''
      payload.goals = values.goals || []
      payload.activityLevel = values.activityLevel || ''
      payload.healthNotes = values.healthNotes || ''
      payload.documentType = values.documentType || ''
      payload.documentNumber = values.documentNumber || ''
      payload.identityType = values.identityType || ''
      payload.identityNumber = values.identityNumber || ''
      payload.identityCountry = values.identityCountry || ''

      // Use FormData if identity images are being uploaded
      const hasIdentityFiles = identityFrontFile || identityBackFile
      if (hasIdentityFiles) {
        const fd = new FormData()
        Object.entries(payload).forEach(([k, v]) => {
          if (Array.isArray(v)) fd.append(k, JSON.stringify(v))
          else fd.append(k, String(v ?? ''))
        })
        if (identityFrontFile) fd.append('identityFrontImage', identityFrontFile)
        if (identityBackFile) fd.append('identityBackImage', identityBackFile)
        await authService.updateProfile(fd)
      } else {
        await authService.updateProfile(payload)
      }
      await refreshUser()
      setIdentityFrontFile(null)
      setIdentityBackFile(null)
      setFormDirty(false)
      message.success('Lưu thông tin thành công')
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Cập nhật thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleSetPassword = async (values: any) => {
    if (values.newPassword !== values.confirm) {
      message.error('Mật khẩu xác nhận không khớp')
      return
    }
    setLoading(true)
    try {
      await authService.setPassword({ newPassword: values.newPassword })
      message.success('Đặt mật khẩu thành công')
      updateUser({ ...user!, hasPassword: true, password: 'set' })
      passwordForm.resetFields()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Đặt mật khẩu thất bại')
    } finally {
      setLoading(false)
    }
  }

  const loadAddresses = async () => {
    if (!user) return
    try {
      const res = await getAddresses()
      setAddresses(res.data.data)
    } catch (err) {
      console.error(err)
    }
  }

  const openCreateAddress = () => {
    setEditAddress(null)
    addressForm.resetFields()
    setAddressModalOpen(true)
  }

  const openEditAddress = (address: any) => {
    setEditAddress(address)
    addressForm.setFieldsValue(address)
    setAddressModalOpen(true)
  }

  const handleSaveAddress = async (values: any) => {
    setLoading(true)
    try {
      if (editAddress) {
        await updateAddress(editAddress._id, values)
        message.success('Cập nhật địa chỉ thành công')
      } else {
        await createAddress({ ...values, isDefault: true })
        message.success('Thêm địa chỉ thành công')
      }
      setAddressModalOpen(false)
      await loadAddresses()
    } catch (err: any) {
      console.error(err)
      message.error(err.response?.data?.message || 'Lưu địa chỉ thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAddress = async (addressId: string) => {
    setLoading(true)
    try {
      await deleteAddress(addressId)
      message.success('Xóa địa chỉ thành công')
      await loadAddresses()
    } catch (err: any) {
      console.error(err)
      message.error(err.response?.data?.message || 'Xóa địa chỉ thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleSetDefault = async (addressId: string) => {
    setLoading(true)
    try {
      await setDefaultAddress(addressId)
      message.success('Đặt làm mặc định thành công')
      await loadAddresses()
    } catch (err: any) {
      console.error(err)
      message.error(err.response?.data?.message || 'Đặt mặc định thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (values: any) => {
    if (values.newPassword !== values.confirm) {
      message.error('Mật khẩu xác nhận không khớp')
      return
    }
    setLoading(true)
    try {
      await authService.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      message.success('Đổi mật khẩu thành công')
      passwordForm.resetFields()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Đổi mật khẩu thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPasswordSendOtp = async (method: 'email' | 'phone') => {
    if (otpSending) return
    setOtpSending(true)
    setOtpSendingMethod(method)
    try {
      await authService.requestPasswordResetOtp({ method })
      message.success('Mã OTP đã được gửi')
      setForgotPasswordMethod(method)
      setForgotPasswordStep('reset')
      setResendCooldown(60)
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Cập nhật thất bại')
    } finally {
      setOtpSending(false)
      setOtpSendingMethod(null)
    }
  }

  const handleForgotPasswordConfirm = async () => {
    if (forgotPasswordNewPassword.length < 6) {
      message.error('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }
    if (forgotPasswordNewPassword !== forgotPasswordConfirmPassword) {
      message.error('Mật khẩu xác nhận không khớp')
      return
    }
    if (!forgotPasswordOtp) {
      message.error('Mã OTP')
      return
    }
    setForgotPasswordLoading(true)
    try {
      await authService.resetPasswordWithOtp({
        method: forgotPasswordMethod || 'email',
        otp: forgotPasswordOtp,
        newPassword: forgotPasswordNewPassword,
      })
      message.success('Đặt lại mật khẩu thành công')
      setForgotPasswordModalOpen(false)
      passwordForm.resetFields()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Cập nhật thất bại')
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setInterval(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearInterval(id)
  }, [resendCooldown])

  useEffect(() => {
    if (activeTab === 'address') {
      loadAddresses()
    }
  }, [activeTab])

  useEffect(() => {
    return () => {
      commitPending()
    }
  }, [])

  if (!user) return null

  const handleCopyContact = async () => {
    if (!user?.email && !user?.phone) return
    await navigator.clipboard?.writeText(user.email || user.phone || '')
    message.success('Đã sao chép thông tin liên hệ')
  }

  const isProfileMobile = !screens.md
  const responsiveSectionCardStyle = {
    ...sectionCardStyle,
    marginBottom: isProfileMobile ? 16 : 20,
    padding: isProfileMobile ? 16 : 28,
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    borderRadius: 16,
    overflowX: 'hidden',
  } as CSSProperties

  const handleRequestEmailChange = async () => {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      message.error('Email không hợp lệ')
      return
    }
    if (newEmail === user?.email) {
      message.error('Email không hợp lệ')
      return
    }
    setEmailChangeLoading(true)
    try {
      await authService.requestEmailChange({ newEmail })
      message.success('Mã OTP đã được gửi đến email mới')
      setEmailChangeStep('otp')
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Cập nhật thất bại')
    } finally {
      setEmailChangeLoading(false)
    }
  }

  const handleConfirmEmailChange = async () => {
    if (!otpValue) {
      message.error('Mã OTP')
      return
    }
    setEmailChangeLoading(true)
    try {
      await authService.confirmEmailChange({ newEmail, otp: otpValue })
      message.success('Đổi email thành công')
      setChangeEmailModalOpen(false)
      if (user && updateUser) {
        updateUser({ ...user, email: newEmail })
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Cập nhật thất bại')
    } finally {
      setEmailChangeLoading(false)
    }
  }

  const tabs: ProfileTabItem[] = [
    { key: 'account', label: 'Tài khoản & Bảo mật', icon: <SafetyCertificateOutlined /> },
    { key: 'personal', label: 'Thông tin cá nhân', icon: <UserOutlined /> },
    { key: 'health', label: 'Sức khỏe', icon: <HeartOutlined /> },
    { key: 'gym', label: 'Hồ sơ Gym', icon: <TrophyOutlined /> },
    { key: 'appearance', label: 'Giao diện', icon: <BgColorsOutlined /> },
  ]

  const renderSectionHeader = (icon: ReactNode, title: string, subtitle: string) => (
    <div style={sectionHeaderStyle}>
      <div style={sectionIconStyle}>{icon}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--theme-text)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--theme-muted)' }}>{subtitle}</div>
      </div>
    </div>
  )

  return (
    <div style={{ ...profileThemeStyle, color: token.colorText, width: '100%', minHeight: '100vh', padding: '24px 32px 120px' }} className="profile-page-wrapper max-[768px]:!px-4 max-[768px]:!py-4">
      {formDirty && (
        <div style={{
          position: 'fixed',
          top: 'calc(var(--member-header-height, 64px) + 16px)',
          left: isProfileMobile ? 12 : '50%',
          right: isProfileMobile ? 12 : 'auto',
          transform: isProfileMobile ? 'none' : 'translateX(-50%)',
          zIndex: 1000,
          width: isProfileMobile ? 'auto' : 'calc(100% - 64px)',
          maxWidth: isProfileMobile ? 'none' : 860,
          background: 'var(--theme-elevated)',
          border: '1px solid var(--theme-border)',
          borderRadius: 12,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--theme-muted)', flex: 1, lineHeight: 1.4 }}>
            {'Bạn có thay đổi chưa lưu'}
          </span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Button
              style={{ background: 'transparent', borderColor: 'var(--theme-border)' }}
              onClick={() => { form.resetFields(); setFormDirty(false) }}
            >
              {'Hủy'}
            </Button>
            <Button
              type="primary"
              loading={loading}
              onClick={() => form.submit()}
            >
              {'Lưu thay đổi'}
            </Button>
          </div>
                  </div>
                  )}
      {formDirty && <div style={{ height: isProfileMobile ? 60 : 0 }} />}

      <div className="profile-settings-layout">
        <div className="profile-settings-sidebar">
          <div className="profile-settings-sidebar-inner">
            <SidebarTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} onLogout={handleLogout} />
          </div>
        </div>

        <div className="profile-settings-mobile-tabs">
          <MobileMenuDrawer
            tabs={tabs}
            activeTab={activeTab}
            onChange={(tab) => {
              setActiveTab(tab)
              if (tab === 'personal') setMobileSubTabPicker(true)
            }}
            onLogout={handleLogout}
            open={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
          />
        </div>

        <div
          className="profile-settings-content"
          style={{
            padding: isProfileMobile ? 0 : 0,
          }}
        >
          <div className="profile-settings-content-inner">
          {isProfileMobile && (
            <div className="profile-mobile-header">
              <button type="button" className="profile-mobile-menu-btn" onClick={() => setMobileMenuOpen(true)}>
                <MenuOutlined />
              </button>
              <span className="profile-mobile-header-title">
                {tabs.find(t => t.key === activeTab)?.label || 'Cài đặt'}
              </span>
            </div>
          )}
          <TabContent activeTab={activeTab}>
            {!dismissBanner && (() => {
              const pct = calcProfileCompletion(user)
              if (pct >= 100) return null
              const statusText = pct < 50 ? 'Cần bổ sung thêm thông tin' : 'Gần hoàn thiện'
              return (
                <div className="profile-completion-alert">
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'var(--theme-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 16, flexShrink: 0,
                  }}>
                    <LockOutlined />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600, color: 'var(--theme-text)' }}>{'Hoàn thiện hồ sơ'}</span>
                    <span style={{ color: 'var(--theme-muted)', marginLeft: 6 }}>{pct}% — {statusText}</span>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button type="primary" size="small" style={{ borderRadius: 8, fontWeight: 600, fontSize: 12, height: 30, whiteSpace: 'nowrap' }}
                      onClick={() => setActiveTab('account')}
                    >
                      {'Hoàn thiện ngay'}
                    </Button>
                    <Button size="small" style={{ borderRadius: 8, fontWeight: 500, fontSize: 12, height: 30, background: 'transparent', borderColor: 'var(--theme-border)', color: 'var(--theme-muted)', whiteSpace: 'nowrap' }}
                      onClick={() => setDismissBanner(true)}
                    >
                      {'Để sau'}
                    </Button>
                  </div>
                </div>
              )
            })()}

            {(['account', 'personal', 'health'] as ProfileTabKey[]).includes(activeTab) && (
              <div>
                <Form layout="vertical" form={form} onFinish={handleSave} onValuesChange={() => setFormDirty(true)} className={profileFormClass}>
                  {activeTab === 'account' && (
                    <>
                    <ProfileHeader
                      user={user}
                      avatarPreview={avatarPreview}
                      fileRef={fileRef}
                      coverPreview={coverPreview}
                      coverRef={coverRef}
                      contactText={contactText}
                      onCopyContact={handleCopyContact}
                      onAvatarChange={handleAvatarFileChange}
                      onCoverChange={handleCoverFileChange}
                      onCoverRemove={handleCoverRemove}
                      mediaUploading={mediaUploading}
                    />
                   <div style={responsiveSectionCardStyle}>
                    {renderSectionHeader(<UserOutlined />, 'Tài khoản & Bảo mật', 'Quản lý thông tin tài khoản và bảo mật')}

                   <Form.Item label={'Mã hội viên'}>
                     <Input
                       disabled
                       suffix={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><LockOutlined /><CopyOutlined style={{ cursor: 'pointer', color: 'var(--theme-accent)' }} onClick={() => { navigator.clipboard.writeText(user.memberCode || ''); message.success('Đã sao chép thông tin liên hệ') }} /></span>}
                       value={user.memberCode || '—'}
                       style={{ ...profileDisabledInputStyle, fontWeight: 600, fontSize: 14 }}
                     />
                   </Form.Item>

                   <Form.Item name="name" hidden>
                     <Input />
                   </Form.Item>

                   <Form.Item label={'Email đăng nhập'} name="email">
                     <Input disabled suffix={<LockOutlined />} style={profileDisabledInputStyle} />
                   </Form.Item>
                   <div className="mb-5 -mt-2">
                     <div className="text-xs leading-relaxed text-[var(--theme-muted)]" style={{ maxWidth: 480 }}>
                       {'Email không thể thay đổi trực tiếp. Nhấn vào liên kết bên dưới để yêu cầu thay đổi.'}
                     </div>
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0, marginTop: 6, fontSize: 12, height: 'auto' }}
                        onClick={() => { setNewEmail(''); setOtpValue(''); setEmailChangeStep('email'); setChangeEmailModalOpen(true) }}
                      >
                        {'Yêu cầu đổi email'}
                      </Button>
                   </div>

                   <Form.Item label={'Tên đăng nhập'}>
                     <Input
                       disabled
                       value={user.username || (user.email ? user.email.split('@')[0] : '—')}
                       style={profileDisabledInputStyle}
                     />
                   </Form.Item>

                   <Form.Item label={'Ngày tạo'}>
                     <Input disabled value={user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'} style={profileDisabledInputStyle} />
                   </Form.Item>
                 </div>
                 </>)}

                {/* Personal Information */}
                {activeTab === 'personal' && (
                <div style={responsiveSectionCardStyle}>
                  {renderSectionHeader(<UserOutlined />, 'Thông tin cá nhân', 'Thông tin cá nhân của bạn')}
                  {isProfileMobile && mobileSubTabPicker ? (
                    <div className="profile-subtab-picker">
                      {[
                        { key: 'basic' as PersonalSubTab, label: 'Cơ bản' },
                        { key: 'contact' as PersonalSubTab, label: 'Liên hệ' },
                        { key: 'emergency' as PersonalSubTab, label: 'Khẩn cấp' },
                        { key: 'verification' as PersonalSubTab, label: 'Xác thực' },
                      ].map((sub) => (
                        <button key={sub.key} type="button" className="profile-subtab-picker-btn"
                          onClick={() => { setPersonalSubTab(sub.key); setMobileSubTabPicker(false) }}
                        >
                          <span className="profile-subtab-picker-icon">
                            {sub.key === 'basic' ? <UserOutlined /> :
                             sub.key === 'contact' ? <PhoneOutlined /> :
                             sub.key === 'emergency' ? <SafetyCertificateOutlined /> :
                             <InfoCircleOutlined />}
                          </span>
                          <span className="profile-subtab-picker-label">{sub.label}</span>
                          <span className="profile-subtab-picker-arrow">›</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
                    {isProfileMobile && (
                      <button type="button" className="profile-subtab-back" onClick={() => setMobileSubTabPicker(true)}>
                        <ArrowLeftOutlined style={{ fontSize: 14 }} />
                        <span>{'Quay lại các mục thông tin'}</span>
                      </button>
                    )}
                    {!isProfileMobile && (
                    <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-2 scrollbar-thin">
                      {[
                        { key: 'basic' as PersonalSubTab, label: 'Cơ bản' },
                        { key: 'contact' as PersonalSubTab, label: 'Liên hệ' },
                        { key: 'emergency' as PersonalSubTab, label: 'Khẩn cấp' },
                        { key: 'verification' as PersonalSubTab, label: 'Xác thực' },
                      ].map((sub) => (
                        <button
                          key={sub.key}
                          type="button"
                          onClick={() => setPersonalSubTab(sub.key)}
                          className={`profile-mobile-tab${personalSubTab === sub.key ? ' active' : ''}`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                    )}
                    <div className={profileFormClass}>
                    {personalSubTab === 'basic' && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-[768px]:grid-cols-1">
                        <Form.Item label={'Họ và tên'} name="fullName" className="col-span-full">
                          <Input placeholder={'Nhập họ và tên'} style={profileInputStyle} />
                        </Form.Item>
                        <Form.Item label={'Ngày sinh'} name="dateOfBirth">
                          <Input type="date" style={profileInputStyle} />
                        </Form.Item>
                        <Form.Item label={'Giới tính'} name="gender">
                          <Select style={profileInputStyle}>
                            <Select.Option value="male">{'Nam'}</Select.Option>
                            <Select.Option value="female">{'Nữ'}</Select.Option>
                            <Select.Option value="other">{'Khác'}</Select.Option>
                          </Select>
                        </Form.Item>
                      </div>
                    )}

                    {personalSubTab === 'contact' && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-[768px]:grid-cols-1">
                        <Form.Item label={'Số điện thoại'} name="phone" className="col-span-full">
                          <Input prefix={<PhoneOutlined />} placeholder={'Nhập số điện thoại'} style={profileInputStyle} />
                        </Form.Item>
                        <Form.Item label={'Quốc gia'} name="country">
                          <Select
                            showSearch
                            placeholder={'Chọn quốc gia'}
                            style={profileInputStyle}
                            optionFilterProp="label"
                          >
                            {[
                              { value: 'Vietnam', label: 'Việt Nam' },
                              { value: 'USA', label: 'United States' },
                              { value: 'UK', label: 'United Kingdom' },
                              { value: 'Canada', label: 'Canada' },
                              { value: 'Australia', label: 'Australia' },
                              { value: 'France', label: 'France' },
                              { value: 'Germany', label: 'Germany' },
                              { value: 'Japan', label: 'Japan' },
                              { value: 'South Korea', label: 'South Korea' },
                              { value: 'China', label: 'China' },
                              { value: 'Singapore', label: 'Singapore' },
                              { value: 'Malaysia', label: 'Malaysia' },
                              { value: 'Thailand', label: 'Thailand' },
                            ].map((c) => (
                              <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                        <Form.Item label={'Tỉnh / Thành phố'} name="province">
                          <Input placeholder={'Nhập tỉnh/thành phố'} style={profileInputStyle} />
                        </Form.Item>
                        <Form.Item label={'Địa chỉ chi tiết'} name="detailedAddress" className="col-span-full">
                          <Input placeholder={'Nhập địa chỉ chi tiết'} style={profileInputStyle} />
                        </Form.Item>
                      </div>
                    )}

                    {personalSubTab === 'emergency' && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-[768px]:grid-cols-1">
                        <Form.Item label={'Tên người liên hệ khẩn cấp'} name="emergencyName">
                          <Input placeholder={'Nhập tên người liên hệ'} style={profileInputStyle} />
                        </Form.Item>
                        <Form.Item label={'Số điện thoại khẩn cấp'} name="emergencyPhone">
                          <Input placeholder={'Nhập số điện thoại'} style={profileInputStyle} />
                        </Form.Item>
                        <Form.Item label={'Quốc gia'} name="emergencyContactCountry">
                          <Select
                            showSearch
                            placeholder={'Chọn quốc gia'}
                            style={profileInputStyle}
                            optionFilterProp="label"
                          >
                            {[
                              { value: 'Vietnam', label: 'Việt Nam' },
                              { value: 'USA', label: 'United States' },
                              { value: 'UK', label: 'United Kingdom' },
                              { value: 'Canada', label: 'Canada' },
                              { value: 'Australia', label: 'Australia' },
                              { value: 'France', label: 'France' },
                              { value: 'Germany', label: 'Germany' },
                              { value: 'Japan', label: 'Japan' },
                              { value: 'South Korea', label: 'South Korea' },
                              { value: 'China', label: 'China' },
                              { value: 'Singapore', label: 'Singapore' },
                              { value: 'Malaysia', label: 'Malaysia' },
                              { value: 'Thailand', label: 'Thailand' },
                            ].map((c) => (
                              <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                        <Form.Item label={'Mối quan hệ'} name="emergencyRelationship">
                          <Select placeholder={'Chọn mối quan hệ'} style={profileInputStyle}>
                            <Select.Option value="spouse">{'Vợ / Chồng'}</Select.Option>
                            <Select.Option value="parent">{'Cha / Mẹ'}</Select.Option>
                            <Select.Option value="sibling">{'Anh / Chị / Em'}</Select.Option>
                            <Select.Option value="relative">{'Họ hàng'}</Select.Option>
                            <Select.Option value="friend">{'Bạn bè'}</Select.Option>
                            <Select.Option value="other">{'Khác'}</Select.Option>
                          </Select>
                        </Form.Item>
                      </div>
                    )}

                    {personalSubTab === 'verification' && (
                      <div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-[768px]:grid-cols-1">
                          <Form.Item label={'Loại giấy tờ'} name="identityType">
                            <Select
                              placeholder={'Chọn loại giấy tờ'}
                              style={profileInputStyle}
                              onChange={(val: string) => {
                                if (val && val !== 'other') form.setFieldValue('identityCountry', '')
                              }}
                            >
                              <Select.Option value="cccd">{'Căn cước công dân'}</Select.Option>
                              <Select.Option value="cmnd">{'Chứng minh nhân dân'}</Select.Option>
                              <Select.Option value="passport">{'Hộ chiếu'}</Select.Option>
                              <Select.Option value="other">{'Giấy tờ khác'}</Select.Option>
                            </Select>
                          </Form.Item>
                          <Form.Item label={'Số giấy tờ'} name="identityNumber">
                            <Input
                              placeholder={'Nhập số giấy tờ'}
                              style={profileInputStyle}
                              type={user.role === 'admin' ? 'text' : 'password'}
                            />
                          </Form.Item>
                          <Form.Item label={'Quốc gia cấp'} name="identityCountry">
                            <Select
                              showSearch
                              placeholder={'Chọn quốc gia cấp'}
                              style={profileInputStyle}
                              optionFilterProp="label"
                            >
                              {[
                                { value: 'Vietnam', label: 'Việt Nam' },
                                { value: 'USA', label: 'United States' },
                                { value: 'UK', label: 'United Kingdom' },
                                { value: 'Canada', label: 'Canada' },
                                { value: 'Australia', label: 'Australia' },
                                { value: 'France', label: 'France' },
                                { value: 'Germany', label: 'Germany' },
                                { value: 'Japan', label: 'Japan' },
                                { value: 'South Korea', label: 'South Korea' },
                                { value: 'China', label: 'China' },
                                { value: 'Singapore', label: 'Singapore' },
                                { value: 'Malaysia', label: 'Malaysia' },
                                { value: 'Thailand', label: 'Thailand' },
                              ].map((c) => (
                                <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>
                              ))}
                            </Select>
                          </Form.Item>
                        </div>
                        <div className="mt-4 border-t border-[var(--theme-border)] pt-4">
                          <div className="mb-3 text-sm font-semibold text-[var(--theme-text)]">
                            {'Hình ảnh giấy tờ'}
                          </div>
                          <div className="grid grid-cols-2 gap-4 max-[480px]:grid-cols-1">
                            <div>
                              <div className="mb-1 text-xs text-[var(--theme-muted)]">{'Mặt trước'}</div>
                              <label
                                style={{
                                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                                  justifyContent: 'center', gap: 6,
                                  minHeight: 100, borderRadius: 10,
                                  border: '1px dashed var(--theme-border)',
                                  background: 'var(--theme-input-bg)',
                                  cursor: 'pointer', overflow: 'hidden',
                                }}
                              >
                                {identityFrontPreview || user.identityFrontImage ? (
                                  <img
                                    src={identityFrontPreview || user.identityFrontImage}
                                    alt="front"
                                    style={{ width: '100%', height: 120, objectFit: 'cover' }}
                                  />
                                ) : (
                                  <>
                                    <PlusOutlined style={{ fontSize: 20, color: 'var(--theme-muted)' }} />
                                    <span style={{ fontSize: 11, color: 'var(--theme-muted)' }}>
                                      {'Tải lên hình ảnh'}
                                    </span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  hidden
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) {
                                      setIdentityFrontFile(file)
                                      setIdentityFrontPreview(URL.createObjectURL(file))
                                    }
                                  }}
                                />
                              </label>
                            </div>
                            <div>
                              <div className="mb-1 text-xs text-[var(--theme-muted)]">{'Mặt sau'}</div>
                              <label
                                style={{
                                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                                  justifyContent: 'center', gap: 6,
                                  minHeight: 100, borderRadius: 10,
                                  border: '1px dashed var(--theme-border)',
                                  background: 'var(--theme-input-bg)',
                                  cursor: 'pointer', overflow: 'hidden',
                                }}
                              >
                                {identityBackPreview || user.identityBackImage ? (
                                  <img
                                    src={identityBackPreview || user.identityBackImage}
                                    alt="back"
                                    style={{ width: '100%', height: 120, objectFit: 'cover' }}
                                  />
                                ) : (
                                  <>
                                    <PlusOutlined style={{ fontSize: 20, color: 'var(--theme-muted)' }} />
                                    <span style={{ fontSize: 11, color: 'var(--theme-muted)' }}>
                                      {'Tải lên hình ảnh'}
                                    </span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  hidden
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) {
                                      setIdentityBackFile(file)
                                      setIdentityBackPreview(URL.createObjectURL(file))
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                        {(user.identityType || user.identityStatus) && (
                          <div className="mt-4 flex items-center gap-2 text-sm flex-wrap">
                            {(() => {
                              const st = (user.identityStatus || '') as string
                              if (!st) return <Tag color="default">{'Chưa nộp'}</Tag>
                              if (st === 'pending') return <Tag color="processing">{'Đang chờ xét duyệt'}</Tag>
                              if (st === 'approved') return <Tag color="success">{'Đã duyệt'}</Tag>
                              if (st === 'rejected') {
                                return <>
                                  <Tag color="error">{'Từ chối'}</Tag>
                                  {user.identityRejectReason && (
                                    <span className="text-xs text-[var(--theme-muted)] ml-1">
                                      ({'Lý do từ chối'}: {user.identityRejectReason})
                                    </span>
                  )}
                            </>
                              }
                              return null
                            })()}
                            {user.identityReviewedAt && (
                              <span className="text-xs text-[var(--theme-muted)]">
                                {new Date(user.identityReviewedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}
                        {form.getFieldValue('identityType') === 'cccd' && user.nationality === 'Vietnamese' && (
                          <div className="mt-2 text-xs text-[var(--theme-accent)]">
                            <InfoCircleOutlined className="mr-1" />
                            {'Sử dụng CCCD gắn chip để xác thực nhanh hơn'}
                          </div>
                        )}
                        {form.getFieldValue('identityType') === 'passport' && user.nationality !== 'Vietnamese' && user.nationality && (
                          <div className="mt-2 text-xs text-[var(--theme-accent)]">
                            <InfoCircleOutlined className="mr-1" />
                            {'Sử dụng hộ chiếu để xác thực'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  </>
                )}
                </div>
                )}

                {/* Health Information */}
                {activeTab === 'health' && (
                <div style={responsiveSectionCardStyle}>
                  {renderSectionHeader(<HeartOutlined />, 'Sức khỏe', 'Thông tin sức khỏe và thể hình')}
                  <div className={profileFormClass}>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-[768px]:grid-cols-1">
                      <Form.Item label={'Chiều cao (cm)'} name="height">
                        <Input type="number" placeholder={'Nhập chiều cao'} style={profileInputStyle} />
                      </Form.Item>
                      <Form.Item label={'Cân nặng (kg)'} name="weight">
                        <Input type="number" placeholder={'Nhập cân nặng'} style={profileInputStyle} />
                      </Form.Item>
                    </div>
                    <Form.Item label={'Mục tiêu tập luyện'} name="goals">
                      <Select mode="multiple" placeholder={'Mục tiêu tập luyện'} style={profileInputStyle}>
                        <Select.Option value="fat_loss">{'Giảm mỡ'}</Select.Option>
                        <Select.Option value="muscle_gain">{'Tăng cơ'}</Select.Option>
                        <Select.Option value="weight_gain">{'Tăng cân'}</Select.Option>
                        <Select.Option value="maintain">{'Duy trì'}</Select.Option>
                      </Select>
                    </Form.Item>
                    <Form.Item label={'Mức độ tập luyện'} name="activityLevel">
                      <Select placeholder={'Mức độ tập luyện'} style={profileInputStyle}>
                        <Select.Option value="beginner">{'Mới bắt đầu'}</Select.Option>
                        <Select.Option value="intermediate">{'Trung bình'}</Select.Option>
                        <Select.Option value="advanced">{'Nâng cao'}</Select.Option>
                      </Select>
                    </Form.Item>
                    <Form.Item label={'Ghi chú sức khỏe'} name="healthNotes">
                      <Input.TextArea rows={3} placeholder={'Nhập ghi chú sức khỏe (nếu có)'} style={profileInputStyle} />
                    </Form.Item>
                  </div>
                </div>
                )}



                </Form>
              </div>
            )}

            {activeTab === 'account' && !hasPassword && (
              <div style={responsiveSectionCardStyle}>
                {renderSectionHeader(<LockOutlined />, 'Đặt mật khẩu', 'Tạo mật khẩu cho tài khoản của bạn')}

                <Form layout="vertical" form={passwordForm} onFinish={handleSetPassword} className={profileFormClass}>
                  <Form.Item label={'Mật khẩu mới'} name="newPassword" rules={[{ required: true, message: 'Nhập mật khẩu mới' }]}>
                    <Input.Password placeholder={'Ít nhất 6 ký tự'} style={profilePasswordInputStyle} />
                  </Form.Item>

                  <Form.Item label={'Xác nhận mật khẩu'} name="confirm" rules={[{ required: true, message: 'Xác nhận mật khẩu mới' }]}>
                    <Input.Password placeholder={'Nhập lại mật khẩu mới'} style={profilePasswordInputStyle} />
                  </Form.Item>

                  <Button type="primary" htmlType="submit" block loading={loading} className={`${primaryButtonClass} !h-12 !rounded-2xl !text-[15px]`}>
                    {'Đặt mật khẩu'}
                  </Button>
                </Form>
              </div>
            )}

            {activeTab === 'account' && hasPassword && (
              <div style={responsiveSectionCardStyle}>
                {renderSectionHeader(<LockOutlined />, 'Đổi mật khẩu', 'Cập nhật mật khẩu tài khoản')}

                <Form layout="vertical" form={passwordForm} onFinish={handleChangePassword} className={profileFormClass}>
                  <Form.Item label={'Mật khẩu hiện tại'} name="currentPassword" rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}>
                    <Input.Password placeholder={'Nhập mật khẩu hiện tại của bạn'} style={profilePasswordInputStyle} />
                  </Form.Item>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -12, marginBottom: 8 }}>
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0, height: 'auto', fontSize: 12 }}
                      onClick={() => { setForgotPasswordStep('method'); setForgotPasswordMethod(null); setForgotPasswordOtp(''); setForgotPasswordNewPassword(''); setForgotPasswordConfirmPassword(''); setResendCooldown(0); setOtpSending(false); setOtpSendingMethod(null); setForgotPasswordModalOpen(true) }}
                    >
                      {'Quên mật khẩu?'}
                    </Button>
                  </div>

                  <Form.Item label={'Mật khẩu mới'} name="newPassword" rules={[{ required: true, min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' }]}>
                    <Input.Password placeholder={'Ít nhất 6 ký tự'} style={profilePasswordInputStyle} />
                  </Form.Item>

                  <Form.Item label={'Xác nhận mật khẩu mới'} name="confirm" rules={[{ required: true, message: 'Xác nhận mật khẩu mới' }, { validator: (_: any, value: string) => { if (!value || passwordForm.getFieldValue('newPassword') === value) return Promise.resolve(); return Promise.reject(new Error('Mật khẩu xác nhận không khớp')) } }]}>
                    <Input.Password placeholder={'Nhập lại mật khẩu mới'} style={profilePasswordInputStyle} />
                  </Form.Item>

                  <Button type="primary" htmlType="submit" block loading={loading} className={`${primaryButtonClass} !h-12 !rounded-2xl !text-[15px]`}>
                    {'Đổi mật khẩu'}
                  </Button>
                </Form>
              </div>
            )}

            {activeTab === 'gym' && (
              <div>
                {/* Gym Profile */}
                <div style={responsiveSectionCardStyle}>
                  {renderSectionHeader(<TrophyOutlined />, 'Hồ sơ Gym', 'Thông tin tập luyện tại phòng gym')}
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-[var(--theme-border)] pb-2">
                      <span className="text-[var(--theme-muted)]">{'Ngày tham gia'}</span>
                      <span className="font-medium text-[var(--theme-text)]">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-[var(--theme-border)] pb-2">
                      <span className="text-[var(--theme-muted)]">{'Hạng thành viên'}</span>
                      <span className="font-medium text-[var(--theme-text)]">{'Mặc định'}</span>
                    </div>
                    <div className="flex justify-between border-b border-[var(--theme-border)] pb-2">
                      <span className="text-[var(--theme-muted)]">{'Gói tập hiện tại'}</span>
                      <span className="font-medium text-[var(--theme-text)]">-</span>
                    </div>
                    <div className="flex justify-between border-b border-[var(--theme-border)] pb-2">
                      <span className="text-[var(--theme-muted)]">{'Huấn luyện viên'}</span>
                      <span className="font-medium text-[var(--theme-text)]">-</span>
                    </div>
                    <div className="flex justify-between border-b border-[var(--theme-border)] pb-2">
                      <span className="text-[var(--theme-muted)]">{'Tổng số buổi'}</span>
                      <span className="font-medium text-[var(--theme-text)]">-</span>
                    </div>
                    <div className="flex justify-between pb-2">
                      <span className="text-[var(--theme-muted)]">{'Điểm tích lũy'}</span>
                      <span className="font-medium text-[var(--theme-text)]">-</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'appearance' && (
              <div style={responsiveSectionCardStyle}>
                {renderSectionHeader(<BgColorsOutlined />, 'Giao diện', 'Tùy chỉnh giao diện cá nhân của bạn')}
                <div className="mb-6 border-b border-[var(--theme-border)] pb-5">
                  <div className="font-extrabold" style={{ color: token.colorText }}>{'Giao diện cá nhân'}</div>
                  <div className="mt-[3px] text-[13px]" style={{ color: token.colorTextSecondary }}>
                    {'Chọn chế độ giao diện bạn muốn'}
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {([
                      { value: 'system', label: 'Theo hệ thống' },
                      { value: 'light', label: 'Sáng' },
                      { value: 'dark', label: 'Tối' },
                    ] as Array<{ value: 'system' | 'light' | 'dark'; label: string }>).map((item) => {
                      const active = (user.themePreference || 'system') === item.value
                      return (
                        <button
                          key={item.value}
                          type="button"
                          disabled={loading}
                          onClick={() => handleThemePreferenceChange(item.value)}
                          className="rounded-xl border px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
                          style={{
                            background: active ? 'var(--theme-button-bg)' : 'var(--gs-card)',
                            borderColor: active ? 'var(--theme-button-border)' : 'var(--gs-border)',
                            color: active ? 'var(--theme-button-text)' : 'var(--gs-text)',
                            fontWeight: active ? 600 : 700,
                          }}
                        >
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex items-start justify-between gap-4 max-[560px]:flex-col">
                  <div>
                    <div className="font-extrabold" style={{ color: token.colorText }}>{'Màu nhấn'}</div>
                    <div className="mt-[3px] text-[13px]" style={{ color: token.colorTextSecondary }}>
                      {'Tùy chỉnh màu nhấn cho giao diện'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {[
                      { label: 'Nền', color: previewTheme.bg },
                      { label: 'Card', color: previewTheme.card },
                      { label: 'Text', color: previewTheme.text },
                    ].map((item) => (
                      <span
                        key={item.label}
                        className="h-8 w-8 rounded-lg border"
                        title={item.label}
                        style={{ backgroundColor: item.color, borderColor: 'var(--theme-border-strong)' }}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-3 max-[560px]:flex-wrap">
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{ position: 'relative', zIndex: 9999 }}
                  >
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(event) => {
                        const hex = event.target.value
                        handleAccentPreview(hex)
                      }}
                      onBlur={(event) => handleAccentCommit(event.target.value)}
                      onMouseUp={(event) => handleAccentCommit(event.currentTarget.value)}
                      onPointerUp={(event) => handleAccentCommit(event.currentTarget.value)}
                      onTouchEnd={(event) => handleAccentCommit(event.currentTarget.value)}
                      className="h-11 w-16 cursor-pointer rounded-xl border bg-transparent p-1"
                      style={{ borderColor: 'var(--theme-border-strong)' }}
                      aria-label={'Chọn màu nhấn'}
                    />
                  </div>
                  <div className="font-semibold" style={{ color: token.colorText }}>{accentColor.toUpperCase()}</div>
                  <button
                    type="button"
                    onClick={() => saveAccentColor('')}
                    disabled={loading}
                    className="ml-auto rounded-xl border px-3 py-1.5 text-xs font-bold transition disabled:opacity-70"
                    style={{
                      background: !user?.accentColor ? 'var(--theme-button-bg)' : 'transparent',
                      borderColor: !user?.accentColor ? 'var(--theme-button-border)' : 'var(--gs-border)',
                      color: !user?.accentColor ? 'var(--theme-button-text)' : 'var(--gs-text)',
                    }}
                  >
                    {'Mặc định'}
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {PRESET_ACCENT_COLORS.map((item) => (
                    <button
                      key={item.color}
                      type="button"
                      onClick={() => handlePresetSelect(item.color)}
                      className="h-8 w-8 cursor-pointer rounded-full border transition-transform duration-150 hover:scale-110"
                      style={{
                        backgroundColor: item.color,
                        borderColor: accentColor.toLowerCase() === item.color.toLowerCase() ? '#ffffff' : token.colorBorder,
                      }}
                      aria-label={'Chọn màu'}
                      title={item.label}
                    />
                  ))}
                </div>

                
              </div>
            )}

            {activeTab === 'address' && (
              <div
                className={profileFormClass}
                style={responsiveSectionCardStyle}
              >
                {renderSectionHeader(<EnvironmentOutlined />, 'Sổ địa chỉ', 'Quản lý địa chỉ giao hàng')}
                <div className="flex items-center justify-between gap-4 max-[768px]:flex-col max-[768px]:items-start">
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreateAddress} loading={loading} className="!rounded-lg !border-0 !bg-[var(--profile-accent)] !font-bold !text-[var(--theme-button-text)] hover:!bg-[var(--profile-accent-hover)]">
                    {'Thêm địa chỉ'}
                  </Button>
                </div>

                <div className="mt-4">
                  {addresses.length === 0 ? (
                    <Empty description={'Chưa có địa chỉ'} />
                  ) : addresses.map((address) => {
                    const fullAddress = [
                      address.street,
                      address.ward,
                      address.district,
                      address.city,
                    ].filter(Boolean).join(', ')

                    return (
                      <div
                        className="mb-2.5 flex items-start gap-3 rounded-xl border p-[14px_16px] max-[480px]:gap-2.5 max-[480px]:p-3"
                        key={address._id}
                        style={{
                          backgroundColor: token.colorBgElevated,
                          borderColor: address.isDefault ? 'var(--profile-accent-border)' : 'var(--theme-border-strong)',
                        }}
                      >
                        <div className="grid h-9 w-9 flex-none place-items-center rounded-[9px]" style={{ backgroundColor: token.colorBgContainer, color: 'var(--profile-accent)' }}>
                          <EnvironmentOutlined />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-extrabold" style={{ color: token.colorText }}>{address.fullName}</span>
                            {address.isDefault && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                                style={{
                                  backgroundColor: 'var(--profile-accent-bg)',
                                  borderColor: 'var(--profile-accent-border)',
                                  color: 'var(--profile-accent)',
                                }}
                              >
                                <StarFilled />
                                {'Mặc định'}
                              </span>
                            )}
                          </div>
                          <div className="mt-[7px] inline-flex items-center gap-1.5 text-[13px]" style={{ color: token.colorTextSecondary }}>
                            <PhoneOutlined />
                            <span>{address.phone}</span>
                          </div>
                          <div className="mt-1.5 text-xs leading-[1.45]" style={{ color: token.colorTextSecondary }}>{fullAddress}</div>
                        </div>
                        <div className="ml-auto flex items-center gap-1.5 max-[480px]:flex-col max-[480px]:gap-1">
                          {!address.isDefault && (
                            <button
                              className={addressActionButtonClass}
                              type="button"
                              title={'Đặt làm mặc định'}
                              onClick={() => handleSetDefault(address._id)}
                            >
                              <StarOutlined />
                            </button>
                          )}
                          <button
                            className={addressActionButtonClass}
                            type="button"
                            title={'Sửa địa chỉ'}
                            onClick={() => openEditAddress(address)}
                          >
                            <EditOutlined />
                          </button>
                          <button
                            className={`${addressActionButtonClass} hover:!border-[var(--profile-accent-border)] hover:!bg-[var(--profile-accent-bg)] hover:!text-[var(--profile-accent)]`}
                            type="button"
                            title={'Xóa địa chỉ'}
                            onClick={() => handleDeleteAddress(address._id)}
                          >
                            <DeleteOutlined />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <Modal
                  title={editAddress ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'}
                  open={addressModalOpen}
                  onCancel={() => setAddressModalOpen(false)}
                  footer={null}
                  destroyOnHidden
                  className={addressEditModalClass}
                  style={profileThemeStyle}
                >
                  <Form form={addressForm} layout="vertical" onFinish={handleSaveAddress} initialValues={{ isDefault: false }} className={profileFormClass}>
                    <Form.Item name="fullName" label={'Người nhận'} rules={[{ required: true, message: 'Vui lòng nhập tên người nhận' }]}>
                      <Input style={profileInputStyle} />
                    </Form.Item>
                    <Form.Item name="phone" label={'Số điện thoại'} rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }, { pattern: /^0\d{9,10}$/, message: 'Số điện thoại không hợp lệ' }]}>
                      <Input style={profileInputStyle} />
                    </Form.Item>
                    <Form.Item name="street" label={'Địa chỉ'} rules={[{ required: true, message: 'Vui lòng nhập địa chỉ' }]}>
                      <Input style={profileInputStyle} />
                    </Form.Item>
                    <Form.Item name="ward" label={'Phường / Xã'}>
                      <Input style={profileInputStyle} />
                    </Form.Item>
                    <Form.Item name="district" label={'Quận / Huyện'} rules={[{ required: true, message: 'Vui lòng nhập quận/huyện' }]}>
                      <Input style={profileInputStyle} />
                    </Form.Item>
                    <Form.Item name="city" label={'Tỉnh / Thành phố'} rules={[{ required: true, message: 'Vui lòng nhập tỉnh/thành phố' }]}>
                      <Input style={profileInputStyle} />
                    </Form.Item>
                    <Form.Item name="isDefault" valuePropName="checked">
                      <Checkbox>{'Đặt làm địa chỉ mặc định'}</Checkbox>
                    </Form.Item>
                    <Form.Item>
                      <Space>
                        <Button type="primary" htmlType="submit" loading={loading}>{'Lưu'}</Button>
                        <Button onClick={() => setAddressModalOpen(false)}>{'Hủy'}</Button>
                      </Space>
                    </Form.Item>
                  </Form>
                </Modal>
              </div>
            )}

          </TabContent>
          </div>
        </div>
      </div>
      <Modal
        title={'Khôi phục mật khẩu'}
        open={forgotPasswordModalOpen}
        onCancel={() => { setForgotPasswordModalOpen(false); setResendCooldown(0); setOtpSending(false); setOtpSendingMethod(null) }}
        footer={null}
        destroyOnHidden
        className={addressEditModalClass}
        style={profileThemeStyle}
      >
        {forgotPasswordStep === 'method' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--theme-muted)', marginBottom: 4 }}>
              {'Chọn phương thức nhận mã OTP'}
            </div>

            <Button
              block
              disabled={!user?.email || otpSending}
              onClick={() => handleForgotPasswordSendOtp('email')}
              loading={otpSending && otpSendingMethod === 'email'}
              style={{
                height: 48,
                borderRadius: 12,
                textAlign: 'left',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                border: '1px solid var(--profile-border)',
                background: !user?.email || otpSending ? 'var(--theme-elevated)' : 'var(--profile-bg-container)',
                color: user?.email ? 'var(--profile-text)' : 'var(--theme-muted)',
                cursor: user?.email && !otpSending ? 'pointer' : 'not-allowed',
              }}
              className="!font-normal"
            >
              ✉ {'Gửi qua Email'}
              {!user?.email && <span style={{ marginLeft: 'auto', fontSize: 11 }}>{'Không khả dụng'}</span>}
            </Button>

            <Button
              block
              disabled={!user?.phone || otpSending}
              onClick={() => handleForgotPasswordSendOtp('phone')}
              loading={otpSending && otpSendingMethod === 'phone'}
              style={{
                height: 48,
                borderRadius: 12,
                textAlign: 'left',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                border: '1px solid var(--profile-border)',
                background: !user?.phone || otpSending ? 'var(--theme-elevated)' : 'var(--profile-bg-container)',
                color: user?.phone ? 'var(--profile-text)' : 'var(--theme-muted)',
                cursor: user?.phone && !otpSending ? 'pointer' : 'not-allowed',
              }}
              className="!font-normal"
            >
              📞 {'Gửi qua SĐT'}
              {!user?.phone && <span style={{ marginLeft: 'auto', fontSize: 11 }}>{'Không khả dụng'}</span>}
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
            <div className="text-xs leading-relaxed text-[var(--theme-muted)]" style={{ marginBottom: 4 }}>
              Mã OTP có thể mất vài giây để đến nơi.
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-muted)', marginBottom: 4 }}>
                {'Mã OTP'}
              </div>
              <Input
                value={forgotPasswordOtp}
                onChange={(e) => setForgotPasswordOtp(e.target.value)}
                placeholder={'Mã OTP'}
                style={profileInputStyle}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-muted)', marginBottom: 4 }}>
                {'Mật khẩu mới'}
              </div>
              <Input.Password
                value={forgotPasswordNewPassword}
                onChange={(e) => setForgotPasswordNewPassword(e.target.value)}
                placeholder={'Ít nhất 6 ký tự'}
                style={profilePasswordInputStyle}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-muted)', marginBottom: 4 }}>
                {'Xác nhận mật khẩu'}
              </div>
              <Input.Password
                value={forgotPasswordConfirmPassword}
                onChange={(e) => setForgotPasswordConfirmPassword(e.target.value)}
                placeholder={'Nhập lại mật khẩu mới'}
                style={profilePasswordInputStyle}
              />
            </div>
            <Button
              type="primary"
              block
              loading={forgotPasswordLoading}
              onClick={handleForgotPasswordConfirm}
              className={`${primaryButtonClass} !h-12 !rounded-2xl !text-[15px]`}
            >
              {'Đặt lại mật khẩu'}
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        title={'Đổi email'}
        open={changeEmailModalOpen}
        onCancel={() => setChangeEmailModalOpen(false)}
        footer={null}
        destroyOnHidden
        className={addressEditModalClass}
        style={profileThemeStyle}
      >
        {emailChangeStep === 'email' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-muted)', marginBottom: 4 }}>
                {'Email hiện tại'}
              </div>
              <Input disabled value={user?.email || '—'} style={profileDisabledInputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-muted)', marginBottom: 4 }}>
                {'Email mới'}
              </div>
              <Input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={'example@email.com'}
                style={profileInputStyle}
              />
            </div>
            <Button
              type="primary"
              block
              loading={emailChangeLoading}
              onClick={handleRequestEmailChange}
              className={`${primaryButtonClass} !h-12 !rounded-2xl !text-[15px]`}
            >
              {'Gửi mã OTP'}
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-muted)', marginBottom: 4 }}>
                {'Email mới'}
              </div>
              <Input disabled value={newEmail} style={profileDisabledInputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-muted)', marginBottom: 4 }}>
                {'Mã OTP'}
              </div>
              <Input
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value)}
                placeholder={'Mã OTP'}
                style={profileInputStyle}
              />
            </div>
            <div className="text-xs leading-relaxed text-[var(--theme-muted)]">
              {'Mã OTP sẽ được gửi đến email mới của bạn'}
            </div>
            <Button
              type="primary"
              block
              loading={emailChangeLoading}
              onClick={handleConfirmEmailChange}
              className={`${primaryButtonClass} !h-12 !rounded-2xl !text-[15px]`}
            >
              {'Xác nhận đổi email'}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default function AccountProfilePage() {
  const { user } = useAuth()

  if (!user) return null

  if (user.role === 'member') {
    return (
      <MemberLayout>
        <div className="member-page">
          <ProfileContent />
        </div>
      </MemberLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-0 flex-1">
        <ProfileContent />
      </div>
    </DashboardLayout>
  )
}
