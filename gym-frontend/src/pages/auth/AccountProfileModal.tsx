import {
  BgColorsOutlined,
  CameraOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  LockOutlined,
  LogoutOutlined,
  PhoneOutlined,
  PlusOutlined,
  StarFilled,
  StarOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Checkbox, Empty, Form, Grid, Input, message, Modal, Space, theme } from 'antd'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSystemSettings } from '../../context/SystemSettingsContext'
import { generateTheme, PRESET_ACCENT_COLORS, resolveEffectiveTheme, useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../hooks/useAuth'
import { createAddress, deleteAddress, getAddresses, setDefaultAddress, updateAddress } from '../../services/addressService'
import { authService } from '../../services/authService'
import { getUserDisplayName, getUserInitialName } from '../../utils/userDisplay'

const getUsernameFromEmail = (email?: string | null) => {
  if (!email) return ''
  return email.includes('@') ? email.split('@')[0] : email
}

const profileModalClass =
  'max-w-[760px] [&_.ant-modal-content]:!p-0 [&_.ant-modal-content]:!rounded-2xl [&_.ant-modal-content]:!border [&_.ant-modal-content]:!border-[var(--profile-border)] [&_.ant-modal-content]:!bg-[var(--profile-bg-elevated)] [&_.ant-modal-content]:!shadow-2xl [&_.ant-modal-close]:!right-3.5 [&_.ant-modal-close]:!top-3.5 [&_.ant-modal-close]:!text-[var(--profile-text-secondary)]'

const profileModalWrapClass =
  'profile-modal-wrap [&_.ant-modal-mask]:!bg-[var(--profile-mask)] [&_.ant-modal-mask]:backdrop-blur-[10px]'

const profileFormClass =
  '[&_.ant-form-item-label>label]:!text-xs [&_.ant-form-item-label>label]:!font-medium [&_.ant-form-item-label>label]:!uppercase [&_.ant-form-item-label>label]:!tracking-[0.06em] [&_.ant-form-item-label>label]:!text-[var(--theme-muted)] [&_.ant-input]:!min-h-[42px] [&_.ant-input]:!rounded-[12px] [&_.ant-input]:!border-[var(--profile-border)] [&_.ant-input]:!bg-[var(--profile-bg-container)] [&_.ant-input]:!text-[var(--profile-text)] [&_.ant-input::placeholder]:!text-[var(--theme-placeholder)] [&_.ant-input-affix-wrapper]:!min-h-[42px] [&_.ant-input-affix-wrapper]:!rounded-[12px] [&_.ant-input-affix-wrapper]:!border-[var(--profile-border)] [&_.ant-input-affix-wrapper]:!bg-[var(--profile-bg-container)] [&_.ant-input-affix-wrapper_input]:!bg-transparent [&_.ant-input-affix-wrapper_input]:!text-[var(--profile-text)] [&_.ant-input-affix-wrapper_input::placeholder]:!text-[var(--theme-placeholder)] [&_.ant-input:focus]:!border-[var(--profile-accent)] [&_.ant-input:focus]:!shadow-none [&_.ant-input-focused]:!border-[var(--profile-accent)] [&_.ant-input-focused]:!shadow-none [&_.ant-input-affix-wrapper-focused]:!border-[var(--profile-accent)] [&_.ant-input-affix-wrapper-focused]:!shadow-none [&_.ant-input[disabled]]:!cursor-not-allowed [&_.ant-input[disabled]]:!bg-[var(--theme-elevated)] [&_.ant-input[disabled]]:!text-[var(--theme-muted)] [&_.ant-input-disabled]:!cursor-not-allowed [&_.ant-input-disabled]:!bg-[var(--theme-elevated)] [&_.ant-input-disabled]:!text-[var(--theme-muted)]'

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

type ProfileTabKey = 'profile' | 'address' | 'password' | 'appearance'

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
  isMobile,
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
  isMobile: boolean
}) => {
  const displayName = getUserDisplayName(user, 'Người dùng')
  const avatarName = getUserInitialName(user, 'U')
  const coverSrc = coverPreview !== null && coverPreview !== ''
    ? coverPreview
    : coverPreview === ''
      ? null
      : user?.coverImage || DEFAULT_COVER

  return (
    <header className="profile-modal-header">
      <div
        className="profile-cover"
        style={{
          backgroundImage: coverSrc ? `url(${coverSrc})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          cursor: 'pointer',
        }}
        onClick={() => coverRef.current?.click()}
      >
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.5) 100%)',
        }} />

        <div
          style={{
            position: 'absolute',
            top: 8, right: 40,
            display: 'flex',
            gap: 6,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={mediaUploading === 'cover'}
            onClick={() => coverRef.current?.click()}
            style={{
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              color: '#fff',
              padding: '4px 10px',
              fontSize: 12,
              cursor: mediaUploading === 'cover' ? 'not-allowed' : 'pointer',
              opacity: mediaUploading === 'cover' ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <CameraOutlined /> {mediaUploading === 'cover' ? 'Đang tải...' : 'Thay đổi ảnh bìa'}
          </button>

          {(coverPreview || user?.coverImage) && coverPreview !== '' && (
            <button
              type="button"
              disabled={mediaUploading === 'cover-remove'}
              onClick={() => onCoverRemove()}
              style={{
                background: 'rgba(239,68,68,0.6)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: 8,
                color: '#fff',
                padding: '4px 10px',
                fontSize: 12,
                cursor: mediaUploading === 'cover-remove' ? 'not-allowed' : 'pointer',
                opacity: mediaUploading === 'cover-remove' ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <DeleteOutlined /> {mediaUploading === 'cover-remove' ? 'Đang tải...' : 'Xóa'}
            </button>
          )}
        </div>

        <input
          ref={coverRef}
          type="file"
          hidden
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onCoverChange(file)
          }}
        />
      </div>
      <div className="profile-header-content">
        <div className="profile-avatar-wrap cursor-pointer" onClick={() => mediaUploading !== 'avatar' && fileRef.current?.click()}>
          <Avatar
            size={isMobile ? 78 : 88}
            src={
              avatarPreview ||
              user.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}`
            }
            icon={<UserOutlined />}
            className="profile-avatar-image"
          />
          <span className="profile-avatar-status" />
          <div className="profile-avatar-camera">
            {mediaUploading === 'avatar' ? 'Đang tải...' : <CameraOutlined />}
          </div>
        </div>

        <div className="profile-header-meta">
          <h2>{displayName}</h2>
          <button type="button" onClick={onCopyContact}>
            <span>{contactText}</span>
            {(user.email || user.phone) && <CopyOutlined />}
          </button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        hidden
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onAvatarChange(file)
        }}
      />
    </header>
  )
}

const SidebarTabs = ({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: ProfileTabItem[]
  activeTab: ProfileTabKey
  onChange: (tab: ProfileTabKey) => void
}) => (
  <aside className="profile-desktop-tabs">
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
  </aside>
)

const MobileMenuGrid = ({
  tabs,
  activeTab,
  onChange,
  mobileMenuOpen,
  onToggle,
  hideBackdrop,
}: {
  tabs: ProfileTabItem[]
  activeTab: ProfileTabKey
  onChange: (tab: ProfileTabKey) => void
  mobileMenuOpen: boolean
  onToggle: () => void
  hideBackdrop?: boolean
}) => (
  <div className="profile-mobile-menu-anchor">
    <div className="profile-mobile-menu-toggle" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
    }}>
      <span style={{ fontSize: 13, color: 'var(--theme-muted)', fontWeight: 500 }}>
        {tabs.find(t => t.key === activeTab)?.label}
      </span>
      <button
        type="button"
        onClick={onToggle}
        style={{
          background: 'var(--theme-elevated)',
          border: '1px solid var(--theme-border)',
          borderRadius: 8,
          padding: '4px 10px',
          color: 'var(--theme-text)',
          cursor: 'pointer',
          fontSize: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {mobileMenuOpen ? '✕' : '☰'}
      </button>
    </div>

    {mobileMenuOpen && (
      <>
        {!hideBackdrop && (
          <button type="button" className="profile-mobile-menu-backdrop" aria-label="Close menu" onClick={onToggle} />
        )}
        <div className="profile-mobile-grid">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                className={`profile-grid-tab${isActive ? ' active' : ''}`}
                onClick={() => onChange(tab.key)}
              >
                <span>{tab.icon}</span>
                <strong>{tab.label}</strong>
              </button>
            )
          })}
        </div>
      </>
    )}
  </div>
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

const MobileProfileSheet = ({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) => {
  if (!open) return null

  return createPortal(
    <div className="profile-mobile-sheet">
      <button className="profile-mobile-sheet-backdrop" onClick={onClose} type="button" aria-label="Close" />
      <div className="profile-mobile-sheet-content" onClick={(e) => e.stopPropagation()}>
        <button className="profile-mobile-sheet-close" onClick={onClose} type="button" aria-label="Close">
          ✕
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export default function AccountProfileModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
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
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('profile')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [addresses, setAddresses] = useState<any[]>([])
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [editAddress, setEditAddress] = useState<any>(null)
  const [accentColor, setAccentColor] = useState(savedAccentColor)
  const [mediaUploading, setMediaUploading] = useState<'avatar' | 'cover' | 'cover-remove' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)
  const profileScrollRef = useRef<HTMLDivElement>(null)
  const preventCloseRef = useRef(false)
  const watchedEmail = Form.useWatch('email', form)
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

  const handleClose = () => {
    if (preventCloseRef.current) return
    commitPending()
    onClose()
  }

  useEffect(() => {
    if (!open || !user) return
    const profileFullName = user.fullName || user.name || ''
    form.setFieldsValue({
      name: user.name || profileFullName,
      email: user.email || '',
      phone: user.phone || '',
      fullName: profileFullName,
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : '',
    })
    setAvatarPreview(null)
    setCoverPreview(null)
    setCoverRemoved(false)
    setActiveTab('profile')
    setMobileMenuOpen(false)
    passwordForm.resetFields()
    addressForm.resetFields()
    setEditAddress(null)
    setAddresses([])
  }, [open, form, passwordForm, addressForm])

  useEffect(() => {
    if (open) {
      setAccentColor(savedAccentColor)
    }
  }, [open, savedAccentColor])

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

  const handleSave = async (values: any) => {
    setLoading(true)
    try {
      const formData = new FormData()
      const submittedFullName = values.fullName || values.name || ''
      formData.append('name', values.name || submittedFullName)
      if (values.email) formData.append('email', values.email)
      if (values.phone) formData.append('phone', values.phone)
      if (values.dateOfBirth) formData.append('dateOfBirth', values.dateOfBirth)
      if (values.fullName !== undefined) formData.append('fullName', submittedFullName)
      await authService.updateProfile(formData)
      await refreshUser()
      message.success('Cập nhật thành công')
      handleClose()
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

  useEffect(() => {
    if (open && activeTab === 'address') {
      loadAddresses()
    }
  }, [open, activeTab])

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
  const isProfileDesktop = Boolean(screens.lg)
  const isProfileCompact = !isProfileDesktop
  const responsiveSectionCardStyle = {
    ...sectionCardStyle,
    marginBottom: isProfileMobile ? 16 : 12,
    padding: isProfileMobile ? 12 : sectionCardStyle.padding,
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
  } as CSSProperties
  const tabs: ProfileTabItem[] = [
    { key: 'profile', label: 'Thông tin', icon: <UserOutlined /> },
    { key: 'address', label: 'Địa chỉ', icon: <EnvironmentOutlined /> },
    { key: 'password', label: hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu', icon: <LockOutlined /> },
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

  const sharedContent = (
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
        isMobile={isProfileCompact}
      />

      <div className="profile-modal-main">
        <SidebarTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        <MobileMenuGrid
          tabs={tabs}
          activeTab={activeTab}
          onChange={(tab) => {
            setActiveTab(tab)
            setMobileMenuOpen(false)
          }}
          mobileMenuOpen={mobileMenuOpen}
          onToggle={() => setMobileMenuOpen(prev => !prev)}
          hideBackdrop={isProfileMobile}
        />

        <div
          className="profile-modal-scroll"
          style={{
            minHeight: 120,
            padding: isProfileMobile ? '4px 4px 0' : '16px 20px',
            paddingBottom: isProfileMobile ? '0' : '16px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--theme-border) transparent',
            overflowX: 'hidden',
            overflowY: isProfileMobile ? 'visible' : 'auto',
            width: '100%',
            maxWidth: '100%',
            flex: 1,
          }}
        >
          <TabContent activeTab={activeTab}>
            {activeTab === 'profile' && (
              <div>
                <div style={responsiveSectionCardStyle}>
                  {renderSectionHeader(<UserOutlined />, 'Thông tin cá nhân', 'Cập nhật thông tin cơ bản của bạn')}

                  <Form layout="vertical" form={form} onFinish={handleSave} className={profileFormClass}>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-[768px]:grid-cols-1">
                      <Form.Item label={'Tên'} name="name" rules={[{ required: true, message: 'Nhập tên' }]}>
                        <Input prefix={<UserOutlined />} placeholder={'Tên của bạn'} style={profileInputStyle} />
                      </Form.Item>

                      <Form.Item label={'Số điện thoại'} name="phone">
                        <Input prefix={<PhoneOutlined />} placeholder={'Nhập số điện thoại'} style={profileInputStyle} />
                      </Form.Item>

                      <Form.Item
                        label="Email"
                        name="email"
                        rules={[
                          { type: 'email', message: 'Email không hợp lệ' },
                          { required: !user.email, message: 'example@email.com' },
                        ]}
                      >
                        <Input disabled={!!user.email} suffix={user.email ? <LockOutlined /> : null} placeholder={user.email ? 'example@email.com' : 'Thêm email'} style={user.email ? profileDisabledInputStyle : profileInputStyle} />
                      </Form.Item>

                      <Form.Item label="Username">
                        <Input disabled suffix={<LockOutlined />} value={getUsernameFromEmail(watchedEmail || user.email)} style={profileDisabledInputStyle} />
                      </Form.Item>

                      <Form.Item label={'Ngày sinh'} name="dateOfBirth" className="col-span-full">
                        <Input
                          type="date"
                          style={{
                            ...profileInputStyle,
                            width: '100%',
                            maxWidth: '100%',
                            boxSizing: 'border-box',
                            minWidth: 0,
                          }}
                        />
                      </Form.Item>
                    </div>

                    <Button type="primary" htmlType="submit" block loading={loading} className={`${primaryButtonClass} !mt-1 !h-12 !rounded-2xl !text-[15px]`}>
                      {'Lưu thay đổi'}
                    </Button>
                  </Form>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <Button
                    block
                    icon={<LogoutOutlined />}
                    onClick={handleLogout}
                    style={{
                      marginTop: 8,
                      height: 44,
                      borderRadius: 10,
                      background: 'transparent',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#ef4444',
                      fontWeight: 500,
                      fontSize: 14,
                    }}
                  >
                    {'Đăng xuất'}
                  </Button>
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

            {activeTab === 'password' && !hasPassword && (
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

            {activeTab === 'password' && hasPassword && (
              <div style={responsiveSectionCardStyle}>
                {renderSectionHeader(<LockOutlined />, 'Đổi mật khẩu', 'Cập nhật mật khẩu tài khoản')}

                <Form layout="vertical" form={passwordForm} onFinish={handleChangePassword} className={profileFormClass}>
                  <Form.Item label={'Mật khẩu hiện tại'} name="currentPassword" rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}>
                    <Input.Password placeholder={'Nhập mật khẩu hiện tại của bạn'} style={profilePasswordInputStyle} />
                  </Form.Item>

                  <Form.Item label={'Mật khẩu mới'} name="newPassword" rules={[{ required: true, message: 'Nhập mật khẩu mới' }]}>
                    <Input.Password placeholder={'Ít nhất 6 ký tự'} style={profilePasswordInputStyle} />
                  </Form.Item>

                  <Form.Item label={'Xác nhận mật khẩu mới'} name="confirm" rules={[{ required: true, message: 'Xác nhận mật khẩu mới' }]}>
                    <Input.Password placeholder={'Nhập lại mật khẩu mới'} style={profilePasswordInputStyle} />
                  </Form.Item>

                  <Button type="primary" htmlType="submit" block loading={loading} className={`${primaryButtonClass} !h-12 !rounded-2xl !text-[15px]`}>
                    {'Đổi mật khẩu'}
                  </Button>
                </Form>
              </div>
            )}
          </TabContent>
        </div>
      </div>
    </>
  )

  if (isProfileMobile) {
    return (
      <MobileProfileSheet open={open} onClose={handleClose}>
        <div style={{ ...profileThemeStyle, color: token.colorText }}>
          {sharedContent}
        </div>
      </MobileProfileSheet>
    )
  }

  return (
    <Modal
      title={null}
      open={open}
      onCancel={handleClose}
      footer={null}
      mask={{ closable: true }}
      destroyOnHidden
      width={isProfileDesktop ? 760 : 680}
      className={`profile-modal ${profileModalClass}`}
      wrapClassName={profileModalWrapClass}
      style={{
        ...profileThemeStyle,
        top: 20,
        margin: 'auto',
        padding: 0,
        maxWidth: '100vw',
      }}
      styles={{
        content: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--theme-border)',
        } as CSSProperties,
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        } as CSSProperties,
        mask: {
          backdropFilter: 'blur(4px)',
        },
      } as any}
    >
      <div
        ref={profileScrollRef}
        className="profile-modal-content-wrapper"
        data-profile-scroll-container="account-profile-modal"
        style={{
          ...profileThemeStyle,
          color: token.colorText,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          flex: 1,
        }}
      >
        {sharedContent}
      </div>
    </Modal>
  )
}
