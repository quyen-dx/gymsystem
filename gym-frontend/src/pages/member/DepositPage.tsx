import { Alert, Button, Card, Form, InputNumber, message, Space, Typography } from 'antd'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../components/layout/MemberLayout'
import { useWallet } from '../../context/WalletProvider'
import { createSandboxPayment, simulatePaymentSuccess } from '../../services/walletService'

const { Title, Paragraph, Text } = Typography

export default function DepositPage() {
    const [form] = Form.useForm()
    const [payment, setPayment] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [confirmLoading, setConfirmLoading] = useState(false)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const navigate = useNavigate()
    const { refreshWallet } = useWallet()

    useEffect(() => {
        if (!payment || payment.status !== 'pending') return

        const timer = window.setTimeout(() => {
            handleSimulateSuccess()
        }, 5000)

        return () => window.clearTimeout(timer)
    }, [payment])

    const onSubmit = async (values: any) => {
        setLoading(true)
        setErrorMessage(null)
        setSuccessMessage(null)
        try {
            const response = await createSandboxPayment({ amount: Number(values.amount) })
            setPayment(response.data.data)
            message.success('Tạo mã QR sandbox thành công. Quét để thanh toán.')
        } catch (error: any) {
            console.error(error)
            const msg = error?.response?.data?.message || 'Không thể tạo yêu cầu sandbox'
            setErrorMessage(msg)
            message.error(msg)
        } finally {
            setLoading(false)
        }
    }

    const handleSimulateSuccess = async () => {
        if (!payment?.orderId) return
        setConfirmLoading(true)
        setErrorMessage(null)
        try {
            const response = await simulatePaymentSuccess({ orderId: payment.orderId })
            setPayment((prev: any) => ({ ...prev, status: 'success' }))
            setSuccessMessage('Thanh toán sandbox thành công! Số dư ví đã được cập nhật.')
            message.success('Thanh toán sandbox thành công!')
            await refreshWallet()
            return response.data
        } catch (error: any) {
            const msg = error?.response?.data?.message || 'Không thể hoàn tất thanh toán sandbox'
            setErrorMessage(msg)
            message.error(msg)
        } finally {
            setConfirmLoading(false)
        }
    }

    const handleCancel = () => {
        setPayment(null)
        setSuccessMessage(null)
        setErrorMessage(null)
        form.resetFields()
    }

    const isSuccess = payment?.status === 'success'

    return (
        <MemberLayout>
            <div className="member-page">
                <Card>
                    <Title level={4}>Nạp tiền ví (Sandbox)</Title>
                    <Paragraph>
                        Hệ thống thanh toán giả lập sandbox. Không dùng tiền thật, chỉ để thử nghiệm.
                    </Paragraph>

                    {!payment && (
                        <Form layout="vertical" form={form} onFinish={onSubmit} initialValues={{ amount: 10000 }}>
                            <Form.Item
                                label="Số tiền (VND)"
                                name="amount"
                                rules={[{ required: true, message: 'Vui lòng nhập số tiền' }]}
                            >
                                <InputNumber min={1000} style={{ width: '100%' }} />
                            </Form.Item>

                            <Form.Item>
                                <Space>
                                    <Button type="primary" htmlType="submit" loading={loading}>
                                        Tạo QR
                                    </Button>
                                    <Button onClick={() => navigate('/dashboard/member/wallet')}>
                                        Ví của tui
                                    </Button>
                                </Space>
                            </Form.Item>
                        </Form>
                    )}

                    {payment && (
                        <div style={{ marginTop: 24 }}>
                            <Alert
                                type={isSuccess ? 'success' : 'info'}
                                showIcon
                                message={isSuccess ? 'Đã thanh toán' : 'Đang chờ thanh toán'}
                                description={
                                    isSuccess
                                        ? 'Số dư ví đã được cập nhật.'
                                        : 'Mã QR đã được tạo. Nhấn "Tôi đã thanh toán" hoặc chờ để giả lập thành công tự động.'
                                }
                                style={{ marginBottom: 24 }}
                            />

                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                                <QRCodeSVG value={payment.qrData} size={240} style={{ maxWidth: '100%', height: 'auto' }} />
                            </div>

                            <Paragraph>
                                <Text strong>Order ID:</Text> {payment.orderId}
                            </Paragraph>
                            <Paragraph type="secondary">Mã sẽ hết hạn sau 15 phút.</Paragraph>

                            <Space wrap>
                                <Button
                                    type="primary"
                                    onClick={handleSimulateSuccess}
                                    loading={confirmLoading}
                                    disabled={isSuccess}
                                >
                                    Tôi đã thanh toán
                                </Button>
                                <Button onClick={handleCancel}>Hủy</Button>
                            </Space>

                            {successMessage && (
                                <Alert
                                    style={{ marginTop: 20 }}
                                    type="success"
                                    message={successMessage}
                                />
                            )}
                            {errorMessage && (
                                <Alert
                                    style={{ marginTop: 20 }}
                                    type="error"
                                    message={errorMessage}
                                />
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </MemberLayout>
    )
}
