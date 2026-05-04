import { Button, Card, Space, Table, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MemberLayout from '../../components/layout/MemberLayout'
import { getWallet, getWalletTransactions } from '../../services/walletService'

const { Title, Text } = Typography

const columns = [
    { title: 'Thời gian', dataIndex: 'createdAt', key: 'createdAt', render: (value: string) => new Date(value).toLocaleString() },
    { title: 'Loại', dataIndex: 'type', key: 'type' },
    { title: 'Số tiền', dataIndex: 'amount', key: 'amount', render: (value: number) => value.toLocaleString('vi-VN') },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status' },
    { title: 'Ghi chú', dataIndex: ['metadata', 'note'], key: 'note' },
]

export default function WalletPage() {
    const [wallet, setWallet] = useState<any>(null)
    const [transactions, setTransactions] = useState<any[]>([])

    useEffect(() => {
        const load = async () => {
            try {
                const walletRes = await getWallet()
                const txRes = await getWalletTransactions()
                setWallet(walletRes.data.data)
                setTransactions(txRes.data.data)
            } catch (error) {
                console.error(error)
            }
        }
        load()
    }, [])

    return (
        <MemberLayout>
            <div className="member-page space-y-6">
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Card>
                        <Space direction="vertical">
                            <Title level={4}>Ví thanh toán</Title>
                            <Text>Tiền hiện có:</Text>
                            <Text strong style={{ fontSize: 28 }}>
                                {wallet ? wallet.balance.toLocaleString('vi-VN') : '...'} VND
                            </Text>
                            <Space>
                                <Link to="/dashboard/member/wallet/deposit">
                                    <Button type="primary">Nạp tiền</Button>
                                </Link>
                                <Link to="/dashboard/member/transfer">
                                    <Button>Chuyển tiền</Button>
                                </Link>
                            </Space>
                        </Space>
                    </Card>

                    <Card title="Lịch sử giao dịch">
                        <Table
                            rowKey="_id"
                            dataSource={transactions}
                            columns={columns}
                            pagination={{ pageSize: 8 }}
                            scroll={{ x: 720 }}
                        />
                    </Card>
                </Space>
            </div>
        </MemberLayout>
    )
}
