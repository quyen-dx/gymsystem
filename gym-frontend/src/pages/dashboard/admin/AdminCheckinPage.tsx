import {
  CalendarOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Card, Col, Row, Segmented, Spin, Statistic, Tooltip, message } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { checkInService } from '../../../services/checkInService'
import type { CheckinStats, HeatmapCell } from '../../../types/admin/checkin'

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

export default function AdminCheckinPage() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')
  const [stats, setStats] = useState<CheckinStats | null>(null)
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, heatmapRes] = await Promise.all([
        checkInService.getStats(period),
        checkInService.getHeatmap(),
      ])
      setStats(statsRes.data.stats)
      setHeatmap(heatmapRes.data.heatmap)
    } catch {
      message.error(t('admin.checkin.load_failed'))
    } finally {
      setLoading(false)
    }
  }, [period, t])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'var(--gs-border)'
    if (count <= 3) return 'rgba(59,130,246,0.3)'
    if (count <= 6) return 'rgba(59,130,246,0.5)'
    if (count <= 10) return 'rgba(59,130,246,0.7)'
    return 'rgba(59,130,246,0.9)'
  }

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Admin</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">{t('admin.checkin.title')}</h1>
      </div>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Card className="rounded-[24px]" hoverable>
              <Statistic title={t('admin.checkin.total_checkins')} value={stats?.totalCheckins || 0} prefix={<CheckCircleOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="rounded-[24px]" hoverable>
              <Statistic title={t('admin.checkin.unique_members')} value={stats?.uniqueMembers || 0} prefix={<UserOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="rounded-[24px]" hoverable>
              <Statistic title={t('admin.checkin.period')} value={period === 'day' ? t('admin.checkin.today') : period === 'week' ? t('admin.checkin.this_week') : t('admin.checkin.this_month')} prefix={<CalendarOutlined />} />
            </Card>
          </Col>
        </Row>

        <Card className="rounded-[24px]" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>{t('admin.checkin.heatmap_title')}</h3>
            <Segmented
              options={[
                { label: t('admin.checkin.today'), value: 'day' },
                { label: t('admin.checkin.week'), value: 'week' },
                { label: t('admin.checkin.month'), value: 'month' },
              ]}
              value={period}
              onChange={(val) => setPeriod(val as 'day' | 'week' | 'month')}
            />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '50px repeat(24, 1fr)', gap: 2, minWidth: 600 }}>
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} style={{ fontSize: 10, textAlign: 'center', color: 'var(--gs-text-soft)' }}>{h}h</div>
              ))}
              {DAY_LABELS.map((day, di) => (
                <div key={day} style={{ display: 'contents' }}>
                  <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', color: 'var(--gs-text-muted)' }}>{day}</div>
                  {Array.from({ length: 24 }, (_, hi) => {
                    const cell = heatmap[di * 24 + hi] || { count: 0, members: [] }
                    return (
                      <Tooltip key={hi} title={`${day} ${hi}h: ${cell.count} check-ins`}>
                        <div style={{
                          aspectRatio: '1',
                          borderRadius: 4,
                          background: getHeatmapColor(cell.count),
                          cursor: 'pointer',
                          minHeight: 20,
                        }} />
                      </Tooltip>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </Spin>
    </DashboardLayout>
  )
}
