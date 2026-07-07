import {
  BarChartOutlined,
  CalendarOutlined,
  DollarOutlined,
  DownloadOutlined,
  RiseOutlined,
  StockOutlined,
} from '@ant-design/icons'
import { Button, Card, Col, Progress, Row, Segmented, Space, Spin, Statistic, Table, message } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { reportService } from '../../../services/reportService'

export default function AdminReportsPage() {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month')
  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState<any>(null)

  const fetchReportData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await reportService.getRevenueReport(period)
      setReportData(res.data)
    } catch {
      message.error('Không thể tải dữ liệu báo cáo tài chính từ hệ thống')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchReportData()
  }, [fetchReportData])

  const transactionColumns = [
    { 
      title: 'Mã hóa đơn', 
      dataIndex: '_id', 
      key: 'id', 
      render: (text: string) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{text?.substring(0, 8).toUpperCase() || 'N/A'}</span> 
    },
    { title: 'Hội viên', dataIndex: ['member', 'name'], key: 'member', render: (text: string, record: any) => text || record.memberName || 'Khách vãng lai' },
    { title: 'Gói dịch vụ', dataIndex: ['plan', 'name'], key: 'plan', render: (text: string, record: any) => text || record.planName || 'N/A' },
    { 
      title: 'Ngày thanh toán', 
      dataIndex: 'createdAt', 
      key: 'date', 
      render: (text: string) => text ? new Date(text).toLocaleDateString('vi-VN') : 'N/A' 
    },
    { 
      title: 'Số tiền', 
      dataIndex: 'amount', 
      key: 'amount', 
      render: (val: number) => <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{val?.toLocaleString('vi-VN') || 0} đ</span> 
    },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Báo cáo</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }} className="max-[640px]:flex-col max-[640px]:items-start gap-4">
          <h1 className="text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl" style={{ margin: 0 }}>Báo cáo & Thống kê</h1>
          <Button type="primary" icon={<DownloadOutlined />} className="rounded-xl bg-orange-600 hover:bg-orange-500 border-none" onClick={() => message.success('Đang xuất file báo cáo...')}>
            Xuất báo cáo
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Segmented
          options={[
            { label: 'Tháng này', value: 'month' },
            { label: 'Quý này', value: 'quarter' },
            { label: 'Năm nay', value: 'year' },
          ]}
          value={period}
          onChange={(val) => setPeriod(val as 'month' | 'quarter' | 'year')}
        />
      </div>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Card className="rounded-[24px]" hoverable>
              <Statistic 
                title="Tổng doanh thu" 
                value={reportData?.totalRevenue || 0} 
                suffix="đ"
                valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
                prefix={<DollarOutlined />} 
              />
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--gs-text-soft)' }}>
                <RiseOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                Tăng trưởng <span style={{ color: '#52c41a', fontWeight: 600 }}>+{reportData?.growthRate || 0}%</span> so với kỳ trước
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="rounded-[24px]" hoverable>
              <Statistic 
                title="Số lượng hóa đơn mới" 
                value={reportData?.newOrdersCount || 0} 
                prefix={<BarChartOutlined />} 
              />
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--gs-text-soft)' }}>
                Ghi nhận lượt đăng ký mua gói mới liên tục
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="rounded-[24px]" hoverable>
              <div style={{ marginBottom: 4, color: 'rgba(255, 255, 255, 0.45)', fontSize: 14 }}>Chỉ tiêu doanh thu</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                <Progress 
                  type="circle" 
                  percent={reportData?.targetPercentage || 0} 
                  size={50} 
                  strokeColor="var(--gs-primary, #b6462f)" 
                />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--gs-text)' }}>{reportData?.targetPercentage || 0}%</div>
                  <div style={{ fontSize: 12, color: 'var(--gs-text-soft)' }}>Đạt mục tiêu đề ra của kỳ</div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={10}>
            <Card className="rounded-[24px]" title={<Space><StockOutlined /><span>Cơ cấu doanh thu gói tập</span></Space>} style={{ height: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {reportData?.topPlans?.map((plan: any, index: number) => (
                  <div key={plan._id || plan.id || index}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ fontWeight: 500 }}>{plan.name || 'Gói không tên'} ({plan.quantity || 0} lượt)</span>
                      <span style={{ color: 'var(--gs-text-soft)' }}>{(plan.revenue || 0).toLocaleString('vi-VN')} đ</span>
                    </div>
                    <Progress percent={plan.percentage || 0} status="active" strokeColor="#1890ff" showInfo={true} />
                  </div>
                )) || <div style={{ color: 'var(--gs-text-soft)', textAlign: 'center', padding: '20px 0' }}>Không có dữ liệu gói tập</div>}
              </div>
            </Card>
          </Col>

          <Col xs={24} md={14}>
            <Card className="rounded-[24px]" title={<Space><CalendarOutlined /><span>Lịch sử nguồn thu gần đây</span></Space>}>
              <Table
                columns={transactionColumns}
                dataSource={reportData?.recentTransactions || []}
                pagination={false}
                size="middle"
                rowKey={(record: any) => record._id || record.id}
                scroll={{ x: 'max-content' }}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </DashboardLayout>
  )
}