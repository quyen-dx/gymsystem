import { Button, Empty, Form, Input, Modal, Tabs, message } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ChannelHeader from '../../../components/channel/ChannelHeader'
import ChannelVideoGrid from '../../../components/channel/ChannelVideoGrid'
import {
  deleteShort,
  getChannelProfile,
  getChannelVideos,
  updateShort,
} from '../../../services/shortService'
import type { ChannelProfileResponse, ShortVideo } from '../../../types/shorts'

const PAGE_SIZE = 12

export default function ChannelPage() {
  const { userId = '' } = useParams()
  const navigate = useNavigate()
  const [api, contextHolder] = message.useMessage()
  const [form] = Form.useForm()
  const [channel, setChannel] = useState<ChannelProfileResponse | null>(null)
  const [videos, setVideos] = useState<ShortVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [editingVideo, setEditingVideo] = useState<ShortVideo | null>(null)
  const [saving, setSaving] = useState(false)

  const loadChannel = useCallback(async () => {
    if (!userId) return
    const { data } = await getChannelProfile(userId)
    setChannel(data)
  }, [userId])

  const loadVideos = useCallback(async (targetPage: number, append = false) => {
    if (!userId) return
    if (append) setLoadingMore(true)
    else setLoading(true)

    try {
      const { data } = await getChannelVideos(userId, { page: targetPage, limit: PAGE_SIZE })
      setVideos((current) => append ? [...current, ...data.videos] : data.videos)
      setPage(data.page)
      setHasMore(data.hasMore)
    } catch {
      api.error('Không thể tải video của kênh')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [api, userId])

  useEffect(() => {
    setChannel(null)
    setVideos([])
    setPage(1)
    setHasMore(false)
    setLoading(true)

    Promise.all([
      loadChannel(),
      loadVideos(1),
    ]).catch(() => {
      api.error('Không thể tải kênh')
      setLoading(false)
    })
  }, [api, loadChannel, loadVideos])

  const openVideo = (video: ShortVideo) => {
    navigate(`/shorts?video=${video._id}`)
  }

  const openEditVideo = (video: ShortVideo) => {
    setEditingVideo(video)
    form.setFieldsValue({
      caption: video.caption,
      tags: video.tags.join(', '),
    })
  }

  const saveVideo = async (values: { caption: string; tags: string }) => {
    if (!editingVideo) return
    setSaving(true)
    try {
      const { data } = await updateShort(editingVideo._id, values)
      setVideos((current) => current.map((video) => video._id === editingVideo._id ? data.video : video))
      setEditingVideo(null)
      api.success('Đã cập nhật video')
      await loadChannel()
    } catch (err: any) {
      api.error(err.response?.data?.message || 'Không thể cập nhật video')
    } finally {
      setSaving(false)
    }
  }

  const toggleVisibility = async (video: ShortVideo) => {
    try {
      const { data } = await updateShort(video._id, { isActive: !video.isActive })
      setVideos((current) => current.map((item) => item._id === video._id ? data.video : item))
      api.success(data.video.isActive ? 'Đã công khai video' : 'Đã chuyển video sang riêng tư')
      await loadChannel()
    } catch (err: any) {
      api.error(err.response?.data?.message || 'Không thể đổi trạng thái video')
    }
  }

  const removeVideo = (video: ShortVideo) => {
    Modal.confirm({
      title: 'Xóa video Shorts?',
      content: 'Video và toàn bộ bình luận liên quan sẽ bị xóa.',
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteShort(video._id)
          setVideos((current) => current.filter((item) => item._id !== video._id))
          api.success('Đã xóa video')
          await loadChannel()
        } catch (err: any) {
          api.error(err.response?.data?.message || 'Không thể xóa video')
        }
      },
    })
  }

  const shareProfile = async () => {
    const url = `${window.location.origin}/channel/${userId}`
    if (navigator.share) {
      await navigator.share({ title: channel?.profile.name || 'GymPro Channel', url }).catch(() => undefined)
      return
    }
    await navigator.clipboard.writeText(url)
    api.success('Đã copy link kênh')
  }

  return (
    <div className="member-page">
      {contextHolder}

      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {channel ? (
          <ChannelHeader
            channel={channel}
            onShare={shareProfile}
          />
        ) : (
          <div className="h-72 animate-pulse rounded-[28px] bg-[var(--gs-bg-elevated)]" />
        )}

        <Tabs
          className="[&_.ant-tabs-tab-btn]:!font-bold"
          items={[
            {
              key: 'videos',
              label: 'Videos',
              children: (
                <div className="space-y-5">
                  <ChannelVideoGrid
                    videos={videos}
                    loading={loading}
                    canManage={Boolean(channel?.canManage)}
                    onOpenVideo={openVideo}
                    onEditVideo={openEditVideo}
                    onDeleteVideo={removeVideo}
                    onToggleVisibility={toggleVisibility}
                  />
                  {hasMore && (
                    <div className="flex justify-center">
                      <Button loading={loadingMore} onClick={() => loadVideos(page + 1, true)}>
                        Tải thêm
                      </Button>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'liked',
              label: 'Liked videos',
              children: (
                <div className="rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-bg-elevated)] p-10">
                  <Empty description="Liked videos sẽ được bổ sung sau" />
                </div>
              ),
            },
            {
              key: 'saved',
              label: 'Saved videos',
              children: (
                <div className="rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-bg-elevated)] p-10">
                  <Empty description="Saved videos sẽ được bổ sung sau" />
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title="Sửa video"
        open={Boolean(editingVideo)}
        onCancel={() => setEditingVideo(null)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={saveVideo}>
          <Form.Item label="Caption" name="caption">
            <Input.TextArea rows={4} maxLength={2200} showCount />
          </Form.Item>
          <Form.Item label="Tags" name="tags" extra="Nhập tags cách nhau bằng dấu phẩy.">
            <Input placeholder="gym, workout, fitness" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
