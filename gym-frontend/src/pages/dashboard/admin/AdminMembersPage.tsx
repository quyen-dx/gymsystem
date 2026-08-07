import {
  EditOutlined,
  EyeOutlined,
  LockOutlined,
  MailOutlined,
  PlusOutlined,
  SendOutlined,
  TeamOutlined,
  UnlockOutlined,
  UserOutlined,
  PhoneOutlined,
} from '@ant-design/icons'
import {
  Badge,
  Button,
  Dropdown,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
  Avatar,
  Empty,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import api from '../../../services/api'
import { trainingRequestService, type TrainingRequest } from '../../../services/trainingRequestService'
import { trainingClassService, type TrainingClass } from '../../../services/trainingGroupService'
import { trainerService } from '../../../services/trainerService'
import { socketService } from '../../../services/socketService'
import { usePtRequests } from '../../../context/PtRequestProvider'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { memberService } from '../../../services/memberService'
import type { MemberListItem } from '../../../types/admin/member'
import type { PT } from '../../../types/admin/trainer'
import { getUserDisplayName } from '../../../utils/userDisplay'
import MemberFormModal from './MemberFormModal'
import MemberRegisterPlanModal from './MemberRegisterPlanModal'
import MemberRenewPlanModal from './MemberRenewPlanModal'

interface PlanOption {
  _id: string
  nameVi: string
}

const SPEC_LABELS: Record<string, string> = {
  GYM: 'GYM',
  CARDIO: 'Cardio',
  'STRENGTH TRAINING': 'Strength Training',
  YOGA: 'Yoga',
  BOXING: 'Boxing',
  CROSSFIT: 'Crossfit',
  PILATES: 'Pilates',
  ZUMBA: 'Zumba',
}

const HISTORY_TABS = [
  { key: 'assigned', label: 'Đã phân công' },
  { key: 'message_sent', label: 'Đã gửi' },
  { key: 'declined_by_member', label: 'Đã từ chối' },
  { key: 'cancelled', label: 'Đã hủy' },
  { key: '', label: 'Tất cả' },
]

const STATUS_COLORS: Record<string, string> = {
  pending: 'orange',
  message_sent: 'blue',
  waiting_assignment: 'purple',
  assigned: 'green',
  declined_by_member: 'red',
  cancelled: 'red',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  processing: 'Đang xử lý',
  message_sent: 'Đã gửi đề xuất',
  waiting_member: 'Chờ hội viên phản hồi',
  waiting_assignment: 'Chờ phân công',
  waiting_reassign: 'Chờ phân công',
  assigned: 'Đã phân công',
  class_assigned: 'Đã phân công',
  active: 'Đang hoạt động',
  completed: 'Hoàn thành',
  ended: 'Đã kết thúc',
  declined_by_member: 'Đã từ chối',
  declined: 'Đã từ chối',
  cancelled: 'Đã hủy',
}

export default function AdminMembersPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [members, setMembers] = useState<MemberListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()

  const [plans, setPlans] = useState<PlanOption[]>([])
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [formModalMember, setFormModalMember] = useState<MemberListItem | null>(null)
  const [registerModalOpen, setRegisterModalOpen] = useState(false)
  const [registerMemberId, setRegisterMemberId] = useState('')
  const [registerMemberName, setRegisterMemberName] = useState('')
  const [renewModalOpen, setRenewModalOpen] = useState(false)
  const [renewMemberId, setRenewMemberId] = useState('')
  const [renewMemberName, setRenewMemberName] = useState('')
  const [renewEndDate, setRenewEndDate] = useState('')
  const [renewStartDate, setRenewStartDate] = useState('')
  const [renewPlanName, setRenewPlanName] = useState('')
  const [renewCurrentPlanId, setRenewCurrentPlanId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [reqFilter, setReqFilter] = useState<'pending' | 'waiting_assignment'>('pending')
  const [reqLoading, setReqLoading] = useState(false)
  const [groupRequests, setGroupRequests] = useState<TrainingRequest[]>([])
  const [msgModal, setMsgModal] = useState<{ open: boolean; request: TrainingRequest | null; text: string; sending: boolean }>({ open: false, request: null, text: '', sending: false })

  // PT 1-1 request modal
  const [pt1on1ModalOpen, setPt1on1ModalOpen] = useState(false)
  const [pt1on1Tab, setPt1on1Tab] = useState<'pending' | 'waiting_assignment'>('pending')

  // Store realtime PT 1-1 + group (admin/staff)
  const { requests: allPt1on1Requests, countsByStatus: pt1on1Counts, badgeCount: pt1on1BadgeCount, groupBadgeCount, loading: pt1on1Loading, latestRequestForMember } = usePtRequests()

  // Assign PT modal
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignRequest, setAssignRequest] = useState<TrainingRequest | null>(null)
  const [assignSearch, setAssignSearch] = useState('')
  const [assignTrainers, setAssignTrainers] = useState<PT[]>([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null)
  const [assignSubmitting, setAssignSubmitting] = useState(false)

  // Gửi đề xuất (chung nhóm + PT 1-1)
  const [proposalModalOpen, setProposalModalOpen] = useState(false)
  const [proposalRequest, setProposalRequest] = useState<TrainingRequest | null>(null)
  const [proposalClasses, setProposalClasses] = useState<TrainingClass[]>([])
  const [proposalPTs, setProposalPTs] = useState<PT[]>([])
  const [proposalClassId, setProposalClassId] = useState<string | undefined>()
  const [proposalPtId, setProposalPtId] = useState<string | undefined>()
  const [proposalText, setProposalText] = useState('')
  const [proposalSubmitting, setProposalSubmitting] = useState(false)

  // Xếp lớp cho yêu cầu nhóm ở tab Chờ phân công
  const [classAssignModalOpen, setClassAssignModalOpen] = useState(false)
  const [classAssignRequest, setClassAssignRequest] = useState<TrainingRequest | null>(null)
  const [classAssignClasses, setClassAssignClasses] = useState<TrainingClass[]>([])
  const [classAssignLoading, setClassAssignLoading] = useState(false)
  const [classAssigningId, setClassAssigningId] = useState<string | null>(null)

  // Lịch sử
  const [historyModal, setHistoryModal] = useState<{ type: 'group' | 'pt1on1'; open: boolean }>({ type: 'group', open: false })
  const [historyFilter, setHistoryFilter] = useState<string>('')
  const [historyRequests, setHistoryRequests] = useState<TrainingRequest[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Lịch sử: tải toàn bộ request theo loại
  // Khai báo trước các effect dùng callback này để tránh lỗi temporal dead zone.
  const loadHistory = useCallback(async (type: 'group' | 'pt1on1') => {
    setHistoryLoading(true)
    try {
      const res = await trainingRequestService.getAllRequests({ type, page: 1, limit: 500 })
      setHistoryRequests(res.data.requests || [])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  // Realtime yêu cầu tập luyện nhóm: reload list khi có sự kiện pt_request_*
  useEffect(() => {
    socketService.connect()
    const handler = (payload?: { request?: TrainingRequest }) => {
      const req = payload?.request
      if (req && req.type === 'group') {
        if (modalOpen) loadGroupRequests()
      }
    }
    const events = ['pt_request_created', 'pt_request_updated', 'pt_request_cancelled', 'pt_request_assigned', 'pt_request_rejected', 'pt_request_waiting_assignment']
    for (const ev of events) socketService.on(ev, handler)
    return () => {
      for (const ev of events) socketService.off(ev, handler)
    }
  }, [modalOpen, reqFilter])

  // Mở modal + tab theo URL (từ thông báo realtime / notification center)
  useEffect(() => {
    if (searchParams.get('pt1on1')) {
      const status = searchParams.get('pt1on1Status')
      if (status === 'pending' || status === 'waiting_assignment' || status === 'waiting_reassign') {
        setPt1on1Tab(status)
        setPt1on1ModalOpen(true)
      } else if (status) {
        // Trạng thái đã đóng → mở lịch sử PT 1-1
        setHistoryFilter(HISTORY_TABS.some((t) => t.key === status) ? status : '')
        setHistoryModal({ type: 'pt1on1', open: true })
        loadHistory('pt1on1')
      } else {
        setPt1on1ModalOpen(true)
      }
    }
  }, [searchParams, loadHistory])

  // Admin đang mở màn hình Phân công PT → join room để backend không tạo thông báo trùng lặp.
  useEffect(() => {
    if (assignModalOpen) {
      socketService.connect()
      socketService.emit('pt1on1:join-active-view')
    } else {
      socketService.emit('pt1on1:leave-active-view')
    }
  }, [assignModalOpen])

  useEffect(() => {
    return () => {
      socketService.emit('pt1on1:leave-active-view')
    }
  }, [])

  const loadGroupRequests = async () => {
    setReqLoading(true)
    try {
      const reqRes = await trainingRequestService.getAllRequests({ type: 'group', activeOnly: true, page: 1, limit: 500 })
      setGroupRequests(reqRes.data.requests || [])
    } finally {
      setReqLoading(false)
    }
  }

  useEffect(() => { if (modalOpen) loadGroupRequests() }, [modalOpen])

  // Yêu cầu nhóm hiển thị theo tab: Chờ xử lý = pending + message_sent, Chờ phân công = waiting_assignment
  const visibleGroupRequests = useMemo(() => {
    if (reqFilter === 'pending') {
      return groupRequests.filter((r) => ['pending', 'processing', 'message_sent', 'waiting_member'].includes(r.status))
    }
      return groupRequests.filter((r) => r.status === 'waiting_assignment' || r.status === 'waiting_reassign')
  }, [groupRequests, reqFilter])

  const groupPendingTabCount = useMemo(
    () => groupRequests.filter((r) => ['pending', 'processing', 'message_sent', 'waiting_member'].includes(r.status)).length,
    [groupRequests],
  )
  const groupWaitingTabCount = useMemo(
    () => groupRequests.filter((r) => r.status === 'waiting_assignment' || r.status === 'waiting_reassign').length,
    [groupRequests],
  )

  // Danh sách PT 1-1 hiển thị trong modal = store realtime, lọc theo tab đang chọn
  const visiblePt1on1Requests = useMemo(
    () => allPt1on1Requests.filter((r) => pt1on1Tab === 'pending' ? ['pending', 'processing', 'message_sent', 'waiting_member'].includes(r.status) : (r.status === 'waiting_assignment' || r.status === 'waiting_reassign')),
    [allPt1on1Requests, pt1on1Tab],
  )

  const visibleHistoryRequests = useMemo(
    () => historyRequests.filter((r) => !historyFilter || r.status === historyFilter),
    [historyRequests, historyFilter],
  )

  useEffect(() => {
    api.get<{ plans: PlanOption[] }>('/plans', { params: { limit: 100 } }).then(({ data }) => {
      setPlans(data.plans || [])
    }).catch(() => {})
  }, [])

  const fetchMembers = useCallback(async (p = page, s = search, plan = planFilter, status = statusFilter) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: p, limit: 15 }
      if (s) params.search = s
      if (plan) params.planId = plan
      if (status) params.status = status
      const { data } = await memberService.getMembers(params)
      setMembers(data.members)
      setTotal(data.pagination.total)
    } catch {
      message.error('Không thể tải danh sách thành viên')
    } finally {
      setLoading(false)
    }
  }, [page, search, planFilter, statusFilter])

  useEffect(() => {
    fetchMembers()
  }, [])

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    fetchMembers(1, value, planFilter, statusFilter)
  }

  const handlePlanFilter = (value: string | undefined) => {
    setPlanFilter(value)
    setPage(1)
    fetchMembers(1, search, value, statusFilter)
  }

  const handleStatusFilter = (value: string | undefined) => {
    setStatusFilter(value)
    setPage(1)
    fetchMembers(1, search, planFilter, value)
  }

  const openAdd = () => {
    setFormModalMember(null)
    setFormModalOpen(true)
  }

  const openEdit = (member: MemberListItem) => {
    setFormModalMember(member)
    setFormModalOpen(true)
  }

  const onFormSuccess = () => {
    setFormModalOpen(false)
    setFormModalMember(null)
    fetchMembers()
  }

  const toggleStatus = async (member: MemberListItem) => {
    try {
      await memberService.toggleMemberStatus(member._id)
      message.success('Cập nhật trạng thái thành công')
      fetchMembers()
    } catch {
      message.error('Thao tác thất bại')
    }
  }

  const openRegisterPlan = (member: MemberListItem) => {
    setRegisterMemberId(member._id)
    setRegisterMemberName(getUserDisplayName(member, member.memberCode))
    setRegisterModalOpen(true)
  }

  const openRenewPlan = (member: MemberListItem) => {
    setRenewMemberId(member._id)
    setRenewMemberName(getUserDisplayName(member, member.memberCode))
    setRenewEndDate(member.activeMembership?.endDate || '')
    setRenewStartDate(member.activeMembership?.startDate || '')
    setRenewPlanName(member.activeMembership?.planId?.nameVi || '')
    setRenewCurrentPlanId(member.activeMembership?.planId?._id || '')
    setRenewModalOpen(true)
  }

  const openAssignTrainer = (r: TrainingRequest) => {
    setAssignRequest(r)
    setAssignSearch('')
    setSelectedTrainerId(null)
    loadAssignTrainers(r.specialization)
    setAssignModalOpen(true)
  }

  const loadAssignTrainers = async (specialization?: string) => {
    setAssignLoading(true)
    try {
      const res = await trainerService.getPTs({ isActive: true, limit: 100, specialty: specialization })
      setAssignTrainers(res.data.pts || [])
    } catch {
      message.error('Không thể tải danh sách PT')
    } finally {
      setAssignLoading(false)
    }
  }

  const handleAssignTrainer = async () => {
    if (!selectedTrainerId || !assignRequest) return
    setAssignSubmitting(true)
    try {
      await trainingRequestService.assignTrainer(assignRequest._id, selectedTrainerId)
      message.success('Đã phân công PT thành công')
      setAssignModalOpen(false)
      setAssignRequest(null)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Phân công thất bại')
    } finally {
      setAssignSubmitting(false)
    }
  }

  // Mở modal Gửi đề xuất (nhóm: đề xuất lớp, PT 1-1: đề xuất PT)
  const openProposalModal = async (r: TrainingRequest) => {
    setProposalRequest(r)
    setProposalClassId(undefined)
    setProposalPtId(undefined)
    setProposalText('')
    setProposalModalOpen(true)
    try {
      if (r.type === 'group') {
        const res = await trainingClassService.getAll({ page: 1, limit: 100 })
        setProposalClasses(res.data.classes || [])
      } else {
        const res = await trainerService.getPTs({ isActive: true, limit: 100 })
        setProposalPTs(res.data.pts || [])
      }
    } catch {
      message.error('Không thể tải dữ liệu để đề xuất')
    }
  }

  const handleSendProposal = async () => {
    if (!proposalRequest) return
    const isGroup = proposalRequest.type === 'group'
    let content = ''
    let proposal: {
      type: 'group' | 'pt1on1'
      classId?: string
      className?: string
      trainerId?: string
      trainerName?: string
      specialization?: string
      goals?: string[]
      timeSlots?: string[]
      daysOfWeek?: number[]
      startTime?: string | null
      endTime?: string | null
      zoneId?: string | null
      zoneName?: string
      floorId?: string | null
      floorName?: string
      note?: string
    } | null = null
    if (isGroup && proposalClassId) {
      const cls = proposalClasses.find((c) => c._id === proposalClassId)
      if (cls) {
        const days = cls.daysLabel || (cls.daysOfWeek || []).map((d) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d]).join(' - ')
        content += `Lớp: ${cls.name}\nNgày: ${days || '—'}\nGiờ: ${cls.startTime && cls.endTime ? `${cls.startTime.slice(0, 5)} - ${cls.endTime.slice(0, 5)}` : '—'}`
        const pt = cls.ptId as any
        const zone = cls.zoneId as any
        const floor = cls.floorId as any
        proposal = {
          type: 'group',
          classId: cls._id,
          className: cls.name,
          trainerId: typeof pt === 'object' ? pt?._id : pt || undefined,
          trainerName: typeof pt === 'object' ? getUserDisplayName(pt, '') : undefined,
          specialization: cls.specialization,
          timeSlots: cls.startTime && cls.endTime ? [`${cls.startTime.slice(0, 5)}-${cls.endTime.slice(0, 5)}`] : [],
          daysOfWeek: cls.daysOfWeek || [],
          startTime: cls.startTime,
          endTime: cls.endTime,
          zoneId: typeof zone === 'object' ? zone?._id : zone || null,
          zoneName: typeof zone === 'object' ? zone?.name : undefined,
          floorId: typeof floor === 'object' ? floor?._id : floor || null,
          floorName: typeof floor === 'object' ? floor?.name : undefined,
        }
      }
    }
    if (!isGroup && proposalPtId) {
      const pt = proposalPTs.find((t) => t._id === proposalPtId)
      if (pt) {
        proposal = {
          type: 'pt1on1',
          trainerId: pt._id,
          trainerName: getUserDisplayName(pt, ''),
          specialization: proposalRequest.specialization,
          goals: proposalRequest.goals || [],
        }
      }
    }
    if (!isGroup) {
      const trimmedMessage = proposalText.trim()
      if (!trimmedMessage) {
        message.warning('Nội dung đề xuất không được để trống.')
        return
      }
      content = trimmedMessage
      proposal = { ...(proposal || { type: 'pt1on1' }), note: trimmedMessage }
    }
    if (isGroup && proposalText.trim()) {
      content += (content ? '\n\n' : '') + proposalText.trim()
      proposal = { ...(proposal || { type: isGroup ? 'group' : 'pt1on1' }), note: proposalText.trim() }
    }
    if (!content.trim()) {
      message.warning('Vui lòng chọn lớp/PT hoặc nhập nội dung đề xuất')
      return
    }
    setProposalSubmitting(true)
    try {
      await trainingRequestService.sendMessage(proposalRequest._id, content.trim(), proposal)
      message.success('Đã gửi đề xuất cho hội viên')
      setProposalModalOpen(false)
      setProposalRequest(null)
      loadGroupRequests()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gửi đề xuất thất bại')
    } finally {
      setProposalSubmitting(false)
    }
  }

  const hasAcceptedProposal = (r: TrainingRequest) =>
    !!r.proposalAccepted && !!(r.acceptedProposal || r.selectedProposal || r.approvedProposal || r.currentProposal || r.proposal)

  // Request đã được hội viên đồng ý proposal phải đi qua Match Class.
  const openClassAssignModal = async (r: TrainingRequest) => {
    if (['waiting_assignment', 'waiting_reassign'].includes(r.status) || hasAcceptedProposal(r)) {
      navigate(`/admin/member-requests/match?requestId=${r._id}`)
      return
    }
    setClassAssignRequest(r)
    setClassAssignModalOpen(true)
    setClassAssignLoading(true)
    try {
      const res = await trainingClassService.getAll({ page: 1, limit: 100 })
      setClassAssignClasses(res.data.classes || [])
    } catch {
      message.error('Không thể tải danh sách lớp')
    } finally {
      setClassAssignLoading(false)
    }
  }

  const handleAssignClass = async (classId: string) => {
    if (!classAssignRequest) return
    setClassAssigningId(classId)
    try {
      await trainingRequestService.assignToClass(classAssignRequest._id, classId)
      message.success('Đã xếp lớp thành công')
      setClassAssignModalOpen(false)
      setClassAssignRequest(null)
      loadGroupRequests()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Xếp lớp thất bại')
    } finally {
      setClassAssigningId(null)
    }
  }

  // Lịch sử
  const openHistory = (type: 'group' | 'pt1on1') => {
    setHistoryFilter('')
    setHistoryModal({ type, open: true })
    loadHistory(type)
  }

  const columns = [
    {
      title: 'Thành viên',
      width: 250,
      render: (_: unknown, record: MemberListItem) => (
        <Space>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: record.avatar ? `url(${record.avatar}) center/cover` : 'var(--gs-border)',
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--gs-text)' }}
              onClick={() => navigate(`/admin/members/${record._id}`)}>
              {getUserDisplayName(record, 'Thành viên')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gs-text-muted)' }}>
              {record.memberCode ? `${record.memberCode} • ` : ''}{record.phone || record.email || '—'}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Gói tập',
      render: (_: unknown, record: MemberListItem) => {
        if (!record.activeMembership) {
          return <Tag style={{ opacity: 0.5 }}>Chưa có gói</Tag>
        }
        const plan = record.activeMembership.planId
        return (
          <Space size={4}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: plan?.color || '#3B82F6', flexShrink: 0 }} />
            <span>{plan?.nameVi || '—'}</span>
          </Space>
        )
      },
    },
    {
      title: 'Ngày còn lại',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: MemberListItem) => {
        if (record.remainingDays <= 0) return <Tag color="error">0</Tag>
        if (record.remainingDays <= 7) return <Badge count={record.remainingDays} size="small" offset={[4, 0]}><Tag color="red">{record.remainingDays}d</Tag></Badge>
        return <span>{record.remainingDays}d</span>
      },
    },
    {
      title: 'Check-in',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: MemberListItem) => (
        <span>{record.checkinCount || <span style={{ opacity: 0.4 }}>0</span>}</span>
      ),
    },
    {
      title: 'Trạng thái',
      width: 100,
      render: (_: unknown, record: MemberListItem) => (
        <Tag color={record.isActive ? 'success' : 'error'}>
          {record.isActive ? 'Hoạt động' : 'Đã khóa'}
        </Tag>
      ),
    },
    {
      title: 'Yêu cầu PT',
      width: 140,
      render: (_: unknown, record: MemberListItem) => {
        const req = latestRequestForMember(record._id)
        if (!req) return <span style={{ opacity: 0.4, fontSize: 12 }}>—</span>
        const openReqView = () => {
          if (req.status === 'pending' || req.status === 'waiting_assignment' || req.status === 'message_sent') {
            setPt1on1Tab(req.status === 'message_sent' ? 'pending' : req.status as 'pending' | 'waiting_assignment')
            setPt1on1ModalOpen(true)
          } else {
            setHistoryFilter(HISTORY_TABS.some((t) => t.key === req.status) ? req.status : '')
            setHistoryModal({ type: 'pt1on1', open: true })
          }
        }
        return (
          <Tag
            color={STATUS_COLORS[req.status] || 'default'}
            style={{ cursor: 'pointer' }}
            onClick={openReqView}
          >
            {STATUS_LABELS[req.status] || 'Đang xử lý'}
          </Tag>
        )
      },
    },
    {
      title: 'Thao tác',
      width: 200,
      render: (_: unknown, record: MemberListItem) => (
        <Space size={4}>
          <Tooltip title="Chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/admin/members/${record._id}`)} />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Tooltip title={record.isActive ? 'Khóa' : 'Mở khóa'}>
            <Button size="small" icon={record.isActive ? <LockOutlined /> : <UnlockOutlined />} onClick={() => toggleStatus(record)} />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                { key: 'register', label: 'Đăng ký gói tập', onClick: () => openRegisterPlan(record), disabled: !!record.activeMembership },
                { key: 'renew', label: 'Gia hạn gói tập', onClick: () => openRenewPlan(record), disabled: !record.activeMembership },
              ],
            }}
            trigger={['click']}
          >
            <Button size="small">Gói tập</Button>
          </Dropdown>
        </Space>
      ),
    },
  ]

  const pt1on1Columns = [
    {
      title: 'Hội viên',
      width: 250,
      render: (_: any, r: TrainingRequest) => {
        const m = typeof r.memberId === 'object' ? r.memberId : null
        return (
          <div className="flex items-center gap-2">
            {m?.avatar ? (
              <img src={m.avatar} className="h-9 w-9 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-[var(--gs-border)] flex items-center justify-center shrink-0">
                <UserOutlined style={{ color: 'var(--gs-text-muted)', fontSize: 16 }} />
              </div>
            )}
            <div>
              <div className="font-medium text-[var(--gs-text)] text-sm leading-tight">{m ? getUserDisplayName(m) : '—'}</div>
              <div className="text-[11px] text-[var(--gs-text-muted)]">
                {m?.memberCode || ''}{m?.phone ? ` • ${m.phone}` : ''}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      title: 'Chuyên môn & Mục tiêu',
      width: 220,
      render: (_: any, r: TrainingRequest) => (
        <div>
          <Tag color="blue" className="m-0 text-xs font-semibold">{SPEC_LABELS[r.specialization || 'GYM'] || r.specialization}</Tag>
          {r.goals?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {r.goals.map((g, i) => <Tag key={i} className="m-0 text-xs" color="purple">{g}</Tag>)}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Liên hệ',
      width: 200,
      render: (_: any, r: TrainingRequest) => (
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1">
            <PhoneOutlined style={{ fontSize: 11, color: 'var(--gs-text-muted)' }} />
            <span>{r.contactPhone || '—'}</span>
          </div>
          <div className="flex items-center gap-1">
            <MailOutlined style={{ fontSize: 11, color: 'var(--gs-text-muted)' }} />
            <span className="truncate block max-w-[140px]">{r.contactEmail || '—'}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'PT mong muốn',
      width: 150,
      render: (_: any, r: TrainingRequest) => {
        if (r.preferredTrainerId) {
          const name = typeof r.preferredTrainerId === 'object'
            ? getUserDisplayName(r.preferredTrainerId, '')
            : null
          return name ? <span className="text-sm">{name}</span> : <Tag className="m-0">Có yêu cầu</Tag>
        }
        return <span className="text-xs text-[var(--gs-text-muted)]">Không yêu cầu</span>
      },
    },
    {
      title: 'Ghi chú',
      width: 200,
      render: (_: any, r: TrainingRequest) => (
        <div className="text-xs text-[var(--gs-text)] truncate max-w-[190px]" title={r.note || ''}>
          {r.status === 'pending' && r.lastMessage ? (
            <span className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-1.5 py-0.5 text-[11px] text-amber-800 dark:text-amber-200 whitespace-normal">
              <span className="font-semibold">Hội viên đề xuất: </span>{r.lastMessage}
            </span>
          ) : (
            r.note || <span className="text-[var(--gs-text-muted)]">—</span>
          )}
        </div>
      ),
    },
    {
      title: 'Ngày gửi',
      width: 100,
      render: (_: any, r: TrainingRequest) => {
        const d = new Date(r.createdAt)
        return <span className="text-xs text-[var(--gs-text-muted)]">{d.toLocaleDateString('vi-VN')}</span>
      },
    },
    {
      title: 'Trạng thái',
      width: 110,
      render: (_: any, r: TrainingRequest) => (
        <Tag color={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status] || r.status}</Tag>
      ),
    },
    {
      title: 'Thao tác',
      width: 260,
      render: (_: any, r: TrainingRequest) => {
        if (r.status === 'pending') {
          return (
            <Space size={4}>
              <Button type="primary" size="small" icon={<UserOutlined />}
                onClick={() => openAssignTrainer(r)}>
                Phân công PT
              </Button>
              <Button size="small" icon={<SendOutlined />} onClick={() => openProposalModal(r)}>
                Gửi đề xuất
              </Button>
            </Space>
          )
        }
        if (r.status === 'waiting_assignment' || r.status === 'waiting_reassign') {
          return (
            <Button type="primary" size="small" icon={<UserOutlined />}
              onClick={() => openAssignTrainer(r)}>
              Phân công PT
            </Button>
          )
        }
        if (r.status === 'message_sent') {
          return <span className="text-xs text-[var(--gs-text-muted)]">Chờ hội viên phản hồi</span>
        }
        return <span className="text-xs text-[var(--gs-text-muted)]">Đã xử lý</span>
      },
    },
  ]

  const filteredAssignTrainers = assignTrainers.filter((t) => {
    const requestSpec = String(assignRequest?.specialization || '').trim().toUpperCase()
    const ptSpecs = (t.specialties || []).map((s) => String(s || '').trim().toUpperCase())
    if (requestSpec && ptSpecs.length > 0 && !ptSpecs.includes(requestSpec)) return false
    if (!assignSearch) return true
    const q = assignSearch.toLowerCase()
    return getUserDisplayName(t, '').toLowerCase().includes(q)
      || (t.email || '').toLowerCase().includes(q)
      || (t.specialties || []).some((s) => s.toLowerCase().includes(q))
  })
  const rejectedPtIds = new Set((assignRequest?.rejectedPtIds || []).map((pt) => typeof pt === 'string' ? pt : pt._id))

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Quản lý</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Quản lý thành viên</h1>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--gs-card)] px-4 py-1.5 text-sm font-medium text-[var(--gs-text)] transition-all hover:bg-[var(--theme-accent)] hover:text-white"
          >
            <span>Yêu cầu tập nhóm</span>
            {groupBadgeCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#f5222d] px-1.5 text-xs font-bold text-white">
                {groupBadgeCount > 99 ? '99+' : groupBadgeCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setPt1on1ModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--gs-card)] px-4 py-1.5 text-sm font-medium text-[var(--gs-text)] transition-all hover:bg-[var(--theme-accent)] hover:text-white"
          >
            <span>Yêu cầu PT 1-1</span>
            {pt1on1BadgeCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#f5222d] px-1.5 text-xs font-bold text-white">
                {pt1on1BadgeCount > 99 ? '99+' : pt1on1BadgeCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => openHistory('group')}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--gs-card)] px-4 py-1.5 text-sm font-medium text-[var(--gs-text)] transition-all hover:bg-[var(--theme-accent)] hover:text-white"
          >
            <span>Lịch sử tập nhóm</span>
          </button>
          <button
            type="button"
            onClick={() => openHistory('pt1on1')}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--gs-card)] px-4 py-1.5 text-sm font-medium text-[var(--gs-text)] transition-all hover:bg-[var(--theme-accent)] hover:text-white"
          >
            <span>Lịch sử PT 1-1</span>
          </button>
        </div>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <Input.Search
            placeholder="Tìm kiếm thành viên..."
            allowClear
            onSearch={handleSearch}
            style={{ maxWidth: 300 }}
          />
          <Select
            allowClear
            showSearch
            placeholder="Lọc theo gói tập"
            style={{ minWidth: 160 }}
            onChange={handlePlanFilter}
            optionFilterProp="label"
            options={plans.map((p) => ({ value: p._id, label: `${p.nameVi}` }))}
          />
          <Select
            allowClear
            placeholder="Lọc theo trạng thái"
            style={{ minWidth: 130 }}
            onChange={handleStatusFilter}
            options={[
              { value: 'active', label: 'Đang hoạt động' },
              { value: 'locked', label: 'Đã khóa' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Thêm thành viên
          </Button>
        </div>

        <div className="member-scroll-x">
          <Table
            dataSource={members}
            columns={columns}
            rowKey="_id"
            loading={loading}
            pagination={{
              total,
              current: page,
              pageSize: 15,
              onChange: (p) => {
                setPage(p)
                fetchMembers(p, search, planFilter, statusFilter)
              },
            }}
          />
        </div>
      </div>

      <MemberFormModal
        open={formModalOpen}
        member={formModalMember}
        onClose={() => { setFormModalOpen(false); setFormModalMember(null) }}
        onSuccess={onFormSuccess}
      />

      <MemberRegisterPlanModal
        open={registerModalOpen}
        memberId={registerMemberId}
        memberName={registerMemberName}
        onClose={() => setRegisterModalOpen(false)}
        onSuccess={() => { setRegisterModalOpen(false); fetchMembers() }}
      />

      <MemberRenewPlanModal
        open={renewModalOpen}
        memberId={renewMemberId}
        memberName={renewMemberName}
        currentEndDate={renewEndDate}
        currentStartDate={renewStartDate}
        currentPlanName={renewPlanName}
        currentPlanId={renewCurrentPlanId}
        onClose={() => setRenewModalOpen(false)}
        onSuccess={() => { setRenewModalOpen(false); fetchMembers() }}
      />

      {/* Group Training Request Modal */}
      <Modal title="Yêu cầu tập nhóm" open={modalOpen} onCancel={() => setModalOpen(false)}
        width={1100} centered footer={null} destroyOnClose
        styles={{ body: { paddingTop: 8, maxHeight: '75vh', overflowY: 'auto' } }}
        className="!w-[min(95vw,1500px)] max-sm:!w-[98vw]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <Button type={reqFilter === 'pending' ? 'primary' : 'default'} size="small" onClick={() => setReqFilter('pending')}>
              Chờ xử lý
              {groupPendingTabCount > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none bg-[var(--theme-accent)]/15 text-[var(--theme-accent)]">
                  {groupPendingTabCount > 99 ? '99+' : groupPendingTabCount}
                </span>
              )}
            </Button>
            {groupWaitingTabCount > 0 && (
              <Button type={reqFilter === 'waiting_assignment' ? 'primary' : 'default'} size="small" onClick={() => setReqFilter('waiting_assignment')}>
                Chờ phân công
                <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none bg-red-500 text-white">
                  {groupWaitingTabCount > 99 ? '99+' : groupWaitingTabCount}
                </span>
              </Button>
            )}
          </div>
        </div>

        <Table
          dataSource={visibleGroupRequests}
          rowKey="_id"
          loading={reqLoading}
          pagination={false}
          locale={{ emptyText: 'Không có yêu cầu nào' }}
          scroll={{ x: 1400 }}
          columns={[
            {
              title: 'Hội viên',
              dataIndex: 'memberId',
              width: 220,
              className: '!whitespace-nowrap',
              render: (m: any) => (
                <div className="flex items-center gap-2">
                  {m?.avatar && <img src={m.avatar} className="h-8 w-8 rounded-full object-cover shrink-0" />}
                  <span className="font-medium text-[var(--gs-text)] truncate">{getUserDisplayName(m)}</span>
                </div>
              ),
            },
            {
              title: 'Chuyên môn & Mục tiêu',
              dataIndex: 'goals',
              width: 240,
              className: '!whitespace-nowrap',
              render: (_: any, r: TrainingRequest) => {
                const specName = SPEC_LABELS[r.specialization || 'GYM'] || r.specialization || 'GYM'
                return (
                  <div>
                    <div className="text-sm font-semibold text-[var(--gs-text)] uppercase">{specName}</div>
                    {r.goals?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.goals.map((g, i) => (
                          <Tag key={i} className="m-0 text-xs" color="purple">{g}</Tag>
                        ))}
                      </div>
                    )}
                  </div>
                )
              },
            },
            {
              title: 'Lịch',
              key: 'schedule',
              width: 280,
              className: '!whitespace-nowrap',
              render: (_: any, r: TrainingRequest) => (
                <div className="text-xs text-[var(--gs-text)] space-y-1">
                  <div><span className="text-[var(--gs-text-muted)]">Số buổi:</span> {r.desiredSessions} buổi/tuần</div>
                  <div><span className="text-[var(--gs-text-muted)]">Ngày:</span> {r.daysOfWeek?.length > 0 ? r.daysOfWeek.map((d) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d]).join(', ') : 'Linh hoạt'}</div>
                  <div><span className="text-[var(--gs-text-muted)]">Giờ:</span> {r.timeSlots?.length > 0 ? r.timeSlots.join(', ') : 'Linh hoạt'}</div>
                  {r.status === 'pending' && r.lastMessage && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-1.5 text-[11px] text-amber-800 dark:text-amber-200">
                      <span className="font-semibold">Hội viên đề xuất: </span>{r.lastMessage}
                    </div>
                  )}
                </div>
              ),
            },
            {
              title: 'Gói tập',
              key: 'membership',
              width: 260,
              className: '!whitespace-nowrap',
              render: (_: any, r: TrainingRequest) => {
                const info = r.membershipInfo
                if (!info) return <span className="text-xs text-[var(--gs-text-muted)]">Không có gói</span>
                const isExpired = info.remainingDays <= 0
                return (
                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-[var(--gs-text)]">{info.planName}</div>
                    <div className="flex flex-wrap gap-1">
                      {isExpired ? (
                        <Tag color="red">Đã hết hạn</Tag>
                      ) : (
                        <Tag color="success">Đang hoạt động</Tag>
                      )}
                    </div>
                    {!isExpired && info.pendingRenewalsCount > 0 && (
                      <div className="text-[var(--gs-text-muted)]">
                        <Tag color="purple">Có gia hạn</Tag>
                      </div>
                    )}
                  </div>
                )
              },
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              width: 130,
              className: '!whitespace-nowrap',
              render: (s: string) => <Tag color={STATUS_COLORS[s] || 'default'}>{STATUS_LABELS[s] || s}</Tag>,
            },
            {
              title: 'Thao tác',
              key: 'action',
              width: 300,
              className: '!whitespace-nowrap',
              render: (_: any, r: TrainingRequest) => {
                if (r.status === 'pending') {
                  const info = r.membershipInfo
                  const canFindClass = info && info.remainingDays >= 30
                  const isExpired = info && info.remainingDays <= 0
                  return (
                    <div className="flex gap-1.5">
                      {isExpired ? (
                        <Button size="small" onClick={() => {
                          const defaultMsg = `Gói tập của bạn đã hết hạn. Bạn vui lòng gia hạn gói tập để Admin có thể sắp xếp lịch học phù hợp.`
                          setMsgModal({ open: true, request: r, text: defaultMsg })
                        }}>
                          Yêu cầu gia hạn
                        </Button>
                      ) : !canFindClass ? (
                        <Button size="small" onClick={() => {
                          const defaultMsg = `Gói tập của bạn chỉ còn ${info?.remainingDays || 0} ngày nên chưa đủ điều kiện tham gia chương trình PT.\n\nBạn vui lòng gia hạn gói tập để Admin có thể sắp xếp lịch học phù hợp.`
                          setMsgModal({ open: true, request: r, text: defaultMsg })
                        }}>
                          Yêu cầu gia hạn
                        </Button>
                      ) : (
                        <Button type="primary" size="small" onClick={() => navigate(`/admin/member-requests/match?requestId=${r._id}`)}>
                          Tìm lớp phù hợp
                        </Button>
                      )}
                      <Button size="small" icon={<SendOutlined />} onClick={() => openProposalModal(r)}>
                        Gửi đề xuất
                      </Button>
                    </div>
                  )
                }
                if (r.status === 'waiting_assignment' || r.status === 'waiting_reassign') {
                  return (
                    <Button type="primary" size="small" icon={<TeamOutlined />} onClick={() => openClassAssignModal(r)}>
                      Xếp lớp
                    </Button>
                  )
                }
                if (r.status === 'message_sent') {
                  return <span className="text-xs text-[var(--gs-text-muted)]">Chờ hội viên phản hồi đề xuất</span>
                }
                return <span className="text-xs text-[var(--gs-text-muted)]">Đã xử lý</span>
              },
            },
          ]}
        />
      </Modal>

      {/* Message Sending Modal */}
      <Modal
        title="Gửi tin nhắn cho hội viên"
        open={msgModal.open}
        onCancel={() => setMsgModal({ open: false, request: null })}
        footer={null}
        width={600}
        centered
        destroyOnClose
      >
        {msgModal.request && (() => {
          const r = msgModal.request
          const info = r.membershipInfo
          const memberName = typeof r.memberId === 'object' ? getUserDisplayName(r.memberId, '') : ''

          const handleSend = async () => {
            setMsgModal((prev) => ({ ...prev, sending: true }))
            try {
              const memberId = typeof r.memberId === 'object' ? r.memberId._id : r.memberId
              await api.post('/notifications/send', {
                receiverId: memberId,
                receiverRole: 'member',
                title: 'Phản hồi yêu cầu tập luyện',
                content: msgModal.text,
                redirectUrl: '/my-membership',
              })
              message.success('Đã gửi tin nhắn thành công')
              setMsgModal({ open: false, request: null, text: '', sending: false })
            } catch {
              message.error('Gửi tin nhắn thất bại')
              setMsgModal((prev) => ({ ...prev, sending: false }))
            }
          }

          return (
            <div className="py-2">
              <p className="m-0 text-sm text-[var(--gs-text)]">
                Gửi tới: <strong>{memberName || 'Hội viên'}</strong>
              </p>
              {info && (
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <Tag>{info.planName}</Tag>
                  {info.remainingDays <= 0 ? (
                    <Tag color="red">Đã hết hạn</Tag>
                  ) : (
                    <>
                      <Tag color="success">Đang hoạt động</Tag>
                      {info.pendingRenewalsCount > 0 && <Tag color="purple">Có gia hạn</Tag>}
                    </>
                  )}
                </div>
              )}
              <textarea
                className="mt-4 w-full rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 text-sm text-[var(--gs-text)] outline-none transition-colors focus:border-[var(--theme-accent)]"
                rows={8}
                value={msgModal.text}
                onChange={(e) => setMsgModal((prev) => ({ ...prev, text: e.target.value }))}
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button onClick={() => setMsgModal({ open: false, request: null, text: '', sending: false })}>Hủy</Button>
                <Button type="primary" loading={msgModal.sending} onClick={handleSend}>Gửi tin nhắn</Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* PT 1-1 Request Modal */}
      <Modal title="Yêu cầu PT 1-1" open={pt1on1ModalOpen} onCancel={() => setPt1on1ModalOpen(false)}
        width={1300} centered footer={null} destroyOnClose
        styles={{ body: { paddingTop: 8, maxHeight: '75vh', overflowY: 'auto' } }}
        className="!w-[min(95vw,1500px)] max-sm:!w-[98vw]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <Button type={pt1on1Tab === 'pending' ? 'primary' : 'default'} size="small" onClick={() => setPt1on1Tab('pending')}>
              Chờ xử lý
              {((pt1on1Counts.pending || 0) + (pt1on1Counts.processing || 0) + (pt1on1Counts.message_sent || 0) + (pt1on1Counts.waiting_member || 0)) > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none bg-[var(--theme-accent)]/15 text-[var(--theme-accent)]">
                  {((pt1on1Counts.pending || 0) + (pt1on1Counts.processing || 0) + (pt1on1Counts.message_sent || 0) + (pt1on1Counts.waiting_member || 0)) > 99 ? '99+' : (pt1on1Counts.pending || 0) + (pt1on1Counts.processing || 0) + (pt1on1Counts.message_sent || 0) + (pt1on1Counts.waiting_member || 0)}
                </span>
              )}
            </Button>
            {(pt1on1Counts.waiting_assignment || 0) > 0 && (
              <Button type={pt1on1Tab === 'waiting_assignment' ? 'primary' : 'default'} size="small" onClick={() => setPt1on1Tab('waiting_assignment')}>
                Chờ phân công
                <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none bg-red-500 text-white">
                  {pt1on1Counts.waiting_assignment > 99 ? '99+' : pt1on1Counts.waiting_assignment}
                </span>
              </Button>
            )}
          </div>
        </div>

        <Table
          dataSource={visiblePt1on1Requests}
          rowKey="_id"
          loading={pt1on1Loading}
          pagination={false}
          locale={{ emptyText: 'Không có yêu cầu PT 1-1 nào' }}
          scroll={{ x: 1400 }}
          columns={pt1on1Columns}
        />
      </Modal>

      {/* Gửi đề xuất Modal (nhóm: đề xuất lớp / PT 1-1: đề xuất PT) */}
      <Modal
        title={proposalRequest?.type === 'group' ? 'Gửi đề xuất lớp tập' : 'Gửi đề xuất PT'}
        open={proposalModalOpen}
        onCancel={() => { setProposalModalOpen(false); setProposalRequest(null) }}
        onOk={handleSendProposal}
        okText="Gửi đề xuất"
        cancelText="Hủy"
        confirmLoading={proposalSubmitting}
        width={620}
        destroyOnClose
      >
        {proposalRequest && (() => {
          const m = typeof proposalRequest.memberId === 'object' ? proposalRequest.memberId : null
          const isGroup = proposalRequest.type === 'group'
          return (
            <div className="py-2 space-y-4">
              <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 text-sm">
                <div className="font-semibold text-[var(--gs-text)]">{m ? getUserDisplayName(m) : '—'}</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Tag color="blue">{SPEC_LABELS[proposalRequest.specialization || 'GYM']}</Tag>
                  {proposalRequest.goals?.map((g, i) => <Tag key={i} color="purple">{g}</Tag>)}
                </div>
              </div>

              {isGroup ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--gs-text-muted)]">
                    Chọn lớp đề xuất <span className="normal-case">(bỏ trống nếu chưa có lớp)</span>
                  </p>
                  <Select
                    allowClear
                    showSearch
                    placeholder="Chọn lớp tập..."
                    style={{ width: '100%' }}
                    value={proposalClassId}
                    onChange={(v) => {
                      setProposalClassId(v)
                      const cls = proposalClasses.find((c) => c._id === v)
                      if (cls) {
                        const days = cls.daysLabel || (cls.daysOfWeek || []).map((d) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d]).join(' - ')
                        const time = cls.startTime && cls.endTime ? `${cls.startTime.slice(0, 5)} - ${cls.endTime.slice(0, 5)}` : '—'
                        setProposalText(`Lớp: ${cls.name}\nNgày: ${days || '—'}\nGiờ: ${time}`)
                      }
                    }}
                    optionFilterProp="label"
                    options={proposalClasses.map((c) => ({
                      value: c._id,
                      label: `${c.name}${c.daysLabel ? ` — ${c.daysLabel}` : ''}${c.startTime ? ` — ${c.startTime.slice(0, 5)}` : ''}`,
                    }))}
                  />
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--gs-text-muted)]">
                    Chọn PT đề xuất <span className="normal-case">(bỏ trống nếu chưa có PT)</span>
                  </p>
                  <Select
                    allowClear
                    showSearch
                    placeholder="Chọn PT..."
                    style={{ width: '100%' }}
                    value={proposalPtId}
                    onChange={(v) => {
                      setProposalPtId(v)
                    }}
                    optionFilterProp="label"
                    options={proposalPTs.map((t) => ({
                      value: t._id,
                      label: `${getUserDisplayName(t, '')}${(t.specialties || []).length ? ` — ${t.specialties.join(', ')}` : ''}`,
                    }))}
                  />
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--gs-text-muted)]">
                  Nội dung đề xuất <span className="normal-case">(hội viên sẽ nhận kèm nút Đồng ý / Từ chối)</span>
                </p>
                <textarea
                  className="w-full rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-3 text-sm text-[var(--gs-text)] outline-none transition-colors focus:border-[var(--theme-accent)]"
                  rows={5}
                  value={proposalText}
                  onChange={(e) => setProposalText(e.target.value)}
                  placeholder={isGroup ? 'Mô tả lớp hoặc thời gian đề xuất...' : 'Hãy nhập lý do vì sao bạn đề xuất PT này...'}
                />
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Xếp lớp Modal (yêu cầu nhóm ở trạng thái chờ phân công) */}
      <Modal title="Xếp lớp cho hội viên" open={classAssignModalOpen} onCancel={() => { setClassAssignModalOpen(false); setClassAssignRequest(null) }}
        width={720} centered footer={null} destroyOnClose>
        <div className="py-2 space-y-3">
          {classAssignRequest && (() => {
            const m = typeof classAssignRequest.memberId === 'object' ? classAssignRequest.memberId : null
            return (
              <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 text-sm">
                <div className="font-semibold text-[var(--gs-text)]">{m ? getUserDisplayName(m) : '—'}</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Tag color="blue">{SPEC_LABELS[classAssignRequest.specialization || 'GYM']}</Tag>
                  {classAssignRequest.goals?.map((g, i) => <Tag key={i} color="purple">{g}</Tag>)}
                </div>
              </div>
            )
          })()}

          {classAssignLoading ? (
            <div className="text-center py-8 text-sm text-[var(--gs-text-muted)]">Đang tải...</div>
          ) : classAssignClasses.length === 0 ? (
            <Empty description="Chưa có lớp nào. Vui lòng tạo lớp trước." />
          ) : (
            <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
              {classAssignClasses.map((c) => {
                const zone = c.zoneId as any
                const maxCap = zone?.maxCapacity
                const current = c.currentActiveCount ?? 0
                const isFull = maxCap ? current >= maxCap : false
                const time = c.startTime && c.endTime ? `${c.startTime.slice(0, 5)} - ${c.endTime.slice(0, 5)}` : '—'
                const days = c.daysLabel || (c.daysOfWeek || []).map((d) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d]).join(', ')
                return (
                  <div key={c._id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--gs-border)] p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--gs-text)]">{c.name}</div>
                      <div className="text-xs text-[var(--gs-text-muted)] mt-0.5">
                        {days || '—'} · {time} · {current}/{maxCap || '∞'} học viên
                      </div>
                    </div>
                    <Button type="primary" size="small" disabled={isFull} loading={classAssigningId === c._id}
                      onClick={() => handleAssignClass(c._id)}>
                      Xếp vào lớp
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Lịch sử Modal */}
      <Modal title={historyModal.type === 'group' ? 'Lịch sử yêu cầu tập nhóm' : 'Lịch sử yêu cầu PT 1-1'}
        open={historyModal.open}
        onCancel={() => setHistoryModal((prev) => ({ ...prev, open: false }))}
        footer={null}
        width={1200}
        centered
        destroyOnClose
        styles={{ body: { paddingTop: 8, maxHeight: '75vh', overflowY: 'auto' } }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {HISTORY_TABS.map((t) => {
              const count = t.key === '' ? historyRequests.length : historyRequests.filter((r) => r.status === t.key).length
              return (
                <Button key={t.key || 'all'} type={historyFilter === t.key ? 'primary' : 'default'} size="small" onClick={() => setHistoryFilter(t.key)}>
                  {t.label}
                  {count > 0 && (
                    <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none bg-[var(--theme-accent)]/15 text-[var(--theme-accent)]">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </Button>
              )
            })}
          </div>
        </div>

        <Table
          dataSource={visibleHistoryRequests}
          rowKey="_id"
          loading={historyLoading}
          pagination={false}
          locale={{ emptyText: 'Không có bản ghi nào' }}
          scroll={{ x: 1100 }}
          columns={[
            {
              title: 'Hội viên',
              dataIndex: 'memberId',
              width: 220,
              className: '!whitespace-nowrap',
              render: (m: any) => (
                <div className="flex items-center gap-2">
                  {m?.avatar && <img src={m.avatar} className="h-8 w-8 rounded-full object-cover shrink-0" />}
                  <span className="font-medium text-[var(--gs-text)] truncate">{getUserDisplayName(m)}</span>
                </div>
              ),
            },
            {
              title: 'Chuyên môn',
              width: 140,
              render: (_: any, r: TrainingRequest) => <Tag color="blue" className="m-0">{SPEC_LABELS[r.specialization || 'GYM'] || r.specialization}</Tag>,
            },
            {
              title: 'Nội dung',
              width: 360,
              className: '!whitespace-nowrap',
              render: (_: any, r: TrainingRequest) => {
                if (r.status === 'assigned' && r.type === 'group') {
                  const cls = r.assignedClassId as any
                  return <span className="text-xs text-[var(--gs-text)]">Đã xếp lớp: <strong>{cls?.name || '—'}</strong></span>
                }
                if (r.status === 'assigned' && r.type === 'pt1on1') {
                  const pt = r.assignedTrainerId as any
                  return <span className="text-xs text-[var(--gs-text)]">Đã phân công PT: <strong>{getUserDisplayName(pt, '—')}</strong></span>
                }
                if (r.lastMessage) return <span className="text-xs text-[var(--gs-text)] line-clamp-2 whitespace-normal">{r.lastMessage}</span>
                return <span className="text-xs text-[var(--gs-text-muted)]">—</span>
              },
            },
            {
              title: 'Ngày gửi',
              width: 110,
              render: (_: any, r: TrainingRequest) => (
                <span className="text-xs text-[var(--gs-text-muted)]">{new Date(r.createdAt).toLocaleDateString('vi-VN')}</span>
              ),
            },
            {
              title: 'Trạng thái',
              width: 150,
              render: (_: any, r: TrainingRequest) => <Tag color={STATUS_COLORS[r.status] || 'default'}>{STATUS_LABELS[r.status] || r.status}</Tag>,
            },
          ]}
        />
      </Modal>

      {/* Assign PT Modal */}
      <Modal title="Phân công PT" open={assignModalOpen} onCancel={() => { setAssignModalOpen(false); setAssignRequest(null) }}
        width={600} centered footer={null} destroyOnClose>
        <div className="py-2 space-y-4">
          {assignRequest && (() => {
            const m = typeof assignRequest.memberId === 'object' ? assignRequest.memberId : null
            return (
              <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 text-sm space-y-1">
                <div className="font-semibold text-[var(--gs-text)]">
                  {m ? getUserDisplayName(m) : '—'}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Tag color="blue">{SPEC_LABELS[assignRequest.specialization || 'GYM']}</Tag>
                  {assignRequest.goals?.map((g, i) => <Tag key={i} color="purple">{g}</Tag>)}
                </div>
                <div className="text-xs text-[var(--gs-text-muted)]">
                  <PhoneOutlined className="mr-1" />{assignRequest.contactPhone || '—'}
                </div>
              </div>
            )
          })()}

          <Input.Search
            placeholder="Tìm kiếm PT theo tên, email, chuyên môn..."
            value={assignSearch}
            onChange={(e) => setAssignSearch(e.target.value)}
            allowClear
          />

          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {assignLoading ? (
              <div className="text-center py-8 text-sm text-[var(--gs-text-muted)]">Đang tải...</div>
            ) : filteredAssignTrainers.length === 0 ? (
              <Empty description="Không tìm thấy PT" />
            ) : (
              filteredAssignTrainers.map((t) => {
                const rejected = rejectedPtIds.has(t._id)
                return (
                <Tooltip key={t._id} title={rejected ? 'PT này đã từ chối phụ trách hội viên này.' : undefined}>
                <div
                  onClick={() => { if (!rejected) setSelectedTrainerId(t._id) }}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${rejected ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${
                    selectedTrainerId === t._id
                      ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)]'
                      : 'border-[var(--gs-border)] hover:border-[var(--theme-accent)]'
                  }`}
                >
                  <Avatar src={t.avatar} size={40} className="shrink-0">
                    {getUserDisplayName(t, 'PT').charAt(0)}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-[var(--gs-text)]">{getUserDisplayName(t)}</div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {t.specialties?.map((s, i) => (
                        <Tag key={i} className="m-0 text-xs">{s}</Tag>
                      ))}
                    </div>
                    <div className="text-xs text-[var(--gs-text-muted)] mt-0.5">
                      {t.totalStudents || 0} hội viên đang phụ trách
                    </div>
                  </div>
                  {selectedTrainerId === t._id && (
                    <div className="h-5 w-5 rounded-full bg-[var(--theme-accent)] flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
                </Tooltip>
                )
              })
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => { setAssignModalOpen(false); setAssignRequest(null) }}>Hủy</Button>
            <Button type="primary" loading={assignSubmitting} disabled={!selectedTrainerId} onClick={handleAssignTrainer}>
              Xác nhận phân công
            </Button>
          </div>
        </div>
      </Modal>

    </DashboardLayout>
  )
}
