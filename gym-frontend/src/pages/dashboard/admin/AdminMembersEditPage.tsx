import { Button, Spin, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { memberService } from '../../../services/memberService'
import type { MemberListItem } from '../../../types/admin/member'
import AdminMembersForm from './AdminMembersForm'

export default function AdminMembersEditPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [member, setMember] = useState<MemberListItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    memberService.getMemberById(id)
      .then(res => setMember(res.data.member as unknown as MemberListItem))
      .catch(() => {
        message.error(t('admin.members.messages.fetch_failed'))
        navigate('/admin/members')
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      </DashboardLayout>
    )
  }

  if (!member) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: 80 }}>
          <p style={{ color: 'var(--gs-text-muted)', marginBottom: 16 }}>Không tìm thấy member</p>
          <Button onClick={() => navigate('/admin/members')}>Quay lại danh sách member</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <AdminMembersForm
        member={member}
        pageTitle={t('admin.members.edit')}
        pageDescription="Chỉnh sửa thông tin member"
        onSuccess={() => navigate('/admin/members')}
      />
    </DashboardLayout>
  )
}
