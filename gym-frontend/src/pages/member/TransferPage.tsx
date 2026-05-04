import { Button, Card, Form, Input, message, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../components/layout/MemberLayout'
import { transferWallet } from '../../services/walletService'

const { Title } = Typography

export default function TransferPage() {
    const [form] = Form.useForm()
    const navigate = useNavigate()

    const handleSubmit = async (values: any) => {
        try {
            await transferWallet({
                fromUserId: values.fromUserId,
                toUserId: values.toUserId,
                amount: Number(values.amount),
            })
            message.success('Chuyển tiền thành công')
            navigate('/dashboard/member/wallet')
        } catch (error: any) {
            console.error(error)
            const errorMessage = error?.response?.data?.message || 'Chuyển tiền thất bại. Vui lòng thử lại.'
            message.error(errorMessage)
        }
    }

    return (
        <MemberLayout>
            <div className="member-page">
            <Card>
                <Title level={4}>Chuyển tiền trong ví</Title>
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item
                        label="Mã người nhận"
                        name="toUserId"
                        rules={[{ required: true, message: 'Vui lòng nhập mã người nhận' }]}
                    >
                        <Input placeholder="Nhập userId người nhận" />
                    </Form.Item>
                    <Form.Item
                        label="Số tiền"
                        name="amount"
                        rules={[{ required: true, message: 'Vui lòng nhập số tiền' }]}
                    >
                        <Input type="number" min={1} placeholder="Số tiền VND" />
                    </Form.Item>
                    <Form.Item
                        label="Mã người gửi"
                        name="fromUserId"
                        rules={[{ required: true, message: 'Vui lòng nhập mã người gửi' }]}
                    >
                        <Input placeholder="Nhập userId người gửi" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit">
                            Chuyển tiền
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
            </div>
        </MemberLayout>
    )
}
