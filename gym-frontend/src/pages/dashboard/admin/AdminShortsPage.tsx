import { DeleteOutlined, EyeOutlined, SearchOutlined, StopOutlined, UnlockOutlined } from '@ant-design/icons'
import { Avatar, Button, Input, message, Modal, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { deleteShort, getAdminShorts, updateShortStatus } from '../../../services/shortService'
import type { ShortVideo } from '../../../types/shorts'

const { Text } = Typography

export default function AdminShortsPage() {
  const [videos, setVideos] = useState<ShortVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [api, contextHolder] = message.useMessage()

  const fetchVideos = async (targetPage = page, keyword = search) => {
    setLoading(true)
    try {
      const { data } = await getAdminShorts({ page: targetPage, limit: 10, search: keyword })
      setVideos(data.videos)
      setPage(data.page)
      setTotal(data.total)
    } catch {
      api.error('Không thể tải danh sách Shorts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchVideos(1, '')
  }, [])

  const handleSearch = (value: string) => {
    setSearch(value)
    void fetchVideos(1, value)
  }

  const handleToggleStatus = async (video: ShortVideo) => {
    setActionLoadingId(video._id)
    try {
      const nextActive = !video.isActive
      await updateShortStatus(video._id, nextActive)
      setVideos((current) => current.map((item) =>
        item._id === video._id ? { ...item, isActive: nextActive } : item,
      ))
      api.success(nextActive ? 'Đã mở video' : 'Đã khóa video')
    } catch {
      api.error('Không thể cập nhật trạng thái')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDelete = (video: ShortVideo) => {
    Modal.confirm({
      title: 'Xóa Shorts?',
      content: `Video của ${video.userId?.name || 'người dùng'} sẽ bị xóa vĩnh viễn.`,
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        setActionLoadingId(video._id)
        try {
          await deleteShort(video._id)
          setVideos((current) => current.filter((item) => item._id !== video._id))
          setTotal((current) => Math.max(0, current - 1))
          api.success('Đã xóa video')
        } catch {
          api.error('Không thể xóa video')
        } finally {
          setActionLoadingId(null)
        }
      },
    })
  }

  const columns: ColumnsType<ShortVideo> = [
    {
      title: 'Video',
      render: (_, video) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 260 }}>
          {video.thumbnail ? (
            <img className="h-[88px] w-[58px] rounded-[10px] bg-[#111] object-cover" src={video.thumbnail} alt={video.caption || 'Short'} />
          ) : (
            <div className="h-[88px] w-[58px] rounded-[10px] bg-[#111]" />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {video.caption || 'Không có caption'}
            </div>
            <Space size={[4, 4]} wrap style={{ marginTop: 6 }}>
              <Tag color={video.type === 'youtube' ? 'red' : 'blue'}>{video.type === 'youtube' ? 'Youtube' : 'Upload'}</Tag>
              {video.tags.slice(0, 4).map((tag) => <Tag key={tag}>#{tag}</Tag>)}
            </Space>
          </div>
        </div>
      ),
    },
    {
      title: 'Người đăng',
      render: (_, video) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar src={video.userId?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(video.userId?.name || 'GP')}`} />
          <div>
            <div>{video.userId?.name || 'Không rõ'}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{video.userId?.email}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Tương tác',
      render: (_, video) => (
        <Space direction="vertical" size={2}>
          <Text>Likes: {video.likesCount.toLocaleString('vi-VN')}</Text>
          <Text>Comments: {video.commentsCount.toLocaleString('vi-VN')}</Text>
          <Text>Views: {video.viewsCount.toLocaleString('vi-VN')}</Text>
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      render: (_, video) => (
        <Tag color={video.isActive ? 'green' : 'red'}>
          {video.isActive ? 'Đang hiển thị' : 'Đã khóa'}
        </Tag>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      render: (value: string) => new Date(value).toLocaleString('vi-VN'),
    },
    {
      title: 'Hành động',
      render: (_, video) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => window.open(video.videoUrl, '_blank', 'noopener,noreferrer')}
          >
            Xem
          </Button>
          <Button
            icon={video.isActive ? <StopOutlined /> : <UnlockOutlined />}
            loading={actionLoadingId === video._id}
            onClick={() => void handleToggleStatus(video)}
          >
            {video.isActive ? 'Khóa' : 'Mở'}
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            loading={actionLoadingId === video._id}
            onClick={() => handleDelete(video)}
          >
            Xóa
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <DashboardLayout>
      {contextHolder}
      <div className="mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(255,45,85,0.14),rgba(255,255,255,0.02))] p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Admin</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)]">Quản lý Shorts</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">Tổng: {total.toLocaleString('vi-VN')} video</p>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input.Search
            allowClear
            enterButton={<SearchOutlined />}
            placeholder="Tìm caption hoặc tags..."
            style={{ maxWidth: 360 }}
            onSearch={handleSearch}
          />
        </div>

        <Table
          rowKey="_id"
          columns={columns}
          dataSource={videos}
          loading={loading}
          scroll={{ x: 1120 }}
          pagination={{
            current: page,
            total,
            pageSize: 10,
            showSizeChanger: false,
            onChange: (nextPage) => void fetchVideos(nextPage),
          }}
        />
      </div>
    </DashboardLayout>
  )
}
