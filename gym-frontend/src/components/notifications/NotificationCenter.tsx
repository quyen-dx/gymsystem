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
  RightOutlined,
  RollbackOutlined,
  SearchOutlined,
  SettingOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  Button,
  Dropdown,
  Input,
  message,
  Modal,
  Select,
  Spin,
  Tag,
} from 'antd'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/vi'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationService, type NotificationItem } from '../../services/notificationService'
import { socketService } from '../../services/socketService'
import { ptClassService } from '../../services/ptAssignmentService'
import { shiftChangeService } from '../../services/shiftChangeService'
import { trainingClassService } from '../../services/trainingGroupService'
import { trainingRequestService } from '../../services/trainingRequestService'

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

// Action Notification: có nút thao tác / bắt buộc người dùng phản hồi
function isActionNotification(item: NotificationItem): boolean {
  return !!item.requiresAction || (Array.isArray(item.actions) && item.actions.length > 0)
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
  role: 'admin' | 'super_admin' | 'pt' | 'member' | 'staff'
}

const STAFF_ROLES = ['super_admin', 'admin', 'staff']

export default function NotificationCenter({ role }: Props) {
  const navigate = useNavigate()
  const isStaffRole = STAFF_ROLES.includes(role)
  const safeRedirect = (item: NotificationItem): string | null => {
    if (!item.redirectUrl) return null
    if (!isStaffRole && item.redirectUrl.startsWith('/admin')) return null
    return item.redirectUrl
  }
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [rejectModal, setRejectModal] = useState<{ open: boolean; item: NotificationItem | null }>({ open: false, item: null })
  const [rejectReason, setRejectReason] = useState('')
  const [shiftRejectModal, setShiftRejectModal] = useState<{ open: boolean; item: NotificationItem | null }>({ open: false, item: null })
  const [shiftRejectReason, setShiftRejectReason] = useState('')
  const [ptRequestStatuses, setPtRequestStatuses] = useState<Record<string, string>>({})
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

  // Đồng bộ realtime khi notification action được xử lý (mọi tab đều đổi ngay)
  useEffect(() => {
    socketService.connect()
    const updatedHandler = (updated: NotificationItem) => {
      setNotifications((prev) => prev.map((n) => (n._id === updated._id ? { ...n, ...updated } : n)))
    }
    socketService.on('notification:updated', updatedHandler)
    return () => { socketService.off('notification:updated', updatedHandler) }
  }, [])

  const handleMarkRead = async (id: string) => {
    // Optimistic update — UI updates immediately
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)))
    try {
      await notificationService.markAsRead(id)
    } catch {
      // Rollback on failure
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: false, readAt: null } : n)))
    }
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
      setNotifications((prev) => prev.map((n) => (
        isActionNotification(n) ? n : { ...n, isRead: true, readAt: new Date().toISOString() }
      )))
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

    // Action Notification (chưa phản hồi) luôn nằm trên đầu danh sách
    items.sort((a, b) => {
      const aPending = isActionNotification(a) && !a.isRead ? 0 : 1
      const bPending = isActionNotification(b) && !b.isRead ? 0 : 1
      return aPending - bPending
    })

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

  // Fetch request status for PT_REASSIGN_REQUEST notifications (đã phản hồi chưa)
  useEffect(() => {
    const reassignNotes = notifications.filter(n => n.notificationType === 'PT_REASSIGN_REQUEST' && n.receiverRole === 'member' && n.relatedId)
    for (const n of reassignNotes) {
      if (ptRequestStatuses[n._id]) continue
      trainingRequestService.getById(n.relatedId!).then((res) => {
        const s = res.data?.request?.status
        if (!s) return
        setPtRequestStatuses(prev => ({ ...prev, [n._id]: s }))
      }).catch(() => {})
    }
  }, [notifications])
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

  const handleRespondPtReassign = async (item: NotificationItem, action: 'accept' | 'reject') => {
    if (!item.relatedId) return
    setProcessingIds(prev => new Set(prev).add(item._id))
    try {
      await trainingRequestService.respond(item.relatedId, action)
      await notificationService.markAsRead(item._id)
      const actionStatus = action === 'accept' ? 'accepted' : 'rejected'
      setNotifications(prev => prev.map(n => n._id === item._id ? { ...n, isRead: true, readAt: new Date().toISOString(), actionStatus, actionAt: new Date().toISOString() } : n))
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      message.error(msg || 'Phản hồi thất bại, vui lòng thử lại')
    }
    setProcessingIds(prev => { const next = new Set(prev); next.delete(item._id); return next })
  }

  // PT phản hồi việc được phân công hội viên PT 1-1 (MEMBER_ASSIGNED)
  const handleRespondPtAssign = async (item: NotificationItem, action: 'accept' | 'reject', reason?: string) => {
    if (!item.relatedId) return
    setProcessingIds(prev => new Set(prev).add(item._id))
    try {
      await trainingRequestService.respondPtAssignment(item.relatedId, action, reason)
      const actionStatus = action === 'accept' ? 'accepted' : 'rejected'
      const content = action === 'accept'
        ? 'Bạn đã chấp nhận hội viên này.'
        : `Bạn đã từ chối nhận hội viên.${reason ? ` Lý do: ${reason}` : ''}`
      setNotifications(prev => prev.map(n => n._id === item._id ? { ...n, isRead: true, readAt: new Date().toISOString(), actionStatus, actionAt: new Date().toISOString(), requiresAction: false, content } : n))
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      message.error(msg || 'Phản hồi thất bại, vui lòng thử lại')
    }
    setProcessingIds(prev => { const next = new Set(prev); next.delete(item._id); return next })
  }

  // PT B phản hồi đề nghị nhận thay ca (SHIFT_CHANGE_ASSIGNED) — từ chối bắt buộc nhập lý do
  const handleRespondShiftChange = async (item: NotificationItem, action: 'accept' | 'reject', reason?: string) => {
    if (!item.relatedId) return
    setProcessingIds(prev => new Set(prev).add(item._id))
    try {
      await shiftChangeService.respond({ itemId: item.relatedId, action, reason: reason || undefined, notificationId: item._id })
      const actionStatus = action === 'accept' ? 'accepted' : 'rejected'
      setNotifications(prev => prev.map(n => n._id === item._id ? { ...n, isRead: true, readAt: new Date().toISOString(), actionStatus, actionAt: new Date().toISOString(), requiresAction: false } : n))
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      message.error(msg || 'Phản hồi thất bại')
    }
    setProcessingIds(prev => { const next = new Set(prev); next.delete(item._id); return next })
  }

  // ──── RENDER CARD ────
  const renderCard = (item: NotificationItem) => {
    const cat = classify(item)
    const isUnread = !item.isRead
    const isAction = isActionNotification(item)
    const pendingAction = isAction && isUnread

    // Custom card for PT_CLASS_REQUEST
    if (item.notificationType === 'PT_CLASS_REQUEST') {
      const detail = classDetails[item._id]
      const classProcessed = detail && detail.status !== 'waiting_accept'
      const action = classProcessed ? 'done' : (item.isRead ? 'read' : 'pending')
      const isLoading = processingIds.has(item._id)
      const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
      const daysStr = detail?.daysOfWeek.map(d => DAY_LABELS[d]).filter(Boolean).join(', ') || ''

      return (
        <div key={item._id} className="group relative flex gap-3.5 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 transition-all cursor-pointer"
          style={action === 'pending' ? { borderColor: 'var(--gs-danger)', boxShadow: '0 0 0 1px var(--gs-danger)' } : undefined}
          onClick={() => {
            if (!item.isRead) handleMarkRead(item._id)
          }}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {action === 'pending' && (
                <Tag color="error" className="m-0 !text-[10px] !leading-none !px-1.5 !py-0.5" icon={<WarningOutlined />}>
                  Cần phản hồi
                </Tag>
              )}
              <h3 className="text-sm font-semibold text-[var(--gs-text)]">Bạn được mời phụ trách lớp</h3>
            </div>
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

    // Custom card for member proposal response (đề xuất lớp/PT từ Admin)
    if (item.notificationType === 'PT_REASSIGN_REQUEST' && item.receiverRole === 'member') {
      const requestStatus = ptRequestStatuses[item._id]
      // Ưu tiên trạng thái action lưu trên notification (bền vững khi refresh).
      // Fallback cho dữ liệu cũ: dựa vào trạng thái request.
      const actionStatus = item.actionStatus
      // Request 'assigned' cũng nghĩa là hội viên đã đồng ý trước đó (legacy notification chưa có actionStatus)
      const isAccepted = actionStatus === 'accepted' || (!actionStatus && (requestStatus === 'waiting_assignment' || requestStatus === 'assigned'))
      const isCountered = actionStatus === 'countered' || (!actionStatus && requestStatus === 'pending')
      const isRejected = actionStatus === 'rejected' || (!actionStatus && requestStatus === 'declined_by_member')
      const isDone = isAccepted || isCountered || isRejected || !item.requiresAction
      const isLoading = processingIds.has(item._id)
      return (
        <div key={item._id} className="group relative flex gap-3.5 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 transition-all cursor-pointer"
          style={!isDone ? { borderColor: 'var(--gs-danger)', boxShadow: '0 0 0 1px var(--gs-danger)' } : undefined}
          onClick={() => { if (!item.isRead) handleMarkRead(item._id) }}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {!isDone && (
                <Tag color="error" className="m-0 !text-[10px] !leading-none !px-1.5 !py-0.5" icon={<WarningOutlined />}>
                  Cần phản hồi
                </Tag>
              )}
              <h3 className="text-sm font-semibold text-[var(--gs-text)]">{item.title || 'Đề xuất từ Admin'}</h3>
            </div>
            <p className="mt-2 whitespace-pre-line text-xs text-[var(--gs-text-muted)]">{item.content}</p>
            <div className="mt-4 flex gap-2">
              {isLoading ? (
                <span className="text-xs text-[var(--gs-text-muted)] self-center">Đang xử lý...</span>
              ) : isDone ? (
                <span className={`self-center text-xs font-semibold ${isAccepted ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                  {isAccepted ? '✓ Bạn đã đồng ý' : isRejected ? '✕ Bạn đã từ chối' : 'Bạn đã phản hồi'}
                </span>
              ) : (
                <>
                  <Button size="small" danger onClick={(e) => { e.stopPropagation(); handleRespondPtReassign(item, 'reject') }}>
                    Từ chối
                  </Button>
                  <Button size="small" type="primary" onClick={(e) => { e.stopPropagation(); handleRespondPtReassign(item, 'accept') }}>
                    Đồng ý
                  </Button>
                </>
              )}
            </div>
          </div>
          <span className="text-[11px] text-[var(--gs-text-muted)] shrink-0 self-start">{formatTimeFull(item.createdAt)}</span>
        </div>
      )
    }

    // Custom card for PT — được phân công hội viên PT 1-1 (Chấp nhận / Từ chối).
    // Chỉ render khi là action notification mới (requiresAction) hoặc đã có actionStatus (đã xử lý).
    if (item.notificationType === 'MEMBER_ASSIGNED' && item.receiverRole === 'pt' && (item.requiresAction || item.actionStatus)) {
      const actionStatus = item.actionStatus
      const isAccepted = actionStatus === 'accepted'
      const isRejected = actionStatus === 'rejected'
      const isDone = isAccepted || isRejected || !item.requiresAction
      const isLoading = processingIds.has(item._id)
      return (
        <div key={item._id} className="group relative flex gap-3.5 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 transition-all cursor-pointer"
          style={!isDone ? { borderColor: 'var(--gs-danger)', boxShadow: '0 0 0 1px var(--gs-danger)' } : undefined}
          onClick={() => { if (!item.isRead) handleMarkRead(item._id) }}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {!isDone && (
                <Tag color="error" className="m-0 !text-[10px] !leading-none !px-1.5 !py-0.5" icon={<WarningOutlined />}>
                  Cần phản hồi
                </Tag>
              )}
              <h3 className="text-sm font-semibold text-[var(--gs-text)]">{item.title || 'Bạn vừa được phân công hội viên mới'}</h3>
            </div>
            <p className="mt-2 whitespace-pre-line text-xs text-[var(--gs-text-muted)]">{item.content}</p>
            <div className="mt-4 flex gap-2">
              {isLoading ? (
                <span className="text-xs text-[var(--gs-text-muted)] self-center">Đang xử lý...</span>
              ) : isDone ? (
                <span className={`self-center text-xs font-semibold ${isAccepted ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                  {isAccepted ? '✓ Bạn đã chấp nhận hội viên này.' : isRejected ? '✕ Bạn đã từ chối' : 'Đã xử lý'}
                </span>
              ) : (
                <>
                  <Button size="small" danger onClick={(e) => { e.stopPropagation(); setRejectReason(''); setRejectModal({ open: true, item }) }}>
                    Từ chối
                  </Button>
                  <Button size="small" type="primary" onClick={(e) => { e.stopPropagation(); handleRespondPtAssign(item, 'accept') }}>
                    Chấp nhận
                  </Button>
                </>
              )}
            </div>
          </div>
          <span className="text-[11px] text-[var(--gs-text-muted)] shrink-0 self-start">{formatTimeFull(item.createdAt)}</span>
        </div>
      )
    }

    // Custom card — PT được đề nghị nhận thay ca (Chấp nhận / Từ chối kèm lý do)
    if (item.notificationType === 'SHIFT_CHANGE_ASSIGNED' && item.receiverRole === 'pt') {
      const actionStatus = item.actionStatus
      const isAccepted = actionStatus === 'accepted'
      const isRejected = actionStatus === 'rejected'
      const isDone = isAccepted || isRejected || !item.requiresAction
      const isLoading = processingIds.has(item._id)
      return (
        <div key={item._id} className="group relative flex gap-3.5 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 transition-all cursor-pointer"
          style={!isDone ? { borderColor: 'var(--gs-danger)', boxShadow: '0 0 0 1px var(--gs-danger)' } : undefined}
          onClick={() => { if (!item.isRead) handleMarkRead(item._id) }}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {!isDone && (
                <Tag color="error" className="m-0 !text-[10px] !leading-none !px-1.5 !py-0.5" icon={<WarningOutlined />}>
                  Cần phản hồi
                </Tag>
              )}
              <h3 className="text-sm font-semibold text-[var(--gs-text)]">{item.title || 'Bạn được đề nghị nhận thay ca'}</h3>
            </div>
            <p className="mt-2 whitespace-pre-line text-xs text-[var(--gs-text-muted)]">{item.content}</p>
            <div className="mt-4 flex gap-2">
              {isLoading ? (
                <span className="text-xs text-[var(--gs-text-muted)] self-center">Đang xử lý...</span>
              ) : isDone ? (
                <span className={`self-center text-xs font-semibold ${isAccepted ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                  {isAccepted ? '✓ Bạn đã chấp nhận nhận thay ca' : isRejected ? '✕ Bạn đã từ chối' : 'Đã xử lý'}
                </span>
              ) : (
                <>
                  <Button size="small" danger onClick={(e) => { e.stopPropagation(); setShiftRejectReason(''); setShiftRejectModal({ open: true, item }) }}>
                    Từ chối
                  </Button>
                  <Button size="small" type="primary" onClick={(e) => { e.stopPropagation(); handleRespondShiftChange(item, 'accept') }}>
                    Chấp nhận
                  </Button>
                </>
              )}
            </div>
          </div>
          <span className="text-[11px] text-[var(--gs-text-muted)] shrink-0 self-start">{formatTimeFull(item.createdAt)}</span>
        </div>
      )
    }

    // Custom card for admin ACTION_REQUIRED (có yêu cầu PT cần phân công) — chỉ dành cho admin/staff
    if (item.notificationType === 'ACTION_REQUIRED' && isStaffRole) {
      const isDone = !!item.isRead
      return (
        <div key={item._id} className="group relative flex gap-3.5 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 transition-all cursor-pointer"
          style={!isDone ? { borderColor: 'var(--gs-danger)', boxShadow: '0 0 0 1px var(--gs-danger)' } : undefined}
          onClick={() => { if (!item.isRead) handleMarkRead(item._id) }}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {!isDone && (
                <Tag color="error" className="m-0 !text-[10px] !leading-none !px-1.5 !py-0.5" icon={<WarningOutlined />}>
                  Cần phản hồi
                </Tag>
              )}
              <h3 className="text-sm font-semibold text-[var(--gs-text)]">{item.title || 'Có yêu cầu PT cần phân công'}</h3>
            </div>
            <p className="mt-2 whitespace-pre-line text-xs text-[var(--gs-text-muted)]">{item.content}</p>
            <div className="mt-4 flex gap-2">
              {isDone ? (
                <span className="text-xs text-[var(--gs-text-muted)] self-center">Đã xử lý</span>
              ) : (
                <Button size="small" type="primary" onClick={(e) => {
                  e.stopPropagation()
                  if (!item.isRead) handleMarkRead(item._id)
                  // Nút "Đi đến yêu cầu" chỉ dành cho admin/staff; role khác (member/pt) không điều hướng sang /admin/*
                  const base = isStaffRole ? (item.redirectUrl || '/admin/members?pt1on1=1&pt1on1Status=waiting_assignment') : safeRedirect(item)
                  if (base) navigate(`${base}${base.includes('?') ? '&' : '?'}ts=${Date.now()}`)
                }}>
                  Đi đến yêu cầu
                </Button>
              )}
            </div>
          </div>
          <span className="text-[11px] text-[var(--gs-text-muted)] shrink-0 self-start">{formatTimeFull(item.createdAt)}</span>
        </div>
      )
    }

    const menuItems = [
      ...(!item.isRead && !isAction
        ? [{ key: 'unread', icon: <RollbackOutlined />, label: 'Đánh dấu chưa đọc', onClick: () => handleMarkUnread(item._id), disabled: true }]
        : []),
      ...(item.isRead && !isAction
        ? [{ key: 'unread', icon: <ReloadOutlined />, label: 'Đánh dấu chưa đọc', onClick: () => handleMarkUnread(item._id) }]
        : []),
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
        style={pendingAction ? { borderColor: 'var(--gs-danger)', boxShadow: '0 0 0 1px var(--gs-danger)' } : undefined}
        onClick={() => {
          if (isUnread) handleMarkRead(item._id)
        }}
      >
        {/* Unread dot */}
        {isUnread && (
          <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[var(--theme-accent)] shadow-[0_0_6px_var(--theme-accent)]" />
        )}

        {/* Icon */}
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-300 max-sm:h-11 max-sm:w-11
          ${isUnread ? 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]' : 'bg-[var(--gs-border)]/40 text-[var(--gs-text-muted)] opacity-70'}
          ${pendingAction ? '!bg-[var(--gs-danger)]/10 !text-[var(--gs-danger)]' : ''}
        `}>
          {pendingAction || item.notificationType === 'PT_SERVICE_LEFT' ? <WarningOutlined /> : cat.icon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {pendingAction && (
                  <Tag color="error" className="m-0 !text-[10px] !leading-none !px-1.5 !py-0.5" icon={<WarningOutlined />}>
                    Cần phản hồi
                  </Tag>
                )}
                <h3 className={`leading-snug transition-colors duration-300 max-sm:text-[15px]
                  ${isUnread ? 'text-sm font-semibold text-[var(--gs-text)]' : 'text-sm font-normal text-[var(--gs-text)]/55'}
                `}>
                  {item.title}
                </h3>
              </div>
              <p className={`mt-1 whitespace-pre-wrap leading-relaxed line-clamp-2 transition-colors duration-300 max-sm:text-[14px]
                ${isUnread ? 'text-xs text-[var(--gs-text-muted)]' : 'text-xs text-[var(--gs-text-muted)]/50'}
              `}>
                {item.content}
              </p>
            </div>

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

            <span className="ml-auto flex items-center gap-1">
              {safeRedirect(item) && (
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-lg border border-[var(--theme-accent)]/30 px-2.5 py-1 text-[11px] font-medium text-[var(--theme-accent)] transition-all hover:bg-[var(--theme-accent)]/10 max-sm:px-3 max-sm:py-1.5 max-sm:text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(safeRedirect(item)!)
                  }}
                >
                  Đến trang <RightOutlined style={{ fontSize: 10 }} />
                </button>
              )}
              <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                <Button
                  type="text"
                  size="small"
                  icon={<EllipsisOutlined style={{ fontSize: 16 }} />}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: 'var(--gs-text-muted)' }}
                />
              </Dropdown>
            </span>
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

      {/* PT từ chối nhận hội viên — nhập lý do */}
      <Modal
        title="Từ chối nhận hội viên"
        open={rejectModal.open}
        onCancel={() => setRejectModal({ open: false, item: null })}
        onOk={() => {
          if (!rejectModal.item) return
          handleRespondPtAssign(rejectModal.item, 'reject', rejectReason.trim())
          setRejectModal({ open: false, item: null })
        }}
        okText="Gửi từ chối"
        cancelText="Hủy"
        okButtonProps={{ danger: true, disabled: rejectReason.trim().length === 0 }}
        width={480}
      >
        <p className="mb-3 text-sm text-[var(--gs-text-muted)]">Vui lòng nhập lý do từ chối phụ trách hội viên này. Admin sẽ chọn PT khác phù hợp hơn.</p>
        <Input.TextArea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="Nhập lý do từ chối..."
        />
      </Modal>

      {/* PT từ chối nhận thay ca — nhập lý do bắt buộc */}
      <Modal
        title="Từ chối nhận thay ca"
        open={shiftRejectModal.open}
        onCancel={() => setShiftRejectModal({ open: false, item: null })}
        onOk={() => {
          if (!shiftRejectModal.item) return
          handleRespondShiftChange(shiftRejectModal.item, 'reject', shiftRejectReason.trim())
          setShiftRejectModal({ open: false, item: null })
        }}
        okText="Gửi từ chối"
        cancelText="Hủy"
        okButtonProps={{ danger: true, disabled: shiftRejectReason.trim().length === 0 }}
        width={480}
      >
        <p className="mb-3 text-sm text-[var(--gs-text-muted)]">Vui lòng nhập lý do từ chối. Admin sẽ chọn PT thay thế khác cho ca này.</p>
        <Input.TextArea
          value={shiftRejectReason}
          onChange={(e) => setShiftRejectReason(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="Nhập lý do từ chối (bắt buộc)..."
        />
      </Modal>

    </div>
  )
}
