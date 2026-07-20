import {
  BellOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  FileTextOutlined,
  GiftOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import {
  Button,
  Dropdown,
  Empty,
  Input,
  Select,
  Spin,
} from 'antd'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/vi'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { notificationService, type NotificationItem } from '../../services/notificationService'
import { socketService } from '../../services/socketService'
import { ptClassService } from '../../services/ptAssignmentService'
import { trainingClassService } from '../../services/trainingGroupService'

dayjs.extend(relativeTime)
dayjs.locale('vi')

const CATEGORIES = [
  { key: 'BOOKING_PT', label: 'Booking / PT', icon: <CalendarOutlined />, match: (t: string) => /PT|Booking|phụ trách|xếp lớp|lớp/i.test(t) },
  { key: 'SCHEDULE', label: 'Lịch tập', icon: <CheckCircleOutlined />, match: (t: string) => /lịch|buổi tập|schedule/i.test(t) },
  { key: 'WORKOUT', label: 'Giáo án', icon: <FileTextOutlined />, match: (t: string) => /giáo án|bài tập|workout/i.test(t) },
  { key: 'CHECKIN', label: 'Check-in', icon: <CheckCircleOutlined />, match: (t: string) => /check-in|checkin|điểm danh/i.test(t) },
  { key: 'MEMBERSHIP', label: 'Gói tập', icon: <GiftOutlined />, match: (t: string) => /gói tập|membership|gia hạn|hủy gói/i.test(t) },
  { key: 'PAYMENT', label: 'Thanh toán', icon: <CreditCardOutlined />, match: (t: string) => /thanh toán|payment|hóa đơn|invoice/i.test(t) },
  { key: 'REFUND', label: 'Hoàn tiền', icon: <RollbackOutlined />, match: (t: string) => /hoàn tiền|refund/i.test(t) },
  { key: 'SYSTEM', label: 'Hệ thống', icon: <SettingOutlined />, match: () => true },
]

function classify(item: NotificationItem): { key: string; label: string; icon: React.ReactNode } {
  if (item.category) {
    const cat = CATEGORIES.find(c => c.key === item.category)
    if (cat) return cat
  }
  for (const c of CATEGORIES) {
    if (c.match(item.title)) return c
  }
  return { key: 'SYSTEM', label: 'Hệ thống', icon: <SettingOutlined /> }
}

function formatTimeFull(dateStr: string) {
  const d = dayjs(dateStr)
  const now = dayjs()
  const diffDays = now.diff(d, 'day')
  if (diffDays === 0) return `Hôm nay • ${d.format('HH:mm')}`
  if (diffDays === 1) return `Hôm qua • ${d.format('HH:mm')}`
  return d.format('DD/MM/YYYY • HH:mm')
}

const unreadBadge = (count: number) =>
  count > 0 ? (
    <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full bg-[var(--theme-accent)] text-white text-[11px] font-bold px-1.5 leading-none">
      {count > 99 ? '99+' : count}
    </span>
  ) : null

type FilterStatus = 'all' | 'unread' | 'read'
type SortMode = 'newest' | 'oldest'

interface Props {
  role: 'admin' | 'pt' | 'member'
}

export default function NotificationCenter({ role: _role }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [classDetails, setClassDetails] = useState<Record<string, { name: string; status: string; daysOfWeek: number[]; startTime: string; endTime: string; floorName: string; zoneName: string; maxCapacity: number; currentCount: number }>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await notificationService.getMyNotifications()
      setNotifications(res.data?.data || [])
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    socketService.connect()
    const handler = (notification: NotificationItem) => {
      setNotifications((prev) => [notification, ...prev])
    }
    socketService.on('notification:new', handler)
    return () => { socketService.off('notification:new', handler) }
  }, [])

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id)
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)))
    } catch { /* ignore */ }
  }

  const handleMarkUnread = async (id: string) => {
    try {
      await notificationService.markAsUnread(id)
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: false, readAt: null } : n)))
    } catch { /* ignore */ }
  }

  const handleDelete = async (id: string) => {
    try {
      await notificationService.deleteNotification(id)
      setNotifications((prev) => prev.filter((n) => n._id !== id))
    } catch { /* ignore */ }
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })))
    } catch { /* ignore */ }
  }

  const filtered = useMemo(() => {
    let items = [...notifications]

    if (filterStatus === 'unread') items = items.filter((n) => !n.isRead)
    else if (filterStatus === 'read') items = items.filter((n) => n.isRead)

    if (filterCategory !== 'all') {
      items = items.filter((n) => classify(n).key === filterCategory)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      items = items.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
    }

    if (sortMode === 'newest') items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    else if (sortMode === 'oldest') items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    return items
  }, [notifications, filterStatus, filterCategory, search, sortMode])

  const totalCount = notifications.length
  const unreadCount = notifications.filter((n) => !n.isRead).length
  const todayCount = notifications.filter((n) => dayjs(n.createdAt).isSame(dayjs(), 'day')).length

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const n of notifications) {
      const key = classify(n).key
      counts[key] = (counts[key] || 0) + 1
    }
    return counts
  }, [notifications])

  // Fetch class details for PT_CLASS_REQUEST notifications
  useEffect(() => {
    const ptRequests = notifications.filter(n => n.notificationType === 'PT_CLASS_REQUEST' && n.relatedId)
    for (const n of ptRequests) {
      if (classDetails[n._id]) continue
      trainingClassService.getById(n.relatedId!).then((res) => {
        const c = res.data.class
        if (!c) return
        const floor = c.floorId as any
        const zone = c.zoneId as any
        setClassDetails(prev => ({
          ...prev,
          [n._id]: {
            name: c.name,
            status: c.status,
            daysOfWeek: c.daysOfWeek || [],
            startTime: c.startTime || '',
            endTime: c.endTime || '',
            floorName: floor?.name || '',
            zoneName: zone?.name || '',
            maxCapacity: zone?.maxCapacity || 0,
            currentCount: c.currentActiveCount || 0,
          },
        }))
      }).catch(() => {})
    }
  }, [notifications])

  const handleAcceptClass = async (item: NotificationItem) => {
    if (!item.relatedId) return
    setProcessingIds(prev => new Set(prev).add(item._id))
    try {
      await ptClassService.acceptClass(item.relatedId)
      await notificationService.markAsRead(item._id)
      // Update local state — không gọi load() để tránh flash
      setNotifications(prev => prev.map(n => n._id === item._id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      setClassDetails(prev => prev[item._id] ? { ...prev, [item._id]: { ...prev[item._id], status: 'active' } } : prev)
    } catch { /* ignore */ }
    setProcessingIds(prev => { const next = new Set(prev); next.delete(item._id); return next })
  }

  const handleDeclineClass = async (item: NotificationItem) => {
    if (!item.relatedId) return
    setProcessingIds(prev => new Set(prev).add(item._id))
    try {
      await ptClassService.declineClass(item.relatedId)
      await notificationService.markAsRead(item._id)
      setNotifications(prev => prev.map(n => n._id === item._id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      setClassDetails(prev => prev[item._id] ? { ...prev, [item._id]: { ...prev[item._id], status: 'waiting_pt' } } : prev)
    } catch { /* ignore */ }
    setProcessingIds(prev => { const next = new Set(prev); next.delete(item._id); return next })
  }

  // ──── RENDER CARD ────
  const renderCard = (item: NotificationItem) => {
    const cat = classify(item)
    const isUnread = !item.isRead

    // Custom card for PT_CLASS_REQUEST
    if (item.notificationType === 'PT_CLASS_REQUEST') {
      const detail = classDetails[item._id]
      const classProcessed = detail && detail.status !== 'waiting_accept'
      const action = classProcessed ? 'done' : (item.isRead ? 'read' : 'pending')
      const isLoading = processingIds.has(item._id)
      const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
      const daysStr = detail?.daysOfWeek.map(d => DAY_LABELS[d]).filter(Boolean).join(', ') || ''

      return (
        <div key={item._id} className="group relative flex gap-3.5 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 transition-all">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-[var(--gs-text)]">Bạn được mời phụ trách lớp</h3>
            {detail ? (
              <div className="mt-3 space-y-1.5 text-xs text-[var(--gs-text-muted)]">
                <p><strong className="text-[var(--gs-text)]">{detail.name}</strong></p>
                <p>{daysStr} | {detail.startTime?.slice(0, 5)} - {detail.endTime?.slice(0, 5)}</p>
                <p>{(detail.floorName || detail.zoneName) && `${detail.floorName} - ${detail.zoneName}`}</p>
                <p>Sức chứa: {detail.currentCount} / {detail.maxCapacity || '∞'}</p>
              </div>
            ) : (
              <div className="mt-2 text-xs text-[var(--gs-text-muted)]">Đang tải thông tin lớp...</div>
            )}
            <div className="mt-4 flex gap-2">
              {isLoading ? (
                <span className="text-xs text-[var(--gs-text-muted)] self-center">Đang xử lý...</span>
              ) : action === 'pending' ? (
                <>
                  <Button size="small" danger onClick={(e) => { e.stopPropagation(); handleDeclineClass(item) }}>
                    Từ chối
                  </Button>
                  <Button size="small" type="primary" onClick={(e) => { e.stopPropagation(); handleAcceptClass(item) }}>
                    Chấp nhận
                  </Button>
                </>
              ) : (
                <span className="text-xs text-[var(--gs-text-muted)] self-center">Đã xử lý</span>
              )}
            </div>
          </div>
          <span className="text-[11px] text-[var(--gs-text-muted)] shrink-0 self-start">{formatTimeFull(item.createdAt)}</span>
        </div>
      )
    }

    const menuItems = [
      ...(!item.isRead
        ? [{ key: 'read', icon: <CheckOutlined />, label: 'Đánh dấu đã đọc', onClick: () => handleMarkRead(item._id) }]
        : [{ key: 'unread', icon: <ReloadOutlined />, label: 'Đánh dấu chưa đọc', onClick: () => handleMarkUnread(item._id) }]),
      { key: 'delete', icon: <DeleteOutlined />, label: 'Xóa thông báo', danger: true, onClick: () => handleDelete(item._id) },
    ]

    return (
      <div
        key={item._id}
        className={`group relative flex gap-3.5 rounded-xl border p-3.5 cursor-pointer transition-all duration-300
          max-sm:p-4 max-sm:gap-4 max-sm:rounded-2xl
          ${isUnread
            ? 'border-l-[3px] border-l-[var(--theme-accent)] border-y-[var(--gs-border)] border-r-[var(--gs-border)] bg-[var(--gs-card)] shadow-sm'
            : 'border-[var(--gs-border)] bg-[var(--gs-card)]/80'
          }
          ${isUnread ? 'hover:border-l-[var(--theme-accent)] hover:bg-[var(--gs-card)]/90' : ''}
        `}
        onClick={() => { if (isUnread) handleMarkRead(item._id) }}
      >
        {/* Unread dot */}
        {isUnread && (
          <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[var(--theme-accent)] shadow-[0_0_6px_var(--theme-accent)]" />
        )}

        {/* Icon */}
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-300 max-sm:h-11 max-sm:w-11
          ${isUnread ? 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]' : 'bg-[var(--gs-border)]/40 text-[var(--gs-text-muted)] opacity-70'}
        `}>
          {cat.icon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className={`leading-snug transition-colors duration-300 max-sm:text-[15px]
                ${isUnread ? 'text-sm font-semibold text-[var(--gs-text)]' : 'text-sm font-normal text-[var(--gs-text)]/55'}
              `}>
                {item.title}
              </h3>
              <p className={`mt-1 whitespace-pre-wrap leading-relaxed line-clamp-2 transition-colors duration-300 max-sm:text-[14px]
                ${isUnread ? 'text-xs text-[var(--gs-text-muted)]' : 'text-xs text-[var(--gs-text-muted)]/50'}
              `}>
                {item.content}
              </p>
            </div>

            {/* Hover action button — only on unread */}
            {isUnread && (
              <button
                type="button"
                className="hidden group-hover:inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--theme-accent)]/10 px-2.5 py-1.5 text-[11px] font-medium text-[var(--theme-accent)] transition-all hover:bg-[var(--theme-accent)]/20
                  max-sm:px-3 max-sm:py-2 max-sm:text-xs"
                onClick={(e) => { e.stopPropagation(); handleMarkRead(item._id) }}
              >
                <CheckOutlined style={{ fontSize: 11 }} /> Đánh dấu đã đọc
              </button>
            )}
          </div>

          {/* Footer row: category + time + unread badge + menu */}
          <div className="mt-2 flex items-center gap-2 max-sm:mt-2.5">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight transition-colors duration-300
              ${isUnread ? 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]' : 'bg-[var(--gs-border)]/30 text-[var(--gs-text-muted)]/50'}
              max-sm:px-2.5 max-sm:py-1 max-sm:text-[11px]
            `}>
              {cat.label}
            </span>
            <span className={`text-[11px] whitespace-nowrap transition-colors duration-300 max-sm:text-[12px]
              ${isUnread ? 'text-[var(--gs-text-muted)]' : 'text-[var(--gs-text-muted)]/50'}
            `}>
              {formatTimeFull(item.createdAt)}
            </span>
            {isUnread && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--theme-accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--theme-accent)] max-sm:text-[11px]">
                UNREAD
              </span>
            )}

            <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
              <Button
                type="text"
                size="small"
                icon={<EllipsisOutlined style={{ fontSize: 16 }} />}
                className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
                style={{ color: 'var(--gs-text-muted)' }}
              />
            </Dropdown>
          </div>
        </div>
      </div>
    )
  }

  // ──── SIDEBAR (Desktop) ────
  const sidebar = (
    <div className="flex h-full flex-col gap-5">
      {/* Tổng quan */}
      <div className="rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-bg-subtle)] p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--gs-text-muted)]">Tổng quan</p>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5 text-sm text-[var(--gs-text)]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--gs-border)]/30">
              <InfoCircleOutlined className="text-[var(--gs-text-muted)]" style={{ fontSize: 13 }} />
            </span>
            <span className="tabular-nums font-semibold">{totalCount}</span>
            <span className="text-[var(--gs-text-muted)]">Tổng thông báo</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-[var(--gs-text)]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--gs-border)]/30">
              <span className="h-2 w-2 rounded-full bg-[var(--theme-accent)]" />
            </span>
            <span className="tabular-nums font-semibold text-[var(--theme-accent)]">{unreadCount}</span>
            <span className="text-[var(--gs-text-muted)]">Chưa đọc</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-[var(--gs-text)]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--gs-border)]/30">
              <ClockCircleOutlined className="text-[var(--gs-text-muted)]" style={{ fontSize: 13 }} />
            </span>
            <span className="tabular-nums font-semibold">{todayCount}</span>
            <span className="text-[var(--gs-text-muted)]">Hôm nay</span>
          </div>
        </div>
      </div>

      {/* Trạng thái */}
      <div>
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--gs-text-muted)]">Trạng thái</p>
        <div className="flex flex-col gap-1">
          {([
            { key: 'all', label: 'Tất cả' },
            { key: 'unread', label: 'Chưa đọc' },
            { key: 'read', label: 'Đã đọc' },
          ] as { key: FilterStatus; label: string }[]).map((f) => (
            <button
              key={f.key}
              type="button"
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors
                ${filterStatus === f.key ? 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] font-semibold' : 'text-[var(--gs-text-muted)] hover:text-[var(--gs-text)] hover:bg-[var(--gs-border)]/30'}
              `}
              onClick={() => setFilterStatus(f.key)}
            >
              {f.label}
              {f.key === 'unread' && unreadCount > 0 && (
                <span className="ml-auto">{unreadBadge(unreadCount)}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Danh mục */}
      <div>
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--gs-text-muted)]">Danh mục</p>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors
              ${filterCategory === 'all' ? 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] font-semibold' : 'text-[var(--gs-text-muted)] hover:text-[var(--gs-text)] hover:bg-[var(--gs-border)]/30'}
            `}
            onClick={() => setFilterCategory('all')}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--gs-border)]/30">
              <InfoCircleOutlined style={{ fontSize: 12 }} />
            </span>
            Tất cả danh mục
          </button>
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.key] || 0
            const unreadInCat = notifications.filter((n) => !n.isRead && classify(n).key === cat.key).length
            return (
              <button
                key={cat.key}
                type="button"
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors
                  ${filterCategory === cat.key ? 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] font-semibold' : count === 0 ? 'text-[var(--gs-text-muted)]/30' : 'text-[var(--gs-text-muted)] hover:text-[var(--gs-text)] hover:bg-[var(--gs-border)]/30'}
                `}
                onClick={() => setFilterCategory(cat.key)}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs
                  ${filterCategory === cat.key ? 'bg-[var(--theme-accent)]/15 text-[var(--theme-accent)]' : 'bg-[var(--gs-border)]/30'}
                  ${count === 0 ? 'opacity-30' : ''}
                `}>
                  {cat.icon}
                </span>
                {cat.label}
                {unreadInCat > 0 && (
                  <span className="ml-auto">{unreadBadge(unreadInCat)}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  const sortOptions: { value: SortMode; label: string }[] = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'oldest', label: 'Cũ nhất' },
  ]

  return (
    <div className="flex min-h-[600px] gap-6 max-lg:flex-col">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-[280px] shrink-0 flex-col rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
        {sidebar}
      </aside>

      {/* Sidebar - Mobile filter chips */}
      <div className="flex lg:hidden flex-col gap-3">
        <button
          type="button"
          className="flex items-center gap-2 self-start rounded-full border border-[var(--gs-border)] bg-[var(--gs-card)] px-4 py-2 text-xs font-medium text-[var(--gs-text-muted)] transition-colors hover:text-[var(--gs-text)]"
          onClick={() => setShowMobileFilters(!showMobileFilters)}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--theme-accent)]" /> Bộ lọc
          {unreadCount > 0 && <span className="ml-1 text-[var(--theme-accent)]">({unreadCount})</span>}
        </button>

        {showMobileFilters && (
          <>
            {/* Trạng thái chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {([
                { key: 'all', label: 'Tất cả' },
                { key: 'unread', label: `Chưa đọc ${unreadCount > 0 ? `(${unreadCount})` : ''}` },
                { key: 'read', label: 'Đã đọc' },
              ] as { key: string; label: string }[]).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors whitespace-nowrap
                    ${(tab.key === filterStatus || (tab.key === 'all' && filterStatus === 'all'))
                      ? 'bg-[var(--theme-accent)] text-white'
                      : 'bg-[var(--gs-border)]/30 text-[var(--gs-text-muted)] hover:text-[var(--gs-text)]'
                    }`}
                  onClick={() => setFilterStatus(tab.key as FilterStatus)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Danh mục chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors whitespace-nowrap
                  ${filterCategory === 'all'
                    ? 'bg-[var(--theme-accent)] text-white'
                    : 'bg-[var(--gs-border)]/30 text-[var(--gs-text-muted)] hover:text-[var(--gs-text)]'
                  }`}
                onClick={() => setFilterCategory('all')}
              >
                Tất cả danh mục
              </button>
              {CATEGORIES.map((cat) => {
                const count = categoryCounts[cat.key] || 0
                return (
                  <button
                    key={cat.key}
                    type="button"
                    className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors whitespace-nowrap
                      ${filterCategory === cat.key
                        ? 'bg-[var(--theme-accent)] text-white'
                        : count === 0 ? 'bg-[var(--gs-border)]/10 text-[var(--gs-text-muted)]/30' : 'bg-[var(--gs-border)]/30 text-[var(--gs-text-muted)] hover:text-[var(--gs-text)]'
                      }`}
                    onClick={() => setFilterCategory(cat.key)}
                  >
                    {cat.label}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-3 max-sm:flex-col max-sm:items-stretch">
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--gs-text-muted)' }} />}
            placeholder="Tìm kiếm thông báo..."
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] max-sm:flex-none"
            style={{ borderRadius: 12, borderColor: 'var(--gs-border)' }}
          />
          <div className="flex items-center gap-3 max-sm:justify-between">
            <Select
              value={sortMode}
              onChange={setSortMode}
              options={sortOptions}
              style={{ minWidth: 140, borderRadius: 12 }}
            />
            <Button
              icon={<CheckOutlined />}
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="whitespace-nowrap"
              style={{ borderRadius: 12 }}
            >
              Đánh dấu tất cả đã đọc
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center"><Spin size="large" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-10 text-center">
            <BellOutlined style={{ fontSize: 48, color: 'var(--gs-text-soft)', marginBottom: 16 }} />
            <h3 className="text-lg font-semibold text-[var(--gs-text)]">Bạn chưa có thông báo nào</h3>
            <p className="mt-2 max-w-sm text-sm text-[var(--gs-text-muted)]">
              Các cập nhật về Booking, PT, Giáo án, Thanh toán và Gói tập sẽ xuất hiện tại đây.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 max-sm:gap-3" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', paddingRight: 4 }}>
            {filtered.map(renderCard)}
          </div>
        )}
      </div>
    </div>
  )
}
