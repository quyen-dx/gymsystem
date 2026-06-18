import { Button, Card, Descriptions, Spin, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { trackOrder } from '../../../services/orderService'

const { Title } = Typography
const statusVi: Record<string, string> = {
    pending: 'CHỜ XÁC NHẬN',
    paid: 'CHỜ XÁC NHẬN',
    processing: 'CHỜ XÁC NHẬN',
    shipped: 'ĐANG GIAO HÀNG',
    delivered: 'GIAO THÀNH CÔNG',
}

export default function OrderTrackingPage() {
    const { t } = useTranslation()
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
                message.error(t('order_tracking.msg_load_failed'))
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [id, t])

    return (
        <MemberLayout>
            <div className="member-page">
                <Card>
                    <Title level={4}>{t('order_tracking.title')}</Title>
                    {loading ? (
                        <Spin />
                    ) : shipping ? (
                        <Descriptions column={1} bordered>
                            <Descriptions.Item label={t('order_tracking.status')}>{statusVi[shipping.trackingStatus] || shipping.trackingStatus}</Descriptions.Item>
                            <Descriptions.Item label={t('order_tracking.shipping_fee')}>{shipping.shippingFee.toLocaleString('vi-VN')} VND</Descriptions.Item>
                            <Descriptions.Item label={t('order_tracking.estimated_delivery')}>{new Date(shipping.estimatedDeliveryDate).toLocaleDateString()}</Descriptions.Item>
                            <Descriptions.Item label={t('order_tracking.delivery_address')}>
                                {shipping.address.recipientName}, {shipping.address.street}, {shipping.address.ward}, {shipping.address.district}, {shipping.address.province}
                            </Descriptions.Item>
                            <Descriptions.Item label={t('order_tracking.phone')}>{shipping.address.phone}</Descriptions.Item>
                        </Descriptions>
                    ) : (
                        <div>{t('order_tracking.not_found')}</div>
                    )}
                    <Button style={{ marginTop: 16 }} onClick={() => navigate('/cart?tab=orders')}>
                        {t('order_tracking.back_to_orders')}
                    </Button>
                </Card>
            </div>
        </MemberLayout>

    )
}
