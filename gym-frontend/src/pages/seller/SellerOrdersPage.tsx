import { Avatar, Card, Select, Space, Table, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { getSellerOrders, updateSellerOrderStatus } from '../../services/orderService'

const { Text, Title } = Typography

const ORDER_STATUSES = ['CHỜ XÁC NHẬN', 'ĐANG GIAO HÀNG', 'GIAO THÀNH CÔNG']
const statusOptions = ORDER_STATUSES.map((status) => ({ label: status, value: status }))
const formatMoney = (value = 0) => `${Number(value || 0).toLocaleString('vi-VN')}đ`

const getItemImage = (item: any) => item.productImage || item.productId?.image || item.productId?.images?.[0] || ''
const getItemName = (item: any) => item.productName || item.name || item.productId?.name || 'Sản phẩm'
const getItemVariant = (item: any) => item.variant?.weight || item.weight || ''

export default function SellerOrdersPage() {
    const [orders, setOrders] = useState<any[]>([])
    const [statusFilter, setStatusFilter] = useState<string>()
    const [updatingId, setUpdatingId] = useState('')

    const loadOrders = async () => {
        try {
            const response = await getSellerOrders()
            setOrders(response.data.data || [])
        } catch (error) {
            console.error(error)
        }
    }

    useEffect(() => { loadOrders() }, [])

    const filteredOrders = useMemo(
        () => orders.filter((order) => !statusFilter || order.status === statusFilter),
        [orders, statusFilter],
    )

    const handleStatusChange = async (orderId: string, status: string) => {
        const previous = orders
        setUpdatingId(orderId)
        setOrders((current) => current.map((order) => order._id === orderId ? { ...order, status } : order))
        try {
            const response = await updateSellerOrderStatus(orderId, status)
            setOrders((current) => current.map((order) => order._id === orderId ? response.data.data : order))
            message.success('Đã cập nhật trạng thái đơn hàng')
        } catch (error: any) {
            setOrders(previous)
            message.error(error?.response?.data?.message || 'Không thể cập nhật trạng thái')
        } finally {
            setUpdatingId('')
        }
    }

    const columns = [
        { title: 'Mã đơn', dataIndex: '_id', key: '_id' },
        {
            title: 'Người mua',
            dataIndex: 'userId',
            key: 'userId',
            render: (user: any) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{user?.name || 'Khách hàng'}</Text>
                    <Text type="secondary">{user?.phone || user?.email || 'Chưa có liên hệ'}</Text>
                </Space>
            ),
        },
        {
            title: 'Sản phẩm',
            dataIndex: 'items',
            key: 'items',
            render: (items: any[]) => (
                <Space direction="vertical" size={8}>
                    {(items || []).map((item, index) => {
                        const image = getItemImage(item)
                        return (
                            <Space key={`${item.productId?._id || item.productId || index}-${getItemVariant(item)}`} align="start">
                                <Avatar shape="square" src={image || undefined} size={48}>
                                    {!image && getItemName(item).charAt(0)}
                                </Avatar>
                                <div>
                                    <Text strong>{getItemName(item)}</Text>
                                    <div>
                                        {getItemVariant(item) && <Tag color="orange">{getItemVariant(item)}</Tag>}
                                        <Tag>Số lượng: {item.quantity}</Tag>
                                        <Tag>{formatMoney(item.price)} / 1</Tag>
                                    </div>
                                </div>
                            </Space>
                        )
                    })}
                </Space>
            ),
        },
        { title: 'Tổng tiền', dataIndex: 'totalAmount', key: 'totalAmount', render: (value: number) => formatMoney(value) },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: string, record: any) => (
                <Select
                    value={status}
                    options={statusOptions}
                    style={{ width: 170 }}
                    loading={updatingId === record._id}
                    onChange={(nextStatus) => handleStatusChange(record._id, nextStatus)}
                />
            ),
        },
    ]

    return (
        <DashboardLayout>
            <div className="p-4">
            <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                    <Title level={4} style={{ margin: 0 }}>Đơn hàng bán</Title>
                    <Select
                        allowClear
                        placeholder="Lọc trạng thái"
                        options={statusOptions}
                        value={statusFilter}
                        onChange={setStatusFilter}
                        style={{ minWidth: 220 }}
                    />
                </div>
                <Table rowKey="_id" dataSource={filteredOrders} columns={columns} pagination={{ pageSize: 8 }} />
            </Card>
        </div>
        </DashboardLayout>
    )
}
