import { Button, Spin, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { getProductById, updateProduct } from '../../../services/productService'
import type { AdminProduct } from '../../../types/admin/product'
import SellerProductForm from './SellerProductForm'

export default function SellerProductEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<AdminProduct | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getProductById(id)
      .then(res => setProduct(res.data.product))
      .catch(() => {
        message.error('Không thể tải thông tin sản phẩm')
        navigate('/seller/products')
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleUpdate = async (payload: any) => {
    if (!id) return
    await updateProduct(id, payload)
    message.success('Cập nhật sản phẩm thành công')
    navigate('/seller/products')
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      </DashboardLayout>
    )
  }

  if (!product) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: 80 }}>
          <p style={{ color: 'var(--gs-text-muted)', marginBottom: 16 }}>Không tìm thấy sản phẩm</p>
          <Button onClick={() => navigate('/seller/products')}>Quay lại sản phẩm</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <SellerProductForm
        initialValues={{
          name: product.name,
          descriptionHtml: product.descriptionHtml || '',
          category: product.category,
          price: product.price,
          stock: product.stock,
          image: product.image,
          images: product.images || [],
          weightVariants: product.weightVariants?.length
            ? product.weightVariants.map(item => ({
              label: item.label,
              priceDelta: item.priceDelta,
              stock: item.stock ?? 0,
            }))
            : (product.weights || []).map(label => ({ label, priceDelta: 0, stock: 0 })),
        }}
        onFinish={handleUpdate}
        submitLabel="Cập nhật sản phẩm"
        pageTitle="Sửa sản phẩm"
        pageDescription="Chỉnh sửa thông tin sản phẩm của bạn"
      />
    </DashboardLayout>
  )
}
