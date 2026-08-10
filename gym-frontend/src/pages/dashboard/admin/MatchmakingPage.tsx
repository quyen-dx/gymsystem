import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Button, Card, Select, Tag, Progress, message, Spin, Empty, Tooltip } from 'antd'
import { ArrowLeftOutlined, TeamOutlined, ClockCircleOutlined } from '@ant-design/icons'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { trainingRequestService, type TrainingRequest } from '../../../services/trainingRequestService'
import { trainingClassService, type TrainingClass } from '../../../services/trainingGroupService'
import { trainerService } from '../../../services/trainerService'
import { getUserDisplayName } from '../../../utils/userDisplay'

const TIME_SLOT_GROUPS = [
  { label: 'Tất cả', value: '' },
  { label: 'Sáng (06:00 - 12:00)', value: 'morning' },
  { label: 'Chiều (12:00 - 18:00)', value: 'afternoon' },
  { label: 'Tối (18:00 - 22:00)', value: 'evening' },
]

const DAY_LABELS: Record<number, string> = { 0: 'CN', 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7' }

function slotToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

function timeSlotGroup(time: string): string {
  const start = slotToMinutes(time.split('-')[0].trim())
  if (start >= 360 && start < 720) return 'morning'
  if (start >= 720 && start < 1080) return 'afternoon'
  return 'evening'
}

export default function MatchmakingPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const requestId = searchParams.get('requestId')

  const [request, setRequest] = useState<TrainingRequest | null>(null)
  const [classes, setClasses] = useState<TrainingClass[]>([])
  const [trainers, setTrainers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [assigningId, setAssigningId] = useState<string | null>(null)

  const [filterSpecialization, setFilterSpecialization] = useState<string>('')
  const [filterTimeGroup, setFilterTimeGroup] = useState<string>('')
  const [filterPtId, setFilterPtId] = useState<string>('')
  const [showNearMatches, setShowNearMatches] = useState(false)

  useEffect(() => {
    if (!requestId) return
    const load = async () => {
      setLoading(true)
      try {
        const [reqRes, clRes, ptRes] = await Promise.all([
          trainingRequestService.getById(requestId),
          trainingClassService.getAll({ page: 1, limit: 100 }),
          trainerService.getPTs({ pageSize: 100 }),
        ])
        const req = reqRes.data.request
        setRequest(req)
        const acceptedProposal = req?.acceptedProposal || req?.selectedProposal || req?.approvedProposal
          || (req?.proposalAccepted ? (req?.currentProposal || req?.proposal) : null)
        if (acceptedProposal?.specialization || req?.specialization) {
          setFilterSpecialization(acceptedProposal?.specialization || req.specialization)
        }
        if (acceptedProposal?.trainerId) setFilterPtId(String(acceptedProposal.trainerId))
        setClasses(clRes.data.classes || [])
        setTrainers(ptRes.data?.pts || [])
      } catch {
        message.error('Không thể tải dữ liệu')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [requestId])

  const member = request?.memberId as any
  const acceptedProposal = request?.acceptedProposal || request?.selectedProposal || request?.approvedProposal
    || (request?.proposalAccepted ? (request?.currentProposal || request?.proposal) : null)
  const effectiveRequest = request && acceptedProposal ? {
    ...request,
    specialization: acceptedProposal.specialization || request.specialization,
    goals: acceptedProposal.goals?.length ? acceptedProposal.goals : request.goals,
    timeSlots: acceptedProposal.timeSlots?.length
      ? acceptedProposal.timeSlots
      : acceptedProposal.startTime && acceptedProposal.endTime
        ? [`${acceptedProposal.startTime.slice(0, 5)}-${acceptedProposal.endTime.slice(0, 5)}`]
        : request.timeSlots,
    daysOfWeek: acceptedProposal.daysOfWeek?.length ? acceptedProposal.daysOfWeek : request.daysOfWeek,
  } : request
  const proposalPtId = acceptedProposal?.trainerId ? String(acceptedProposal.trainerId) : ''
  const proposalZoneId = acceptedProposal?.zoneId ? String(acceptedProposal.zoneId) : ''
  const requestSlots = (effectiveRequest?.timeSlots || []).map((s) => s.replace(/\s/g, ''))

  const getCapacityInfo = (c: TrainingClass) => {
    const zone = c.zoneId as any
    const maxCap = zone?.maxCapacity
    const current = c.currentActiveCount ?? 0
    const remaining = maxCap ? Math.max(maxCap - current, 0) : 99
    const isFull = maxCap ? current >= maxCap : false
    const percent = maxCap ? Math.round((current / maxCap) * 100) : 0
    return { maxCap, current, remaining, isFull, percent }
  }

  const getClassMatchInfo = (c: TrainingClass) => {
    const reqSpec = (effectiveRequest?.specialization || '').trim().toLowerCase()
    const classSpec = (c.specialization || '').trim().toLowerCase()
    const specMatch = !reqSpec || classSpec === reqSpec

    const classSlot = c.startTime && c.endTime ? `${c.startTime.slice(0, 5)}-${c.endTime.slice(0, 5)}` : ''
    const timeMatch = requestSlots.length === 0 || (!!classSlot && requestSlots.includes(classSlot))

    const reqDays = effectiveRequest?.daysOfWeek || []
    const classDays = c.daysOfWeek || []
    const sharedDays = reqDays.filter((d) => classDays.includes(d))
    const dayMatch = reqDays.length === 0 || sharedDays.length > 0

    const pt = c.ptId as any
    const ptId = pt?._id || pt
    const ptMatch = !proposalPtId || String(ptId) === proposalPtId

    const zone = c.zoneId as any
    const zoneId = zone?._id || zone
    const zoneMatch = !proposalZoneId || String(zoneId) === proposalZoneId

    const capacity = getCapacityInfo(c)
    const isAssignable = specMatch && timeMatch && dayMatch && ptMatch && zoneMatch && !capacity.isFull
    const dayScore = reqDays.length === 0 ? 25 : Math.round((sharedDays.length / reqDays.length) * 25)
    const rawScore =
      (specMatch ? 35 : 0) +
      (timeMatch ? 25 : 0) +
      dayScore +
      (ptMatch ? 5 : 0) +
      (zoneMatch ? 5 : 0) +
      (!capacity.isFull ? 5 : 0) +
      (c.status === 'active' ? 5 : 0)
    const score = Math.min(rawScore, 100)

    const reasons: string[] = []
    if (!specMatch) reasons.push('Lệch chuyên môn')
    if (!timeMatch) reasons.push('Lệch giờ')
    if (!dayMatch) reasons.push('Lệch ngày')
    if (!ptMatch) reasons.push('Lệch PT đã đề xuất')
    if (!zoneMatch) reasons.push('Lệch khu vực đã đề xuất')
    if (capacity.isFull) reasons.push('Lớp đã đầy')

    return { ...capacity, specMatch, timeMatch, dayMatch, ptMatch, zoneMatch, sharedDays, isAssignable, score, reasons }
  }

  const matchesEffectiveRequest = (c: TrainingClass) => {
    return getClassMatchInfo(c).isAssignable
  }

  const filteredClasses = classes.map((c) => ({ classItem: c, match: getClassMatchInfo(c) })).filter(({ classItem: c, match }) => {
    if (acceptedProposal && !matchesEffectiveRequest(c)) return false
    if (filterSpecialization) {
      const spec = (c.specialization || '').toLowerCase()
      const filter = filterSpecialization.toLowerCase()
      if (spec !== filter) return false
    }
    if (filterTimeGroup) {
      const group = c.startTime ? timeSlotGroup(c.startTime) : ''
      if (group !== filterTimeGroup) return false
    }
    if (filterPtId) {
      const pt = c.ptId as any
      const ptId = pt?._id || pt
      if (String(ptId) !== filterPtId) return false
    }
    if (proposalPtId) {
      const pt = c.ptId as any
      const ptId = pt?._id || pt
      if (String(ptId) !== proposalPtId) return false
    }
    if (proposalZoneId) {
      const zone = c.zoneId as any
      const zoneId = zone?._id || zone
      if (String(zoneId) !== proposalZoneId) return false
    }
    if (!showNearMatches && !match.isAssignable) return false
    return true
  }).sort((a, b) => {
    if (a.match.isAssignable !== b.match.isAssignable) return a.match.isAssignable ? -1 : 1
    if (b.match.score !== a.match.score) return b.match.score - a.match.score
    if (b.match.sharedDays.length !== a.match.sharedDays.length) return b.match.sharedDays.length - a.match.sharedDays.length
    return (a.classItem.currentActiveCount ?? 0) - (b.classItem.currentActiveCount ?? 0)
  }).map((item) => item.classItem)

  const handleAssign = async (classId: string) => {
    if (!requestId) return
    setAssigningId(classId)
    try {
      await trainingRequestService.assignToClass(requestId, classId)
      message.success('Đã xếp lớp thành công')
      navigate('/admin/members')
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Xếp lớp thất bại')
    } finally {
      setAssigningId(null)
    }
  }

  if (!requestId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Empty description="Không tìm thấy yêu cầu" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/members')}
          className="mb-4 text-[var(--gs-text-muted)] hover:text-[var(--gs-text)]">
          Quay lại quản lý thành viên
        </Button>

        {loading ? (
          <div className="flex justify-center py-20"><Spin size="large" /></div>
        ) : !request ? (
          <Empty description="Không tìm thấy yêu cầu" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Member Request Panel */}
            <div className="lg:col-span-1">
              <Card title={<span className="text-base font-semibold">Thông tin yêu cầu</span>} className="rounded-2xl shadow-sm border-[var(--gs-border)]">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-[var(--gs-border)]">
                    {member?.avatar ? (
                      <img src={member.avatar} className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-[var(--gs-border)] flex items-center justify-center text-lg font-semibold text-[var(--gs-text-muted)]">
                        {getUserDisplayName(member, '?')[0]}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-[var(--gs-text)]">{getUserDisplayName(member)}</div>
                      <div className="text-xs text-[var(--gs-text-muted)]">{member?.memberCode || ''}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-[var(--gs-text-muted)] mb-1 uppercase tracking-wider">Chuyên môn</div>
                    <Tag className="text-sm font-semibold px-3 py-1" color="blue">{effectiveRequest?.specialization || '—'}</Tag>
                  </div>

                  {acceptedProposal?.trainerName && (
                    <div>
                      <div className="text-xs text-[var(--gs-text-muted)] mb-1 uppercase tracking-wider">PT</div>
                      <span className="text-sm text-[var(--gs-text)]">{acceptedProposal.trainerName}</span>
                    </div>
                  )}

                  {(acceptedProposal?.zoneName || acceptedProposal?.floorName) && (
                    <div>
                      <div className="text-xs text-[var(--gs-text-muted)] mb-1 uppercase tracking-wider">Địa điểm</div>
                      <span className="text-sm text-[var(--gs-text)]">
                        {[acceptedProposal.floorName, acceptedProposal.zoneName].filter(Boolean).join(' - ')}
                      </span>
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-[var(--gs-text-muted)] mb-1 uppercase tracking-wider">Khung giờ mong muốn</div>
                    <div className="flex flex-wrap gap-1">
                      {(effectiveRequest?.timeSlots || []).length > 0
                        ? effectiveRequest?.timeSlots.map((s) => <Tag key={s} className="text-sm">{s}</Tag>)
                        : <span className="text-sm text-[var(--gs-text-muted)]">Linh hoạt</span>}
                    </div>
                  </div>

                  {request.desiredSessions && (
                    <div>
                      <div className="text-xs text-[var(--gs-text-muted)] mb-1 uppercase tracking-wider">Số buổi / tuần</div>
                      <span className="text-sm font-medium text-[var(--gs-text)]">{request.desiredSessions} buổi</span>
                    </div>
                  )}

                  {effectiveRequest?.daysOfWeek?.length > 0 && (
                    <div>
                      <div className="text-xs text-[var(--gs-text-muted)] mb-1 uppercase tracking-wider">Ngày mong muốn</div>
                      <div className="flex flex-wrap gap-1">
                        {effectiveRequest.daysOfWeek.map((d) => (
                          <Tag key={d} className="text-sm">{DAY_LABELS[d] || d}</Tag>
                        ))}
                      </div>
                    </div>
                  )}

                  {effectiveRequest?.goals?.length > 0 && (
                    <div>
                      <div className="text-xs text-[var(--gs-text-muted)] mb-1 uppercase tracking-wider">Mục tiêu</div>
                      <div className="flex flex-wrap gap-1">
                        {effectiveRequest.goals.map((g) => <Tag key={g} color="purple" className="text-sm">{g}</Tag>)}
                      </div>
                    </div>
                  )}

                  {request.healthNotes && (
                    <div>
                      <div className="text-xs text-[var(--gs-text-muted)] mb-1 uppercase tracking-wider">Ghi chú sức khỏe</div>
                      <p className="text-sm text-[var(--gs-text)]">{request.healthNotes}</p>
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-[var(--gs-text-muted)] mb-1 uppercase tracking-wider">Trạng thái</div>
                    <Tag color={request.status === 'assigned' ? 'green' : 'orange'}>
                      {request.status === 'waiting_assignment' ? 'Chờ phân công' : request.status === 'pending' ? 'Chờ xếp lớp' : request.status === 'assigned' ? 'Đã xếp lớp' : request.status}
                    </Tag>
                  </div>
                </div>
              </Card>
            </div>

            {/* Class Matcher Panel */}
            <div className="lg:col-span-2">
              <Card title={<span className="text-base font-semibold">Danh sách lớp tập phù hợp</span>}
                className="rounded-2xl shadow-sm border-[var(--gs-border)]">

                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-6 pb-4 border-b border-[var(--gs-border)]">
                  <Select value={filterSpecialization} onChange={setFilterSpecialization}
                    style={{ minWidth: 140 }} options={[
                    { value: '', label: 'Tất cả chuyên môn' },
                    ...(effectiveRequest?.specialization ? [{ value: effectiveRequest.specialization, label: effectiveRequest.specialization }] : []),
                  ]} />
                  <Select value={filterTimeGroup} onChange={setFilterTimeGroup}
                    style={{ minWidth: 180 }}
                    options={TIME_SLOT_GROUPS.map((g) => ({ value: g.value, label: g.label }))} />
                  <Select value={filterPtId || undefined} onChange={setFilterPtId}
                    style={{ minWidth: 180 }} allowClear
                    placeholder="Lọc theo PT"
                    options={trainers.map((t: any) => ({
                      value: t._id,
                      label: getUserDisplayName(t, 'PT'),
                    }))} />
                  <Button onClick={() => setShowNearMatches((v) => !v)}>
                    {showNearMatches ? 'Chỉ hiện lớp có thể xếp' : 'Hiện lớp gần khớp'}
                  </Button>
                </div>

                {/* Class List */}
                {filteredClasses.length === 0 ? (
                  <div className="text-center py-12">
                    <Empty description="Không có lớp tập phù hợp với bộ lọc" />
                    <Button type="primary" ghost className="mt-4" onClick={() => navigate('/admin/training-classes')}>
                      Tạo lớp mới
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {filteredClasses.map((c) => {
                      const pt = c.ptId as any
                      const ptName = pt ? getUserDisplayName(pt) : '—'
                      const match = getClassMatchInfo(c)
                      const { maxCap, current, remaining, isFull, percent } = match
                      const timeLabel = c.startTime && c.endTime ? `${c.startTime.slice(0, 5)} - ${c.endTime.slice(0, 5)}` : '—'
                      const dayLabel = c.daysLabel || ''
                      const specLabel = c.specializationLabel || c.specialization || ''
                      const perfect = match.isAssignable

                      return (
                        <div key={c._id} className={`rounded-xl border p-4 transition-all hover:shadow-md ${perfect ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)]' : 'border-[var(--gs-border)] bg-[var(--gs-card)]'}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-bold text-[var(--gs-text)]">{c.name}</span>
                                {perfect && <Tag color="green" className="m-0 text-xs leading-none px-1 py-0.5">Phù hợp nhất</Tag>}
                                {!perfect && <Tag color="orange" className="m-0 text-xs leading-none px-1 py-0.5">{match.score}% phù hợp</Tag>}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-[var(--gs-text)]">
                                <div className="flex items-center gap-1.5">
                                  {pt?.avatar && <img src={pt.avatar} className="h-5 w-5 rounded-full object-cover" />}
                                  <span className="truncate">{ptName}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <ClockCircleOutlined className="text-[var(--gs-text-muted)]" />
                                  <span>{timeLabel}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <TeamOutlined className="text-[var(--gs-text-muted)]" />
                                  <span>{dayLabel || '—'}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 mt-3 text-sm">
                                <span className="text-xs text-[var(--gs-text-muted)] uppercase">{specLabel}</span>
                                <div className="flex-1 max-w-[200px]">
                                  <Progress percent={percent} size="small" strokeColor={percent >= 100 ? '#f5222d' : percent >= 80 ? '#faad14' : '#52c41a'}
                                    format={() => `${current}/${maxCap || '∞'}`} />
                                </div>
                                <span className={`text-xs font-medium ${isFull ? 'text-red-500' : remaining <= 2 ? 'text-orange-500' : 'text-green-600'}`}>
                                  {isFull ? 'Đã đầy' : `Còn ${remaining} chỗ`}
                                </span>
                              </div>
                              {!perfect && match.reasons.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {match.reasons.map((reason) => (
                                    <Tag key={reason} className="m-0 text-xs">{reason}</Tag>
                                  ))}
                                </div>
                              )}
                            </div>
                            {perfect ? (
                              <Button type="primary" size="middle"
                                disabled={isFull || !['pending', 'waiting_assignment', 'waiting_reassign'].includes(request.status)} loading={assigningId === c._id}
                                onClick={() => handleAssign(c._id)}
                                className="shrink-0">
                                Xếp vào lớp này
                              </Button>
                            ) : (
                              <Tooltip title={`Chưa thể xếp ngay: ${match.reasons.join(', ') || 'lớp chưa đủ điều kiện'}.`}>
                                <Button size="middle" disabled className="shrink-0">
                                  Chưa khớp
                                </Button>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
