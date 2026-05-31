import { Avatar, Card, Select, Space, Table, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { getSellerOrders, updateSellerOrderStatus } from '../../../services/orderService'

const { Text, Title } = Typography

const ORDER_STATUSES = ['CHỜ XÁC NHẬN', 'ĐANG GIAO HÀNG', 'GIAO THÀNH CÔNG']
const formatMoney = (value = 0) => `${Number(value || 0).toLocaleString('vi-VN')}đ`

const getItemImage = (item: any) => item.productImage || item.productId?.image || item.productId?.images?.[0] || ''
const getItemName = (item: any, fallback: string) => item.productName || item.name || item.productId?.name || fallback
const getItemVariant = (item: any) => item.variant?.weight || item.weight || ''

export default function SellerOrdersPage() {
    const { t } = useTranslation()
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

    const statusLabelMap: Record<string, string> = {
        'CHỜ XÁC NHẬN': t('seller_orders.status_pending'),
        'ĐANG GIAO HÀNG': t('seller_orders.status_shipping'),
        'GIAO THÀNH CÔNG': t('seller_orders.status_delivered'),
    }
    const statusOptions = ORDER_STATUSES.map((status) => ({ label: statusLabelMap[status] || status, value: status }))

    const handleStatusChange = async (orderId: string, status: string) => {
        const previous = orders
        setUpdatingId(orderId)
        setOrders((current) => current.map((order) => order._id === orderId ? { ...order, status } : order))
        try {
            const response = await updateSellerOrderStatus(orderId, status)
            setOrders((current) => current.map((order) => order._id === orderId ? response.data.data : order))
            message.success(t('seller_orders.update_success'))
        } catch (error: any) {
            setOrders(previous)
            message.error(error?.response?.data?.message || t('seller_orders.update_failed'))
        } finally {
            setUpdatingId('')
        }
    }

    const columns = [
        { title: t('seller_orders.order_id'), dataIndex: '_id', key: '_id' },
        {
            title: t('seller_orders.buyer'),
            dataIndex: 'userId',
            key: 'userId',
            render: (user: any) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{user?.name || t('seller_orders.customer_fallback')}</Text>
                    <Text type="secondary">{user?.phone || user?.email || t('seller_orders.no_contact')}</Text>
                </Space>
            ),
        },
        {
            title: t('seller_orders.products'),
            dataIndex: 'items',
            key: 'items',
            render: (items: any[]) => (
                <Space direction="vertical" size={8}>
                    {(items || []).map((item, index) => {
                        const image = getItemImage(item)
                        return (
                            <Space key={`${item.productId?._id || item.productId || index}-${getItemVariant(item)}`} align="start">
                                <Avatar shape="square" src={image || undefined} size={48}>
                                    {!image && getItemName(item, t('seller_dashboard.product_fallback')).charAt(0)}
                                </Avatar>
                                <div>
                                    <Text strong>{getItemName(item, t('seller_dashboard.product_fallback'))}</Text>
                                    <div>
                                        {getItemVariant(item) && <Tag color="orange">{getItemVariant(item)}</Tag>}
                                        <Tag>{t('seller_orders.quantity')}: {item.quantity}</Tag>
                                        <Tag>{formatMoney(item.price)} / 1</Tag>
                                    </div>
                                </div>
                            </Space>
                        )
                    })}
                </Space>
            ),
        },
        { title: t('seller_orders.total'), dataIndex: 'totalAmount', key: 'totalAmount', render: (value: number) => formatMoney(value) },
        {
            title: t('seller_orders.status'),
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
            <div className="p-4 max-[640px]:p-0">
                <Card className="max-[640px]:border-0 max-[640px]:bg-transparent">
                    <div className="dashboard-filter-bar">
                        <Title level={4} style={{ margin: 0 }}>{t('seller_orders.title')}</Title>
                        <Select
                            allowClear
                            placeholder={t('seller_orders.status_filter')}
                            options={statusOptions}
                            value={statusFilter}
                            onChange={setStatusFilter}
                            style={{ minWidth: 180 }}
                        />
                    </div>
                    <div className="member-scroll-x">
                        <Table rowKey="_id" dataSource={filteredOrders} columns={columns} pagination={{ pageSize: 8 }} scroll={{ x: 900 }} />
                    </div>
                </Card>
            </div>
        </DashboardLayout>
    )
}
