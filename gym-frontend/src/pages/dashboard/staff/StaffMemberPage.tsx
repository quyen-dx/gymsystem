import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { Badge, Button, Input, Select, Space, Table, Tag, Tooltip, message } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { membershipService, type MembershipPlan } from '../../../services/membershipService'
import { memberService } from '../../../services/memberService'
import type { MemberListItem } from '../../../types/admin/member'
import { getUserDisplayName } from '../../../utils/userDisplay'

type MemberPlanState = 'inactive' | 'no_plan' | 'active' | 'expired'

export default function StaffMemberPage() {
  const navigate = useNavigate()

  const [members, setMembers] = useState<MemberListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [membershipStatus, setMembershipStatus] = useState('')
  const [planId, setPlanId] = useState('')
  const [remainingDays, setRemainingDays] = useState('')
  const [plans, setPlans] = useState<MembershipPlan[]>([])

  const fetchMembers = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const { data } = await memberService.getMembers({
        page: p,
        limit: 15,
        keyword: keyword.trim() || undefined,
        membershipStatus: membershipStatus || undefined,
        planId: planId || undefined,
        remainingDays: remainingDays || undefined,
      })
      setMembers(data.members)
      setTotal(data.pagination.total)
    } catch {
      message.error('Không thể tải danh sách hội viên')
    } finally {
      setLoading(false)
    }
  }, [page, keyword, membershipStatus, planId, remainingDays])

  useEffect(() => {
    fetchMembers(1)
    membershipService.getPlans()
      .then((res) => setPlans((res.data.plans || []).filter((plan) => plan.isActive !== false)))
      .catch(() => setPlans([]))
  }, [])

  const handleSearch = () => {
    setPage(1)
    fetchMembers(1)
  }

  const handleResetFilters = () => {
    setKeyword('')
    setMembershipStatus('')
    setPlanId('')
    setRemainingDays('')
    setPage(1)
    setLoading(true)
    memberService.getMembers({ page: 1, limit: 15 })
      .then(({ data }) => {
        setMembers(data.members)
        setTotal(data.pagination.total)
      })
      .catch(() => message.error('Không thể tải danh sách hội viên'))
      .finally(() => setLoading(false))
  }

  const isExpired = (record: MemberListItem) => {
    if (!record.activeMembership) return false
    return record.activeMembership.status === 'expired' || new Date(record.activeMembership.endDate).getTime() < Date.now()
  }

  const getPlanState = (record: MemberListItem): MemberPlanState => {
    if (!record.isActive) return 'inactive'
    if (!record.activeMembership) return 'no_plan'
    if (isExpired(record)) return 'expired'
    return 'active'
  }

  const showChangePlanNotice = () => {
    message.info('Chức năng đổi gói tại quầy cần API tính chênh lệch/hoàn ví riêng. Hiện tại hãy xử lý đổi gói ở luồng hội viên hoặc bổ sung API staff đổi gói.')
  }

  const columns = [
    {
      title: 'Mã hội viên',
      dataIndex: 'memberCode',
      width: 130,
      render: (code: string) => <Tag>{code || '—'}</Tag>,
    },
    {
      title: 'Họ tên',
      dataIndex: 'name',
      ellipsis: true,
      render: (_: string, record: MemberListItem) => (
        <span className="font-medium">{getUserDisplayName(record) || record.memberCode || '—'}</span>
      ),
    },
    {
      title: 'SĐT',
      dataIndex: 'phone',
      width: 150,
      render: (phone: string) => phone || '—',
    },
    {
      title: 'Gói hiện tại',
      width: 180,
      render: (_: any, record: MemberListItem) => {
        const plan = record.activeMembership?.planId
        if (!plan) return <Tag>Chưa có gói</Tag>
        return <span className="font-medium">{plan.nameVi}</span>
      },
    },
    {
      title: 'Số ngày còn lại',
      width: 150,
      align: 'center' as const,
      render: (_: any, record: MemberListItem) => {
        if (!record.activeMembership) return '—'
        if (isExpired(record)) return <Badge count={0} style={{ backgroundColor: '#EF4444' }} />
        const days = Number(record.remainingDays || 0)
        const color = days <= 7 ? '#EF4444' : days <= 30 ? '#F59E0B' : '#10B981'
        return <Badge count={days} style={{ backgroundColor: color }} />
      },
    },
    {
      title: 'Trạng thái',
      width: 160,
      align: 'center' as const,
      render: (_: any, record: MemberListItem) => {
        const state = getPlanState(record)
        if (state === 'inactive') return <Tag color="error">Đã khóa</Tag>
        if (state === 'no_plan') return <Tag>Chưa từng có gói</Tag>
        if (state === 'expired') return <Tag color="error">Đã hết hạn</Tag>
        if (record.remainingDays <= 7) return <Tag color="warning">Sắp hết hạn</Tag>
        return <Tag color="success">Đang hoạt động</Tag>
      },
    },
    {
      title: 'Thao tác',
      width: 280,
      render: (_: any, record: MemberListItem) => {
        const state = getPlanState(record)
        if (state === 'inactive') return null

        if (state === 'no_plan') {
          return (
            <Button size="small" type="primary" onClick={() => navigate(`/staff/members/${record._id}/register-plan`)}>
              Đăng ký gói
            </Button>
          )
        }

        if (state === 'expired') {
          return (
            <Space wrap size={6}>
              <Button size="small" type="primary" onClick={() => navigate(`/staff/members/${record._id}/renew-plan`)}>
                Gia hạn
              </Button>
              <Button size="small" onClick={() => navigate(`/staff/members/${record._id}/register-plan`)}>
                Đăng ký lại gói
              </Button>
            </Space>
          )
        }

        return (
          <Space wrap size={6}>
            <Button size="small" type="primary" onClick={() => navigate(`/staff/members/${record._id}/renew-plan`)}>
              Gia hạn
            </Button>
            <Tooltip title="Cần API staff đổi gói để tính chênh lệch đúng">
              <Button size="small" onClick={showChangePlanNotice}>
                Đổi gói
              </Button>
            </Tooltip>
          </Space>
        )
      },
    },
  ]

  return (
    <DashboardLayout>
      <section className="mb-6 rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-6">
        <h1 className="m-0 text-3xl font-semibold text-[var(--gs-text)]">Quản lý hội viên</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
          Khách mới tạo hội viên kèm đăng ký gói. Hội viên hiện có chỉ thao tác theo trạng thái gói.
        </p>
      </section>

      <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <Input
            placeholder="Tìm mã hội viên, họ tên, SĐT, email"
            value={keyword}
            allowClear
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Select
            className="min-w-[180px]"
            value={membershipStatus}
            onChange={setMembershipStatus}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'no_plan', label: 'Chưa có gói' },
              { value: 'active', label: 'Đang hoạt động' },
              { value: 'expiring', label: 'Sắp hết hạn' },
              { value: 'expired', label: 'Đã hết hạn' },
            ]}
          />
          <Select
            className="min-w-[190px]"
            value={planId}
            onChange={setPlanId}
            options={[
              { value: '', label: 'Tất cả gói' },
              ...plans.map((plan) => ({
                value: plan._id,
                label: plan.nameVi,
              })),
            ]}
          />
          <Select
            className="min-w-[180px]"
            value={remainingDays}
            onChange={setRemainingDays}
            options={[
              { value: '', label: 'Tất cả ngày còn lại' },
              { value: 'under7', label: 'Còn dưới 7 ngày' },
              { value: 'under15', label: 'Còn dưới 15 ngày' },
              { value: 'under30', label: 'Còn dưới 30 ngày' },
            ]}
          />
          <Space wrap>
            <Button type="primary" onClick={handleSearch}>Tìm kiếm</Button>
            <Button onClick={handleResetFilters}>Xóa lọc</Button>
            <Button icon={<ReloadOutlined />} onClick={() => fetchMembers(page)}>Tải lại</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/staff/members/new')}>
              Thêm hội viên + đăng ký gói
            </Button>
          </Space>
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
                fetchMembers(p)
              },
            }}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
