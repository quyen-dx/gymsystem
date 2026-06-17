import axios from 'axios'
import api from './api'
import { clearAuthSession, getAuthToken, refreshAccessToken } from './api'
import { API_URL } from '../config/env'
import type { ChatAttachment, ConversationContext } from '../types/aichat/aichat'

const aiCache = new Map<string, any>()
const AI_CACHE_VERSION = 'tool-v10-member-orchestration'

const isRecord = (value: unknown): value is Record<string, any> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeWebSearch = (webSearch: unknown) => {
    const safeWebSearch = isRecord(webSearch) ? webSearch : {}
    return {
        needed: Boolean(safeWebSearch.needed),
        used: Boolean(safeWebSearch.used),
        reason: typeof safeWebSearch.reason === 'string' ? safeWebSearch.reason : 'not_needed',
        results: Array.isArray(safeWebSearch.results) ? safeWebSearch.results : [],
    }
}

const normalizeSuggestions = (suggestions: unknown) => (
    Array.isArray(suggestions)
        ? suggestions
            .filter((item) => typeof item === 'string' && item.trim())
            .map((item) => item.trim())
            .slice(0, 4)
        : []
)

const normalizeSources = (sources: unknown) => (
    Array.isArray(sources)
        ? sources
            .filter((item) => isRecord(item) && typeof item.url === 'string' && item.url.trim())
            .map((item) => ({
                title: typeof item.title === 'string' ? item.title : '',
                url: item.url,
            }))
            .slice(0, 5)
        : isRecord(sources) ? sources : {}
)

const normalizeAiPayload = (payload: unknown, fallbackAnswer = '', mode: AiMode = 'gym') => {
    const safePayload = isRecord(payload) ? payload : {}
    return {
        ...safePayload,
        answer: typeof safePayload.answer === 'string' ? safePayload.answer : fallbackAnswer,
        suggestions: normalizeSuggestions(safePayload.suggestions),
        messages: Array.isArray(safePayload.messages) ? safePayload.messages : [],
        pts: Array.isArray(safePayload.pts) ? safePayload.pts : [],
        products: Array.isArray(safePayload.products) ? safePayload.products : [],
        plans: Array.isArray(safePayload.plans) ? safePayload.plans : [],
        cards: Array.isArray(safePayload.cards) ? safePayload.cards : [],
        action: isRecord(safePayload.action) ? safePayload.action : null,
        mode: safePayload.mode === 'general' ? 'general' : mode,
        sources: normalizeSources(safePayload.sources),
        metadata: isRecord(safePayload.metadata) ? safePayload.metadata : {},
        data: isRecord(safePayload.data) ? safePayload.data : {},
        webSearch: normalizeWebSearch(safePayload.webSearch),
    }
}

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
    conversationContext?: ConversationContext
    attachments?: ChatAttachment[]
    requestContext?: Record<string, string>
}

const getRequestLanguage = (requestContext?: Record<string, string>) => (
    requestContext?.language === 'en' ? 'en' : 'vi'
)

const aiClientMessages = {
    vi: {
        quota: '⚠️ AI đang quá tải hoặc hết hạn mức. Vui lòng thử lại sau hoặc kiểm tra gói API.',
        connect: 'Lỗi kết nối AI, vui lòng thử lại',
        unknown: 'Lỗi không xác định, thử lại sau',
        stream: 'Lỗi streaming AI, vui lòng thử lại',
        parseStream: 'Không parse được stream AI',
    },
    en: {
        quota: '⚠️ The AI is overloaded or quota has been exceeded. Please try again later.',
        connect: 'AI connection error. Please try again.',
        unknown: 'Unknown error. Please try again later.',
        stream: 'AI streaming error. Please try again.',
        parseStream: 'Unable to parse the AI stream.',
    },
}

const tAIClient = (key: keyof typeof aiClientMessages.vi, language = 'vi') => (
    aiClientMessages[language === 'en' ? 'en' : 'vi'][key]
)

export const requestAiAssistant = async (
    query: string,
    mode: AiMode = 'gym',
    conversationContext?: ConversationContext,
    requestContext?: Record<string, string>,
) => {
    const trimmed = query.trim()
    if (!trimmed) {
        return normalizeAiPayload({}, '', mode)
    }

    try {
        const language = getRequestLanguage(requestContext)
        const cacheKey = `${AI_CACHE_VERSION}:${mode}:${language}:${requestContext?.source || ''}:${requestContext?.intent || ''}:${trimmed.toLowerCase()}:${conversationContext?.lastIntent || ''}:${conversationContext?.lastSearchQuery || ''}`

        if (aiCache.has(cacheKey)) {
            return aiCache.get(cacheKey)
        }

        const response = await api.post('/ai-assistant', {
            query: trimmed,
            mode,
            language,
            conversationContext,
            requestContext,
        })
        console.log('AI Response:', response)
        console.log('AI Data:', response.data)
        const payload = normalizeAiPayload(response.data, '', mode)
        aiCache.set(cacheKey, payload)
        return payload
    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status || 500
            if (status === 429) {
                throw {
                    code: 429,
                    message: 'AI quota exceeded',
                    userMessage: tAIClient('quota', getRequestLanguage(requestContext)),
                }
            }
            throw {
                code: status,
                message: error.response?.data?.message || 'Lỗi kết nối AI',
                userMessage: tAIClient('connect', getRequestLanguage(requestContext)),
            }
        }

        throw {
            code: 500,
            message: error?.message || 'Lỗi không xác định',
            userMessage: tAIClient('unknown', getRequestLanguage(requestContext)),
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
        return normalizeAiPayload({}, '', mode)
    }

    const buildRequest = (token: string | null) => fetch(`${API_URL}/ai-assistant/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
            query: trimmed,
            mode,
            language: getRequestLanguage(options.requestContext),
            conversationContext: options.conversationContext,
            requestContext: options.requestContext,
            ...(options.attachments ? { attachments: options.attachments } : {}),
        }),
        signal: options.signal,
    })

    let token = getAuthToken()
    let response = await buildRequest(token)

    if (response.status === 401 && token) {
        try {
            token = await refreshAccessToken()
            response = await buildRequest(token)
        } catch {
            clearAuthSession()
            window.location.href = '/login'
        }
    }

    if (!response.ok || !response.body) {
        const language = getRequestLanguage(options.requestContext)
        throw {
            code: response.status || 500,
            message: 'Lỗi kết nối AI stream',
            userMessage: tAIClient('connect', language),
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
            donePayload = isRecord(streamEvent.data) ? streamEvent.data : {}
            if (typeof donePayload.answer === 'string' && donePayload.answer.length >= answer.length) {
                answer = donePayload.answer
            }
            return
        }

        if (streamEvent.event === 'error') {
            const language = getRequestLanguage(options.requestContext)
            const parsedMessage = streamEvent.data?.message === 'Không parse được stream AI'
                ? tAIClient('parseStream', language)
                : streamEvent.data?.message
            throw {
                code: 500,
                message: parsedMessage || 'Lỗi streaming AI',
                userMessage: parsedMessage || tAIClient('stream', language),
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

    const payload = normalizeAiPayload({
        answer,
        mode,
        ...(isRecord(donePayload) ? donePayload : {}),
    }, answer, mode)
    console.log('AI Response:', payload)
    console.log('AI Data:', payload)
    return payload
}

export const getAiChatHistory = () => api.get('/ai-assistant/history')

export const saveAiChatHistory = (data: { sessions: any[]; activeSessionId?: string }) =>
    api.put('/ai-assistant/history', data)

export const renameAiChatSession = (sessionId: string, title: string) =>
    api.patch(`/ai-assistant/session/${sessionId}`, { title })

export const deleteAiChatSession = (sessionId: string) =>
    api.delete(`/ai-assistant/session/${sessionId}`)

export const uploadAiChatImage = (file: File) => {
    const formData = new FormData()
    formData.append('image', file)
    return api.post('/ai-assistant/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
    })
}

export type GymRecommendation = {
    goal: string
    recommendedPlan: { name: string; reason: string } | null
    recommendedPT: { name: string; reason: string } | null
    roadmap: string
}

export type BodyAnalysisResult = {
    bodyType: string
    estimatedCondition: string
    strengths: string[]
    improvements: string[]
    recommendedGoal: string
    explanation: string
    recommendations?: GymRecommendation
}

export const analyzeBodyImages = async (
    attachments: ChatAttachment[],
    language = 'vi',
): Promise<BodyAnalysisResult> => {
    const { data } = await api.post('/ai-assistant/analyze-body', { attachments, language })
    if (data?.result && typeof data.result === 'object') {
        return data.result as BodyAnalysisResult
    }
    throw new Error('Invalid body analysis response')
}

export type InBodyMetrics = {
    weight: string | null
    bodyFatPercent: string | null
    skeletalMuscle: string | null
    bmi: string | null
    visceralFat: string | null
}

export type InBodyAnalysisResult = {
    unreadable: boolean
    message?: string
    metrics?: InBodyMetrics
    interpretation?: string
    assessment?: string
    recommendation?: 'giảm mỡ' | 'tăng cơ' | 'duy trì'
    explanation?: string
    recommendations?: GymRecommendation
}

export const analyzeInBodyImages = async (
    attachments: ChatAttachment[],
    language = 'vi',
): Promise<InBodyAnalysisResult> => {
    const { data } = await api.post('/ai-assistant/analyze-inbody', { attachments, language })
    if (data?.result && typeof data.result === 'object') {
        return data.result as InBodyAnalysisResult
    }
    throw new Error('Invalid InBody analysis response')
}

export type ActivePlanInfo = {
  name: string
  color: string
}

export const getActivePlans = async (): Promise<ActivePlanInfo[]> => {
  try {
    const { data } = await api.get('/plans', { params: { limit: 50 } })
    const plans = Array.isArray(data?.plans) ? data.plans : []
    const result: ActivePlanInfo[] = []
    for (const plan of plans) {
      if (!plan || typeof plan !== 'object') continue
      const color = typeof plan.color === 'string' && /^#[0-9a-f]{6}$/i.test(plan.color)
        ? plan.color
        : ''
      if (!color) continue
      if (plan.nameVi) result.push({ name: plan.nameVi, color })
      if (plan.nameEn && plan.nameEn !== plan.nameVi) result.push({ name: plan.nameEn, color })
    }
    return result
  } catch {
    return []
  }
}
