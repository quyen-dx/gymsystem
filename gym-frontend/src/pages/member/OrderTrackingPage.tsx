import { Button, Card, Descriptions, Spin, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { trackOrder } from '../../services/orderService'
import MemberLayout from '../../components/layout/MemberLayout'

const { Title } = Typography
const statusVi: Record<string, string> = {
    pending: 'CHỜ XÁC NHẬN',
    paid: 'CHỜ XÁC NHẬN',
    processing: 'CHỜ XÁC NHẬN',
    shipped: 'ĐANG GIAO HÀNG',
    delivered: 'GIAO THÀNH CÔNG',
}

export default function OrderTrackingPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [shipping, setShipping] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const load = async () => {
            if (!id) return
            setLoading(true)
            try {
                const response = await trackOrder(id)
                setShipping(response.data.data)
            } catch (error) {
                console.error(error)
                message.error('Không thể tải thông tin vận chuyển')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [id])

    return (
        <MemberLayout>
            <div className="member-page">
            <Card>
                <Title level={4}>Theo dõi đơn hàng</Title>
                {loading ? (
                    <Spin />
                ) : shipping ? (
                    <Descriptions column={1} bordered>
                        <Descriptions.Item label="Trạng thái">{statusVi[shipping.trackingStatus] || shipping.trackingStatus}</Descriptions.Item>
                        <Descriptions.Item label="Phí vận chuyển">{shipping.shippingFee.toLocaleString('vi-VN')} VND</Descriptions.Item>
                        <Descriptions.Item label="Dự kiến giao hàng">{new Date(shipping.estimatedDeliveryDate).toLocaleDateString()}</Descriptions.Item>
                        <Descriptions.Item label="Địa chỉ nhận">
                            {shipping.address.recipientName}, {shipping.address.street}, {shipping.address.ward}, {shipping.address.district}, {shipping.address.province}
                        </Descriptions.Item>
                        <Descriptions.Item label="Số điện thoại">{shipping.address.phone}</Descriptions.Item>
                    </Descriptions>
                ) : (
                    <div>Không tìm thấy thông tin vận chuyển</div>
                )}
                <Button style={{ marginTop: 16 }} onClick={() => navigate('/dashboard/member/orders')}>
                    Quay lại danh sách đơn hàng
                </Button>
            </Card>
        </div>
        </MemberLayout>
        
    )
}
