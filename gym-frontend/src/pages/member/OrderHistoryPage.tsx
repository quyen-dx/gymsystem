import { Button, Card, Empty, Image, Popconfirm, Space, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MemberLayout from '../../components/layout/MemberLayout'
import { deleteMyOrderHistory, getMyOrders } from '../../services/orderService'

const { Text, Title } = Typography

const statusVi: Record<string, string> = {
    pending: 'CHỜ XÁC NHẬN',
    paid: 'CHỜ XÁC NHẬN',
    processing: 'CHỜ XÁC NHẬN',
    shipped: 'ĐANG GIAO HÀNG',
    delivered: 'GIAO THÀNH CÔNG',
}
const statusColor: Record<string, string> = {
    'CHỜ XÁC NHẬN': 'gold',
    'ĐANG GIAO HÀNG': 'blue',
    'GIAO THÀNH CÔNG': 'green',
    pending: 'gold',
    paid: 'gold',
    processing: 'gold',
    shipped: 'blue',
    delivered: 'green',
}

const formatMoney = (value: number = 0) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const getOrderItemName = (item: any) => item.productName || item.name || item.productId?.name || 'Sản phẩm'
const getOrderItemImage = (item: any) => item.productImage || item.productId?.image || item.productId?.images?.[0] || ''
const getOrderItemVariant = (item: any) => item.variant?.weight || item.weight || ''
const hasOrderItems = (order: any) => Array.isArray(order.items) && order.items.length > 0

export default function OrderHistoryPage() {
    const [orders, setOrders] = useState<any[]>([])
    const [deletingId, setDeletingId] = useState('')

    useEffect(() => {
        const load = async () => {
            try {
                const response = await getMyOrders()
                setOrders(response.data.data || [])
            } catch (error) {
                console.error(error)
            }
        }
        load()
    }, [])

    const visibleOrders = useMemo(() => orders.filter(hasOrderItems), [orders])

    const handleDeleteHistory = async (orderId: string) => {
        const previous = orders
        setDeletingId(orderId)
        setOrders((current) => current.filter((order) => order._id !== orderId))
        try {
            await deleteMyOrderHistory(orderId)
            message.success('Đã xóa đơn hàng khỏi lịch sử')
        } catch (error: any) {
            setOrders(previous)
            message.error(error?.response?.data?.message || 'Không thể xóa lịch sử đơn hàng')
        } finally {
            setDeletingId('')
        }
    }

    return (
        <MemberLayout>
            <div className="member-page">
                <Card>
                    <Title level={4}>Lịch sử đơn hàng</Title>
                    {visibleOrders.length === 0 ? (
                        <Empty description="Chưa có đơn hàng có dữ liệu sản phẩm" />
                    ) : (
                        <div style={{ display: 'grid', gap: 16 }}>
                            {visibleOrders.map((order) => (
                                <Card
                                    key={order._id}
                                    size="small"
                                    title={
                                        <Space wrap>
                                            <Text strong>Đơn hàng #{String(order._id).slice(-8).toUpperCase()}</Text>
                                            <Tag color="blue">{order.shopId?.name || 'Shop'}</Tag>
                                        </Space>
                                    }
                                    extra={
                                        <Space>
                                            <Link to={`/dashboard/member/track/${order._id}`}>
                                                <Button type="link">Theo dõi</Button>
                                            </Link>
                                            <Popconfirm
                                                title="Xóa đơn hàng khỏi lịch sử?"
                                                description="Thao tác này chỉ ẩn đơn khỏi lịch sử của bạn."
                                                okText="Xóa"
                                                cancelText="Hủy"
                                                onConfirm={() => handleDeleteHistory(order._id)}
                                            >
                                                <Button danger type="text" loading={deletingId === order._id}>Xóa</Button>
                                            </Popconfirm>
                                        </Space>
                                    }
                                >
                                    <div style={{ display: 'grid', gap: 12 }}>
                                        {order.items.map((item: any, index: number) => {
                                            const image = getOrderItemImage(item)
                                            const variant = getOrderItemVariant(item)
                                            return (
                                                <div
                                                    key={`${item.productId?._id || item.productId || index}-${variant}`}
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: '72px 1fr',
                                                        gap: 12,
                                                        alignItems: 'center',
                                                    }}
                                                >
                                                    {image ? (
                                                        <Image
                                                            src={image}
                                                            width={72}
                                                            height={72}
                                                            style={{ objectFit: 'cover', borderRadius: 8 }}
                                                        />
                                                    ) : (
                                                        <div style={{ width: 72, height: 72, borderRadius: 8, background: '#f0f0f0' }} />
                                                    )}
                                                    <div>
                                                        <Text strong>{getOrderItemName(item)}</Text>
                                                        <div style={{ marginTop: 6 }}>
                                                            <Text type="secondary">
                                                                x{item.quantity} - {formatMoney(item.price)}
                                                                {variant ? ` - ${variant}` : ''}
                                                            </Text>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', marginTop: 14, paddingTop: 12 }}>
                                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Text>Tổng:</Text>
                                                <Text strong>{formatMoney(order.totalAmount)}</Text>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Text>Phí ship:</Text>
                                                <Text>{formatMoney(order.shippingFee)}</Text>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Text>Trạng thái:</Text>
                                                <Tag color={statusColor[order.status] || statusColor[statusVi[order.status]] || 'default'}>
                                                    {statusVi[order.status] || order.status}
                                                </Tag>
                                            </div>
                                        </Space>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </MemberLayout>
    )
}
