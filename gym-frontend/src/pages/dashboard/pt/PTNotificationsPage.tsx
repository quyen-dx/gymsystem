import { useEffect, useState } from 'react'
import { List, Typography, Button, Tag, Spin, Empty } from 'antd'
import { CheckOutlined, BellOutlined } from '@ant-design/icons'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { notificationService, type Notification } from '../../../services/notificationService'
import { socketService } from '../../../services/socketService'

const { Title, Text, Paragraph } = Typography

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'Vừa xong'
  if (diffMin < 60) return `${diffMin} phút trước`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} giờ trước`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay} ngày trước`
  return d.toLocaleDateString('vi-VN')
}

export default function PTNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res = await notificationService.getMyNotifications()
      setNotifications(res.data.data || [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  // Socket listener for real-time
  useEffect(() => {
    socketService.connect()
    const handler = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev])
    }
    socketService.on('notification:new', handler)
    return () => {
      socketService.off('notification:new', handler)
    }
  }, [])

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      )
    } catch {
      // silently fail
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch {
      // silently fail
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">THÔNG BÁO</p>
          <Title level={2} style={{ margin: '8px 0 4px', color: 'var(--gs-text)' }}>
            <BellOutlined style={{ marginRight: 8 }} />
            Thông báo
          </Title>
          <p className="text-sm text-[var(--gs-text-muted)]">
            {unreadCount > 0
              ? `Bạn có ${unreadCount} thông báo chưa đọc`
              : 'Không có thông báo mới'}
          </p>
          {unreadCount > 0 && (
            <Button
              type="default"
              size="small"
              icon={<CheckOutlined />}
              onClick={handleMarkAllRead}
              style={{ marginTop: 8 }}
            >
              Đánh dấu tất cả đã đọc
            </Button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : notifications.length === 0 ? (
          <div
            className="rounded-[20px] border border-[var(--gs-border)]"
            style={{
              padding: 60,
              textAlign: 'center',
              background: 'var(--gs-card)',
            }}
          >
            <BellOutlined style={{ fontSize: 48, color: 'var(--gs-text-soft)', marginBottom: 16 }} />
            <Text type="secondary" style={{ display: 'block', fontSize: 16 }}>
              Chưa có thông báo nào
            </Text>
          </div>
        ) : (
          <div className="rounded-[20px] border border-[var(--gs-border)] overflow-hidden">
            <List
              dataSource={notifications}
              renderItem={(item) => (
                <List.Item
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    background: item.isRead ? 'var(--gs-card)' : 'var(--gs-active-bg)',
                    borderBottom: '1px solid var(--gs-border)',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => handleMarkRead(item._id)}
                  onMouseEnter={(e) => {
                    if (!item.isRead) {
                      e.currentTarget.style.background = 'var(--gs-elevated)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = item.isRead ? 'var(--gs-card)' : 'var(--gs-active-bg)'
                  }}
                >
                  <div style={{ width: '100%' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          {!item.isRead && (
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: 'var(--gs-accent)',
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <Text strong style={{ fontSize: 15, color: item.isRead ? 'var(--gs-text-muted)' : 'var(--gs-text)' }}>
                            {item.title}
                          </Text>
                        </div>
                        <Paragraph
                          style={{
                            fontSize: 13,
                            margin: '4px 0 0',
                            color: 'var(--gs-text-soft)',
                            lineHeight: 1.5,
                          }}
                        >
                          {item.content}
                        </Paragraph>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                          {formatTime(item.createdAt)}
                        </Text>
                        {!item.isRead && (
                          <Tag
                            color="var(--gs-accent)"
                            style={{
                              fontSize: 10,
                              padding: '0 6px',
                              lineHeight: '18px',
                              borderRadius: 4,
                              background: 'var(--gs-accent-muted)',
                              color: 'var(--gs-accent)',
                              border: 'none',
                            }}
                          >
                            Mới
                          </Tag>
                        )}
                      </div>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
