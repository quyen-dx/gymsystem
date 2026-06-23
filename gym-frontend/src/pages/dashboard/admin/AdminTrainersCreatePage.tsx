import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import AdminTrainersForm from './AdminTrainersForm'

export default function AdminTrainersCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <DashboardLayout>
      <AdminTrainersForm
        pageTitle={t('admin.trainers.add')}
        pageDescription="Nhập thông tin chi tiết cho huấn luyện viên mới"
        onSuccess={() => navigate('/admin/trainers')}
      />
    </DashboardLayout>
  )
}
