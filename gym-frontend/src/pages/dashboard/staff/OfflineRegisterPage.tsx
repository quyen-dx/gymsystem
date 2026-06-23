import { ArrowLeftOutlined, CheckCircleOutlined, CreditCardOutlined, MoneyCollectOutlined, QrcodeOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar, Button, Card, Descriptions, Empty, Input, List, Radio, Spin, Statistic, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { membershipService, type MembershipPlan } from '../../../services/membershipService'

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('vi-VN') : '-'

export default function OfflineRegisterPage() {
  const navigate = useNavigate()
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedMember, setSelectedMember] = useState<any | null>(null)

  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null)

  const [paymentMethod, setPaymentMethod] = useState<string>('CASH')
  const [amountPaid, setAmountPaid] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLoadingPlans(true)
    membershipService.getPlans()
      .then((res) => setPlans(res.data.plans || []))
      .catch(() => message.error('Không thể tải danh sách gói tập'))
      .finally(() => setLoadingPlans(false))
  }, [])

  let searchTimer: ReturnType<typeof setTimeout>
  const handleSearch = (value: string) => {
    setSearchKeyword(value)
    clearTimeout(searchTimer)
    if (!value.trim()) {
      setSearchResults([])
      return
    }
    searchTimer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await membershipService.searchMembers(value.trim())
        setSearchResults(res.data.members || [])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
  }

  const selectMember = (member: any) => {
    setSelectedMember(member)
    setSearchKeyword('')
    setSearchResults([])
  }

  const amount = Number(amountPaid) || 0
  const planPrice = selectedPlan?.price || 0
  const canSubmit = selectedMember && selectedPlan && paymentMethod && amount >= planPrice

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await membershipService.offlineRegister({
        memberId: selectedMember._id,
        planId: selectedPlan!._id,
        paymentMethod,
        amountPaid: amount,
        note: note.trim() || undefined,
      })
      message.success('Đăng ký gói tập offline thành công.')
      navigate('/staff/payments')
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Đăng ký thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1600px] px-4 py-8 md:px-6 lg:px-8 xl:px-10">
        <div className="mb-6 flex items-center gap-3">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/staff/payments')} />
          <div>
            <p className="m-0 text-xs uppercase tracking-[0.24em] text-[var(--gs-text-soft)]">Staff</p>
            <h1 className="m-0 mt-1 text-2xl font-semibold text-[var(--gs-text)]">Đăng ký offline</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3 space-y-6">
            <Card title={<span><UserOutlined className="mr-2" />Phần 1: Tìm hội viên</span>}>
              <Input
                size="large"
                prefix={<SearchOutlined />}
                placeholder="Tìm bằng tên, mã HV, email, SĐT..."
                value={searchKeyword}
                onChange={(e) => handleSearch(e.target.value)}
                suffix={searching ? <Spin size="small" /> : null}
              />

              {searchResults.length > 0 && !selectedMember && (
                <List
                  className="mt-3"
                  dataSource={searchResults}
                  renderItem={(item) => (
                    <List.Item
                      onClick={() => selectMember(item)}
                      className="cursor-pointer rounded-lg px-3 py-2 transition-colors hover:bg-[var(--gs-accent-muted)]"
                    >
                      <List.Item.Meta
                        avatar={<Avatar icon={<UserOutlined />} />}
                        title={item.name || item.email}
                        description={
                          <div className="flex flex-wrap gap-x-4 text-xs">
                            <span>{item.memberCode && `Mã: ${item.memberCode}`}</span>
                            <span>{item.email}</span>
                            <span>{item.phone}</span>
                            <Tag color={item.isActive ? 'success' : 'default'}>{item.isActive ? 'Hoạt động' : 'Đã khóa'}</Tag>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}

              {selectedMember ? (
                <div className="mt-4 rounded-lg border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold">Đã chọn hội viên</span>
                    <Button size="small" onClick={() => setSelectedMember(null)}>Bỏ chọn</Button>
                  </div>
                  <Descriptions column={{ xs: 1, sm: 2, md: 3, lg: 6 }} size="small">
                    <Descriptions.Item label="Member ID">{selectedMember.memberCode || selectedMember._id}</Descriptions.Item>
                    <Descriptions.Item label="Họ tên">{selectedMember.name}</Descriptions.Item>
                    <Descriptions.Item label="Email">{selectedMember.email || '-'}</Descriptions.Item>
                    <Descriptions.Item label="SĐT">{selectedMember.phone || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Trạng thái">
                      <Tag color={selectedMember.isActive ? 'success' : 'default'}>
                        {selectedMember.isActive ? 'Hoạt động' : 'Đã khóa'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Gói hiện tại">
                      {selectedMember.currentPlan ? (
                        <span>{selectedMember.currentPlan.planName} — còn {selectedMember.currentPlan.remainingDays} ngày</span>
                      ) : (
                        <span className="text-[var(--gs-text-muted)]">Chưa có</span>
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              ) : searchKeyword && searchResults.length === 0 && !searching && (
                <Empty className="mt-6" description="Không tìm thấy hội viên" />
              )}
            </Card>

            <Card title={<span><CreditCardOutlined className="mr-2" />Phần 2: Chọn gói tập</span>}>
              {loadingPlans ? (
                <div className="flex justify-center py-8"><Spin /></div>
              ) : plans.length === 0 ? (
                <Empty description="Không có gói tập nào" />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {plans.map((plan) => {
                    const active = selectedPlan?._id === plan._id
                    return (
                      <div
                        key={plan._id}
                        className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${active ? 'border-[var(--gs-accent)] bg-[var(--gs-accent-muted)]' : 'border-[var(--gs-border)] hover:border-[var(--gs-accent)]'}`}
                        onClick={() => { setSelectedPlan(plan); setAmountPaid(String(plan.price)) }}
                      >
                        <div className="mb-2 text-base font-semibold">{plan.nameVi || plan.nameEn}</div>
                        <div className="mb-1 text-lg font-bold text-[var(--gs-accent)]">{formatMoney(plan.price)}</div>
                        <div className="mb-2 text-xs text-[var(--gs-text-muted)]">{plan.durationDays} ngày</div>
                        {plan.featuresVi?.slice(0, 3).map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs text-[var(--gs-text-soft)]">
                            <CheckCircleOutlined style={{ fontSize: 11, color: 'var(--gs-accent)' }} />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>

          <div className="sticky top-8 self-start space-y-6">
            <Card title={<span><MoneyCollectOutlined className="mr-2" />Phần 3: Thanh toán</span>}>
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium">Phương thức</label>
                <Radio.Group
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full"
                >
                  <Radio.Button value="CASH" className="mb-2 w-full text-left">
                    <MoneyCollectOutlined className="mr-1" /> Tiền mặt
                  </Radio.Button>
                  <Radio.Button value="BANK_TRANSFER" className="mb-2 w-full text-left">
                    <QrcodeOutlined className="mr-1" /> Chuyển khoản tại quầy
                  </Radio.Button>
                  <Radio.Button value="POS" className="w-full text-left">
                    <CreditCardOutlined className="mr-1" /> POS / quẹt thẻ
                  </Radio.Button>
                </Radio.Group>
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium">Số tiền đã thu</label>
                <Input
                  type="number"
                  min={0}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  suffix="VNĐ"
                />
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium">Ghi chú thanh toán</label>
                <Input.TextArea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú nếu có..."
                />
              </div>
            </Card>

            <Card title="Tổng quan">
              <Statistic
                title="Hội viên"
                value={selectedMember?.name || 'Chưa chọn'}
                valueStyle={{ fontSize: 14, fontWeight: 600 }}
              />
              <Statistic
                title="Gói tập"
                value={selectedPlan?.nameVi || selectedPlan?.nameEn || 'Chưa chọn'}
                valueStyle={{ fontSize: 14, fontWeight: 600 }}
                className="mt-3"
              />
              <Statistic
                title="Số tiền"
                value={amount ? formatMoney(amount) : '—'}
                valueStyle={{ fontSize: 14, fontWeight: 600, color: amount >= planPrice ? 'var(--gs-success)' : 'var(--gs-danger)' }}
                className="mt-3"
              />
              {selectedPlan && amount < planPrice && (
                <div className="mt-2 text-xs text-[var(--gs-danger)]">
                  Số tiền thu phải &ge; {formatMoney(planPrice)}
                </div>
              )}
              {selectedMember?.currentPlan && (
                <div className="mt-3 rounded-lg bg-[var(--gs-warning-bg)] p-2 text-xs text-[var(--gs-warning)]">
                  Hội viên đang có gói hoạt động
                </div>
              )}
            </Card>

            <Button
              type="primary"
              size="large"
              block
              disabled={!canSubmit}
              loading={submitting}
              onClick={handleSubmit}
              icon={<CheckCircleOutlined />}
            >
              Xác nhận đăng ký offline
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
