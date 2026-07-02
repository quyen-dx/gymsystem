import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import AdminTrainersForm from './AdminTrainersForm'

export default function AdminTrainersCreatePage() {
  const navigate = useNavigate()

  return (
    <DashboardLayout>
      <AdminTrainersForm
        pageTitle="Thêm huấn luyện viên"
        pageDescription="Nhập thông tin chi tiết cho huấn luyện viên mới"
        onSuccess={() => navigate('/admin/trainers')}
      />
    </DashboardLayout>
  )
}
