import type { AxiosProgressEvent } from 'axios'
import api from './api'
import type { ShortsCommentsResponse, ShortsFeedResponse } from '../types/shorts'

export const getShortFeed = (params?: { page?: number; limit?: number }) =>
  api.get<ShortsFeedResponse>('/shorts/feed', { params })

export const getAdminShorts = (params?: { page?: number; limit?: number; search?: string }) =>
  api.get<ShortsFeedResponse>('/shorts/admin', { params })

export const uploadShort = (data: FormData, onUploadProgress?: (event: AxiosProgressEvent) => void) =>
  api.post('/shorts/upload', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  })

export const uploadShortByUrl = (data: { videoUrl: string; caption?: string; tags?: string }) =>
  api.post('/shorts/upload-by-url', data)

export const likeShort = (id: string) =>
  api.post<{ liked: boolean; likesCount: number }>(`/shorts/${id}/like`)

export const viewShort = (id: string) =>
  api.post<{ counted: boolean; viewsCount: number }>(`/shorts/${id}/view`)

export const getShortComments = (id: string, params?: { page?: number; limit?: number }) =>
  api.get<ShortsCommentsResponse>(`/shorts/${id}/comments`, { params })

export const addShortComment = (
  id: string,
  content: string,
  parentCommentId?: string | null,
  image?: File | null,
) => {
  if (image) {
    const formData = new FormData()
    formData.append('content', content)
    if (parentCommentId) formData.append('parentCommentId', parentCommentId)
    formData.append('image', image)
    return api.post(`/shorts/${id}/comment`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }

  return api.post(`/shorts/${id}/comment`, { content, parentCommentId })
}

export const getCommentReplies = (id: string, params?: { page?: number; limit?: number }) =>
  api.get<ShortsCommentsResponse>(`/shorts/comments/${id}/replies`, { params })

export const likeShortComment = (id: string) =>
  api.post<{ liked: boolean; likesCount: number }>(`/shorts/comments/${id}/like`)

export const updateShortStatus = (id: string, isActive: boolean) =>
  api.patch(`/shorts/${id}/status`, { isActive })

export const deleteShort = (id: string) => api.delete(`/shorts/${id}`)
