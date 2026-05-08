import axios from 'axios'
import api from './api'
import { API_URL } from '../config/env'

const aiCache = new Map<string, any>()
const AI_CACHE_VERSION = 'tool-v6-full-response'

export type AiMode = 'gym' | 'general'

type AiStreamEvent =
    | { id: string; event: 'meta'; data: any }
    | { id: string; event: 'chunk'; data: { text?: string; seq?: number } }
    | { id: string; event: 'done'; data: any }
    | { id: string; event: 'error'; data: { message?: string } }
    | { id: string; event: 'fallback'; data: any }

type RequestAiAssistantStreamOptions = {
    onChunk?: (chunk: string) => void
    onFirstChunk?: () => void
    onMeta?: (data: any) => void
    onFallback?: (data: any) => void
    signal?: AbortSignal
}

export const requestAiAssistant = async (query: string, mode: AiMode = 'gym') => {
    const trimmed = query.trim()
    if (!trimmed) {
        return { answer: '', pts: [], products: [], plans: [] }
    }

    const cacheKey = `${AI_CACHE_VERSION}:${mode}:${trimmed.toLowerCase()}`

    if (aiCache.has(cacheKey)) {
        return aiCache.get(cacheKey)
    }

    try {
        const response = await api.post('/ai-assistant', { query: trimmed, mode })
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

const parseSseEvent = (rawEvent: string): AiStreamEvent | null => {
    const lines = rawEvent.split(/\r?\n/)
    const id = lines.find((line) => line.startsWith('id:'))?.replace(/^id:\s*/, '').trim() || ''
    const event = lines.find((line) => line.startsWith('event:'))?.replace(/^event:\s*/, '').trim() || 'message'
    const dataLines = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.replace(/^data:\s*/, ''))

    if (dataLines.length === 0) return null

    try {
        return { id, event, data: JSON.parse(dataLines.join('\n')) } as AiStreamEvent
    } catch {
        return { id, event: 'error', data: { message: 'Không parse được stream AI' } }
    }
}

export const requestAiAssistantStream = async (
    query: string,
    mode: AiMode = 'gym',
    options: RequestAiAssistantStreamOptions = {},
) => {
    const trimmed = query.trim()
    if (!trimmed) {
        return { answer: '', pts: [], products: [], plans: [], mode }
    }

    const token = localStorage.getItem('token')
    const response = await fetch(`${API_URL}/ai-assistant/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query: trimmed, mode }),
        signal: options.signal,
    })

    if (response.status === 401 && token) {
        localStorage.removeItem('token')
        window.location.href = '/login'
    }

    if (!response.ok || !response.body) {
        throw {
            code: response.status || 500,
            message: 'Lỗi kết nối AI stream',
            userMessage: 'Lỗi kết nối AI, vui lòng thử lại',
        }
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let answer = ''
    let donePayload: any = null
    let firstChunkReceived = false
    const seenEventIds = new Set<string>()

    const handleEvent = (streamEvent: AiStreamEvent | null) => {
        if (!streamEvent) return
        if (streamEvent.id) {
            if (seenEventIds.has(streamEvent.id)) return
            seenEventIds.add(streamEvent.id)
        }

        if (streamEvent.event === 'meta') {
            console.log('[AI stream frontend] meta:', streamEvent.data)
            options.onMeta?.(streamEvent.data)
            return
        }

        if (streamEvent.event === 'fallback') {
            console.log('[AI stream frontend] fallback:', streamEvent.data)
            options.onFallback?.(streamEvent.data)
            return
        }

        if (streamEvent.event === 'chunk') {
            const text = streamEvent.data?.text || ''
            if (!text) return
            console.log('[AI stream frontend] chunk received:', text)
            if (!firstChunkReceived) {
                firstChunkReceived = true
                options.onFirstChunk?.()
            }
            answer += text
            options.onChunk?.(text)
            return
        }

        if (streamEvent.event === 'done') {
            console.log('[AI stream frontend] done:', streamEvent.data)
            donePayload = streamEvent.data || {}
            if (typeof donePayload.answer === 'string' && donePayload.answer.length >= answer.length) {
                answer = donePayload.answer
            }
            return
        }

        if (streamEvent.event === 'error') {
            throw {
                code: 500,
                message: streamEvent.data?.message || 'Lỗi streaming AI',
                userMessage: streamEvent.data?.message || 'Lỗi streaming AI, vui lòng thử lại',
            }
        }
    }

    while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split(/\r?\n\r?\n/)
        buffer = events.pop() || ''

        for (const rawEvent of events) {
            const cleanEvent = rawEvent.trim()
            if (!cleanEvent || cleanEvent.startsWith(':')) continue
            handleEvent(parseSseEvent(cleanEvent))
        }
    }

    buffer += decoder.decode()
    if (buffer.trim() && !buffer.trim().startsWith(':')) {
        handleEvent(parseSseEvent(buffer.trim()))
    }

    return {
        answer,
        mode,
        ...(donePayload || {}),
    }
}

export const getAiChatHistory = () => api.get('/ai-assistant/history')

export const saveAiChatHistory = (data: { sessions: any[]; activeSessionId?: string }) =>
    api.put('/ai-assistant/history', data)

export const renameAiChatSession = (sessionId: string, title: string) =>
    api.patch(`/ai-assistant/session/${sessionId}`, { title })

export const deleteAiChatSession = (sessionId: string) =>
    api.delete(`/ai-assistant/session/${sessionId}`)
