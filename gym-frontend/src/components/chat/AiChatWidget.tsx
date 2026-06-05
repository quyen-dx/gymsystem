import { CheckOutlined, CloseOutlined, CopyOutlined, DeleteOutlined, EditOutlined, ExpandAltOutlined, MenuFoldOutlined, MenuUnfoldOutlined, MoreOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons'
import { Avatar, Badge, Button, Drawer, Dropdown, Input, Modal, Segmented, Select, Space, Spin, Tooltip, Typography } from 'antd'
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode, TouchEvent as ReactTouchEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../context/ThemeProvider'
import { useAuth } from '../../hooks/useAuth'
import { useDraggable } from '../../hooks/useDraggable'
import { deleteAiChatSession, getAiChatHistory, renameAiChatSession, requestAiAssistant, requestAiAssistantStream, saveAiChatHistory, type AiMode } from '../../services/aiService'
import type { AiToolPayload, ChatMessage, ChatSession, ConversationContext, PlanPayload, StoredChatState, WebSearchResult } from '../../types/aichat/aichat'

import { AssistantMessageBubble } from './AssistantMessageBubble'

const STORAGE_KEY_PREFIX = 'chat_history_'
const MASCOT_WIDTH = 100
const MASCOT_HEIGHT = 100
const CHAT_PANEL_BACKGROUND_IMAGE = 'https://genk.mediacdn.vn/2019/7/3/photo-1-1562129061617297549771.jpg'
const AI_AVATAR_IMAGE = 'https://vcdn1-giaitri.vnecdn.net/2023/04/28/doraemon4-1682675790-8961-1682675801.jpg?w=500&h=300&q=100&dpr=1&fit=crop&s=3dxqum5l0xkhHX-R0z_a1g'
const MEMBER_SUGGESTED_PROMPT_KEYS = [
    'today_workout',
    'weekly_schedule',
    'membership_days_left',
    'monthly_checkins',
    'eat_to_lose_fat',
    'eat_to_gain_muscle',
    'explain_health_metrics',
    'completed_sessions',
    'training_progress',
    'suggest_training_goals',
]

const getSourceDomain = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, '')
    } catch {
        return ''
    }
}

const getSourceName = (source: WebSearchResult, t?: (key: string) => string) => {
    const domain = getSourceDomain(source.url)
    const title = String(source.title || '').replace(/\s+/g, ' ').trim()
    if (!title) return domain || (t ? t('ai.sourceWeb') : 'Web source')
    return title
        .replace(/\s*[-|]\s*.*$/, '')
        .slice(0, 80)
}

const stripWebSourceSection = (text: string) => {
    return String(text || '')
        .replace(/\n?\s*(Nguồn|Sources)\s*:\s*[\s\S]*$/i, '')
        .trim()
}

const extractSourceResultsFromText = (text: string): WebSearchResult[] => {
    const sourceMatch = String(text || '').match(/(?:^|\n)\s*(Nguồn|Sources)\s*:\s*([\s\S]*)$/i)
    if (!sourceMatch) return []

    const seen = new Set<string>()
    const results: WebSearchResult[] = []
    const sourceText = sourceMatch[2]
    const linkPattern = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)|(https:\/\/[^\s<>)]+)/g
    let match: RegExpExecArray | null

    while ((match = linkPattern.exec(sourceText)) !== null) {
        const url = (match[2] || match[3] || '').replace(/[.,!?;:]+$/, '')
        if (!url || seen.has(url)) continue
        seen.add(url)
        results.push({ title: match[1] || getSourceDomain(url), url })
    }

    return results
}

const TYPING_INTERVAL_MS = 24
const TYPING_BASE_CHARS = 2
const TYPING_FAST_BACKLOG = 700
const TYPING_MAX_CHARS = 7
const AI_MESSAGE_RENDER_FALLBACK_TEXT = 'Mình chưa thể hiển thị đầy đủ dữ liệu này. Vui lòng thử lại.'

type AiActionPayload = {
    action: string
    color?: string
    themeName?: string
    message?: string
    path?: string
    url?: string
}



const normalizeCommandText = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()

const normalizeHexColor = (hex: string) => {
    const value = hex.trim().toLowerCase()
    if (/^#[0-9a-f]{6}$/.test(value)) return value
    if (/^#[0-9a-f]{3}$/.test(value)) {
        return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
    }
    return ''
}

const getThemeActionFromMessage = (content: string): { themeName?: string; color?: string } | null => {
    try {
        const parsed = JSON.parse(content)
        if (parsed?.action === 'change_theme') return { themeName: parsed.themeName, color: parsed.color }
    } catch { }
    return null
}

const extractJsonObjectPayload = (content: unknown): Record<string, any> | null => {
    if (content && typeof content === 'object' && !Array.isArray(content)) {
        return content as Record<string, any>
    }
    if (typeof content !== 'string') return null

    const text = content
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        .trim()
    if (!text) return null

    const candidates = [
        text,
        text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim(),
    ]
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        candidates.push(text.slice(firstBrace, lastBrace + 1))
    }

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate)
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
        } catch { }
    }
    return null
}

const parseAiActionPayload = (content: unknown): AiActionPayload | null => {
    const parsed = extractJsonObjectPayload(content)
    if (typeof parsed?.action === 'string') return parsed as AiActionPayload
    return null
}

const getAiResponseActionPayload = (response: unknown): AiActionPayload | null => {
    if (!isRecord(response)) return null
    if (isRecord(response.action) && typeof response.action.action === 'string') return response.action as AiActionPayload
    if (isRecord(response.data) && isRecord(response.data.action) && typeof response.data.action.action === 'string') {
        return response.data.action as AiActionPayload
    }
    return null
}

const getAiActionFallbackMessage = (t: (key: string) => string, action?: string) => {
    const messages: Record<string, string> = {
        change_theme: t('ai.actionChangeTheme'),
        open_modal: t('ai.actionOpenModal'),
        navigate: t('ai.actionNavigate'),
        search_web: t('ai.actionSearchWeb'),
    }
    return action ? messages[action] || t('ai.actionFallback') : t('ai.actionFallback')
}

const getAiActionDisplayMessage = (
    actionPayload: ReturnType<typeof parseAiActionPayload>,
    currentContent = '',
    t: (key: string) => string,
) => {
    if (!actionPayload) return currentContent
    const actionMessage = typeof actionPayload.message === 'string'
        ? actionPayload.message
        : ''
    return actionMessage.trim() ? actionMessage : getAiActionFallbackMessage(t, actionPayload.action)
}

const getAiObjectDisplayMessage = (content: unknown, t: (key: string) => string) => {
    const parsed = extractJsonObjectPayload(content)
    if (!parsed) return null
    const actionPayload = typeof parsed.action === 'string'
        ? parsed as AiActionPayload
        : null
    if (actionPayload) return getAiActionDisplayMessage(actionPayload, '', t)

    const naturalMessage = [parsed.message, parsed.text, parsed.answer, parsed.content]
        .find((value) => typeof value === 'string' && value.trim())
    return typeof naturalMessage === 'string'
        ? naturalMessage
        : t('ai.actionProcessed')
}

const getSafeAssistantDisplayContent = (content: unknown, actionPayload: ReturnType<typeof parseAiActionPayload>, t: (key: string) => string) => {
    if (actionPayload) return getAiActionDisplayMessage(actionPayload, '', t)
    const objectMessage = getAiObjectDisplayMessage(content, t)
    return objectMessage ? objectMessage : typeof content === 'string' ? content : ''
}

const splitAiAssistantResponse = (rawContent: unknown, currentContent = '', t: (key: string) => string) => {
    const actionPayload = parseAiActionPayload(rawContent)
    const chatContent = rawContent
        ? getSafeAssistantDisplayContent(rawContent, actionPayload, t)
        : currentContent

    return {
        actionPayload,
        chatContent,
    }
}

const extractAiResponseContent = (response: unknown, fallback = '', t?: (key: string) => string) => {
    if (typeof response === 'string') return response
    if (!response || typeof response !== 'object') return fallback

    const payload = response as Record<string, unknown>
    const directContent = [payload.answer, payload.message, payload.text, payload.content]
        .find((value) => typeof value === 'string' && value.trim())

    if (typeof directContent === 'string') return directContent

    const objectMessage = getAiObjectDisplayMessage(
        payload.answer ?? payload.message ?? payload.text ?? payload.content ?? payload,
        t || ((key: string) => key),
    )
    return objectMessage || fallback
}

const normalizeChatContent = (content: unknown, t?: (key: string) => string) => {
    if (typeof content === 'string') {
        const cleaned = content
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
            .replace(/^```[a-z0-9_-]*\s*/i, '')
            .replace(/\s*```$/i, '')
        if (/^\s*\{[\s\S]*\}\s*$/.test(cleaned)) {
            return getAiObjectDisplayMessage(cleaned, t || ((key: string) => key)) || ''
        }
        return cleaned
    }
    return getAiObjectDisplayMessage(content, t || ((key: string) => key)) || ''
}

const isPotentialJsonObjectResponse = (content: unknown) => {
    if (content && typeof content === 'object') return true
    if (typeof content !== 'string') return false
    const text = content.trimStart().toLowerCase()
    return text.startsWith('{') || text.startsWith('```json') || text.startsWith('```')
}

const parseAiToolPayload = (content: unknown): AiToolPayload | null => {
    const parsed = extractJsonObjectPayload(content)
    if (parsed?.type === 'product_list' && Array.isArray(parsed.items)) return parsed as AiToolPayload
    if (parsed?.type === 'pt_list' && Array.isArray(parsed.items)) return parsed as AiToolPayload
    if (parsed?.type === 'category_list' && Array.isArray(parsed.items)) return parsed as AiToolPayload
    if (parsed?.type === 'empty' && typeof parsed.message === 'string') return parsed as AiToolPayload
    return null
}

const renderInlineMarkdown = (text: string, color: string): ReactNode[] => {
    const parts = text.split(/(\[[^\]]+\]\(https:\/\/[^)\s]+\)|https:\/\/[^\s<>)]+|`[^`]+`|\*\*[^*]+\*\*)/g)
    return parts.flatMap((part, index) => {
        const markdownLink = part.match(/^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/)
        if (markdownLink) {
            return (
                <a
                    key={index}
                    href={markdownLink[2]}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--theme-accent)', textDecoration: 'underline', overflowWrap: 'anywhere' }}
                >
                    {markdownLink[1]}
                </a>
            )
        }
        if (/^https:\/\/[^\s<>)]+$/i.test(part)) {
            const trailing = part.match(/[.,!?;:]+$/)?.[0] || ''
            const href = trailing ? part.slice(0, -trailing.length) : part
            return (
                <span key={index}>
                    <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--theme-accent)', textDecoration: 'underline', overflowWrap: 'anywhere' }}
                    >
                        {href}
                    </a>
                    {trailing}
                </span>
            )
        }
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return (
                <code
                    key={index}
                    style={{
                        padding: '1px 5px',
                        borderRadius: 5,
                        background: 'rgba(0,0,0,0.10)',
                        color,
                        fontSize: '0.92em',
                    }}
                >
                    {part.slice(1, -1)}
                </code>
            )
        }
        return part
    })
}

const renderMarkdownText = (text: string, color: string) => {
    const blocks = text.split(/(```[\s\S]*?```)/g)
    return (
        <div style={{ color, whiteSpace: 'pre-wrap' }}>
            {blocks.map((block, blockIndex) => {
                if (block.startsWith('```')) {
                    const code = block
                        .replace(/^```[a-zA-Z0-9_-]*\n?/, '')
                        .replace(/```$/, '')
                    return (
                        <pre
                            key={`code-${blockIndex}`}
                            style={{
                                margin: '8px 0',
                                padding: '10px 12px',
                                borderRadius: 8,
                                overflowX: 'auto',
                                background: 'rgba(0,0,0,0.14)',
                                color,
                                fontSize: 13,
                                lineHeight: 1.55,
                            }}
                        >
                            <code>{code}</code>
                        </pre>
                    )
                }

                return block.split('\n').map((line, lineIndex) => {
                    const bullet = line.match(/^(\s*[-*]\s+)(.+)$/)
                    return (
                        <div
                            key={`text-${blockIndex}-${lineIndex}`}
                            style={{ margin: bullet ? '2px 0 2px 12px' : undefined, minHeight: line ? undefined : 6 }}
                        >
                            {bullet ? '• ' : ''}
                            {renderInlineMarkdown(bullet ? bullet[2] : line, color)}
                        </div>
                    )
                })
            })}
        </div>
    )
}

const renderWebSourceCards = (sourcesInput: unknown, dark: boolean, t?: (key: string) => string) => {
    const sources = Array.isArray(sourcesInput) ? sourcesInput : []
    const uniqueSources = sources
        .filter((source): source is WebSearchResult => Boolean(source) && typeof source === 'object' && !Array.isArray(source))
        .filter((source) => /^https:\/\//i.test(source.url || '') && getSourceDomain(source.url))
        .filter((source, index, list) => list.findIndex((item) => item.url === source.url) === index)
        .slice(0, 5)

    if (uniqueSources.length === 0) return null

    return (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <Typography.Text style={{ color: 'var(--theme-muted)', fontSize: 12, fontWeight: 700 }}>
                {t ? t('ai.sourcesTitle') : 'Sources'}
            </Typography.Text>
            {uniqueSources.map((source) => {
                const domain = getSourceDomain(source.url)
                const name = getSourceName(source, t)
                return (
                    <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '32px minmax(0, 1fr)',
                            gap: 10,
                            alignItems: 'center',
                            padding: '9px 10px',
                            borderRadius: 8,
                            border: '1px solid var(--theme-border)',
                            background: 'var(--theme-card)',
                            color: 'inherit',
                            textDecoration: 'none',
                        }}
                    >
                        <Avatar
                            size={32}
                            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
                            style={{ background: 'var(--theme-elevated)' }}
                        >
                            {domain.charAt(0).toUpperCase()}
                        </Avatar>
                        <span style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                            <Typography.Text strong ellipsis style={{ color: 'inherit', lineHeight: 1.25 }}>
                                {name}
                            </Typography.Text>
                            <Typography.Text ellipsis style={{ color: dark ? '#d8d8d8' : 'rgba(237,235,230,0.55)', fontSize: 12, lineHeight: 1.2 }}>
                                {domain}
                            </Typography.Text>
                        </span>
                    </a>
                )
            })}
        </div>
    )
}







const getAiResponsePlanPayload = (response: unknown): PlanPayload | undefined => {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return undefined
  const payload = response as Record<string, unknown>
  const responseType = typeof payload.type === 'string' ? payload.type : ''
  const isPlanResponse = responseType === 'plan_detail'
    || responseType === 'plan_list'
    || responseType === 'plan_compare'
    || responseType === 'plan_compare_two'
    || responseType === 'plan_compare_all'
    || responseType === 'plan_recommend'
  if (!isPlanResponse) return undefined
  const candidate = isRecord(payload.planPayload) ? payload.planPayload : undefined
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return undefined
  const planPayload = candidate as Record<string, unknown>
  if (planPayload.type === 'plan_detail' && planPayload.plan) return planPayload as PlanPayload
  if (
    (planPayload.type === 'plan_list' || planPayload.type === 'plan_compare_two' || planPayload.type === 'plan_compare_all')
    && Array.isArray(planPayload.plans)
  ) return planPayload as PlanPayload
  if (planPayload.type === 'plan_recommend' && planPayload.recommendedPlan) {
    return planPayload as PlanPayload
  }
  if (planPayload.type === 'ai_advice' && typeof planPayload.answer === 'string') {
    return planPayload as PlanPayload
  }
  return undefined
}

const getAiResponsePlanFields = (response: unknown) => {
  const planPayload = getAiResponsePlanPayload(response)
  if (!planPayload) return {}
  return {
    type: planPayload.type,
    ...(planPayload.type === 'plan_detail' ? { plan: planPayload.plan } : {}),
    ...(planPayload.type === 'plan_list' || planPayload.type === 'plan_compare_two' || planPayload.type === 'plan_compare_all'
      ? { plans: planPayload.plans, ...(planPayload.type === 'plan_compare_two' ? { conclusion: planPayload.conclusion } : {}) }
      : {}),
    ...(planPayload.type === 'plan_recommend'
      ? { recommendedPlan: planPayload.recommendedPlan, reason: planPayload.reason, conclusion: planPayload.conclusion, alternatives: planPayload.alternatives }
      : {}),
    ...(planPayload.type === 'ai_advice' ? { answer: planPayload.answer } : {}),
    planPayload,
  }
}

const renderSafeAiMessageContent = (renderContent: () => ReactNode, fallbackColor: string, fallbackText?: string) => {
  try {
    return renderContent()
  } catch (error) {
    console.error('[AI chat] message render failed:', error)
    return <Typography.Text style={{ color: fallbackColor }}>{fallbackText || AI_MESSAGE_RENDER_FALLBACK_TEXT}</Typography.Text>
  }
}



const getStorageKey = (userId?: string) => `${STORAGE_KEY_PREFIX}${userId ?? 'guest'}`

const isRecord = (value: unknown): value is Record<string, any> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const loadChatState = (storageKey: string): StoredChatState => {
    try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return { sessions: [] }
        const parsed = JSON.parse(raw)
        const safeParsed = isRecord(parsed) ? parsed : {}
        const sessions = Array.isArray(safeParsed.sessions)
            ? normalizeChatSessions(safeParsed.sessions)
            : []
        return {
            sessions,
            activeSessionId: typeof safeParsed.activeSessionId === 'string' ? safeParsed.activeSessionId : undefined,
        }
    } catch {
        return { sessions: [] }
    }
}

const saveChatState = (storageKey: string, state: StoredChatState) => {
    try {
        localStorage.setItem(storageKey, JSON.stringify(state))
    } catch { }
}

const createSession = (): ChatSession => ({
    sessionId: `session-${Date.now()}`,
    title: 'New Chat',
    createdAt: new Date().toISOString(),
    messages: [],
})

const normalizeSuggestions = (suggestions: unknown) => (
    Array.isArray(suggestions)
        ? suggestions
            .filter((item) => typeof item === 'string' && item.trim())
            .map((item) => item.trim())
            .slice(0, 4)
        : []
)

const getAiResponseSubject = (response: unknown) => {
    const safeResponse = isRecord(response) ? response : {}
    const metadata = isRecord(safeResponse.metadata) ? safeResponse.metadata : {}
    const questionAnalysis = isRecord(metadata.questionAnalysis) ? metadata.questionAnalysis : {}
    const classifier = isRecord(metadata.classifier) ? metadata.classifier : {}
    if (typeof questionAnalysis.subject === 'string') return questionAnalysis.subject
    if (typeof classifier.subject === 'string') return classifier.subject
    if (typeof safeResponse.subject === 'string') return safeResponse.subject
    return undefined
}

const normalizeChatMessage = (message: ChatMessage): ChatMessage => {
    const safeMessage: Record<string, any> = isRecord(message) ? message : {}
    const suggestions = normalizeSuggestions(safeMessage.suggestions)
    const planFields = getAiResponsePlanFields(safeMessage)
    const alternatives = Array.isArray(safeMessage.alternatives) ? safeMessage.alternatives.slice(0, 2) : undefined
    return {
        id: typeof safeMessage.id === 'string' ? safeMessage.id : `${Date.now()}-${Math.random()}`,
        userId: typeof safeMessage.userId === 'string' ? safeMessage.userId : 'guest',
        role: safeMessage.role === 'user' || safeMessage.role === 'assistant' || safeMessage.role === 'system'
            ? safeMessage.role
            : 'system',
        content: normalizeChatContent(safeMessage.content),
        ...(typeof safeMessage.answer === 'string' ? { answer: safeMessage.answer } : {}),
        createdAt: typeof safeMessage.createdAt === 'string' ? safeMessage.createdAt : new Date().toISOString(),
        ...(suggestions.length > 0 ? { suggestions } : {}),
        ...(isRecord(safeMessage.webSearch) ? { webSearch: {
            needed: Boolean(safeMessage.webSearch.needed),
            used: Boolean(safeMessage.webSearch.used),
            reason: typeof safeMessage.webSearch.reason === 'string' ? safeMessage.webSearch.reason : 'not_needed',
            results: Array.isArray(safeMessage.webSearch.results) ? safeMessage.webSearch.results : [],
        } } : {}),
        ...(typeof safeMessage.intent === 'string' ? { intent: safeMessage.intent } : {}),
        ...(typeof safeMessage.subject === 'string' ? { subject: safeMessage.subject } : {}),
        ...(typeof safeMessage.action === 'string' ? { action: safeMessage.action } : {}),
        ...(isRecord(safeMessage.metadata) ? { metadata: safeMessage.metadata } : {}),
        ...(isRecord(safeMessage.data) ? { data: safeMessage.data } : {}),
        ...(Array.isArray(safeMessage.cards) ? { cards: safeMessage.cards } : {}),
        ...(isRecord(safeMessage.aiAction) ? { aiAction: safeMessage.aiAction } : {}),
        ...(alternatives ? { alternatives } : {}),
        ...(typeof safeMessage.conclusion === 'string' ? { conclusion: safeMessage.conclusion } : {}),
        ...planFields,
    }
}

const normalizeChatSessions = (sessions: ChatSession[]) =>
    (Array.isArray(sessions) ? sessions : []).map((session) => {
        const safeSession: Record<string, any> = isRecord(session) ? session : {}
        return {
            sessionId: typeof safeSession.sessionId === 'string' ? safeSession.sessionId : `session-${Date.now()}-${Math.random()}`,
            title: typeof safeSession.title === 'string' ? safeSession.title : 'New Chat',
            createdAt: typeof safeSession.createdAt === 'string' ? safeSession.createdAt : new Date().toISOString(),
            messages: Array.isArray(safeSession.messages)
                ? safeSession.messages.map(normalizeChatMessage)
                : [],
        }
    })

const getSessionTitle = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return 'New Chat'
    return trimmed.length > 30 ? `${trimmed.slice(0, 30)}...` : trimmed
}

const getProductTopicFromText = (text: string) => {
    const normalized = normalizeCommandText(text)
    const match = normalized.match(/\b(whey|protein|creatine|ta|dumbbell|dumbell|may tap|giay gym|gang tay|glove|strap|day khang luc|tham tap)\b/)
    return match?.[0]
}

const buildConversationContext = (messages: ChatMessage[], currentMode: AiMode, sessionId?: string): ConversationContext => {
    const recentMessages = messages.slice(-10).map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        intent: message.intent,
        subject: message.subject,
        action: message.action,
    }))
    const context: ConversationContext = {
        conversationId: sessionId,
        sessionId,
        recentMessages,
        lastMode: currentMode,
    }

    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index]
        const themeAction = getThemeActionFromMessage(message.content)
        if (themeAction && !context.lastThemeAction) {
            context.lastThemeAction = themeAction
            context.lastIntent = 'change_theme'
            context.lastAction = 'change_theme'
        }
        if (message.intent && !context.lastIntent) context.lastIntent = message.intent
        if (message.subject && !context.lastSubject) context.lastSubject = message.subject
        if (message.action && !context.lastAction) context.lastAction = message.action
        if (message.role === 'user' && !context.lastSearchQuery) {
            const productTopic = getProductTopicFromText(message.content)
            if (productTopic) {
                context.lastSearchQuery = message.content
                context.lastProduct = productTopic
            }
        }
        if (context.lastIntent && context.lastSubject && context.lastSearchQuery && context.lastThemeAction) break
    }

    return context
}

const playDoraemonClickSound = () => {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContextClass) return
        const audioContext = new AudioContextClass()
        const gain = audioContext.createGain()
        gain.gain.setValueAtTime(0.001, audioContext.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.18)
        gain.connect(audioContext.destination)
            ;[660, 880].forEach((frequency, index) => {
                const oscillator = audioContext.createOscillator()
                oscillator.type = 'sine'
                oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + index * 0.07)
                oscillator.connect(gain)
                oscillator.start(audioContext.currentTime + index * 0.07)
                oscillator.stop(audioContext.currentTime + index * 0.07 + 0.11)
            })
        window.setTimeout(() => audioContext.close(), 320)
    } catch { }
}

const DoraemonChatMascot = ({ width = MASCOT_WIDTH, height = MASCOT_HEIGHT }: { width?: number; height?: number }) => (
    <div style={{ width, height, position: 'relative', borderRadius: '9999px', overflow: 'hidden' }}>
        <img
            src="https://upload.wikimedia.org/wikipedia/en/b/bd/Doraemon_character.png"
            alt="Doraemon"
            style={{
                width,
                height,
                objectFit: 'cover',
                display: 'block',
                position: 'absolute',
                top: 0, left: 0,
                filter: 'brightness(0.9) saturate(0.95) drop-shadow(0 8px 20px rgba(0,116,170,0.5))',
                opacity: 1,
                transform: 'scale(1) translateY(0)',
                transition: 'filter 180ms ease, transform 180ms ease',
            }}
        />
    </div>
)

const DoraemonMiniAvatar = () => (
    <img
        src={AI_AVATAR_IMAGE}
        alt="Doraemon"
        style={{ width: 22, height: 22, borderRadius: '50%', display: 'block', objectFit: 'cover' }}
    />
)

export default function AiChatWidget() {
    const { dark, tokens, applyTheme } = useTheme()
    const { user } = useAuth()
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const [visible, setVisible] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string>('')
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [aiActionLoading, setAiActionLoading] = useState(false)
    const [activeAiTool, setActiveAiTool] = useState('')
    const [loadingPhase, setLoadingPhase] = useState<'data' | 'reasoning'>('data')
    const [errorInfo, setErrorInfo] = useState<{ code: number; message: string } | null>(null)
    const [retryCountdown, setRetryCountdown] = useState(0)
    const [lastQuery, setLastQuery] = useState('')
    const [copiedMessageIds, setCopiedMessageIds] = useState<Set<string>>(new Set())
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
    const [editingTitle, setEditingTitle] = useState('')
    const [mode, setMode] = useState<AiMode>('gym')
    const scrollRef = useRef<HTMLDivElement>(null)
    const hydratedServerHistoryRef = useRef('')
    const streamTextBufferRef = useRef('')
    const streamTypingTimerRef = useRef<number | null>(null)
    const streamTargetMessageIdRef = useRef('')
    const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

    const [viewport, setViewport] = useState(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
    }))

    const storageKey = getStorageKey(user?._id)

    useEffect(() => {
        const handleResize = () => {
            setViewport({ width: window.innerWidth, height: window.innerHeight })
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    useEffect(() => {
        if (user?._id && hydratedServerHistoryRef.current === user._id) return
        const stored = loadChatState(storageKey)
        if (stored.sessions.length > 0) {
            setSessions(stored.sessions)
            setActiveSessionId(stored.activeSessionId || stored.sessions[0].sessionId)
        } else {
            const newSession = createSession()
            setSessions([newSession])
            setActiveSessionId(newSession.sessionId)
        }
    }, [storageKey])

    useEffect(() => {
        if (!user?._id) return
        let cancelled = false
        const loadServerHistory = async () => {
            try {
                const { data } = await getAiChatHistory()
                if (cancelled) return
                hydratedServerHistoryRef.current = user._id
                const safeData = isRecord(data) ? data : {}
                const serverSessions = Array.isArray(safeData.sessions) ? safeData.sessions : []
                if (serverSessions.length > 0) {
                    const normalizedSessions = normalizeChatSessions(serverSessions)
                    const nextActiveSessionId = typeof safeData.activeSessionId === 'string'
                        ? safeData.activeSessionId
                        : normalizedSessions[0].sessionId
                    setSessions(normalizedSessions)
                    setActiveSessionId(nextActiveSessionId)
                    saveChatState(storageKey, {
                        sessions: normalizedSessions,
                        activeSessionId: nextActiveSessionId,
                    })
                }
            } catch {
                hydratedServerHistoryRef.current = user._id
            }
        }
        loadServerHistory()
        return () => { cancelled = true }
    }, [user?._id, storageKey])

    useEffect(() => {
        if (!activeSessionId && sessions.length > 0) setActiveSessionId(sessions[0].sessionId)
    }, [activeSessionId, sessions])

    useEffect(() => {
        saveChatState(storageKey, { sessions, activeSessionId })
    }, [sessions, activeSessionId, storageKey])

    useEffect(() => {
        if (!user?._id || hydratedServerHistoryRef.current !== user._id || sessions.length === 0) return
        const timer = window.setTimeout(() => {
            saveAiChatHistory({ sessions, activeSessionId }).catch(() => { })
        }, 450)
        return () => window.clearTimeout(timer)
    }, [sessions, activeSessionId, user?._id])

    useEffect(() => {
        if (!visible) return
        window.requestAnimationFrame(() => {
            const element = scrollRef.current
            if (element) element.scrollTop = element.scrollHeight
        })
    }, [sessions, visible, loading, aiActionLoading])

    useEffect(() => {
        return () => {
            if (streamTypingTimerRef.current) {
                window.clearInterval(streamTypingTimerRef.current)
                streamTypingTimerRef.current = null
            }
            document.body.style.userSelect = ''
            document.body.style.touchAction = ''
        }
    }, [])

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>
        if (retryCountdown > 0) timer = setTimeout(() => setRetryCountdown(retryCountdown - 1), 1000)
        return () => { if (timer) clearTimeout(timer) }
    }, [retryCountdown])

    useEffect(() => {
        if (!loading) {
            setLoadingPhase('data')
            return
        }
        setLoadingPhase('data')
        const timer = window.setTimeout(() => setLoadingPhase('reasoning'), 2000)
        return () => window.clearTimeout(timer)
    }, [loading])

    const activeSession = sessions.find((s) => s.sessionId === activeSessionId) || sessions[0]
    const activeMessages = activeSession?.messages || []

    const addMessageToSession = (message: ChatMessage) => {
        if (!activeSession) return
        const safeMessage = normalizeChatMessage(message)
        setSessions((current) =>
            current.map((session) => {
                if (session.sessionId !== activeSession.sessionId) return session
                return {
                    ...session,
                    title: session.title === 'New Chat' && safeMessage.role === 'user'
                        ? getSessionTitle(safeMessage.content)
                        : session.title,
                    messages: [...(Array.isArray(session.messages) ? session.messages : []), safeMessage],
                }
            })
        )
    }

    const updateMessageInSession = (messageId: string, updater: (message: ChatMessage) => ChatMessage) => {
        setSessions((current) =>
            current.map((session) => ({
                ...session,
                messages: (Array.isArray(session.messages) ? session.messages : []).map((message) =>
                    message.id === messageId ? updater(message) : message
                ),
            }))
        )
    }

    const stopStreamTyping = () => {
        if (streamTypingTimerRef.current) {
            window.clearInterval(streamTypingTimerRef.current)
            streamTypingTimerRef.current = null
        }
    }

    const flushStreamTextBuffer = (messageId: string) => {
        const remaining = streamTextBufferRef.current
        if (!remaining) return
        streamTextBufferRef.current = ''
        updateMessageInSession(messageId, (message) => ({
            ...message,
            content: `${normalizeChatContent(message.content)}${remaining}`,
        }))
    }

    const getNextTypingSliceLength = () => {
        const backlog = streamTextBufferRef.current.length
        if (backlog > TYPING_FAST_BACKLOG) return TYPING_MAX_CHARS
        if (backlog > 320) return 5
        if (backlog > 140) return 4
        return TYPING_BASE_CHARS
    }

    const waitForStreamTypingDrain = (timeoutMs = 30000) => new Promise<void>((resolve) => {
        const startedAt = Date.now()
        const checker = window.setInterval(() => {
            const drained = streamTextBufferRef.current.length === 0 && !streamTypingTimerRef.current
            const timedOut = Date.now() - startedAt > timeoutMs
            if (drained || timedOut) {
                window.clearInterval(checker)
                if (timedOut) {
                    const targetId = streamTargetMessageIdRef.current
                    if (targetId) flushStreamTextBuffer(targetId)
                    stopStreamTyping()
                }
                resolve()
            }
        }, 40)
    })

    const enqueueStreamText = (messageId: string, text: string) => {
        if (!text) return
        streamTargetMessageIdRef.current = messageId
        streamTextBufferRef.current += text
        if (streamTypingTimerRef.current) return

        streamTypingTimerRef.current = window.setInterval(() => {
            const targetId = streamTargetMessageIdRef.current
            if (!targetId || streamTextBufferRef.current.length === 0) {
                stopStreamTyping()
                return
            }

            const sliceLength = getNextTypingSliceLength()
            const nextText = streamTextBufferRef.current.slice(0, sliceLength)
            streamTextBufferRef.current = streamTextBufferRef.current.slice(nextText.length)
            updateMessageInSession(targetId, (message) => ({
                ...message,
                content: `${normalizeChatContent(message.content)}${nextText}`,
            }))
        }, TYPING_INTERVAL_MS)
    }

    const renameSession = (sessionId: string, newTitle: string) => {
        setSessions((current) =>
            current.map((session) =>
                session.sessionId === sessionId
                    ? { ...session, title: newTitle.trim() || 'New Chat' }
                    : session
            )
        )
    }

    const startEditingSession = (sessionId: string, title: string) => {
        setEditingSessionId(sessionId)
        setEditingTitle(title)
    }

    const commitEditingSession = () => {
        if (!editingSessionId) return
        const title = editingTitle.trim() || 'New Chat'
        renameSession(editingSessionId, title)
        renameAiChatSession(editingSessionId, title).catch(() => {
            saveAiChatHistory({
                sessions: sessions.map((session) =>
                    session.sessionId === editingSessionId ? { ...session, title } : session
                ),
                activeSessionId,
            }).catch(() => { })
        })
        setEditingSessionId(null)
        setEditingTitle('')
    }

    const cancelEditingSession = () => {
        setEditingSessionId(null)
        setEditingTitle('')
    }

    const createNewChat = () => {
        const newSession = createSession()
        setSessions((current) => [newSession, ...current].slice(0, 20))
        setActiveSessionId(newSession.sessionId)
        setQuery('')
        setErrorInfo(null)
        setExpanded(true)
        setSessionDrawerOpen(false)
        cancelEditingSession()
    }

    const selectSession = (sessionId: string) => {
        setActiveSessionId(sessionId)
        setErrorInfo(null)
        setQuery('')
        setSessionDrawerOpen(false)
        cancelEditingSession()
    }

    const deleteSession = (sessionId: string) => {
        const previousSessions = sessions
        const previousActiveSessionId = activeSessionId
        const remainingSessions = sessions.filter((session) => session.sessionId !== sessionId)
        const nextSessions = remainingSessions.length > 0 ? remainingSessions : [createSession()]
        const nextActiveSessionId = activeSessionId === sessionId
            ? nextSessions[0]?.sessionId || ''
            : activeSessionId
        setSessions(nextSessions)
        setActiveSessionId(nextActiveSessionId)
        setSessionDrawerOpen(false)
        cancelEditingSession()
        deleteAiChatSession(sessionId).catch(() => {
            setSessions(previousSessions)
            setActiveSessionId(previousActiveSessionId)
        })
    }

    const confirmDeleteSession = (sessionId: string) => {
        Modal.confirm({
            title: t('ai.deleteModalTitle'),
            content: t('ai.deleteModalContent'),
            okText: t('ai.delete'),
            cancelText: t('ai.cancel'),
            okButtonProps: { danger: true },
            zIndex: 12000,
            onOk: () => deleteSession(sessionId),
        })
    }

    const toggleWidget = () => {
        playDoraemonClickSound()
        if (!visible) { setVisible(true); setExpanded(true); return }
        if (!expanded) { setExpanded(true); return }
        setVisible(false); setExpanded(false)
    }

    const handleFloatingWidgetClick = (event: ReactMouseEvent<HTMLDivElement>) => {
        event.stopPropagation()
    }

    const closeWidget = () => {
        setVisible(false)
        setExpanded(false)
        setErrorInfo(null)
    }

    const executeAiAction = (actionPayload: ReturnType<typeof parseAiActionPayload>) => {
        if (!actionPayload) return
        if (actionPayload.action === 'change_theme') {
            const color = typeof actionPayload.color === 'string' ? normalizeHexColor(actionPayload.color) : ''
            if (color) applyTheme(color)
            return
        }
        if (actionPayload.action === 'navigate' && actionPayload.path) {
            navigate(actionPayload.path)
        }
    }

    const handleRetry = async () => {
        if (!lastQuery) return
        setQuery(lastQuery)
        await handleSend(lastQuery)
    }

    const handleSend = async (messageText?: string, options: { source?: 'suggested_prompt'; modeOverride?: AiMode } = {}) => {
        const trimmed = (messageText ?? query).trim()
        if (!trimmed) return
        const effectiveMode = options.modeOverride || mode
        if (options.source === 'suggested_prompt' && mode !== 'gym') setMode('gym')
        const fromSuggestion = options.source === 'suggested_prompt'
        const userMessage: ChatMessage = {
            id: `${Date.now()}-user`,
            userId: user?._id ?? 'guest',
            role: 'user',
            content: trimmed,
            createdAt: new Date().toISOString(),
        }
        addMessageToSession(userMessage)
        setLastQuery(trimmed)
        if (!fromSuggestion) setQuery('')
        const conversationContext = buildConversationContext([...activeMessages, userMessage], effectiveMode, activeSession?.sessionId)
        const assistantType = 'member'
        const domain = 'gym'
        const chatMode = 'chat'
        const currentLanguage = i18n.language?.startsWith('en') ? 'en' : 'vi'
        const tab = effectiveMode === 'gym' ? t('ai.gymTab') : t('ai.otherTab')
        const intent = 'member_question'
        console.log('Prompt:', trimmed)
        console.log('DETECTED INTENT:', intent)
        console.log('Detected Intent:', intent)
        console.log('Assistant:', assistantType)
        console.log('Domain:', domain)
        console.log('CHAT REQUEST:', {
            message: trimmed,
            assistantType,
            domain,
            language: currentLanguage,
            mode: chatMode,
            tab,
            intent,
        })
        setLoading(true)
        setAiActionLoading(effectiveMode === 'gym')
        setActiveAiTool('')
        setErrorInfo(null)
        const assistantMessageId = `${Date.now()}-assistant`
        const assistantMessage: ChatMessage = {
            id: assistantMessageId,
            userId: user?._id ?? 'guest',
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
        }
        stopStreamTyping()
        streamTextBufferRef.current = ''
        streamTargetMessageIdRef.current = assistantMessageId
        addMessageToSession(assistantMessage)
        try {
            let usedFallback = false
            let suppressActionStream: boolean | null = null
            let suppressedActionText = ''
            const response = await requestAiAssistantStream(trimmed, effectiveMode, {
                conversationContext,
                requestContext: {
                    assistantType,
                    domain,
                    language: currentLanguage,
                    mode: chatMode,
                    source: options.source || 'user_message',
                    ...(fromSuggestion ? { suggestedFollowUp: trimmed } : {}),
                    intent,
                },
                onMeta: (data) => {
                    if (data?.aiAction || data?.toolCalling) {
                        setAiActionLoading(data.status !== 'tool_complete')
                        setActiveAiTool(data.tool || '')
                    }
                },
                onFirstChunk: () => setLoading(false),
                onChunk: (chunk) => {
                    const actionCandidate = `${suppressedActionText}${chunk}`.trimStart()
                    if (suppressActionStream === null) {
                        if (!actionCandidate) {
                            suppressedActionText += chunk
                            return
                        }
                        suppressActionStream = isPotentialJsonObjectResponse(actionCandidate)
                    }
                    if (suppressActionStream) {
                        suppressedActionText += chunk
                        return
                    }
                    enqueueStreamText(assistantMessageId, chunk)
                },
                onFallback: () => {
                    usedFallback = true
                },
            })

            if (usedFallback) {
                flushStreamTextBuffer(assistantMessageId)
                stopStreamTyping()
                updateMessageInSession(assistantMessageId, (message) => ({
                    ...message,
                    content: '',
                    answer: undefined,
                    suggestions: undefined,
                    cards: undefined,
                    planPayload: undefined,
                    recommendedPlan: undefined,
                    plans: undefined,
                }))
                const fallbackResponse = await requestAiAssistant(trimmed, effectiveMode, conversationContext, {
                    assistantType,
                    domain,
                    language: currentLanguage,
                    mode: chatMode,
                    source: options.source || 'user_message',
                    ...(fromSuggestion ? { suggestedFollowUp: trimmed } : {}),
                    intent,
                })
                const fallbackContent = extractAiResponseContent(fallbackResponse)
                const fallbackSplit = splitAiAssistantResponse(fallbackContent, '', t)
                const fallbackAction = fallbackSplit.actionPayload || getAiResponseActionPayload(fallbackResponse)
                if (fallbackAction) executeAiAction(fallbackAction)
                console.log('Response:', fallbackResponse)
                setAiActionLoading(false)
                updateMessageInSession(assistantMessageId, (message) => ({
                    ...message,
                    content: fallbackContent ? fallbackSplit.chatContent : t('ai.fallbackResponse'),
                    suggestions: normalizeSuggestions(fallbackResponse.suggestions)
                        .filter((suggestion) => normalizeCommandText(suggestion) !== normalizeCommandText(trimmed)),
                    intent: typeof fallbackResponse.metadata?.intent === 'string' ? fallbackResponse.metadata.intent : fallbackAction?.action,
                    subject: getAiResponseSubject(fallbackResponse),
                    action: fallbackAction?.action,
                    metadata: isRecord(fallbackResponse.metadata) ? fallbackResponse.metadata : undefined,
                    webSearch: fallbackResponse.webSearch,
                    data: isRecord(fallbackResponse.data) ? fallbackResponse.data : undefined,
                    cards: Array.isArray(fallbackResponse.cards) ? fallbackResponse.cards : undefined,
                    aiAction: fallbackAction || undefined,
                    ...getAiResponsePlanFields(fallbackResponse),
                }))
                return
            }

            const responseContent = extractAiResponseContent(response, suppressedActionText)
            const splitResponse = splitAiAssistantResponse(responseContent, suppressedActionText, t)
            const actionPayload = splitResponse.actionPayload || getAiResponseActionPayload(response)
            if (actionPayload) executeAiAction(actionPayload)
            console.log('Response:', response)

            if (responseContent) {
                await waitForStreamTypingDrain()
                setAiActionLoading(false)
                updateMessageInSession(assistantMessageId, (message) => ({
                    ...message,
                    content: message.content ? message.content : splitResponse.chatContent || t('ai.fallbackResponse'),
                    suggestions: normalizeSuggestions(response.suggestions)
                        .filter((suggestion) => normalizeCommandText(suggestion) !== normalizeCommandText(trimmed)),
                    intent: typeof response.metadata?.intent === 'string' ? response.metadata.intent : actionPayload?.action,
                    subject: getAiResponseSubject(response),
                    action: actionPayload?.action,
                    metadata: isRecord(response.metadata) ? response.metadata : undefined,
                    webSearch: response.webSearch,
                    data: isRecord(response.data) ? response.data : undefined,
                    cards: Array.isArray(response.cards) ? response.cards : undefined,
                    aiAction: actionPayload || undefined,
                    ...getAiResponsePlanFields(response),
                }))
            } else {
                await waitForStreamTypingDrain()
                setAiActionLoading(false)
                updateMessageInSession(assistantMessageId, (message) => ({
                    ...message,
                    content: message.content ? message.content : splitResponse.chatContent || t('ai.fallbackResponse'),
                    suggestions: normalizeSuggestions(response.suggestions)
                        .filter((suggestion) => normalizeCommandText(suggestion) !== normalizeCommandText(trimmed)),
                    intent: typeof response.metadata?.intent === 'string' ? response.metadata.intent : actionPayload?.action,
                    subject: getAiResponseSubject(response),
                    action: actionPayload?.action,
                    metadata: isRecord(response.metadata) ? response.metadata : undefined,
                    webSearch: response.webSearch,
                    data: isRecord(response.data) ? response.data : undefined,
                    cards: Array.isArray(response.cards) ? response.cards : undefined,
                    aiAction: actionPayload || undefined,
                    ...getAiResponsePlanFields(response),
                }))
            }
        } catch (error: any) {
            setAiActionLoading(false)
            const errMsg = error?.userMessage || t('ai.error')
            if (error?.code === 429) setRetryCountdown(4)
            setErrorInfo({ code: error?.code || 500, message: errMsg })
            flushStreamTextBuffer(assistantMessageId)
            stopStreamTyping()
            updateMessageInSession(assistantMessageId, (message) => ({
                ...message,
                role: 'system',
                content: errMsg,
            }))
        } finally {
            setLoading(false)
            setAiActionLoading(false)
        }
    }

    // ─── Layout calculations ───────────────────────────────────────────────────
    const compactChat = viewport.width <= 720
    const mobileChat = viewport.width <= 560
    const showSessionSidebar = expanded && !compactChat
    const sidebarWidth = sidebarCollapsed ? 64 : 240
    const mascotButtonWidth = viewport.width >= 1024 ? 100 : viewport.width >= 768 ? 64 : 56
    const mascotButtonHeight = mascotButtonWidth
    const defaultChatPosition = {
        x: Math.max(0, viewport.width - mascotButtonWidth - 24),
        y: Math.max(0, viewport.height - mascotButtonHeight - 24),
    }
    const {
        pos: draggableChatPosition,
        onStart: startDraggingChat,
        hasMoved: hasDraggedChat,
    } = useDraggable(defaultChatPosition, mascotButtonWidth)
    const panelWidth = mobileChat
        ? '100vw'
        : viewport.width < 1024
            ? 'calc(100vw - 32px)'
            : viewport.width >= 1280
                ? 'min(1080px, 78vw)'
                : 860
    const panelHeight = mobileChat
        ? '100dvh'
        : viewport.width < 1024
            ? 'calc(100dvh - 80px)'
            : 'min(760px, calc(100dvh - 80px))'
    const panelBackground = 'color-mix(in srgb, var(--theme-card) 75%, transparent)'
    const panelBandBackground = 'color-mix(in srgb, var(--theme-bg) 60%, transparent)'
    const panelTint = dark
        ? 'linear-gradient(135deg, rgba(10,10,15,0.82), rgba(20,22,30,0.64))'
        : 'linear-gradient(135deg, rgba(46,46,46,0.58), rgba(72,72,72,0.46))'
    const panelImageFilter = dark
        ? 'blur(12px) brightness(0.82) saturate(1.2) contrast(1.45)'
        : 'blur(12px) brightness(0.78) saturate(1.08) contrast(1.24)'
    const panelText = tokens.text
    const panelMutedText = tokens.muted
    const panelBorder = '1px solid var(--theme-accent-border)'
    const assistantBubbleBackground = '#20232c'
    const inputBackground = 'color-mix(in srgb, var(--theme-elevated) 80%, transparent)'
    const inputBorder = 'var(--theme-accent-border)'
    const mascotCursor = 'pointer'
    const panelAlignRight = draggableChatPosition.x > viewport.width / 2
    const newChatActionBackground = dark ? '#FFFFFF' : '#000000'
    const newChatActionColor = dark ? '#000000' : '#FFFFFF'
    const newChatActionBorder = dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'
    const newChatActionHoverBackground = dark ? '#F3F4F6' : '#111827'
    const newChatActionFocusRing = dark
        ? '0 0 0 2px rgba(0,0,0,0.55), 0 0 0 4px #FFFFFF'
        : '0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px #000000'
    const newChatActionButtonStyle = {
        width: 36,
        height: 36,
        minWidth: 36,
        color: newChatActionColor,
        background: newChatActionBackground,
        border: `1px solid ${newChatActionBorder}`,
        borderRadius: 9,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'none',
        transition: 'background 160ms ease, transform 160ms ease, box-shadow 160ms ease',
    }

    const applyNewChatActionHover = (target: HTMLElement, hovering: boolean) => {
        target.style.background = hovering ? newChatActionHoverBackground : newChatActionBackground
        target.style.color = newChatActionColor
        target.style.borderColor = newChatActionBorder
        target.style.transform = hovering ? 'translateY(-1px)' : 'translateY(0)'
    }

    const applyNewChatActionFocus = (target: HTMLElement, focused: boolean) => {
        target.style.boxShadow = focused ? newChatActionFocusRing : 'none'
    }

    const lastAssistantMessageIndex = activeMessages.reduce(
        (latestIndex, message, index) => message.role === 'assistant' ? index : latestIndex,
        -1,
    )
    const latestUserPrompt = [...activeMessages].reverse().find((message) => message.role === 'user')?.content || ''
    const latestUserPromptNormalized = normalizeCommandText(latestUserPrompt)

    const copyMessage = async (messageId: string, content: string) => {
        try {
            await navigator.clipboard.writeText(content)
        } catch {
            const textarea = document.createElement('textarea')
            textarea.value = content
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand('copy')
            document.body.removeChild(textarea)
        }
        setCopiedMessageIds((prev) => {
            const next = new Set(prev)
            next.add(messageId)
            return next
        })
        setTimeout(() => {
            setCopiedMessageIds((prev) => {
                const next = new Set(prev)
                next.delete(messageId)
                return next
            })
        }, 2000)
    }

    const startDraggingFromHeader = (event: ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement
        if (target.closest('button, input, textarea, select, a, [role="button"], .ant-select, .ant-dropdown-trigger, .ant-segmented, .ant-drawer, .ant-modal')) {
            return
        }
        startDraggingChat(event)
    }

    // ─── Session list renderer (shared between sidebar & drawer) ──────────────
    const renderSessionList = () => (
        <>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {sessions.map((session) => {
                    const isActive = session.sessionId === activeSession?.sessionId
                    return (
                        <div
                            key={session.sessionId}
                            className="ai-chat-session-item"
                            onClick={() => selectSession(session.sessionId)}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--theme-accent-muted)'
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) e.currentTarget.style.background = 'transparent'
                            }}
                            style={{
                                padding: '12px 14px',
                                cursor: 'pointer',
                                background: isActive ? 'var(--theme-accent-muted)' : 'transparent',
                                borderLeft: isActive ? '3px solid var(--theme-accent)' : '3px solid transparent',
                                borderRadius: 8,
                                transition: 'background 0.15s',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                {editingSessionId === session.sessionId ? (
                                    <Input
                                        size="small"
                                        value={editingTitle}
                                        onChange={(e) => setEditingTitle(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        onBlur={commitEditingSession}
                                        onPressEnter={(e) => { e.preventDefault(); commitEditingSession() }}
                                        onKeyDown={(e) => { if (e.key === 'Escape') cancelEditingSession() }}
                                        autoFocus
                                        style={{ width: '100%' }}
                                    />
                                ) : (
                                    <>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <Typography.Text strong style={{ color: isActive ? 'var(--theme-accent)' : 'var(--theme-text)', display: 'block' }}>
                                                {session.title}
                                            </Typography.Text>
                                            <Typography.Text style={{ fontSize: 12, color: 'var(--theme-muted)' }}>
                                                            {new Date(session.createdAt).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}
                                            </Typography.Text>
                                        </div>
                                        <Dropdown
                                            trigger={['click']}
                                            menu={{
                                                items: [
                                                    { key: 'rename', icon: <EditOutlined />, label: t('ai.rename') },
                                                    { key: 'delete', icon: <DeleteOutlined />, label: t('ai.delete'), danger: true },
                                                ],
                                                onClick: ({ key, domEvent }) => {
                                                    domEvent.stopPropagation()
                                                    if (key === 'rename') startEditingSession(session.sessionId, session.title)
                                                    if (key === 'delete') confirmDeleteSession(session.sessionId)
                                                },
                                            }}
                                        >
                                            <Button
                                                type="text"
                                                size="small"
                                                className="ai-chat-session-actions"
                                                icon={<MoreOutlined />}
                                                onClick={(e) => e.stopPropagation()}
                                                style={{ color: panelMutedText }}
                                            />
                                        </Dropdown>
                                    </>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </>
    )

    if (typeof document === 'undefined') return null

    return createPortal(
        <>
            <style>{`
                .doraemon-chat-trigger {
                    position: relative;
                    z-index: 2;
                    width: ${MASCOT_WIDTH}px;
                    height: ${MASCOT_HEIGHT}px;
                    border: 0;
                    padding: 0;
                    background: transparent;
                    box-shadow: none;
                    cursor: grab;
                    transform: translateZ(0);
                    transition: transform 180ms ease, filter 180ms ease;
                    touch-action: manipulation;
                    user-select: none;
                    -webkit-user-select: none;
                }
                .ai-chat-overlay {
                    position: fixed;
                    inset: 0;
                    background: transparent;
                    z-index: 10990;
                }
                .ai-chat-anchor {
                    position: fixed;
                    z-index: 11000;
                }
                .ai-chat-wrapper {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    overflow: visible;
                }
                .chat-sidebar {
                    width: var(--sidebar-width);
                    transition: width 0.2s ease;
                }
                .chat-sidebar.collapsed {
                    width: 64px;
                }
                .ai-chat-content {
                    display: flex;
                }
                .chat-main,
                .ai-chat-main {
                    flex: 1;
                    min-width: 0;
                }
                .ai-chat-popup {
                    position: absolute;
                    bottom: 100%;
                    margin-bottom: 10px;
                    z-index: 11010;
                }
                .doraemon-chat-trigger:hover,
                .doraemon-chat-trigger.is-dragging,
                .doraemon-chat-trigger:not(.is-active):hover {
                    transform: translateY(-4px) scale(1.08);
                }
                .doraemon-chat-trigger.is-active {
                    transform: translateZ(0);
                }
                .doraemon-chat-mascot,
                .doraemon-chat-mascot svg {
                    width: ${MASCOT_WIDTH}px;
                    height: ${MASCOT_HEIGHT}px;
                    display: block;
                }
                .doraemon-chat-mascot svg { overflow: visible; }
                .mascot-body {
                    transform-origin: 70px 105px;
                    animation: doraemonIdle 3.2s ease-in-out infinite;
                }
                .mascot-right-arm {
                    transform-origin: 96px 100px;
                    transition: transform 180ms ease;
                }
                .mascot-mouth-happy { opacity: 0; transition: opacity 160ms ease; }
                .doraemon-chat-trigger:hover .mascot-right-arm,
                .doraemon-chat-trigger.is-active .mascot-right-arm,
                .doraemon-chat-mascot.is-active .mascot-right-arm {
                    animation: doraemonWave 850ms ease-in-out infinite;
                }
                .doraemon-chat-trigger:hover .mascot-mouth-idle,
                .doraemon-chat-trigger.is-active .mascot-mouth-idle,
                .doraemon-chat-mascot.is-active .mascot-mouth-idle { opacity: 0; }
                .doraemon-chat-trigger:hover .mascot-mouth-happy,
                .doraemon-chat-trigger.is-active .mascot-mouth-happy,
                .doraemon-chat-mascot.is-active .mascot-mouth-happy { opacity: 1; }
                .doraemon-chat-trigger:hover .mascot-eye,
                .doraemon-chat-trigger.is-active .mascot-eye {
                    animation: doraemonEyeJoy 850ms ease-in-out infinite;
                }
                @keyframes doraemonIdle {
                    0%, 100% { transform: rotate(-2deg) translateY(0); }
                    50% { transform: rotate(1.5deg) translateY(-2px); }
                }
                @keyframes doraemonWave {
                    0%, 100% { transform: rotate(0deg) translate(0, 0); }
                    35% { transform: rotate(-18deg) translate(-1px, -3px); }
                    70% { transform: rotate(10deg) translate(1px, 1px); }
                }
                @keyframes doraemonEyeJoy {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-1px); }
                }

                /* Drawer phien chat nam tren khung chat (11010) va duoi modal xoa (12000). */
                .ai-session-drawer .ant-drawer-content-wrapper {
                    z-index: 11500 !important;
                }
                .ai-session-drawer .ant-drawer-mask {
                    z-index: 11499 !important;
                }
                /* Ant Design drawer z-index override */
                .ant-drawer.ai-session-drawer {
                    z-index: 11500 !important;
                }


                .ai-chat-session-actions {
                    opacity: 0;
                    transition: opacity 160ms ease;
                }
                .ai-chat-session-item:hover .ai-chat-session-actions,
                .ai-chat-session-actions.is-open { opacity: 1; }

                @media (hover: none), (pointer: coarse) {
                    .ai-chat-session-actions { opacity: 1 !important; }
                }

                .ai-chat-panel textarea::placeholder {
                    color: ${dark ? 'rgba(255,255,255,0.48)' : 'rgba(237,235,230,0.35)'};
                }

                .ai-chat-panel .ant-segmented {
                    background: var(--theme-elevated) !important;
                    border: 1px solid var(--theme-border) !important;
                }
                .ai-chat-panel .ant-segmented-item {
                    color: var(--theme-muted) !important;
                }
                .ai-chat-panel .ant-segmented-item-selected {
                    background: var(--theme-active-bg) !important;
                    color: var(--theme-active-text) !important;
                    border: none !important;
                }
                .ai-chat-panel .ant-segmented-thumb {
                    background: var(--theme-active-bg) !important;
                }

                .ai-chat-panel,
                .ai-chat-panel * {
                    user-select: text !important;
                    -webkit-user-select: text !important;
                }

                .ai-chat-message-content,
                .ai-chat-message-content * {
                    user-select: text !important;
                    -webkit-user-select: text !important;
                }

                .ai-assistant-bubble {
                    background: color-mix(in srgb, var(--theme-card) 88%, transparent);
                    border: 1px solid var(--theme-border);
                    box-shadow: 0 14px 36px rgba(0,0,0,0.42);
                    border-radius: 16px;
                    padding: 18px 20px;
                    max-width: 76%;
                    color: var(--theme-text);
                }

                .ai-assistant-content,
                .ai-assistant-content * {
                    font-weight: 600;
                    line-height: 1.8;
                    font-size: 15.5px;
                }

                .ai-text-content {
                    white-space: pre-line;
                    line-height: 1.75;
                    max-width: 100%;
                }

                .ai-text-content p {
                    margin: 0 0 10px;
                }

                .ai-text-content ul {
                    margin: 8px 0 10px;
                    padding-left: 18px;
                }

                .ai-reason-box {
                    margin-top: 10px;
                    padding: 12px 14px;
                    border-radius: 12px;
                    background: rgba(255,255,255,0.06);
                    max-width: 100%;
                    overflow-wrap: anywhere;
                }

                .ai-reason-box li {
                    margin: 6px 0;
                    line-height: 1.6;
                }

                @media (max-width: 1024px) {
                    .ai-assistant-bubble {
                        max-width: 90%;
                    }
                }

                @media (max-width: 768px) {
                    .ai-assistant-bubble {
                        max-width: 100%;
                        padding: 14px;
                    }

                    .ai-plan-row,
                    .mpc-head {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .ai-compare-grid,
                    .ai-compare-two-cols {
                        grid-template-columns: 1fr;
                    }
                }

                .ai-plan-list {
                    margin-top: 12px;
                    display: grid;
                    gap: 8px;
                }

                .ai-plan-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                    padding: 11px 13px;
                    border-radius: 12px;
                    background: rgba(255,255,255,0.09);
                    border: 1px solid rgba(255,255,255,0.13);
                }

                .ai-chat-copy-btn {
                    opacity: 0;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    margin-top: 4px;
                    padding: 3px 8px;
                    border: none;
                    border-radius: 6px;
                    background: transparent;
                    color: var(--theme-muted-text, #999);
                    cursor: pointer;
                    font-size: 12px;
                    line-height: 1;
                    transition: opacity 0.15s, background 0.15s;
                }
                .ai-chat-copy-btn:hover {
                    background: rgba(128,128,128,0.12);
                    color: var(--theme-text, inherit);
                }
                .ai-chat-message-wrapper:hover .ai-chat-copy-btn {
                    opacity: 1 !important;
                }
                @media (hover: none), (pointer: coarse) {
                    .ai-chat-copy-btn {
                        opacity: 1 !important;
                        min-width: 32px;
                        min-height: 32px;
                        margin-top: 6px;
                    }
                    .ai-chat-copy-btn span {
                        display: none;
                    }
                }

            `}</style>

            {visible && <div className="ai-chat-overlay" onClick={closeWidget} />}

            <div
                className="ai-chat-anchor"
                style={{
                    position: 'fixed',
                    left: draggableChatPosition.x,
                    top: draggableChatPosition.y,
                    zIndex: 11000,
                    width: mascotButtonWidth,
                    height: mascotButtonHeight,
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    margin: 0,
                }}
            >
                <div className="ai-chat-wrapper">
                    {/* MASCOT BUTTON */}
                    <Tooltip placement="left">
                        <button
                            type="button"
                            className={`doraemon-chat-trigger ${visible ? 'is-active' : ''}`}
                            aria-label={t('ai.ariaLabel')}
                            style={{
                                width: mascotButtonWidth,
                                height: mascotButtonHeight,
                                cursor: mascotCursor,
                                touchAction: 'none',
                            }}
                            onMouseDown={startDraggingChat}
                            onTouchStart={startDraggingChat}
                            onClick={(event) => {
                                event.stopPropagation()
                                if (!hasDraggedChat.current) toggleWidget()
                            }}
                        >
                            <DoraemonChatMascot width={mascotButtonWidth} height={mascotButtonHeight} />
                        </button>
                    </Tooltip>

                    {/* CHAT PANELl */}
                    <div
                        className="ai-chat-panel ai-chat-modal ai-chat-popup"
                        onClick={handleFloatingWidgetClick}
                        style={{
                            position: mobileChat ? 'fixed' : undefined,
                            left: mobileChat ? 0 : panelAlignRight ? 'auto' : 0,
                            right: mobileChat ? 'auto' : panelAlignRight ? 0 : 'auto',
                            top: mobileChat ? 0 : undefined,
                            bottom: mobileChat ? 'auto' : undefined,
                            width: panelWidth,
                            maxWidth: mobileChat ? '100vw' : viewport.width < 1024 ? 'calc(100vw - 32px)' : 'calc(100vw - 48px)',
                            height: panelHeight,
                            maxHeight: mobileChat ? '100dvh' : viewport.width < 1024 ? 'calc(100dvh - 80px)' : 'calc(100dvh - 48px)',
                            zIndex: 11010,
                            // Chat panel must float above the member header/menu.
                            borderRadius: mobileChat ? 0 : 16,
                            background: panelBackground,
                            color: 'var(--theme-text)',
                            border: panelBorder,
                            boxShadow: visible
                                ? '0 28px 100px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.08)'
                                : '0 24px 80px rgba(0,0,0,0.18)',
                            transform: visible ? 'scale(1)' : 'scale(0.75)',
                            opacity: visible ? 1 : 0,
                            visibility: visible ? 'visible' : 'hidden',
                            transition: 'all 220ms ease',
                            overflow: 'hidden',
                            isolation: 'isolate',
                            display: 'flex',
                            flexDirection: 'column',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            cursor: 'default',
                            userSelect: 'text',
                            WebkitUserSelect: 'text',
                        }}
                    >
                        {CHAT_PANEL_BACKGROUND_IMAGE && (
                            <img
                                className="ai-chat-panel-bg-image"
                                src={CHAT_PANEL_BACKGROUND_IMAGE}
                                alt=""
                                aria-hidden="true"
                                style={{
                                    position: 'absolute',
                                    inset: -18,
                                    width: 'calc(100% + 36px)',
                                    height: 'calc(100% + 36px)',
                                    objectFit: 'cover',
                                    transform: 'scale(1.03)',
                                    zIndex: 0,
                                    pointerEvents: 'none',
                                    filter: panelImageFilter,
                                    opacity: dark ? 0.72 : 0.76,
                                }}
                            />
                        )}
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 0,
                            pointerEvents: 'none',
                            background: panelTint,
                        }} />

                        {/* Panel content */}
                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

                            {/* HEADER */}
                            <div
                                onMouseDown={startDraggingFromHeader}
                                onTouchStart={startDraggingFromHeader}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    padding: mobileChat ? '12px 14px' : '16px 18px',
                                    background: 'var(--theme-button-bg)',
                                    backdropFilter: 'blur(10px)',
                                    WebkitBackdropFilter: 'blur(10px)',
                                    color: 'var(--theme-button-text)',
                                    flexShrink: 0,
                                    cursor: 'grab',
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                    touchAction: 'none',
                                }}>
                                <div style={{ minWidth: 0 }}>
                                    <Typography.Title level={5} style={{ margin: 0, color: 'var(--theme-button-text)', fontSize: mobileChat ? 14 : 16 }}>
                                        {t('ai.chatTitle')}
                                    </Typography.Title>

                                </div>
                                <Space
                                    size={mobileChat ? 2 : 8}
                                    style={{ flexShrink: 0 }}
                                >
                                    {/* FIX: Nút "Phiên" chỉ hiện trên mobile/tablet, mở drawer với z-index cao */}
                                    {compactChat && (
                                        <Button
                                            size="small"
                                            type="text"
                                            style={{ color: 'var(--theme-button-text)', fontWeight: 600 }}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setSessionDrawerOpen(true)
                                            }}
                                        >
                                            {t('ai.sessions', { count: sessions.length })}
                                        </Button>
                                    )}
                                    {!compactChat && (
                                        <Button
                                            size="small"
                                            type="text"
                                            icon={<ExpandAltOutlined />}
                                            style={{ color: 'var(--theme-button-text)' }}
                                            onClick={() => setExpanded(!expanded)}
                                        />
                                    )}
                                    <Button size="small" type="text" icon={<CloseOutlined />} style={{ color: 'var(--theme-button-text)' }} onClick={closeWidget} />
                                </Space>
                            </div>

                            <div className="ai-chat-content" style={{ display: 'flex', flex: 1, minHeight: 0 }}>

                                {/* SIDEBAR (desktop only) */}
                                {showSessionSidebar && (
                                    <div className={`chat-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`} style={{
                                        '--sidebar-width': `${sidebarWidth}px`,
                                        width: sidebarWidth,
                                        minWidth: sidebarWidth,
                                        borderRight: panelBorder,
                                        background: panelBandBackground,
                                        backdropFilter: 'blur(12px)',
                                        WebkitBackdropFilter: 'blur(12px)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        overflow: 'hidden',
                                        transition: 'width 0.2s ease, min-width 0.2s ease',
                                    } as CSSProperties}>
                                        <div
                                            style={{
                                                padding: sidebarCollapsed ? '10px 8px' : '12px 14px',
                                                borderBottom: panelBorder,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: sidebarCollapsed ? 'center' : 'space-between',
                                                gap: 8,
                                            }}
                                        >
                                            {!sidebarCollapsed && <Typography.Text strong style={{ color: panelText }}>{t('ai.sessionSidebarTitle')}</Typography.Text>}
                                            <Space size={4}>
                                                <Button
                                                    size="small"
                                                    type="text"
                                                    icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                                                    onClick={() => setSidebarCollapsed((value) => !value)}
                                                    style={{ color: panelText }}
                                                />
                                                {!sidebarCollapsed && (
                                                    <Button
                                                        size="small"
                                                        type="text"
                                                        className="ai-new-chat-action-button focus:ring-2 focus:ring-offset-2"
                                                        icon={<PlusOutlined />}
                                                        style={newChatActionButtonStyle}
                                                        onMouseEnter={(event) => applyNewChatActionHover(event.currentTarget, true)}
                                                        onMouseLeave={(event) => applyNewChatActionHover(event.currentTarget, false)}
                                                        onFocus={(event) => applyNewChatActionFocus(event.currentTarget, true)}
                                                        onBlur={(event) => applyNewChatActionFocus(event.currentTarget, false)}
                                                        onClick={createNewChat}
                                                    />
                                                )}
                                            </Space>
                                        </div>
                                        {sidebarCollapsed && (
                                            <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0', borderBottom: panelBorder }}>
                                                <Button
                                                    size="small"
                                                    type="text"
                                                    className="ai-new-chat-action-button focus:ring-2 focus:ring-offset-2"
                                                    icon={<PlusOutlined />}
                                                    style={newChatActionButtonStyle}
                                                    onMouseEnter={(event) => applyNewChatActionHover(event.currentTarget, true)}
                                                    onMouseLeave={(event) => applyNewChatActionHover(event.currentTarget, false)}
                                                    onFocus={(event) => applyNewChatActionFocus(event.currentTarget, true)}
                                                    onBlur={(event) => applyNewChatActionFocus(event.currentTarget, false)}
                                                    onClick={createNewChat}
                                                />
                                            </div>
                                        )}
                                        <div style={{ flex: 1, overflowY: 'auto' }}>
                                            {sessions.map((session) => {
                                                const isActive = session.sessionId === activeSession?.sessionId
                                                const sessionInitial = session.title?.trim()?.slice(0, 1)?.toUpperCase() || 'C'
                                                return (
                                                    <div
                                                        key={session.sessionId}
                                                        className="ai-chat-session-item"
                                                        onClick={() => selectSession(session.sessionId)}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'var(--theme-accent-muted)'
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (!isActive) e.currentTarget.style.background = 'transparent'
                                                        }}
                                                        style={{
                                                            padding: sidebarCollapsed ? '9px 0' : '12px 14px',
                                                            cursor: 'pointer',
                                                            background: isActive ? 'var(--theme-accent-muted)' : 'transparent',
                                                            borderLeft: isActive ? '3px solid var(--theme-accent)' : '3px solid transparent',
                                                            borderRadius: 8,
                                                            transition: 'background 0.15s',
                                                            display: sidebarCollapsed ? 'grid' : undefined,
                                                            placeItems: sidebarCollapsed ? 'center' : undefined,
                                                        }}
                                                    >
                                                        {sidebarCollapsed ? (
                                                            <Tooltip title={session.title} placement="right">
                                                                <Avatar
                                                                    size={34}
                                                                    style={{
                                                                        background: isActive ? 'var(--theme-accent)' : 'var(--theme-elevated)',
                                                                        color: isActive ? 'var(--theme-button-text)' : 'var(--theme-text)',
                                                                    }}
                                                                >
                                                                    {sessionInitial}
                                                                </Avatar>
                                                            </Tooltip>
                                                        ) : (
                                                            <>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                            {editingSessionId === session.sessionId ? (
                                                                <Input
                                                                    size="small"
                                                                    value={editingTitle}
                                                                    onChange={(e) => setEditingTitle(e.target.value)}
                                                                    onBlur={commitEditingSession}
                                                                    onPressEnter={(e) => { e.preventDefault(); commitEditingSession() }}
                                                                    onKeyDown={(e) => { if (e.key === 'Escape') cancelEditingSession() }}
                                                                    autoFocus
                                                                    style={{ width: '100%' }}
                                                                />
                                                            ) : (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                                                                    <Typography.Text strong style={{ color: isActive ? 'var(--theme-accent)' : 'var(--theme-text)', flex: 1, fontSize: 13 }}>
                                                                        {session.title}
                                                                    </Typography.Text>
                                                                    <Dropdown
                                                                        trigger={['click']}
                                                                        getPopupContainer={(trigger) => trigger.parentElement || document.body}
                                                                        menu={{
                                                                            items: [
                                                                                { key: 'rename', icon: <EditOutlined />, label: t('ai.rename') },
                                                                                { key: 'delete', icon: <DeleteOutlined />, label: t('ai.delete'), danger: true },
                                                                            ],
                                                                            onClick: ({ key, domEvent }) => {
                                                                                domEvent.stopPropagation()
                                                                                if (key === 'rename') startEditingSession(session.sessionId, session.title)
                                                                                if (key === 'delete') confirmDeleteSession(session.sessionId)
                                                                            },
                                                                        }}
                                                                    >
                                                                        <Button
                                                                            type="text"
                                                                            size="small"
                                                                            className="ai-chat-session-actions"
                                                                            icon={<MoreOutlined />}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            style={{ color: panelMutedText }}
                                                                        />
                                                                    </Dropdown>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <Typography.Text style={{ fontSize: 11, color: 'var(--theme-muted)' }}>
                                                {new Date(session.createdAt).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}
                                                        </Typography.Text>
                                                            </>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* MAIN CHAT AREA */}
                                <div className="chat-main ai-chat-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>

                                    {/* SESSION HEADER */}
                                    <div style={{
                                        padding: mobileChat ? '10px 12px' : '12px 16px',
                                        borderBottom: panelBorder,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: 8,
                                        flexShrink: 0,
                                        flexWrap: 'wrap',
                                    }}>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <Typography.Text strong style={{ color: panelText, fontSize: mobileChat ? 13 : 14, display: 'block' }}>
                                                {activeSession?.title || t('ai.defaultSessionTitle')}
                                            </Typography.Text>
                                            <Typography.Text style={{ fontSize: 11, color: panelMutedText }}>
                                                {activeSession?.messages.length
                                                    ? t('ai.sessionCount', { count: activeSession.messages.length })
                                                    : t('ai.newChatEmpty')}
                                            </Typography.Text>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                            <Segmented
                                                value={mode}
                                                onChange={(value) => setMode(value as AiMode)}
                                                options={[
                                                    { label: t('ai.gymTab'), value: 'gym' },
                                                    { label: t('ai.otherTab'), value: 'general' },
                                                ]}
                                                size="small"
                                            />
                                            {!showSessionSidebar && !compactChat && (
                                                <Select
                                                    value={activeSession?.sessionId}
                                                    onChange={selectSession}
                                                    style={{ width: 140 }}
                                                    options={sessions.map((s) => ({ label: s.title, value: s.sessionId }))}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* MESSAGES */}
                                    <div
                                        ref={scrollRef}
                                        style={{
                                            flex: 1,
                                            overflowY: 'auto',
                                            padding: mobileChat ? 10 : 16,
                                            paddingBottom: mobileChat ? 128 : 96,
                                            scrollPaddingBottom: mobileChat ? 128 : 96,
                                            background: panelBandBackground,
                                            backdropFilter: 'blur(12px)',
                                            WebkitBackdropFilter: 'blur(12px)',
                                            cursor: 'text',
                                            pointerEvents: 'auto',
                                            userSelect: 'text',
                                            WebkitUserSelect: 'text',
                                        }}
                                    >
                                        {activeMessages.length === 0 ? (
                                            <div style={{ display: 'grid', gap: 16, margin: mobileChat ? '8px 0' : '14px 0' }}>
                                                <div style={{ textAlign: 'center', display: 'grid', gap: 6 }}>
                                                    <Typography.Text strong style={{ color: panelText, fontSize: mobileChat ? 15 : 16 }}>
                                                        {t('ai.startTitle')}
                                                    </Typography.Text>
                                                    <Typography.Text style={{ color: panelMutedText, fontSize: 13 }}>
                                                        {t('ai.startDescription')}
                                                    </Typography.Text>
                                                </div>
                                                <div
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: mobileChat ? '1fr' : compactChat ? 'repeat(2, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
                                                        gap: mobileChat ? 8 : 10,
                                                    }}
                                                >
                                                    {MEMBER_SUGGESTED_PROMPT_KEYS.map((promptKey) => {
                                                        const suggestion = t(`ai.suggestions.${promptKey}`)
                                                        return (
                                                        <button
                                                            key={promptKey}
                                                            type="button"
                                                            disabled={loading}
                                                            onClick={() => handleSend(suggestion, { source: 'suggested_prompt', modeOverride: 'gym' })}
                                                            style={{
                                                                width: '100%',
                                                                minHeight: mobileChat ? 44 : 50,
                                                                padding: mobileChat ? '9px 11px' : '11px 13px',
                                                                borderRadius: 14,
                                                                border: '1px solid var(--theme-accent-border)',
                                                                background: 'color-mix(in srgb, var(--theme-card) 82%, transparent)',
                                                                color: panelText,
                                                                textAlign: 'left',
                                                                font: 'inherit',
                                                                fontSize: mobileChat ? 13 : 14,
                                                                lineHeight: 1.35,
                                                                cursor: loading ? 'not-allowed' : 'pointer',
                                                                boxShadow: '0 8px 22px rgba(0,0,0,0.08)',
                                                                opacity: loading ? 0.6 : 1,
                                                                transition: 'transform 160ms ease, border-color 160ms ease, background 160ms ease',
                                                            }}
                                                            onMouseEnter={(event) => {
                                                                if (loading) return
                                                                event.currentTarget.style.transform = 'translateY(-1px)'
                                                                event.currentTarget.style.background = 'var(--theme-accent-muted)'
                                                                event.currentTarget.style.borderColor = 'var(--theme-accent)'
                                                            }}
                                                            onMouseLeave={(event) => {
                                                                event.currentTarget.style.transform = 'translateY(0)'
                                                                event.currentTarget.style.background = 'color-mix(in srgb, var(--theme-card) 82%, transparent)'
                                                                event.currentTarget.style.borderColor = 'var(--theme-accent-border)'
                                                            }}
                                                        >
                                                            {suggestion}
                                                        </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            activeMessages.map((message, index) => {
                                                const isUser = message.role === 'user'
                                                const messageContent = normalizeChatContent(message.content)
                                                const bubbleBg = isUser ? 'var(--theme-accent)' : assistantBubbleBackground
                                                const bubbleColor = isUser
                                                    ? 'var(--theme-button-text)'
                                                    : (dark ? '#ffffff' : '#111827')
                                                const toolPayload = !isUser && message.role === 'assistant'
                                                    ? parseAiToolPayload(messageContent)
                                                    : null
                                                const actionPayload = !isUser && message.role === 'assistant'
                                                    ? parseAiActionPayload(messageContent)
                                                    : null
                                                 const webSearchResults = Array.isArray(message.webSearch?.results) ? message.webSearch.results : []
                                                 const sourceCards = !isUser
                                                     ? (webSearchResults.length > 0
                                                         ? webSearchResults
                                                         : extractSourceResultsFromText(messageContent))
                                                     : []
                                                 const safeAssistantContent = !isUser
                                                     ? getSafeAssistantDisplayContent(messageContent, actionPayload, t)
                                                     : messageContent

                                                 const visibleContent = isUser
                                                     ? messageContent
                                                     : safeAssistantContent !== messageContent
                                                        ? safeAssistantContent
                                                        : sourceCards.length > 0
                                                            ? stripWebSourceSection(messageContent)
                                                            : safeAssistantContent
                                                const messageSuggestions = !isUser && message.role === 'assistant' && index === lastAssistantMessageIndex
                                                    ? normalizeSuggestions(message.suggestions)
                                                        .filter((suggestion) => normalizeCommandText(suggestion) !== latestUserPromptNormalized)
                                                        .slice(0, 4)
                                                    : []
                                                return (
                                                    <div
                                                        key={message.id}
                                                        className="ai-chat-message-wrapper"
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: isUser ? 'flex-end' : 'flex-start',
                                                            justifyContent: isUser ? 'flex-end' : 'flex-start',
                                                            marginBottom: 10,
                                                        }}
                                                    >
                                                        <div className={isUser ? '' : 'ai-assistant-bubble'} style={{
                                                            maxWidth: isUser
                                                                ? mobileChat ? '92%' : '78%'
                                                                : undefined,
                                                            padding: isUser
                                                                ? mobileChat ? '9px 12px' : '12px 16px'
                                                                : undefined,
                                                            borderRadius: isUser ? 20 : undefined,
                                                            borderTopRightRadius: isUser ? 4 : undefined,
                                                            borderTopLeftRadius: isUser ? 20 : undefined,
                                                            background: isUser ? bubbleBg : undefined,
                                                            color: bubbleColor,
                                                            border: isUser
                                                                ? 'none'
                                                                : undefined,
                                                            backdropFilter: isUser ? undefined : 'blur(10px)',
                                                            WebkitBackdropFilter: isUser ? undefined : 'blur(10px)',
                                                            boxShadow: isUser
                                                                ? '0 4px 14px rgba(0,0,0,0.08)'
                                                                : undefined,
                                                            whiteSpace: 'pre-wrap',
                                                            lineHeight: isUser ? 1.6 : 1.75,
                                                            fontSize: isUser ? undefined : 15,
                                                            fontWeight: isUser ? undefined : 400,
                                                            wordBreak: 'break-word',
                                                            cursor: 'text',
                                                            userSelect: 'text',
                                                            WebkitUserSelect: 'text',
                                                        }}>
                                                            {message.role === 'assistant' && (
                                                                <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <Avatar size={22} style={{ backgroundColor: '#0aa7e6' }} icon={<DoraemonMiniAvatar />} />
                                                                    <Typography.Text strong style={{ color: bubbleColor }}>Doraemon</Typography.Text>
                                                                </div>
                                                            )}
                                                            <div className="ai-chat-message-content">
                                                                {renderSafeAiMessageContent(() => (
                                                                    <>
                                                                        {toolPayload?.type === 'empty' && (
                                                                            <Typography.Text style={{ color: bubbleColor }}>{String(toolPayload.message || '')}</Typography.Text>
                                                                        )}
                                                                        {toolPayload?.type === 'product_list' && (
                                                                            <div style={{ display: 'grid', gap: 10 }}>
                                                                                {toolPayload.message && (
                                                                                    <Typography.Text style={{ color: bubbleColor }}>{String(toolPayload.message)}</Typography.Text>
                                                                                )}
                                                                                {(Array.isArray(toolPayload.items) ? toolPayload.items : []).map((item, index) => {
                                                                                    const name = String(item?.name || '')
                                                                                    const link = String(item?.link || '#')
                                                                                    return (
                                                                                        <a
                                                                                            key={`${link}-${index}`}
                                                                                            href={link}
                                                                                            style={{
                                                                                                display: 'grid',
                                                                                                gridTemplateColumns: '54px minmax(0, 1fr)',
                                                                                                gap: 10,
                                                                                                alignItems: 'center',
                                                                                                padding: 10,
                                                                                                borderRadius: 14,
                                                                                                background: 'var(--theme-card)',
                                                                                                color: bubbleColor,
                                                                                                textDecoration: 'none',
                                                                                            }}
                                                                                        >
                                                                                            <img src={String(item?.image || AI_AVATAR_IMAGE)} alt={name}
                                                                                                style={{ width: 54, height: 54, borderRadius: 10, objectFit: 'cover' }} />
                                                                                            <div style={{ minWidth: 0 }}>
                                                                                                <Typography.Text strong style={{ color: bubbleColor, display: 'block' }}>
                                                                                                    {name}
                                                                                                </Typography.Text>
                                                                                                <Typography.Text style={{ color: 'var(--theme-accent)' }}>
                                                                                                    {Number(item?.price || 0).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}đ
                                                                                                </Typography.Text>
                                                                                                {item?.selectedVariant && (
                                                                                                    <Typography.Text style={{ color: bubbleColor, display: 'block', fontSize: 12 }}>
                                                                                                        {t('ai.weightLabel')}: {String(item.selectedVariant)}
                                                                                                    </Typography.Text>
                                                                                                )}
                                                                                            </div>
                                                                                        </a>
                                                                                    )
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                        {toolPayload?.type === 'category_list' && (
                                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                                                {(Array.isArray(toolPayload.items) ? toolPayload.items : []).map((item, index) => {
                                                                                    const name = String(item?.name || '')
                                                                                    const slug = String(item?.slug || name || index)
                                                                                    return (
                                                                                        <a
                                                                                            key={`${slug}-${index}`}
                                                                                            href={`/store?category=${encodeURIComponent(name)}`}
                                                                                            style={{
                                                                                                padding: '7px 10px',
                                                                                                borderRadius: 999,
                                                                                                background: 'var(--theme-elevated)',
                                                                                                color: bubbleColor,
                                                                                                textDecoration: 'none',
                                                                                                fontSize: 13,
                                                                                            }}
                                                                                        >
                                                                                            {name}
                                                                                        </a>
                                                                                    )
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                        {toolPayload?.type === 'pt_list' && (
                                                                            <div style={{ display: 'grid', gap: 10 }}>
                                                                                {(Array.isArray(toolPayload.items) ? toolPayload.items : []).map((item, index) => {
                                                                                    const name = String(item?.name || '')
                                                                                    const phone = String(item?.phone || '')
                                                                                    const email = String(item?.email || '')
                                                                                    return (
                                                                                        <div
                                                                                            key={`${email || phone || name}-${index}`}
                                                                                            style={{
                                                                                                display: 'grid',
                                                                                                gridTemplateColumns: '44px minmax(0, 1fr)',
                                                                                                gap: 10,
                                                                                                alignItems: 'center',
                                                                                                padding: 10,
                                                                                                borderRadius: 14,
                                                                                                background: 'var(--theme-card)',
                                                                                            }}
                                                                                        >
                                                                                            <Avatar src={item?.avatar ? String(item.avatar) : undefined} size={44}>
                                                                                                {name.charAt(0) || 'PT'}
                                                                                            </Avatar>
                                                                                            <div style={{ minWidth: 0 }}>
                                                                                                <Typography.Text strong style={{ color: bubbleColor, display: 'block' }}>
                                                                                                    {name}
                                                                                                </Typography.Text>
                                                                                                <Typography.Text style={{ color: bubbleColor, display: 'block', fontSize: 12 }}>
                                                                                                    {String(item?.specialty || t('ai.ptFallback'))}
                                                                                                </Typography.Text>
                                                                                                <Typography.Text style={{ color: panelMutedText, display: 'block', fontSize: 12 }}>
                                                                                                    {phone || t('ai.phoneFallback')} {email ? `• ${email}` : ''}
                                                                                                </Typography.Text>
                                                                                            </div>
                                                                                        </div>
                                                                                    )
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                        {!toolPayload && isUser && (
                                                                            visibleContent
                                                                                ? renderMarkdownText(visibleContent, bubbleColor)
                                                                                : <Typography.Text style={{ color: panelMutedText }}>{t('ai.loading')}</Typography.Text>
                                                                        )}
                                                                        {!toolPayload && !isUser && (
                                                                            <AssistantMessageBubble message={message} content={visibleContent} />
                                                                        )}
                                                                        {!toolPayload && !actionPayload && sourceCards.length > 0 && renderWebSourceCards(sourceCards, dark, t)}
                                                                    </>
                                                                ), panelMutedText, visibleContent)}
                                                              </div>
                                                          </div>
                                                          <Tooltip title={copiedMessageIds.has(message.id) ? t('ai.copied') : t('ai.copy')}>
                                                              <button
                                                                  type="button"
                                                                  aria-label={copiedMessageIds.has(message.id) ? t('ai.copied') : t('ai.copy')}
                                                                  className="ai-chat-copy-btn"
                                                                  onClick={(e) => { e.stopPropagation(); copyMessage(message.id, message.content) }}
                                                              >
                                                                  {copiedMessageIds.has(message.id) ? <CheckOutlined /> : <CopyOutlined />}
                                                                  <span>{t(copiedMessageIds.has(message.id) ? 'ai.copied' : 'ai.copy')}</span>
                                                              </button>
                                                          </Tooltip>
                                                         {!isUser && message.role === 'assistant' && index === lastAssistantMessageIndex && !loading && messageSuggestions.length > 0 && (
                                                            <div
                                                                style={{
                                                                    maxWidth: mobileChat ? '100%' : viewport.width <= 1024 ? '90%' : '76%',
                                                                    marginTop: 8,
                                                                    display: 'grid',
                                                                    gap: 8,
                                                                }}
                                                            >
                                                                <Typography.Text style={{ color: panelMutedText, fontSize: 12, fontWeight: 700 }}>
                                                                    {t('ai.relatedPromptsTitle')}
                                                                </Typography.Text>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                                    {messageSuggestions.map((suggestion) => (
                                                                        <button
                                                                            key={suggestion}
                                                                            type="button"
                                                                            onClick={() => handleSend(suggestion, { source: 'suggested_prompt', modeOverride: 'gym' })}
                                                                            style={{
                                                                                border: '1px solid var(--theme-accent-border)',
                                                                                background: 'color-mix(in srgb, var(--theme-card) 86%, transparent)',
                                                                                color: panelText,
                                                                                borderRadius: 999,
                                                                                padding: '7px 11px',
                                                                                font: 'inherit',
                                                                                fontSize: 12,
                                                                                lineHeight: 1.25,
                                                                                cursor: 'pointer',
                                                                                transition: 'background 160ms ease, border-color 160ms ease, transform 160ms ease',
                                                                            }}
                                                                            onMouseEnter={(event) => {
                                                                                event.currentTarget.style.background = 'var(--theme-accent-muted)'
                                                                                event.currentTarget.style.borderColor = 'var(--theme-accent)'
                                                                                event.currentTarget.style.transform = 'translateY(-1px)'
                                                                            }}
                                                                            onMouseLeave={(event) => {
                                                                                event.currentTarget.style.background = 'color-mix(in srgb, var(--theme-card) 86%, transparent)'
                                                                                event.currentTarget.style.borderColor = 'var(--theme-accent-border)'
                                                                                event.currentTarget.style.transform = 'translateY(0)'
                                                                            }}
                                                                        >
                                                                            {suggestion}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })
                                        )}
                                        {loading && (
                                            <div style={{ textAlign: 'center', marginTop: 14 }}>
                                                <Spin />
                                                <div style={{ marginTop: 8 }}>
                                                    <Typography.Text style={{ color: 'var(--theme-muted)', fontSize: 12 }}>
                                                        {loadingPhase === 'reasoning'
                                                            ? 'Đang suy luận câu trả lời phù hợp...'
                                                            : 'Doraemon đang xem dữ liệu GymPro...'}
                                                        {activeAiTool ? `: ${activeAiTool}` : ''}
                                                    </Typography.Text>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* INPUT */}
                                    <div style={{
                                        borderTop: panelBorder,
                                        padding: mobileChat ? '10px 12px' : '14px 16px',
                                        background: panelBackground,
                                        backdropFilter: 'blur(12px)',
                                        WebkitBackdropFilter: 'blur(12px)',
                                        flexShrink: 0,
                                    }}>
                                        {errorInfo && (
                                            <div style={{
                                                marginBottom: 10,
                                                padding: 10,
                                                borderRadius: 14,
                                                background: 'rgba(255,77,79,0.12)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 10,
                                                flexWrap: 'wrap',
                                            }}>
                                                <Typography.Text style={{ color: 'var(--theme-text)', fontSize: 13 }}>{errorInfo.message}</Typography.Text>
                                                <Button
                                                    size="small"
                                                    disabled={retryCountdown > 0}
                                                    onClick={handleRetry}
                                                    style={{ background: 'var(--theme-button-bg)', borderColor: 'var(--theme-button-border)', color: 'var(--theme-button-text)' }}
                                                >
                                                    {retryCountdown > 0 ? t('ai.retryAfter', { count: retryCountdown }) : t('ai.retry')}
                                                </Button>
                                            </div>
                                        )}
                                        <Input.TextArea
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            onPressEnter={(e) => {
                                                if (!e.shiftKey) { e.preventDefault(); handleSend() }
                                            }}
                                            placeholder={t('ai.inputPlaceholder')}
                                            rows={mobileChat ? 2 : 3}
                                            disabled={loading}
                                            style={{
                                                borderRadius: 14,
                                                marginBottom: 10,
                                                background: inputBackground,
                                                border: `1px solid ${inputBorder}`,
                                                backdropFilter: 'blur(8px)',
                                                WebkitBackdropFilter: 'blur(8px)',
                                                color: panelText,
                                                fontSize: mobileChat ? 14 : 15,
                                            }}
                                        />
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: 8,
                                            flexWrap: 'wrap',
                                        }}>
                                            {!mobileChat && (
                                                <Typography.Text style={{ fontSize: 12, color: panelMutedText }}>
                                                    {t('ai.enterToSend')} · {t('ai.shiftEnterNewLine')}
                                                </Typography.Text>
                                            )}
                                            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                                                <Button
                                                    type="text"
                                                    size={mobileChat ? 'small' : 'middle'}
                                                    onClick={createNewChat}
                                                    style={{ color: panelText }}
                                                >
                                                {t('ai.newButton')}
                                            </Button>
                                                <Button
                                                    icon={<SendOutlined />}
                                                    size={mobileChat ? 'small' : 'middle'}
                                                    onClick={() => handleSend()}
                                                    loading={loading}
                                                    style={{ background: 'var(--theme-button-bg)', color: 'var(--theme-button-text)', border: 'none' }}
                                                >
                                                    {t('ai.send')}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SESSION DRAWER — mobile/tablet */}
                    {/* Drawer phien chat cao hon khung chat va thap hon modal xoa. */}
                </div>
            </div>

            <Drawer
                className="ai-session-drawer"
                title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span>{t('ai.sessionDrawerTitle')}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Badge count={sessions.length} color="var(--theme-accent)" />
                             <Button
                                 size="small"
                                 type="text"
                                 className="ai-new-chat-action-button focus:ring-2 focus:ring-offset-2"
                                 icon={<PlusOutlined />}
                                 style={newChatActionButtonStyle}
                                 onMouseEnter={(event) => applyNewChatActionHover(event.currentTarget, true)}
                                 onMouseLeave={(event) => applyNewChatActionHover(event.currentTarget, false)}
                                 onFocus={(event) => applyNewChatActionFocus(event.currentTarget, true)}
                                 onBlur={(event) => applyNewChatActionFocus(event.currentTarget, false)}
                                 onClick={(event) => {
                                     event.stopPropagation()
                                     createNewChat()
                                }}
                            />
                        </div>
                    </div>
                }
                placement="left"
                open={sessionDrawerOpen}
                onClose={() => {
                    setSessionDrawerOpen(false)
                    cancelEditingSession()
                }}
                zIndex={11500}
                width={280}
                styles={{
                    body: {
                        padding: 0,
                        background: 'var(--theme-card)',
                        color: 'var(--theme-text)',
                        display: 'flex',
                        flexDirection: 'column',
                    },
                    header: {
                        background: 'var(--theme-card)',
                        borderBottom: '1px solid var(--theme-border)',
                    },
                    wrapper: {
                        zIndex: 11500,
                    },
                }}
            >
                {renderSessionList()}
            </Drawer>
        </>,
        document.body,
    )
}


