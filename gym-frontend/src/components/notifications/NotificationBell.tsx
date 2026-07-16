import { BellOutlined } from '@ant-design/icons'
import { Badge, Dropdown, List, Typography, Button, Empty } from 'antd'
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationService, type Notification } from '../../services/notificationService'
import { socketService } from '../../services/socketService'

const { Text, Paragraph } = Typography

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

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const initialLoadDone = useRef(false)

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const fetchNotifications = async () => {
    try {
      const res = await notificationService.getMyNotifications()
      setNotifications(res.data.data || [])
    } catch {
      // silently fail
    }
  }

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      fetchNotifications()
    }
  }, [])

  // Socket listener for real-time notifications
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

  const handleSeeAll = () => {
    setOpen(false)
    const role = window.location.pathname.startsWith('/pt') ? 'pt' : 'staff'
    navigate(`/${role}/notifications`)
  }

  const items = [
    {
      key: 'list',
      label: (
        <div style={{ width: 360, maxHeight: 400, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--gs-border)',
              fontWeight: 600,
              fontSize: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Thông báo</span>
            {unreadCount > 0 && (
              <Button
                type="text"
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
                  notificationService.markAllAsRead().catch(() => {})
                }}
              >
                Đọc tất cả
              </Button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <Empty description="Chưa có thông báo" style={{ padding: '32px 0' }} />
            ) : (
              <List
                dataSource={notifications.slice(0, 20)}
                renderItem={(item) => (
                  <List.Item
                    style={{
                      padding: '10px 16px',
                      cursor: 'pointer',
                      background: item.isRead ? 'transparent' : 'var(--gs-active-bg)',
                      borderBottom: '1px solid var(--gs-border)',
                    }}
                    onClick={() => handleMarkRead(item._id)}
                  >
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text strong style={{ fontSize: 13, color: item.isRead ? 'var(--gs-text-muted)' : 'var(--gs-text)' }}>
                          {item.title}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap', marginLeft: 8 }}>
                          {formatTime(item.createdAt)}
                        </Text>
                      </div>
                      <Paragraph
                        ellipsis={{ rows: 2 }}
                        style={{
                          fontSize: 12,
                          margin: '4px 0 0',
                          color: 'var(--gs-text-soft)',
                        }}
                      >
                        {item.content}
                      </Paragraph>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </div>

          <div
            style={{
              padding: '8px 16px',
              borderTop: '1px solid var(--gs-border)',
              textAlign: 'center',
            }}
          >
            <Button type="link" size="small" onClick={handleSeeAll}>
              Xem tất cả thông báo
            </Button>
          </div>
        </div>
      ),
    },
  ]

  return (
    <Dropdown
      menu={{ items }}
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      placement="bottomRight"
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: 18, color: 'var(--gs-text)' }} />}
          style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        />
      </Badge>
    </Dropdown>
  )
}
