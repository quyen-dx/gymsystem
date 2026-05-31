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
  RightOutlined,
  ShoppingCartOutlined,
  StarFilled,
  StarOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Checkbox, Empty, Form, Grid, Input, message, Modal, Space, theme } from 'antd'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { generateTheme, PRESET_ACCENT_COLORS, useTheme } from '../../context/ThemeContext'
import { useSystemSettings } from '../../context/SystemSettingsContext'
import { useAuth } from '../../hooks/useAuth'
import { createAddress, deleteAddress, getAddresses, setDefaultAddress, updateAddress } from '../../services/addressService'
import { authService } from '../../services/authService'

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
  '!h-11 !rounded-full !border-0 !bg-[var(--theme-accent)] !font-extrabold !text-[var(--theme-button-text)] !shadow-none hover:!bg-[var(--theme-accent-hover)]'

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

const actionItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  background: 'var(--theme-elevated)',
  border: '1px solid var(--theme-border)',
  borderRadius: 10,
  cursor: 'pointer',
  marginBottom: 8,
  transition: 'border-color 0.2s, background 0.2s',
  width: '100%',
  textAlign: 'left',
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
  t,
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
  t: (key: string, opts?: any) => string
}) => {
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
            <CameraOutlined /> {mediaUploading === 'cover' ? t('common.loading') : t('profile.change_cover')}
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
              <DeleteOutlined /> {mediaUploading === 'cover-remove' ? t('common.loading') : t('profile.remove')}
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
              `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}`
            }
            icon={<UserOutlined />}
            className="profile-avatar-image"
          />
          <span className="profile-avatar-status" />
          <div className="profile-avatar-camera">
            {mediaUploading === 'avatar' ? t('common.loading') : <CameraOutlined />}
          </div>
        </div>

        <div className="profile-header-meta">
          <h2>{user.name || t('profile.account_name')}</h2>
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
  const { t, i18n } = useTranslation()
  const { user, updateUser, logout } = useAuth()
  const { applyAccentFast, applyThemeFull, applyThemeMode, commitPending, accentColor: savedAccentColor } = useTheme()
  const { settings: systemSettings } = useSystemSettings()
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  const navigate = useNavigate()
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
  const watchedEmail = Form.useWatch('email', form)
  const previewTheme = generateTheme(accentColor)

  const hasPassword = Boolean(user?.hasPassword || user?.password)
  const contactText = user?.email || user?.phone || t('profile.no_email')

  const goToOrders = () => {
    handleClose()
    navigate('/orders')
  }

  const handlePresetSelect = (hex: string) => {
    setAccentColor(hex)
    applyThemeFull(hex)
  }

  const handleAccentPreview = (hex: string) => {
    setAccentColor(hex)
    applyAccentFast(hex)
  }

  const handleAccentCommit = (hex = accentColor) => {
    setAccentColor(hex)
    applyThemeFull(hex)
  }

  const resolveThemePreference = (preference: 'system' | 'light' | 'dark' = 'system') => {
    if (preference === 'light' || preference === 'dark') return preference
    return systemSettings.general.defaultTheme === 'light' ? 'light' : 'dark'
  }

  const handleThemePreferenceChange = async (preference: 'system' | 'light' | 'dark') => {
    if (!user || loading) return
    const previousPreference = user.themePreference || 'system'
    applyThemeMode(resolveThemePreference(preference))
    updateUser({ ...user, themePreference: preference })

    const formData = new FormData()
    formData.append('themePreference', preference)

    setLoading(true)
    try {
      const { data } = await authService.updateProfile(formData)
      updateUser(data.user)
      message.success(t('profile.msg_theme_update_success'))
    } catch (err: any) {
      applyThemeMode(resolveThemePreference(previousPreference))
      updateUser({ ...user, themePreference: previousPreference })
      message.error(err.response?.data?.message || t('profile.msg_theme_update_failed'))
    } finally {
      setLoading(false)
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
      const { data } = await authService.updateProfile(formData)
      updateUser(data.user)
      setAvatarPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      message.success(t('profile.msg_avatar_update_success'))
    } catch (err: any) {
      setAvatarPreview(previousPreview)
      message.error(err.response?.data?.message || t('profile.msg_avatar_update_failed'))
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
      const { data } = await authService.updateProfile(formData)
      updateUser(data.user)
      setCoverPreview(null)
      setCoverRemoved(false)
      if (coverRef.current) coverRef.current.value = ''
      message.success(t('profile.msg_cover_update_success'))
    } catch (err: any) {
      setCoverPreview(previousPreview)
      setCoverRemoved(previousRemoved)
      message.error(err.response?.data?.message || t('profile.msg_cover_update_failed'))
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
      const { data } = await authService.updateProfile(formData)
      updateUser(data.user)
      setCoverPreview(null)
      setCoverRemoved(false)
      if (coverRef.current) coverRef.current.value = ''
      message.success(t('profile.msg_cover_update_success'))
    } catch (err: any) {
      setCoverPreview(previousPreview)
      setCoverRemoved(previousRemoved)
      message.error(err.response?.data?.message || t('profile.msg_cover_update_failed'))
    } finally {
      setMediaUploading(null)
    }
  }

  const handleClose = () => {
    commitPending()
    onClose()
  }

  useEffect(() => {
    if (!open || !user) return
    form.setFieldsValue({
      name: user.name,
      email: user.email || '',
      phone: user.phone || '',
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
  }, [open, user, form, passwordForm, addressForm])

  useEffect(() => {
    if (open) {
      setAccentColor(savedAccentColor)
    }
  }, [open, savedAccentColor])

  const profileThemeStyle = {
    '--profile-bg-layout': token.colorBgLayout,
    '--profile-bg-container': 'var(--theme-input-bg)',
    '--profile-bg-elevated': token.colorBgElevated,
    '--profile-text': token.colorText,
    '--profile-text-secondary': token.colorTextSecondary,
    '--profile-border': 'var(--theme-border-strong)',
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
      formData.append('name', values.name || '')
      if (values.email) formData.append('email', values.email)
      if (values.phone) formData.append('phone', values.phone)
      if (values.dateOfBirth) formData.append('dateOfBirth', values.dateOfBirth)
      const { data } = await authService.updateProfile(formData)
      updateUser(data.user)
      message.success(t('profile.msg_update_success'))
      handleClose()
    } catch (err: any) {
      message.error(err.response?.data?.message || t('profile.msg_update_failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSetPassword = async (values: any) => {
    if (values.newPassword !== values.confirm) {
      message.error(t('profile.msg_password_mismatch'))
      return
    }
    setLoading(true)
    try {
      await authService.setPassword({ newPassword: values.newPassword })
      message.success(t('profile.msg_set_password_success'))
      updateUser({ ...user!, hasPassword: true, password: 'set' })
      passwordForm.resetFields()
    } catch (err: any) {
      message.error(err.response?.data?.message || t('profile.msg_set_password_failed'))
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
        message.success(t('profile.msg_address_update_success'))
      } else {
        await createAddress({ ...values, isDefault: true })
        message.success(t('profile.msg_address_created'))
      }
      setAddressModalOpen(false)
      await loadAddresses()
    } catch (err: any) {
      console.error(err)
      message.error(err.response?.data?.message || t('profile.msg_address_save_failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAddress = async (addressId: string) => {
    setLoading(true)
    try {
      await deleteAddress(addressId)
      message.success(t('profile.msg_address_deleted'))
      await loadAddresses()
    } catch (err: any) {
      console.error(err)
      message.error(err.response?.data?.message || t('profile.msg_address_delete_failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSetDefault = async (addressId: string) => {
    setLoading(true)
    try {
      await setDefaultAddress(addressId)
      message.success(t('profile.msg_default_set'))
      await loadAddresses()
    } catch (err: any) {
      console.error(err)
      message.error(err.response?.data?.message || t('profile.msg_default_failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (values: any) => {
    if (values.newPassword !== values.confirm) {
      message.error(t('profile.msg_password_mismatch'))
      return
    }
    setLoading(true)
    try {
      await authService.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      message.success(t('profile.msg_change_password_success'))
      passwordForm.resetFields()
    } catch (err: any) {
      message.error(err.response?.data?.message || t('profile.msg_change_password_failed'))
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
    message.success(t('profile.msg_contact_copied'))
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
    { key: 'profile', label: t('profile.info'), icon: <UserOutlined /> },
    { key: 'address', label: t('profile.address'), icon: <EnvironmentOutlined /> },
    { key: 'password', label: hasPassword ? t('profile.change_password') : t('profile.set_password'), icon: <LockOutlined /> },
    { key: 'appearance', label: t('profile.appearance'), icon: <BgColorsOutlined /> },
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

  const renderActionItem = (
    icon: ReactNode,
    title: string,
    description: string,
    onClick: () => void,
    disabled = false,
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ ...actionItemStyle, opacity: disabled ? 0.65 : 1 }}
    >
      <div style={{ ...sectionIconStyle, width: 36, height: 36, fontSize: 16 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--theme-text)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--theme-muted)', marginTop: 2 }}>{description}</div>
      </div>
      <RightOutlined style={{ color: 'var(--theme-muted)', fontSize: 12 }} />
    </button>
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
        t={t}
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
                  {renderSectionHeader(<UserOutlined />, t('profile.info_title'), t('profile.info_subtitle'))}

                  <Form layout="vertical" form={form} onFinish={handleSave} className={profileFormClass}>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-[768px]:grid-cols-1">
                      <Form.Item label={t('profile.name')} name="name" rules={[{ required: true, message: t('profile.name_placeholder') }]}>
                        <Input prefix={<UserOutlined />} placeholder={t('profile.your_name')} style={profileInputStyle} />
                      </Form.Item>

                      <Form.Item label={t('profile.phone')} name="phone">
                        <Input prefix={<PhoneOutlined />} placeholder={t('profile.phone_placeholder')} style={profileInputStyle} />
                      </Form.Item>

                      <Form.Item
                        label="Email"
                        name="email"
                        rules={[
                          { type: 'email', message: t('profile.invalid_email') },
                          { required: !user.email, message: t('profile.email_placeholder') },
                        ]}
                      >
                        <Input disabled={!!user.email} suffix={user.email ? <LockOutlined /> : null} placeholder={user.email ? t('profile.email_placeholder') : t('profile.add_email_placeholder')} style={user.email ? profileDisabledInputStyle : profileInputStyle} />
                      </Form.Item>

                      <Form.Item label="Username">
                        <Input disabled suffix={<LockOutlined />} value={getUsernameFromEmail(watchedEmail || user.email)} style={profileDisabledInputStyle} />
                      </Form.Item>

                      <Form.Item label={t('profile.dob')} name="dateOfBirth" className="col-span-full">
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
                      {t('profile.save_changes')}
                    </Button>
                  </Form>
                </div>

                <div style={{ marginBottom: 12 }}>
                  {renderActionItem(<ShoppingCartOutlined />, t('profile.orders_title'), t('profile.orders_subtitle'), goToOrders)}
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
                    {t('profile.logout')}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div style={responsiveSectionCardStyle}>
                {renderSectionHeader(<BgColorsOutlined />, t('profile.appearance_title'), t('profile.appearance_subtitle'))}
                <div className="mb-6 border-b border-[var(--theme-border)] pb-5">
                  <div className="font-extrabold" style={{ color: token.colorText }}>{t('profile.personal_theme')}</div>
                  <div className="mt-[3px] text-[13px]" style={{ color: token.colorTextSecondary }}>
                    {t('profile.personal_theme_subtitle')}
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {([
                      { value: 'system', label: t('profile.theme_system') },
                      { value: 'light', label: t('profile.theme_light') },
                      { value: 'dark', label: t('profile.theme_dark') },
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
                            background: active ? 'var(--theme-accent-muted)' : 'var(--theme-elevated)',
                            borderColor: active ? 'var(--theme-accent)' : 'var(--theme-border-strong)',
                            color: active ? 'var(--theme-accent)' : 'var(--theme-text)',
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
                    <div className="font-extrabold" style={{ color: token.colorText }}>{t('profile.accent_color')}</div>
                    <div className="mt-[3px] text-[13px]" style={{ color: token.colorTextSecondary }}>
                      {t('profile.accent_subtitle')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {[
                      { label: t('profile.bg_mode'), color: previewTheme.bg },
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
                      aria-label={t('profile.choose_accent')}
                    />
                  </div>
                  <div className="font-semibold" style={{ color: token.colorText }}>{accentColor.toUpperCase()}</div>
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
                        borderColor: accentColor === item.color ? '#ffffff' : token.colorBorder,
                      }}
                      aria-label={t('profile.choose_color', { label: item.label })}
                      title={item.label}
                    />
                  ))}
                </div>

                <div className="mt-6 border-t border-[var(--theme-border)] pt-6">
                  <div className="font-extrabold" style={{ color: token.colorText }}>Ngôn ngữ / Language</div>
                  <div className="mt-[3px] text-[13px]" style={{ color: token.colorTextSecondary }}>
                    Chuyển đổi giữa Tiếng Việt và English
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() => i18n.changeLanguage('vi')}
                      title="Tiếng Việt"
                      style={{
                        background: i18n.language === 'vi' ? 'var(--theme-accent-muted)' : 'transparent',
                        border: i18n.language === 'vi' ? '1px solid var(--theme-accent)' : '1px solid var(--theme-border-strong)',
                        borderRadius: 10,
                        cursor: 'pointer',
                        padding: '8px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        opacity: i18n.language === 'vi' ? 1 : 0.5,
                        transition: 'all 0.2s',
                        fontWeight: i18n.language === 'vi' ? 600 : 400,
                        color: 'var(--theme-text)',
                      }}
                    >
                      <img src="https://flagcdn.com/16x12/vn.png" alt="" style={{ height: 16, width: 'auto', display: 'block' }} />
                      Tiếng Việt
                    </button>
                    <button
                      onClick={() => i18n.changeLanguage('en')}
                      title="English"
                      style={{
                        background: i18n.language === 'en' ? 'var(--theme-accent-muted)' : 'transparent',
                        border: i18n.language === 'en' ? '1px solid var(--theme-accent)' : '1px solid var(--theme-border-strong)',
                        borderRadius: 10,
                        cursor: 'pointer',
                        padding: '8px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        opacity: i18n.language === 'en' ? 1 : 0.5,
                        transition: 'all 0.2s',
                        fontWeight: i18n.language === 'en' ? 600 : 400,
                        color: 'var(--theme-text)',
                      }}
                    >
                      <img src="https://flagcdn.com/16x12/us.png" alt="" style={{ height: 16, width: 'auto', display: 'block' }} />
                      English
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'address' && (
              <div
                className={profileFormClass}
                style={responsiveSectionCardStyle}
              >
                {renderSectionHeader(<EnvironmentOutlined />, t('profile.address_title'), t('profile.address_subtitle'))}
                <div className="flex items-center justify-between gap-4 max-[768px]:flex-col max-[768px]:items-start">
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreateAddress} loading={loading} className="!rounded-lg !border-0 !bg-[var(--profile-accent)] !font-bold !text-[var(--theme-button-text)] hover:!bg-[var(--profile-accent-hover)]">
                    {t('profile.add_address')}
                  </Button>
                </div>

                <div className="mt-4">
                  {addresses.length === 0 ? (
                    <Empty description={t('profile.no_address')} />
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
                                {t('profile.default')}
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
                              title={t('profile.set_default')}
                              onClick={() => handleSetDefault(address._id)}
                            >
                              <StarOutlined />
                            </button>
                          )}
                          <button
                            className={addressActionButtonClass}
                            type="button"
                            title={t('profile.edit_address')}
                            onClick={() => openEditAddress(address)}
                          >
                            <EditOutlined />
                          </button>
                          <button
                            className={`${addressActionButtonClass} hover:!border-[var(--profile-accent-border)] hover:!bg-[var(--profile-accent-bg)] hover:!text-[var(--profile-accent)]`}
                            type="button"
                            title={t('profile.delete_address')}
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
                  title={editAddress ? t('profile.address_modal_edit') : t('profile.address_modal_create')}
                  open={addressModalOpen}
                  onCancel={() => setAddressModalOpen(false)}
                  footer={null}
                  destroyOnClose
                  className={addressEditModalClass}
                  style={profileThemeStyle}
                >
                  <Form form={addressForm} layout="vertical" onFinish={handleSaveAddress} initialValues={{ isDefault: false }} className={profileFormClass}>
                    <Form.Item name="fullName" label={t('profile.form_recipient')} rules={[{ required: true, message: t('profile.form_recipient_required') }]}>
                      <Input style={profileInputStyle} />
                    </Form.Item>
                    <Form.Item name="phone" label={t('profile.form_phone')} rules={[{ required: true, message: t('profile.form_phone_required') }, { pattern: /^0\d{9,10}$/, message: t('profile.form_phone_invalid') }]}>
                      <Input style={profileInputStyle} />
                    </Form.Item>
                    <Form.Item name="street" label={t('profile.form_street')} rules={[{ required: true, message: t('profile.form_street_required') }]}>
                      <Input style={profileInputStyle} />
                    </Form.Item>
                    <Form.Item name="ward" label={t('profile.form_ward')}>
                      <Input style={profileInputStyle} />
                    </Form.Item>
                    <Form.Item name="district" label={t('profile.form_district')} rules={[{ required: true, message: t('profile.form_district_required') }]}>
                      <Input style={profileInputStyle} />
                    </Form.Item>
                    <Form.Item name="city" label={t('profile.form_city')} rules={[{ required: true, message: t('profile.form_city_required') }]}>
                      <Input style={profileInputStyle} />
                    </Form.Item>
                    <Form.Item name="isDefault" valuePropName="checked">
                      <Checkbox>{t('profile.form_is_default')}</Checkbox>
                    </Form.Item>
                    <Form.Item>
                      <Space>
                        <Button type="primary" htmlType="submit" loading={loading}>{t('profile.form_save')}</Button>
                        <Button onClick={() => setAddressModalOpen(false)}>{t('profile.form_cancel')}</Button>
                      </Space>
                    </Form.Item>
                  </Form>
                </Modal>
              </div>
            )}

            {activeTab === 'password' && !hasPassword && (
              <div style={responsiveSectionCardStyle}>
                {renderSectionHeader(<LockOutlined />, t('profile.set_password_title'), t('profile.set_password_subtitle'))}

                <Form layout="vertical" form={passwordForm} onFinish={handleSetPassword} className={profileFormClass}>
                  <Form.Item label={t('profile.new_password')} name="newPassword" rules={[{ required: true, message: t('profile.new_password_placeholder') }]}>
                    <Input.Password placeholder={t('profile.new_password_hint')} style={profilePasswordInputStyle} />
                  </Form.Item>

                  <Form.Item label={t('profile.confirm_password')} name="confirm" rules={[{ required: true, message: t('profile.confirm_password_placeholder') }]}>
                    <Input.Password placeholder={t('profile.confirm_password_hint')} style={profilePasswordInputStyle} />
                  </Form.Item>

                  <Button type="primary" htmlType="submit" block loading={loading} className={`${primaryButtonClass} !h-12 !rounded-2xl !text-[15px]`}>
                    {t('profile.set_password_btn')}
                  </Button>
                </Form>
              </div>
            )}

            {activeTab === 'password' && hasPassword && (
              <div style={responsiveSectionCardStyle}>
                {renderSectionHeader(<LockOutlined />, t('profile.change_password_title'), t('profile.change_password_subtitle'))}

                <Form layout="vertical" form={passwordForm} onFinish={handleChangePassword} className={profileFormClass}>
                  <Form.Item label={t('profile.current_password')} name="currentPassword" rules={[{ required: true, message: t('profile.current_password_placeholder') }]}>
                    <Input.Password placeholder={t('profile.current_password_hint')} style={profilePasswordInputStyle} />
                  </Form.Item>

                  <Form.Item label={t('profile.new_password_change')} name="newPassword" rules={[{ required: true, message: t('profile.new_password_change_placeholder') }]}>
                    <Input.Password placeholder={t('profile.new_password_hint')} style={profilePasswordInputStyle} />
                  </Form.Item>

                  <Form.Item label={t('profile.confirm_password_change')} name="confirm" rules={[{ required: true, message: t('profile.confirm_password_change_placeholder') }]}>
                    <Input.Password placeholder={t('profile.confirm_password_change_hint')} style={profilePasswordInputStyle} />
                  </Form.Item>

                  <Button type="primary" htmlType="submit" block loading={loading} className={`${primaryButtonClass} !h-12 !rounded-2xl !text-[15px]`}>
                    {t('profile.change_password_btn')}
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
      maskClosable
      destroyOnClose
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
