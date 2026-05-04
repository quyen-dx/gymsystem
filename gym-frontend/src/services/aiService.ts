import axios from 'axios'
import api from './api'

const aiCache = new Map<string, any>()
const AI_CACHE_VERSION = 'tool-v5'

export type AiMode = 'gym' | 'general'

export const requestAiAssistant = async (query: string, mode: AiMode = 'gym') => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
        return { answer: '', pts: [], products: [], plans: [] }
    }

    const cacheKey = `${AI_CACHE_VERSION}:${mode}:${normalized}`

    if (aiCache.has(cacheKey)) {
        return aiCache.get(cacheKey)
    }

    try {
        const response = await api.post('/ai-assistant', { query: normalized, mode })
        const payload = response.data
        aiCache.set(cacheKey, payload)
        return payload
    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status || 500
            if (status === 429) {
                throw {
                    code: 429,
                    message: 'AI quota exceeded',
                    userMessage: '⚠️ AI đang quá tải hoặc hết hạn mức. Vui lòng thử lại sau hoặc kiểm tra gói API.',
                }
            }
            throw {
                code: status,
                message: error.response?.data?.message || 'Lỗi kết nối AI',
                userMessage: 'Lỗi kết nối AI, vui lòng thử lại',
            }
        }

        throw {
            code: 500,
            message: error?.message || 'Lỗi không xác định',
            userMessage: 'Lỗi không xác định, thử lại sau',
        }
    }
}

export const getAiChatHistory = () => api.get('/ai-assistant/history')

export const saveAiChatHistory = (data: { sessions: any[]; activeSessionId?: string }) =>
    api.put('/ai-assistant/history', data)

export const renameAiChatSession = (sessionId: string, title: string) =>
    api.patch(`/ai-assistant/session/${sessionId}`, { title })

export const deleteAiChatSession = (sessionId: string) =>
    api.delete(`/ai-assistant/session/${sessionId}`)
