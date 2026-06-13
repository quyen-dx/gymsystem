import { Button, Spin, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { trainerService } from '../../../services/trainerService'
import type { PT } from '../../../types/admin/trainer'
import AdminTrainersForm from './AdminTrainersForm'

export default function AdminTrainersEditPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [pt, setPt] = useState<PT | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    trainerService.getPTById(id)
      .then(res => setPt(res.data.pt))
      .catch(() => {
        message.error(t('admin.trainers.messages.fetch_detail_failed'))
        navigate('/admin/trainers')
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

  if (!pt) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: 80 }}>
          <p style={{ color: 'var(--gs-text-muted)', marginBottom: 16 }}>Không tìm thấy PT</p>
          <Button onClick={() => navigate('/admin/trainers')}>Quay lại danh sách PT</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <AdminTrainersForm
        pt={pt}
        pageTitle={t('admin.trainers.edit')}
        pageDescription="Chỉnh sửa thông tin huấn luyện viên"
        onSuccess={() => navigate('/admin/trainers')}
      />
    </DashboardLayout>
  )
}
