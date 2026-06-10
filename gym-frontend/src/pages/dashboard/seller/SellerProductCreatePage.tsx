import { message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { createProduct } from '../../../services/productService'
import SellerProductForm from './SellerProductForm'

export default function SellerProductCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleCreate = async (payload: any) => {
    await createProduct(payload)
    message.success(t('seller_products.create_success'))
    navigate('/seller/products')
  }

  return (
    <DashboardLayout>
      <SellerProductForm
        onFinish={handleCreate}
        submitLabel="Thêm sản phẩm"
        pageTitle="Thêm sản phẩm mới"
        pageDescription="Nhập thông tin chi tiết cho sản phẩm của bạn"
      />
    </DashboardLayout>
  )
}
