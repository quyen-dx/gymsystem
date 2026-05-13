import {
  CameraOutlined,
  BgColorsOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  LockOutlined,
  LogoutOutlined,
  PhoneOutlined,
  PlusOutlined,
  RightOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  StarFilled,
  StarOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Checkbox, Empty, Form, Grid, Input, Modal, Space, message, theme } from 'antd'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateTheme, PRESET_ACCENT_COLORS, useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../hook/useAuth'
import { createAddress, deleteAddress, getAddresses, setDefaultAddress, updateAddress } from '../../services/addressService'
import { authService } from '../../services/authService'

const getUsernameFromEmail = (email?: string | null) => {
  if (!email) return ''
  return email.includes('@') ? email.split('@')[0] : email
}

const profileModalClass =
  'max-w-[760px] max-[768px]:!m-0 max-[768px]:!w-[calc(100vw-16px)] max-[768px]:!max-w-none max-[768px]:!pb-0 [&_.ant-modal-content]:!overflow-hidden [&_.ant-modal-content]:!p-0 [&_.ant-modal-content]:!rounded-2xl [&_.ant-modal-content]:!border [&_.ant-modal-content]:!border-[var(--profile-border)] [&_.ant-modal-content]:!bg-[var(--profile-bg-elevated)] [&_.ant-modal-content]:!shadow-2xl [&_.ant-modal-close]:!right-3.5 [&_.ant-modal-close]:!top-3.5 [&_.ant-modal-close]:!text-[var(--profile-text-secondary)]'

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

const ProfileHeader = ({
  user,
  avatarPreview,
  fileRef,
  contactText,
  onCopyContact,
  onAvatarChange,
  isMobile,
}: {
  user: any
  avatarPreview: string | null
  fileRef: React.RefObject<HTMLInputElement | null>
  contactText: string
  onCopyContact: () => void
  onAvatarChange: (url: string) => void
  isMobile: boolean
}) => (
  <header className="profile-modal-header">
    <div className="profile-cover" />
    <div className="profile-header-content">
      <div className="profile-avatar-wrap cursor-pointer" onClick={() => fileRef.current?.click()}>
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
          <CameraOutlined />
        </div>
      </div>

      <div className="profile-header-meta">
        <h2>{user.name || 'Tài khoản GymSystem'}</h2>
        <button type="button" onClick={onCopyContact}>
          <span>{contactText}</span>
          {(user.email || user.phone) && <CopyOutlined />}
        </button>
        <div className="profile-header-badge">Member profile</div>
      </div>
    </div>
    <input
      ref={fileRef}
      type="file"
      hidden
      accept="image/*"
      onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) onAvatarChange(URL.createObjectURL(file))
      }}
    />
  </header>
)

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
}: {
  tabs: ProfileTabItem[]
  activeTab: ProfileTabKey
  onChange: (tab: ProfileTabKey) => void
}) => (
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

export default function AccountProfileModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { user, updateUser, logout } = useAuth()
  const { applyAccentFast, applyThemeFull, commitPending, accentColor: savedAccentColor } = useTheme()
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [addressForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('profile')
  const [addresses, setAddresses] = useState<any[]>([])
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [editAddress, setEditAddress] = useState<any>(null)
  const [accentColor, setAccentColor] = useState(savedAccentColor)
  const fileRef = useRef<HTMLInputElement>(null)
  const profileScrollRef = useRef<HTMLDivElement>(null)
  const watchedEmail = Form.useWatch('email', form)
  const previewTheme = generateTheme(accentColor)

  const hasPassword = Boolean(user?.hasPassword || user?.password)
  const contactText = user?.email || user?.phone || 'Chưa cập nhật email'

  const goToOrders = () => {
    handleClose()
    navigate('/dashboard/member/orders')
  }

  const goToChannel = () => {
    if (!user?._id) return
    handleClose()
    navigate(`/channel/${user._id}`)
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

  const handleLogout = () => {
    logout()
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
    setActiveTab('profile')
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

  useEffect(() => {
    if (!open) return

    let frame = 0
    let touchStartY = 0
    const scrollY = window.scrollY
    const previousBodyPosition = document.body.style.position
    const previousBodyTop = document.body.style.top
    const previousBodyWidth = document.body.style.width
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow

    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    const updateProfileViewport = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const viewport = window.visualViewport
        const height = Math.floor(viewport?.height || window.innerHeight)
        const top = Math.max(8, Math.floor(viewport?.offsetTop || 0) + 8)

        document.documentElement.style.setProperty('--profile-visual-height', `${height}px`)
        document.documentElement.style.setProperty('--profile-visual-top', `${top}px`)
      })
    }

    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY || 0
    }

    const handleTouchMove = (event: TouchEvent) => {
      const scrollNode = profileScrollRef.current
      const target = event.target as Node | null

      if (!scrollNode || !target || !scrollNode.contains(target)) {
        const modalNode = document.querySelector('.profile-modal .ant-modal-content')
        const currentY = event.touches[0]?.clientY || 0
        const deltaY = currentY - touchStartY

        if (scrollNode && target && modalNode?.contains(target)) {
          scrollNode.scrollTop -= deltaY
          touchStartY = currentY
        }

        event.preventDefault()
        return
      }

      const currentY = event.touches[0]?.clientY || 0
      const deltaY = currentY - touchStartY
      const atTop = scrollNode.scrollTop <= 0
      const atBottom = scrollNode.scrollTop + scrollNode.clientHeight >= scrollNode.scrollHeight - 1
      const cannotScroll = scrollNode.scrollHeight <= scrollNode.clientHeight

      if (cannotScroll || (atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
        event.preventDefault()
      }
    }

    const handleWheel = (event: WheelEvent) => {
      const scrollNode = profileScrollRef.current
      const target = event.target as Node | null
      const modalNode = document.querySelector('.profile-modal .ant-modal-content')

      if (!scrollNode || !target) return

      if (scrollNode.contains(target)) {
        const atTop = scrollNode.scrollTop <= 0
        const atBottom = scrollNode.scrollTop + scrollNode.clientHeight >= scrollNode.scrollHeight - 1

        if ((atTop && event.deltaY < 0) || (atBottom && event.deltaY > 0)) {
          event.preventDefault()
        }
        return
      }

      if (modalNode?.contains(target)) {
        scrollNode.scrollTop += event.deltaY
        event.preventDefault()
        return
      }

      event.preventDefault()
    }

    updateProfileViewport()
    window.visualViewport?.addEventListener('resize', updateProfileViewport)
    window.visualViewport?.addEventListener('scroll', updateProfileViewport)
    window.addEventListener('resize', updateProfileViewport)
    window.addEventListener('orientationchange', updateProfileViewport)
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      cancelAnimationFrame(frame)
      window.visualViewport?.removeEventListener('resize', updateProfileViewport)
      window.visualViewport?.removeEventListener('scroll', updateProfileViewport)
      window.removeEventListener('resize', updateProfileViewport)
      window.removeEventListener('orientationchange', updateProfileViewport)
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('wheel', handleWheel)
      document.body.style.position = previousBodyPosition
      document.body.style.top = previousBodyTop
      document.body.style.width = previousBodyWidth
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      window.scrollTo(0, scrollY)
      document.documentElement.style.removeProperty('--profile-visual-height')
      document.documentElement.style.removeProperty('--profile-visual-top')
    }
  }, [open])

  if (!user) return null

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
      if (fileRef.current?.files?.[0]) {
        formData.append('avatar', fileRef.current.files[0])
      }
      const { data } = await authService.updateProfile(formData)
      updateUser(data.user)
      message.success('Cập nhật tài khoản thành công')
      handleClose()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Cập nhật thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleSetPassword = async (values: any) => {
    if (values.newPassword !== values.confirm) {
      message.error('Mật khẩu không khớp')
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

  const handleEnableSeller = async () => {
    setLoading(true)
    try {
      const { data } = await authService.enableSellerMode()
      updateUser(data.user)
      message.success('Đã bật chế độ bán hàng')
      handleClose()
      window.location.href = '/dashboard/seller/products'
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Bật bán hàng thất bại')
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
        message.success('Đã thêm địa chỉ mới')
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
      message.success('Đã đặt địa chỉ mặc định')
      await loadAddresses()
    } catch (err: any) {
      console.error(err)
      message.error(err.response?.data?.message || 'Không thể đặt mặc định')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (values: any) => {
    if (values.newPassword !== values.confirm) {
      message.error('Mật khẩu không khớp')
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

  const handleCopyContact = async () => {
    if (!user?.email && !user?.phone) return
    await navigator.clipboard?.writeText(user.email || user.phone || '')
    message.success('Đã sao chép thông tin liên hệ')
  }

  const isProfileMobile = !screens.md
  const isProfileDesktop = Boolean(screens.lg)
  const isProfileCompact = !isProfileDesktop
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

  return (
    <Modal
      title={null}
      open={open}
      onCancel={handleClose}
      footer={null}
      maskClosable
      destroyOnClose
      width={isProfileDesktop ? 760 : isProfileMobile ? 'calc(100vw - 16px)' : 680}
      className={`profile-modal ${profileModalClass}`}
      wrapClassName={profileModalWrapClass}
      style={{
        ...profileThemeStyle,
        top: 20,
        margin: isProfileMobile ? 0 : 'auto',
        padding: 0,
        maxWidth: '100vw',
      }}
      styles={{
        content: {
          borderRadius: 16,
          padding: 0,
          height: isProfileCompact && !isProfileMobile ? '82vh' : undefined,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--theme-border)',
        },
        body: {
          padding: 0,
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
        mask: {
          backdropFilter: 'blur(4px)',
        },
      } as any}
    >
      <div
        style={{
          ...profileThemeStyle,
          color: token.colorText,
          overflowX: 'hidden',
          width: '100%',
          maxWidth: '100%',
          height: isProfileCompact ? '100%' : 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <ProfileHeader
          user={user}
          avatarPreview={avatarPreview}
          fileRef={fileRef}
          contactText={contactText}
          onCopyContact={handleCopyContact}
          onAvatarChange={setAvatarPreview}
          isMobile={isProfileCompact}
        />

        <div className="profile-modal-main min-h-0 flex-1">
          <SidebarTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          <MobileMenuGrid tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

          <div
            ref={profileScrollRef}
            className="profile-modal-scroll min-h-0 flex-1 overflow-y-auto"
            style={{
              maxHeight: isProfileCompact ? undefined : '70vh',
              padding: isProfileMobile ? '14px 14px 16px' : '16px 20px',
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--theme-border) transparent',
              overflowX: 'hidden',
              width: '100%',
              maxWidth: '100%',
            }}
          >
          <TabContent activeTab={activeTab}>
          {activeTab === 'profile' && (
            <div>
              <div style={sectionCardStyle}>
                {renderSectionHeader(<UserOutlined />, 'Thông tin tài khoản', 'Cập nhật hồ sơ cá nhân để sử dụng GymSystem thuận tiện hơn.')}

                <Form layout="vertical" form={form} onFinish={handleSave} className={profileFormClass}>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-[768px]:grid-cols-1">
                    <Form.Item label="Tên tài khoản" name="name" rules={[{ required: true, message: 'Nhập tên' }]}>
                      <Input prefix={<UserOutlined />} placeholder="Tên của bạn" style={profileInputStyle} />
                    </Form.Item>

                    <Form.Item label="Số điện thoại" name="phone">
                      <Input prefix={<PhoneOutlined />} placeholder="Thêm số điện thoại" style={profileInputStyle} />
                    </Form.Item>

                    <Form.Item
                      label="Email"
                      name="email"
                      rules={[
                        { type: 'email', message: 'Email không hợp lệ' },
                        { required: !user.email, message: 'Nhập email' },
                      ]}
                    >
                      <Input disabled={!!user.email} suffix={user.email ? <LockOutlined /> : null} placeholder="Thêm email" style={user.email ? profileDisabledInputStyle : profileInputStyle} />
                    </Form.Item>

                    <Form.Item label="Username">
                      <Input disabled suffix={<LockOutlined />} value={getUsernameFromEmail(watchedEmail || user.email)} style={profileDisabledInputStyle} />
                    </Form.Item>

                    <Form.Item label="Ngày sinh" name="dateOfBirth" className="col-span-full">
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
                    Lưu thay đổi
                  </Button>
                </Form>
              </div>

              <div style={{ marginBottom: 12 }}>
                {user.role !== 'seller' && (
                  renderActionItem(<ShopOutlined />, 'Bật chế độ bán hàng', 'Mở kênh bán sản phẩm và quản lý shop.', handleEnableSeller, loading)
                )}

                {renderActionItem(<ShoppingCartOutlined />, 'Các đơn hàng', 'Theo dõi lịch sử mua hàng và trạng thái giao hàng.', goToOrders)}
                {renderActionItem(<UserOutlined />, 'Xem kênh', 'Xem trang cá nhân và nội dung đã chia sẻ.', goToChannel)}

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
                  Đăng xuất
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div style={sectionCardStyle}>
              {renderSectionHeader(<BgColorsOutlined />, 'Giao diện', 'Tuỳ chỉnh màu sắc theo sở thích.')}
              <div className="flex items-start justify-between gap-4 max-[560px]:flex-col">
                <div>
                  <div className="font-extrabold" style={{ color: token.colorText }}>Màu chủ đạo</div>
                  <div className="mt-[3px] text-[13px]" style={{ color: token.colorTextSecondary }}>
                    Tuỳ chỉnh màu sắc theo sở thích
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
                    aria-label="Chọn màu chủ đạo"
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
                    aria-label={`Chọn màu ${item.label}`}
                    title={item.label}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'address' && (
            <div
              className={profileFormClass}
              style={sectionCardStyle}
            >
              {renderSectionHeader(<EnvironmentOutlined />, 'Địa chỉ giao hàng', 'Thêm, sửa, xóa và đặt mặc định địa chỉ.')}
              <div className="flex items-center justify-between gap-4 max-[768px]:flex-col max-[768px]:items-start">
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateAddress} loading={loading} className="!rounded-lg !border-0 !bg-[var(--profile-accent)] !font-bold !text-[var(--theme-button-text)] hover:!bg-[var(--profile-accent-hover)]">
                  Thêm địa chỉ
                </Button>
              </div>

              <div className="mt-4">
                {addresses.length === 0 ? (
                  <Empty description="Chưa có địa chỉ giao hàng" />
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
                              Mặc định
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
                            title="Đặt mặc định"
                            onClick={() => handleSetDefault(address._id)}
                          >
                            <StarOutlined />
                          </button>
                        )}
                        <button
                          className={addressActionButtonClass}
                          type="button"
                          title="Sửa địa chỉ"
                          onClick={() => openEditAddress(address)}
                        >
                          <EditOutlined />
                        </button>
                        <button
                          className={`${addressActionButtonClass} hover:!border-[var(--profile-accent-border)] hover:!bg-[var(--profile-accent-bg)] hover:!text-[var(--profile-accent)]`}
                          type="button"
                          title="Xóa địa chỉ"
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
                title={editAddress ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}
                open={addressModalOpen}
                onCancel={() => setAddressModalOpen(false)}
                footer={null}
                destroyOnClose
                className={addressEditModalClass}
                style={profileThemeStyle}
              >
                <Form form={addressForm} layout="vertical" onFinish={handleSaveAddress} initialValues={{ isDefault: false }} className={profileFormClass}>
                  <Form.Item name="fullName" label="Tên người nhận" rules={[{ required: true, message: 'Vui lòng nhập tên người nhận' }]}>
                    <Input style={profileInputStyle} />
                  </Form.Item>
                  <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }, { pattern: /^0\d{9,10}$/, message: 'Số điện thoại không hợp lệ' }]}>
                    <Input style={profileInputStyle} />
                  </Form.Item>
                  <Form.Item name="street" label="Địa chỉ cụ thể" rules={[{ required: true, message: 'Vui lòng nhập địa chỉ cụ thể' }]}>
                    <Input style={profileInputStyle} />
                  </Form.Item>
                  <Form.Item name="ward" label="Phường / xã">
                    <Input style={profileInputStyle} />
                  </Form.Item>
                  <Form.Item name="district" label="Quận / huyện" rules={[{ required: true, message: 'Vui lòng nhập quận/huyện' }]}>
                    <Input style={profileInputStyle} />
                  </Form.Item>
                  <Form.Item name="city" label="Tỉnh / thành phố" rules={[{ required: true, message: 'Vui lòng nhập tỉnh/thành phố' }]}>
                    <Input style={profileInputStyle} />
                  </Form.Item>
                  <Form.Item name="isDefault" valuePropName="checked">
                    <Checkbox>Đặt mặc định</Checkbox>
                  </Form.Item>
                  <Form.Item>
                    <Space>
                      <Button type="primary" htmlType="submit" loading={loading}>Lưu</Button>
                      <Button onClick={() => setAddressModalOpen(false)}>Hủy</Button>
                    </Space>
                  </Form.Item>
                </Form>
              </Modal>
            </div>
          )}

          {activeTab === 'password' && !hasPassword && (
            <div style={sectionCardStyle}>
              {renderSectionHeader(<LockOutlined />, 'Đặt mật khẩu', 'Tạo mật khẩu riêng để đăng nhập bằng số điện thoại hoặc email.')}

              <Form layout="vertical" form={passwordForm} onFinish={handleSetPassword} className={profileFormClass}>
                <Form.Item label="Mật khẩu mới" name="newPassword" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
                  <Input.Password placeholder="Tối thiểu 6 ký tự" style={profilePasswordInputStyle} />
                </Form.Item>

                <Form.Item label="Xác nhận mật khẩu" name="confirm" rules={[{ required: true, message: 'Xác nhận mật khẩu' }]}>
                  <Input.Password placeholder="Nhập lại mật khẩu" style={profilePasswordInputStyle} />
                </Form.Item>

                <Button type="primary" htmlType="submit" block loading={loading} className={`${primaryButtonClass} !h-12 !rounded-2xl !text-[15px]`}>
                  Đặt mật khẩu
                </Button>
              </Form>
            </div>
          )}

          {activeTab === 'password' && hasPassword && (
            <div style={sectionCardStyle}>
              {renderSectionHeader(<LockOutlined />, 'Đổi mật khẩu', 'Cập nhật mật khẩu định kỳ để bảo vệ tài khoản.')}

              <Form layout="vertical" form={passwordForm} onFinish={handleChangePassword} className={profileFormClass}>
                <Form.Item label="Mật khẩu hiện tại" name="currentPassword" rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}>
                  <Input.Password placeholder="Nhập mật khẩu hiện tại" style={profilePasswordInputStyle} />
                </Form.Item>

                <Form.Item label="Mật khẩu mới" name="newPassword" rules={[{ required: true, message: 'Nhập mật khẩu mới' }]}>
                  <Input.Password placeholder="Tối thiểu 6 ký tự" style={profilePasswordInputStyle} />
                </Form.Item>

                <Form.Item label="Xác nhận mật khẩu" name="confirm" rules={[{ required: true, message: 'Xác nhận mật khẩu' }]}>
                  <Input.Password placeholder="Nhập lại mật khẩu mới" style={profilePasswordInputStyle} />
                </Form.Item>

                <Button type="primary" htmlType="submit" block loading={loading} className={`${primaryButtonClass} !h-12 !rounded-2xl !text-[15px]`}>
                  Đổi mật khẩu
                </Button>
              </Form>
            </div>
          )}
          </TabContent>
        </div>
        </div>
      </div>
    </Modal>
  )
}
