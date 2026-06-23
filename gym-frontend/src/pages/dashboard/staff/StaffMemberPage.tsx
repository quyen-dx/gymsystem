import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  Badge,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { memberService } from '../../../services/memberService'
import type { MemberListItem } from '../../../types/admin/member'

interface PlanOption {
  _id: string
  nameVi: string
  nameEn: string
  price: number
  durationDays: number
  color?: string
  isActive?: boolean
}

export default function StaffMemberPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  const [members, setMembers] = useState<MemberListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [plans, setPlans] = useState<PlanOption[]>([])

  const [createModal, setCreateModal] = useState(false)
  const [registerModal, setRegisterModal] = useState<{ open: boolean; memberId: string; memberName: string }>({ open: false, memberId: '', memberName: '' })
  const [renewModal, setRenewModal] = useState<{ open: boolean; memberId: string; memberName: string; endDate?: string }>({ open: false, memberId: '', memberName: '' })
  const [submitting, setSubmitting] = useState(false)

  const [createForm] = Form.useForm()
  const [registerForm] = Form.useForm()
  const [renewForm] = Form.useForm()

  const fetchMembers = useCallback(async (p = page, s = search) => {
    setLoading(true)
    try {
      const { data } = await memberService.getMembers({ page: p, limit: 15, search: s })
      setMembers(data.members)
      setTotal(data.pagination.total)
    } catch {
      message.error(t('staff.members.error.fetch_failed'))
    } finally {
      setLoading(false)
    }
  }, [page, search, t])

  const fetchPlans = useCallback(async () => {
    try {
      const api = (await import('../../../services/api')).default
      const { data } = await api.get<{ plans: PlanOption[] }>('/plans', { params: { limit: 100 } })
      setPlans(data.plans?.filter((p) => p.isActive) || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchMembers()
    fetchPlans()
  }, [])

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    fetchMembers(1, value)
  }

  const planOptions = useMemo(() =>
    plans.map((p) => ({
      value: p._id,
      label: `${lang.startsWith('vi') ? p.nameVi : p.nameEn} — ${(p.price || 0).toLocaleString('vi-VN')}đ / ${p.durationDays} ${t('staff.members.plan.days')}`,
    })),
  [plans, lang, t])

  const paymentMethods = [
    { value: 'CASH', label: t('staff.members.plan.cash') },
    { value: 'BANK_TRANSFER', label: t('staff.members.plan.bank_transfer') },
    { value: 'POS', label: t('staff.members.plan.pos') },
  ]

  const selectedPlanForCreate = plans.find((p) => p._id === createForm.getFieldValue('planId'))
  const selectedPlanForRegister = plans.find((p) => p._id === registerForm.getFieldValue('planId'))
  const handleCreateMember = async () => {
    try {
      const values = await createForm.validateFields()
      setSubmitting(true)
      const payload: any = {
        name: values.name,
        email: values.email || undefined,
        phone: values.phone || undefined,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.toISOString() : undefined,
        gender: values.gender || undefined,
        password: values.password || 'member123',
      }

      if (values.registerPlan === true && values.planId) {
        payload.planId = values.planId
        payload.paymentMethod = values.paymentMethod
        payload.amountPaid = values.amountPaid
        payload.memo = values.memo || ''
        const { data } = await memberService.createAndRegister(payload)
        message.success(data.message || t('staff.members.success.created_with_plan'))
      } else {
        const { data } = await memberService.createMember(payload)
        message.success(data.message || t('staff.members.success.created'))
      }

      createForm.resetFields()
      setCreateModal(false)
      fetchMembers(1, '')
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.response?.data?.message || t('staff.members.error.create_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegisterPlan = async () => {
    try {
      const values = await registerForm.validateFields()
      setSubmitting(true)
      const { data } = await memberService.offlineRegister({
        memberId: registerModal.memberId,
        planId: values.planId,
        paymentMethod: values.paymentMethod,
        amountPaid: values.amountPaid,
        note: values.memo || '',
      })
      message.success(data.message || t('staff.members.success.registered'))
      registerForm.resetFields()
      setRegisterModal({ open: false, memberId: '', memberName: '' })
      fetchMembers(page, search)
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.response?.data?.message || t('staff.members.error.register_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRenewPlan = async () => {
    try {
      const values = await renewForm.validateFields()
      setSubmitting(true)
      const { data } = await memberService.renewPlan(
        renewModal.memberId,
        values.planId,
        values.renewFrom || 'today',
      )
      message.success(data.message || t('staff.members.success.renewed'))
      renewForm.resetFields()
      setRenewModal({ open: false, memberId: '', memberName: '' })
      fetchMembers(page, search)
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.response?.data?.message || t('staff.members.error.renew_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      title: t('staff.members.table.no'),
      width: 60,
      align: 'center' as const,
      render: (_: any, __: MemberListItem, index: number) => (page - 1) * 15 + index + 1,
    },
    {
      title: t('staff.members.table.name'),
      dataIndex: 'name',
      ellipsis: true,
      render: (name: string, record: MemberListItem) => (
        <span style={{ fontWeight: 500 }}>{name || record.memberCode || '—'}</span>
      ),
    },
    {
      title: t('staff.members.table.code'),
      dataIndex: 'memberCode',
      width: 100,
      render: (code: string) => <Tag>{code || '—'}</Tag>,
    },
    {
      title: t('staff.members.table.phone'),
      dataIndex: 'phone',
      width: 120,
      render: (phone: string) => phone || '—',
    },
    {
      title: t('staff.members.table.plan'),
      width: 140,
      render: (_: any, record: MemberListItem) => {
        const plan = record.activeMembership?.planId
        return plan ? (
          <span>{lang.startsWith('vi') ? plan.nameVi : plan.nameEn || '—'}</span>
        ) : (
          <Tag color="default">{t('staff.members.status.no_plan')}</Tag>
        )
      },
    },
    {
      title: t('staff.members.table.remaining'),
      width: 90,
      align: 'center' as const,
      render: (_: any, record: MemberListItem) => {
        if (!record.activeMembership) return <span style={{ color: 'var(--gs-text-muted)' }}>—</span>
        const days = record.remainingDays
        const color = days <= 7 ? 'red' : days <= 30 ? 'orange' : 'green'
        return <Badge count={days} style={{ backgroundColor: color === 'green' ? '#10B981' : color === 'orange' ? '#F59E0B' : '#EF4444' }} />
      },
    },
    {
      title: t('staff.members.table.status'),
      width: 90,
      align: 'center' as const,
      render: (_: any, record: MemberListItem) => {
        if (!record.isActive) return <Tag color="error">{t('staff.members.status.locked')}</Tag>
        const days = record.remainingDays
        if (days <= 0) return <Tag color="default">{t('staff.members.status.no_plan')}</Tag>
        if (days <= 7) return <Tag color="warning">{t('staff.members.status.expiring_soon')}</Tag>
        return <Tag color="success">{t('staff.members.status.active')}</Tag>
      },
    },
    {
      title: t('staff.members.table.actions'),
      width: 220,
      render: (_: any, record: MemberListItem) => (
        <Space size={4}>
          {record.isActive && !record.activeMembership && (
            <Tooltip title={t('staff.members.actions.register')}>
              <Button size="small" type="primary"
                onClick={() => setRegisterModal({ open: true, memberId: record._id, memberName: record.name })}
              >
                {t('staff.members.actions.register')}
              </Button>
            </Tooltip>
          )}
          {record.isActive && record.activeMembership && (
            <Tooltip title={t('staff.members.actions.renew')}>
              <Button size="small"
                onClick={() => setRenewModal({
                  open: true,
                  memberId: record._id,
                  memberName: record.name,
                  endDate: record.activeMembership?.endDate,
                })}
              >
                {t('staff.members.actions.renew')}
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <section className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">{t('staff.members.overline')}</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">{t('staff.members.title')}</h1>
      </section>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <Input.Search
            placeholder={t('staff.members.search_placeholder')}
            allowClear
            onSearch={handleSearch}
            onChange={(e) => !e.target.value && handleSearch('')}
          />
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => fetchMembers()}>{t('common.reload')}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateModal(true) }}>
              {t('staff.members.add_member')}
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
              onChange: (p) => { setPage(p); fetchMembers(p, search) },
            }}
          />
        </div>
      </div>

      {/* CREATE MEMBER MODAL */}
      <Modal
        title={t('staff.members.create_with_plan')}
        open={createModal}
        onCancel={() => setCreateModal(false)}
        onOk={handleCreateMember}
        confirmLoading={submitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        width={720}
        destroyOnClose
      >
        <Form layout="vertical" form={createForm} style={{ marginTop: 16 }}>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Form.Item name="name" label={t('staff.members.form.name')}
              rules={[{ required: true, message: t('staff.members.form.name_required') }]}
            >
              <Input placeholder="Nguyễn Văn A" />
            </Form.Item>
            <Form.Item name="phone" label={t('staff.members.form.phone')}>
              <Input placeholder="090xxxxxxx" />
            </Form.Item>
            <Form.Item name="email" label={t('staff.members.form.email')}>
              <Input placeholder="email@example.com" type="email" />
            </Form.Item>
            <Form.Item name="dateOfBirth" label={t('staff.members.form.dateOfBirth')}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="gender" label={t('staff.members.form.gender')}>
              <Select allowClear placeholder={t('staff.members.form.optional')}>
                <Select.Option value="male">{t('staff.members.form.male')}</Select.Option>
                <Select.Option value="female">{t('staff.members.form.female')}</Select.Option>
                <Select.Option value="other">{t('staff.members.form.other')}</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="password" label={t('staff.members.form.password')}
              tooltip={t('staff.members.form.password_default')}
              rules={[
                { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' },
              ]}
            >
              <Input.Password placeholder={t('staff.members.form.password_default')} />
            </Form.Item>
          </div>

          <div className="mb-1 mt-4 font-medium">Đăng ký gói tập</div>
          <Form.Item name="registerPlan" initialValue={false}>
            <Radio.Group>
              <Radio value={false}>Không</Radio>
              <Radio value={true}>Có, đăng ký gói ngay</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.registerPlan !== cur.registerPlan}>
            {({ getFieldValue }) =>
              getFieldValue('registerPlan') === true ? (
                <>
                  <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                    <Form.Item name="planId" label={t('staff.members.plan.select_plan')}
                      rules={[{ required: true, message: t('staff.members.plan.select_plan_required') }]}
                    >
                      <Select placeholder={t('staff.members.plan.select_plan')} options={planOptions} />
                    </Form.Item>
                    <Form.Item name="paymentMethod" label={t('staff.members.plan.payment_method')}
                      rules={[{ required: true, message: t('staff.members.plan.payment_method_required') }]}
                    >
                      <Radio.Group>
                        {paymentMethods.map((m) => <Radio key={m.value} value={m.value}>{m.label}</Radio>)}
                      </Radio.Group>
                    </Form.Item>
                    <Form.Item name="amountPaid" label={t('staff.members.plan.amount')}
                      rules={[{ required: true, message: t('staff.members.plan.amount_placeholder') }]}
                    >
                      <InputNumber min={0} style={{ width: '100%' }}
                        formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        placeholder={t('staff.members.plan.amount_placeholder')}
                      />
                    </Form.Item>
                    <Form.Item name="memo" label={t('staff.members.plan.memo')}>
                      <Input placeholder={t('staff.members.plan.memo')} />
                    </Form.Item>
                  </div>

                  {selectedPlanForCreate && (
                    <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-4">
                      <div className="mb-1 text-sm font-semibold">
                        {lang.startsWith('vi') ? selectedPlanForCreate.nameVi : selectedPlanForCreate.nameEn}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--gs-text-muted)' }}>
                        <span>{t('staff.members.plan.price')}:</span>
                        <span className="font-semibold" style={{ color: 'var(--gs-text)' }}>
                          {(selectedPlanForCreate.price || 0).toLocaleString('vi-VN')}đ
                        </span>
                        <span>{t('staff.members.plan.duration')}:</span>
                        <span className="font-semibold" style={{ color: 'var(--gs-text)' }}>
                          {selectedPlanForCreate.durationDays} {t('staff.members.plan.days')}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* REGISTER PLAN MODAL */}
      <Modal
        title={`${t('staff.members.register_plan')} — ${registerModal.memberName}`}
        open={registerModal.open}
        onCancel={() => { registerForm.resetFields(); setRegisterModal({ open: false, memberId: '', memberName: '' }) }}
        onOk={handleRegisterPlan}
        confirmLoading={submitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        width={640}
        destroyOnClose
      >
        <Form layout="vertical" form={registerForm} style={{ marginTop: 16 }}>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Form.Item name="planId" label={t('staff.members.plan.select_plan')}
              rules={[{ required: true, message: t('staff.members.plan.select_plan_required') }]}
            >
              <Select placeholder={t('staff.members.plan.select_plan')} options={planOptions} />
            </Form.Item>
            <Form.Item name="paymentMethod" label={t('staff.members.plan.payment_method')}
              rules={[{ required: true, message: t('staff.members.plan.payment_method_required') }]}
            >
              <Radio.Group>
                {paymentMethods.map((m) => <Radio key={m.value} value={m.value}>{m.label}</Radio>)}
              </Radio.Group>
            </Form.Item>
            <Form.Item name="amountPaid" label={t('staff.members.plan.amount')}
              rules={[{ required: true, message: t('staff.members.plan.amount_placeholder') }]}
            >
              <InputNumber min={0} style={{ width: '100%' }}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                placeholder={t('staff.members.plan.amount_placeholder')}
              />
            </Form.Item>
            <Form.Item name="memo" label={t('staff.members.plan.memo')}>
              <Input placeholder={t('staff.members.plan.memo')} />
            </Form.Item>
          </div>

          {selectedPlanForRegister && (
            <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-4">
              <div className="mb-1 text-sm font-semibold">
                {lang.startsWith('vi') ? selectedPlanForRegister.nameVi : selectedPlanForRegister.nameEn}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--gs-text-muted)' }}>
                <span>{t('staff.members.plan.price')}:</span>
                <span className="font-semibold" style={{ color: 'var(--gs-text)' }}>
                  {(selectedPlanForRegister.price || 0).toLocaleString('vi-VN')}đ
                </span>
                <span>{t('staff.members.plan.duration')}:</span>
                <span className="font-semibold" style={{ color: 'var(--gs-text)' }}>
                  {selectedPlanForRegister.durationDays} {t('staff.members.plan.days')}
                </span>
              </div>
            </div>
          )}
        </Form>
      </Modal>

      {/* RENEW PLAN MODAL */}
      <Modal
        title={`${t('staff.members.renew_plan')} — ${renewModal.memberName}`}
        open={renewModal.open}
        onCancel={() => { renewForm.resetFields(); setRenewModal({ open: false, memberId: '', memberName: '' }) }}
        onOk={handleRenewPlan}
        confirmLoading={submitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        width={640}
        destroyOnClose
      >
        <Form layout="vertical" form={renewForm} style={{ marginTop: 16 }}>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Form.Item name="planId" label={t('staff.members.plan.select_plan')}
              rules={[{ required: true, message: t('staff.members.plan.select_plan_required') }]}
            >
              <Select placeholder={t('staff.members.plan.select_plan')} options={planOptions} />
            </Form.Item>
            <Form.Item name="renewFrom" label={t('staff.members.plan.renew_from')} initialValue="endDate">
              <Radio.Group>
                <Radio value="endDate">{t('staff.members.plan.from')}</Radio>
                <Radio value="today">{t('staff.members.plan.today')}</Radio>
              </Radio.Group>
            </Form.Item>
          </div>

          <Form.Item shouldUpdate={(prev, cur) => prev.planId !== cur.planId || prev.renewFrom !== cur.renewFrom}>
            {({ getFieldValue }) => {
              const pid = getFieldValue('planId')
              const rfrom = getFieldValue('renewFrom')
              const plan = plans.find((p) => p._id === pid)
              if (!plan) return null
              const baseDate = rfrom === 'endDate' && renewModal.endDate
                ? dayjs(renewModal.endDate).add(1, 'day')
                : dayjs()
              const endDate = baseDate.add(plan.durationDays - 1, 'day')
              return (
                <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-4">
                  <div className="mb-1 text-sm font-semibold">
                    {lang.startsWith('vi') ? plan.nameVi : plan.nameEn}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--gs-text-muted)' }}>
                    <span>{t('staff.members.plan.price')}:</span>
                    <span className="font-semibold" style={{ color: 'var(--gs-text)' }}>
                      {(plan.price || 0).toLocaleString('vi-VN')}đ
                    </span>
                    <span>{t('staff.members.plan.duration')}:</span>
                    <span className="font-semibold" style={{ color: 'var(--gs-text)' }}>
                      {plan.durationDays} {t('staff.members.plan.days')}
                    </span>
                    <span>{t('staff.members.plan.summary')}:</span>
                    <span className="font-semibold" style={{ color: '#10B981' }}>
                      {baseDate.format('DD/MM/YYYY')} → {endDate.format('DD/MM/YYYY')}
                    </span>
                  </div>
                </div>
              )
            }}
          </Form.Item>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
