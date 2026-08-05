import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { socketService } from '../services/socketService'
import { trainingRequestService, type TrainingRequest } from '../services/trainingRequestService'

export const PT_REQUEST_EVENTS = [
  'pt_request_created',
  'pt_request_updated',
  'pt_request_deleted',
  'pt_request_waiting_assignment',
  'pt_request_assigned',
  'pt_request_cancelled',
  'pt_request_rejected',
] as const

export const PT_STATUS_KEYS = [
  'pending',
  'processing',
  'message_sent',
  'waiting_member',
  'waiting_assignment',
  'waiting_reassign',
  'assigned',
  'declined_by_member',
  'cancelled',
] as const

export type PtStatus = (typeof PT_STATUS_KEYS)[number]

export type PtCounts = Record<PtStatus, number>

interface PtRequestContextValue {
  requests: TrainingRequest[]
  countsByStatus: PtCounts
  badgeCount: number
  groupBadgeCount: number
  loading: boolean
  hasLoaded: boolean
  reload: () => Promise<void>
  latestRequestForMember: (memberId: string) => TrainingRequest | undefined
}

const PtRequestContext = createContext<PtRequestContextValue | null>(null)

const emptyCounts = (): PtCounts => ({
  pending: 0,
  processing: 0,
  message_sent: 0,
  waiting_member: 0,
  waiting_assignment: 0,
  waiting_reassign: 0,
  assigned: 0,
  declined_by_member: 0,
  cancelled: 0,
})

const isStaffView = (role?: string) => ['admin', 'super_admin', 'staff'].includes(role || '')

/**
 * Store realtime cho module Yêu cầu PT 1-1 (admin/staff).
 * - Khởi tạo: fetch 1 lần counts + toàn bộ yêu cầu pt1on1.
 * - Subscribe tất cả event `pt_request_*`: chỉ upsert/xóa ĐÚNG record thay đổi
 *   và điều chỉnh số lượng theo trạng thái — không refetch, không polling.
 */
export function PtRequestProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const enabled = isStaffView(user?.role)

  const [requests, setRequests] = useState<TrainingRequest[]>([])
  const [groupRequests, setGroupRequests] = useState<TrainingRequest[]>([])
  const [countsByStatus, setCountsByStatus] = useState<PtCounts>(emptyCounts)
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const statusByRequestId = useRef<Record<string, PtStatus>>({})

  const upsertIn = useCallback((setter: (updater: (prev: TrainingRequest[]) => TrainingRequest[]) => void, req: TrainingRequest) => {
    setter((prev) => {
      const idx = prev.findIndex((r) => r._id === req._id)
      if (idx === -1) return [req, ...prev]
      const next = [...prev]
      next[idx] = req
      return next
    })
  }, [])

  const applyEvent = useCallback((req: TrainingRequest) => {
    const newStatus = req.status
    const isGroup = req.type === 'group'
    const prevStatus = statusByRequestId.current[req._id]
    statusByRequestId.current[req._id] = newStatus
    upsertIn(isGroup ? setGroupRequests : setRequests, req)
    if (!isGroup) {
      if (prevStatus && prevStatus !== newStatus) {
        setCountsByStatus((prev) => {
          if (!(prevStatus in prev) || !(newStatus in prev)) return prev
          return { ...prev, [prevStatus]: Math.max(0, prev[prevStatus] - 1), [newStatus]: prev[newStatus] + 1 }
        })
      } else if (!prevStatus) {
        setCountsByStatus((prev) => (newStatus in prev ? { ...prev, [newStatus]: prev[newStatus] + 1 } : prev))
      }
    }
  }, [upsertIn])

  const remove = useCallback((req: TrainingRequest) => {
    const status = statusByRequestId.current[req._id]
    const isGroup = req.type === 'group'
    delete statusByRequestId.current[req._id]
    if (isGroup) {
      setGroupRequests((prev) => prev.filter((r) => r._id !== req._id))
    } else {
      setRequests((prev) => prev.filter((r) => r._id !== req._id))
      if (status) {
        setCountsByStatus((prev) => (status in prev ? { ...prev, [status]: Math.max(0, prev[status] - 1) } : prev))
      }
    }
  }, [])

  const reload = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const [countsRes, listRes, groupListRes] = await Promise.all([
        trainingRequestService.getPt1on1Counts(),
        trainingRequestService.getAllRequests({ type: 'pt1on1', activeOnly: true, page: 1, limit: 500 }),
        trainingRequestService.getAllRequests({ type: 'group', activeOnly: true, page: 1, limit: 500 }),
      ])
      const list = listRes.data.requests || []
      setRequests(list)
      setGroupRequests(groupListRes.data.requests || [])
      setCountsByStatus(countsRes.data.counts || emptyCounts())
      const map: Record<string, PtStatus> = {}
      for (const r of list) map[r._id] = r.status
      for (const r of (groupListRes.data.requests || [])) map[r._id] = r.status
      statusByRequestId.current = map
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }, [enabled])

  useEffect(() => {
    if (enabled) reload()
  }, [enabled, reload])

  useEffect(() => {
    if (!enabled) return
    socketService.connect()
    const upsertHandler = (payload?: { request?: TrainingRequest }) => {
      if (payload?.request) applyEvent(payload.request)
    }
    const deleteHandler = (payload?: { request?: TrainingRequest }) => {
      if (payload?.request) remove(payload.request)
    }
    for (const ev of PT_REQUEST_EVENTS) {
      if (ev === 'pt_request_deleted') socketService.on(ev, deleteHandler)
      else socketService.on(ev, upsertHandler)
    }
    return () => {
      for (const ev of PT_REQUEST_EVENTS) {
        if (ev === 'pt_request_deleted') socketService.off(ev, deleteHandler)
        else socketService.off(ev, upsertHandler)
      }
    }
  }, [enabled, applyEvent, remove])

  const latestRequestForMember = useCallback((memberId: string) => {
    return requests.find((r) => {
      const mid = typeof r.memberId === 'object' ? r.memberId._id : r.memberId
      return mid === memberId && !['declined_by_member', 'cancelled'].includes(r.status)
    })
  }, [requests])

  const value = useMemo<PtRequestContextValue>(
    () => ({
      requests,
      countsByStatus,
      badgeCount: countsByStatus.pending + countsByStatus.waiting_assignment,
      groupBadgeCount: groupRequests.filter((r) => ['pending', 'processing', 'message_sent', 'waiting_member', 'waiting_assignment', 'waiting_reassign'].includes(r.status)).length,
      loading,
      hasLoaded,
      reload,
      latestRequestForMember,
    }),
    [requests, countsByStatus, groupRequests, loading, hasLoaded, reload, latestRequestForMember],
  )

  return <PtRequestContext.Provider value={value}>{children}</PtRequestContext.Provider>
}

export function usePtRequests() {
  const ctx = useContext(PtRequestContext)
  if (!ctx) throw new Error('usePtRequests must be used within PtRequestProvider')
  return ctx
}
