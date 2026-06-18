import { CheckOutlined, CopyOutlined, DeleteOutlined, EditOutlined, MenuFoldOutlined, MenuUnfoldOutlined, MoreOutlined, PaperClipOutlined, PlusOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons'
import { Avatar, Badge, Button, Drawer, Dropdown, Input, Modal, Tooltip, Typography, message as antdMessage } from 'antd'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../context/ThemeProvider'
import { useAuth } from '../../hooks/useAuth'
import { deleteAiChatSession, getAiChatHistory, renameAiChatSession, requestAiAssistant, requestAiAssistantStream, saveAiChatHistory, uploadAiChatImage, type AiMode, type InBodyAnalysisResult } from '../../services/aiService'
import { InBodyAnalysisCard } from './InBodyAnalysisCard'
import type { AiToolPayload, ChatAttachment, ChatMessage, ChatSession, ConversationContext, PlanPayload, StoredChatState, WebSearchResult } from '../../types/aichat/aichat'

import { AssistantMessageBubble } from './AssistantMessageBubble'
import PTCard from './PTCard'
import {
    extractAiAnswer,
} from '../../utils/aiUtils'

const STORAGE_KEY_PREFIX = 'chat_history_'
const ACCEPTED_AI_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_AI_IMAGE_SIZE = 5 * 1024 * 1024
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
    const domain = String(source.domain || source.sourceDomain || '').trim() || getSourceDomain(source.url)
    const title = String(source.title || source.sourceTitle || '').replace(/\s+/g, ' ').trim()
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

const extractAiResponseContent = (response: unknown, fallback = '') => {
    const answer = extractAiAnswer(response)
    if (answer === 'Phản hồi AI chưa đúng định dạng.' || answer === 'Không nhận được phản hồi.') {
        return fallback || answer
    }
    return answer
}

const normalizeChatContent = (content: unknown, t?: (key: string) => string) => {
    if (typeof content === 'string') {
        const cleaned = content
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
            .replace(/^```[a-z0-9_-]*\s*/i, '')
            .replace(/\s*```$/i, '')
        
        const extracted = extractAiAnswer(cleaned)
        if (extracted !== 'Phản hồi AI chưa đúng định dạng.' && extracted !== 'Không nhận được phản hồi.') {
            return extracted
        }

        if (/^\s*\{[\s\S]*\}\s*$/.test(cleaned)) {
            return getAiObjectDisplayMessage(cleaned, t || ((key: string) => key)) || ''
        }
        return cleaned
    }
    
    const extracted = extractAiAnswer(content)
    if (extracted !== 'Phản hồi AI chưa đúng định dạng.' && extracted !== 'Không nhận được phản hồi.') {
        return extracted
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
                const domain = String(source.domain || source.sourceDomain || '').trim() || getSourceDomain(source.url)
                const name = getSourceName(source, t)
                const favicon = typeof source.favicon === 'string' && source.favicon.trim()
                    ? source.favicon.trim()
                    : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
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
                            src={favicon}
                            style={{ background: 'var(--theme-elevated)' }}
                        >
                            {domain.charAt(0).toUpperCase()}
                        </Avatar>
                        <span style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                            <Typography.Text strong ellipsis style={{ color: 'inherit', lineHeight: 1.25 }}>
                                {domain || name}
                            </Typography.Text>
                            <Typography.Text ellipsis style={{ color: dark ? '#d8d8d8' : 'rgba(237,235,230,0.55)', fontSize: 12, lineHeight: 1.2 }}>
                                {t ? t('ai.sourceArticle') : 'Article'}: {name}
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
    (planPayload.type === 'plan_compare_two' || planPayload.type === 'plan_compare_all')
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
    ...(planPayload.type === 'plan_compare_two' || planPayload.type === 'plan_compare_all'
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

const normalizeChatAttachments = (attachments: unknown): ChatAttachment[] => (
    Array.isArray(attachments)
        ? attachments
            .filter(isRecord)
            .map((item) => ({
                type: 'image' as const,
                url: typeof item.url === 'string' ? item.url.trim() : '',
                name: typeof item.name === 'string' ? item.name : '',
                mimeType: typeof item.mimeType === 'string' ? item.mimeType : '',
                size: Number.isFinite(Number(item.size)) ? Number(item.size) : 0,
            }))
            .filter((item) => item.url)
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
    const attachments = normalizeChatAttachments(safeMessage.attachments)
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
        ...(Array.isArray(safeMessage.sources) ? { sources: safeMessage.sources } : {}),
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
        ...(attachments.length > 0 ? { attachments } : {}),
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

const playAiClickSound = () => {
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

const AiAssistantAvatar = ({ size = 28 }: { size?: number }) => (
    <Avatar
        size={size}
        icon={<RobotOutlined />}
        style={{
            background: 'var(--theme-button-bg)',
            color: 'var(--theme-button-text)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
        }}
    />
)

type AiChatWidgetProps = {
    variant?: 'floating' | 'page'
}

function AiChatFloatingButton() {
    const navigate = useNavigate()
    const { t } = useTranslation()

    if (typeof document === 'undefined') return null

    return createPortal(
        <>
            <style>{`
                .ai-gympro-floating-chat {
                    position: fixed;
                    right: max(18px, env(safe-area-inset-right));
                    bottom: max(18px, env(safe-area-inset-bottom));
                    z-index: 11000;
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    min-height: 52px;
                    max-width: calc(100vw - 36px);
                    padding: 7px 16px 7px 8px;
                    border: 1px solid var(--theme-button-border);
                    border-radius: 999px;
                    background: var(--theme-button-bg);
                    color: var(--theme-button-text);
                    box-shadow: 0 16px 42px rgba(0, 116, 170, 0.26);
                    cursor: pointer;
                    font: inherit;
                    font-weight: 800;
                    letter-spacing: 0;
                    transition: transform 160ms ease, box-shadow 160ms ease, filter 160ms ease;
                    touch-action: manipulation;
                }
                .ai-gympro-floating-chat:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 20px 54px rgba(0, 116, 170, 0.34);
                    filter: brightness(1.04);
                }
                .ai-gympro-floating-chat:focus-visible {
                    outline: 3px solid var(--theme-accent-muted);
                    outline-offset: 3px;
                }
                .ai-gympro-floating-chat-avatar {
                    display: grid;
                    place-items: center;
                    width: 38px;
                    height: 38px;
                    min-width: 38px;
                    border-radius: 999px;
                    overflow: hidden;
                    background: color-mix(in srgb, var(--theme-card) 84%, transparent);
                    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.28);
                }
                .ai-gympro-floating-chat-text {
                    white-space: nowrap;
                    line-height: 1;
                }
                @media (max-width: 560px) {
                    .ai-gympro-floating-chat {
                        width: 56px;
                        height: 56px;
                        min-height: 56px;
                        padding: 8px;
                        justify-content: center;
                    }
                    .ai-gympro-floating-chat-text {
                        position: absolute;
                        width: 1px;
                        height: 1px;
                        padding: 0;
                        margin: -1px;
                        overflow: hidden;
                        clip: rect(0, 0, 0, 0);
                        white-space: nowrap;
                        border: 0;
                    }
                }
            `}</style>
            <button
                type="button"
                className="ai-gympro-floating-chat"
                aria-label={t('ai.askAI') || 'Ask AI'}
                onClick={() => {
                    playAiClickSound()
                    navigate('/ai-chat')
                }}
            >
                <span className="ai-gympro-floating-chat-avatar">
                    <RobotOutlined />
                </span>
                <span className="ai-gympro-floating-chat-text">{t('ai.askAI') || 'Ask AI'}</span>
            </button>
        </>,
        document.body,
    )
}

export default function AiChatWidget({ variant = 'floating' }: AiChatWidgetProps) {
    if (variant !== 'page') return <AiChatFloatingButton />

    const { dark, tokens, applyTheme } = useTheme()
    const { user } = useAuth()
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string>('')
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [aiActionLoading, setAiActionLoading] = useState(false)
    const [, setActiveAiTool] = useState('')
    const [aiStatus, setAiStatus] = useState<{ status: string; message: string } | null>(null)
    const [errorInfo, setErrorInfo] = useState<{ code: number; message: string } | null>(null)
    const [retryCountdown, setRetryCountdown] = useState(0)
    const [lastQuery, setLastQuery] = useState('')
    const [copiedMessageIds, setCopiedMessageIds] = useState<Set<string>>(new Set())
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
    const [editingTitle, setEditingTitle] = useState('')
    const [selectedImage, setSelectedImage] = useState<{ file: File; previewUrl: string } | null>(null)
    const [visionImageType, setVisionImageType] = useState<string | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const imageInputRef = useRef<HTMLInputElement>(null)
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
        window.requestAnimationFrame(() => {
            const element = scrollRef.current
            if (element) element.scrollTop = element.scrollHeight
        })
    }, [sessions, loading, aiActionLoading])

    useEffect(() => {
        return () => {
            if (streamTypingTimerRef.current) {
                window.clearInterval(streamTypingTimerRef.current)
                streamTypingTimerRef.current = null
            }
            if (selectedImage?.previewUrl) URL.revokeObjectURL(selectedImage.previewUrl)
            document.body.style.userSelect = ''
            document.body.style.touchAction = ''
        }
    }, [selectedImage?.previewUrl])

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>
        if (retryCountdown > 0) timer = setTimeout(() => setRetryCountdown(retryCountdown - 1), 1000)
        return () => { if (timer) clearTimeout(timer) }
    }, [retryCountdown])

    useEffect(() => {
        if (!loading) {
            setAiStatus(null)
        }
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
                        ? getSessionTitle(safeMessage.content || safeMessage.attachments?.[0]?.name || 'Image')
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

    const clearSelectedImage = () => {
        setSelectedImage((current) => {
            if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
            return null
        })
        if (imageInputRef.current) imageInputRef.current.value = ''
    }

    const handleImageFileChange = (fileList: FileList | null) => {
        const file = fileList?.[0]
        if (!file) return
        if (!ACCEPTED_AI_IMAGE_TYPES.includes(file.type)) {
            antdMessage.error('Chỉ hỗ trợ ảnh JPG, JPEG, PNG hoặc WEBP')
            if (imageInputRef.current) imageInputRef.current.value = ''
            return
        }
        if (file.size > MAX_AI_IMAGE_SIZE) {
            antdMessage.error('Ảnh tối đa 5MB')
            if (imageInputRef.current) imageInputRef.current.value = ''
            return
        }
        setSelectedImage((current) => {
            if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
            return { file, previewUrl: URL.createObjectURL(file) }
        })
    }

    const handleRetry = async () => {
        if (!lastQuery) return
        setQuery(lastQuery)
        await handleSend(lastQuery)
    }

    const handleSend = async (messageText?: string, options: { source?: 'suggested_prompt'; modeOverride?: AiMode } = {}) => {
        const trimmed = (messageText ?? query).trim()
        const imageToSend = selectedImage
        if (!trimmed && !imageToSend) return
        const effectiveMode: AiMode = 'gym'
        const fromSuggestion = options.source === 'suggested_prompt'
        let attachments: ChatAttachment[] = []
        if (imageToSend) {
            setLoading(true)
            setErrorInfo(null)
            try {
                const { data } = await uploadAiChatImage(imageToSend.file)
                const attachment = isRecord(data?.attachment) ? data.attachment : {}
                const url = typeof attachment.url === 'string' ? attachment.url : ''
                if (!url) throw new Error('Missing uploaded image URL')
                attachments = [{
                    type: 'image',
                    url,
                    name: typeof attachment.name === 'string' ? attachment.name : imageToSend.file.name,
                    mimeType: typeof attachment.mimeType === 'string' ? attachment.mimeType : imageToSend.file.type,
                    size: Number.isFinite(Number(attachment.size)) ? Number(attachment.size) : imageToSend.file.size,
                }]
                clearSelectedImage()
            } catch (error: any) {
                setLoading(false)
                const message = error?.response?.data?.message || error?.message || 'Không thể upload ảnh'
                setErrorInfo({ code: error?.response?.status || 500, message })
                return
            }
        }

        setVisionImageType(null)

        const userMessage: ChatMessage = {
            id: `${Date.now()}-user`,
            userId: user?._id ?? 'guest',
            role: 'user',
            content: trimmed,
            createdAt: new Date().toISOString(),
            ...(attachments.length > 0 ? { attachments } : {}),
        }
        addMessageToSession(userMessage)
        setLastQuery(trimmed)
        if (!fromSuggestion) setQuery('')
        if (!trimmed) {
            setLoading(false)
            setAiActionLoading(false)
            return
        }
        const conversationContext = buildConversationContext([...activeMessages, userMessage], effectiveMode, activeSession?.sessionId)
        const assistantType = 'member'
        const domain = 'gym'
        const chatMode = 'chat'
        const currentLanguage = i18n.language?.startsWith('en') ? 'en' : 'vi'
        const tab = t('ai.gymTab')
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
                attachments: attachments.length > 0 ? attachments : undefined,
                requestContext: {
                    assistantType,
                    domain,
                    language: currentLanguage,
                    mode: chatMode,
                    source: options.source || 'user_message',
                    ...(fromSuggestion ? { suggestedFollowUp: trimmed } : {}),
                    intent,
                },
                onStatus: (status, message) => {
                    setAiStatus({ status, message })
                },
                onMeta: (data) => {
                    if (data?.imageType) {
                        setVisionImageType(data.imageType)
                    }
                    if (data?.aiAction || data?.toolCalling) {
                        setAiActionLoading(data.status !== 'tool_complete')
                        setActiveAiTool(data.tool || '')
                    }
                },
                onFirstChunk: () => {
                    setLoading(false)
                },
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
                    content: fallbackSplit.chatContent || t('ai.fallbackResponse'),
                    answer: fallbackSplit.chatContent,
                    suggestions: normalizeSuggestions(fallbackResponse.suggestions)
                        .filter((suggestion) => normalizeCommandText(suggestion) !== normalizeCommandText(trimmed)),
                    intent: typeof fallbackResponse.metadata?.intent === 'string' ? fallbackResponse.metadata.intent : fallbackAction?.action,
                    subject: getAiResponseSubject(fallbackResponse),
                    action: fallbackAction?.action,
                    metadata: isRecord(fallbackResponse.metadata) ? fallbackResponse.metadata : undefined,
                    sources: Array.isArray(fallbackResponse.sources) ? fallbackResponse.sources : undefined,
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
                    content: splitResponse.chatContent,
                    answer: splitResponse.chatContent,
                    suggestions: normalizeSuggestions(response.suggestions)
                        .filter((suggestion) => normalizeCommandText(suggestion) !== normalizeCommandText(trimmed)),
                    intent: typeof response.metadata?.intent === 'string' ? response.metadata.intent : actionPayload?.action,
                    subject: getAiResponseSubject(response),
                    action: actionPayload?.action,
                    metadata: isRecord(response.metadata) ? response.metadata : undefined,
                    sources: Array.isArray(response.sources) ? response.sources : undefined,
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
                    content: splitResponse.chatContent || t('ai.fallbackResponse'),
                    answer: splitResponse.chatContent,
                    suggestions: normalizeSuggestions(response.suggestions)
                        .filter((suggestion) => normalizeCommandText(suggestion) !== normalizeCommandText(trimmed)),
                    intent: typeof response.metadata?.intent === 'string' ? response.metadata.intent : actionPayload?.action,
                    subject: getAiResponseSubject(response),
                    action: actionPayload?.action,
                    metadata: isRecord(response.metadata) ? response.metadata : undefined,
                    sources: Array.isArray(response.sources) ? response.sources : undefined,
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
    const showSessionSidebar = !compactChat
    const sidebarWidth = sidebarCollapsed ? 72 : 280
    const panelBackground = 'var(--theme-bg)'
    const panelText = tokens.text
    const panelMutedText = tokens.muted
    const panelBorder = '1px solid var(--theme-border)'
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

    const widgetContent = (
        <>
            <style>{`
                .ai-chat-anchor {
                    width: 100%;
                    height: 100%;
                    min-width: 0;
                }
                .ai-chat-wrapper {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    min-width: 0;
                    overflow: hidden;
                }
                .chat-sidebar {
                    width: var(--sidebar-width);
                    transition: width 0.2s ease;
                }
                .chat-sidebar.collapsed {
                    width: 72px;
                }
                .ai-chat-content {
                    display: flex;
                }
                .chat-main,
                .ai-chat-main {
                    flex: 1;
                    min-width: 0;
                }
                .ai-chat-page-panel,
                .ai-chat-page-panel * {
                    box-sizing: border-box;
                }
                .ai-chat-page-content {
                    background: var(--theme-bg);
                }
                .ai-chat-message-scroll {
                    background: var(--theme-bg);
                }
                .ai-chat-message-inner,
                .ai-chat-composer-inner {
                    width: min(100%, 840px);
                    margin: 0 auto;
                }
                .ai-chat-composer {
                    border-top: 1px solid transparent;
                    background: linear-gradient(to top, var(--theme-bg) 82%, color-mix(in srgb, var(--theme-bg) 82%, transparent));
                }
                .ai-chat-composer-shell {
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr) auto;
                    align-items: end;
                    gap: 8px;
                    padding: 10px 12px;
                    border: 1px solid var(--theme-border);
                    border-radius: 24px;
                    background: var(--theme-card);
                    box-shadow: 0 10px 28px rgba(0,0,0,0.08);
                }
                .ai-chat-composer-shell textarea {
                    min-height: 32px !important;
                    max-height: 180px;
                    padding: 5px 0 !important;
                    border: 0 !important;
                    box-shadow: none !important;
                    resize: none !important;
                }
                .ai-chat-image-preview {
                    display: inline-grid;
                    grid-template-columns: 92px auto;
                    align-items: start;
                    gap: 10px;
                    max-width: min(100%, 360px);
                    padding: 8px;
                    margin-bottom: 10px;
                    border: 1px solid var(--theme-border);
                    border-radius: 14px;
                    background: var(--theme-card);
                }
                .ai-chat-image-preview img,
                .ai-chat-message-image {
                    display: block;
                    max-width: 100%;
                    border-radius: 12px;
                    object-fit: cover;
                }
                .ai-chat-image-preview img {
                    width: 92px;
                    height: 72px;
                }
                .ai-chat-message-attachments {
                    display: grid;
                    gap: 8px;
                    margin-bottom: 10px;
                }
                .ai-chat-message-image {
                    max-height: 280px;
                    width: auto;
                    border: 1px solid var(--theme-border);
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
                    background: transparent;
                    border: 0;
                    box-shadow: none;
                    border-radius: 0;
                    padding: 0;
                    max-width: 100%;
                    color: var(--theme-text);
                }

                .ai-assistant-content,
                .ai-assistant-content * {
                    line-height: 1.72;
                    font-size: 15px;
                }

                .ai-text-content {
                    white-space: pre-line;
                    line-height: 1.72;
                    max-width: 100%;
                }

                .ai-text-content p {
                    margin: 0 0 8px;
                }

                .ai-text-content ul {
                    margin: 6px 0 14px;
                    padding-left: 0;
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

            <div
                className="ai-chat-anchor"
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    maxHeight: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    margin: 0,
                    minWidth: 0,
                }}
            >
                <div className="ai-chat-wrapper">
                    <div
                        className="ai-chat-panel ai-chat-surface ai-chat-page-panel"
                        style={{
                            position: 'relative',
                            left: 0,
                            top: 0,
                            width: '100%',
                            maxWidth: '100%',
                            height: '100%',
                            maxHeight: 'none',
                            zIndex: 'auto',
                            borderRadius: 0,
                            background: panelBackground,
                            color: 'var(--theme-text)',
                            border: 0,
                            boxShadow: 'none',
                            transform: 'none',
                            opacity: 1,
                            visibility: 'visible',
                            transition: 'none',
                            overflow: 'hidden',
                            isolation: 'isolate',
                            display: 'flex',
                            flexDirection: 'column',
                            backdropFilter: 'none',
                            WebkitBackdropFilter: 'none',
                            cursor: 'default',
                            userSelect: 'text',
                            WebkitUserSelect: 'text',
                        }}
                    >
                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

                            <div className="ai-chat-content ai-chat-page-content" style={{ display: 'flex', flex: 1, minHeight: 0 }}>

                                {/* SIDEBAR (desktop only) */}
                                {showSessionSidebar && (
                                    <div className={`chat-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`} style={{
                                        '--sidebar-width': `${sidebarWidth}px`,
                                        width: sidebarWidth,
                                        minWidth: sidebarWidth,
                                        borderRight: panelBorder,
                                        background: 'color-mix(in srgb, var(--theme-card) 58%, var(--theme-bg))',
                                        backdropFilter: 'none',
                                        WebkitBackdropFilter: 'none',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        overflow: 'hidden',
                                        transition: 'width 0.2s ease, min-width 0.2s ease',
                                    } as CSSProperties}>
                                        <div
                                            style={{
                                                padding: sidebarCollapsed ? '10px 8px' : '12px 16px 10px',
                                                borderBottom: panelBorder,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: sidebarCollapsed ? 0 : 8,
                                                flexShrink: 0,
                                            }}
                                        >
                                            {!sidebarCollapsed ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Button
                                                        size="small"
                                                        type="text"
                                                        block
                                                        className="ai-new-chat-action-button focus:ring-2 focus:ring-offset-2"
                                                        icon={<PlusOutlined />}
                                                        style={{
                                                            height: 36,
                                                            color: newChatActionColor,
                                                            background: newChatActionBackground,
                                                            border: `1px solid ${newChatActionBorder}`,
                                                            borderRadius: 9,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            boxShadow: 'none',
                                                            transition: 'background 160ms ease, transform 160ms ease, box-shadow 160ms ease',
                                                            gap: 6,
                                                            fontSize: 13,
                                                            fontWeight: 500,
                                                            paddingInline: 12,
                                                        }}
                                                        onMouseEnter={(event) => applyNewChatActionHover(event.currentTarget, true)}
                                                        onMouseLeave={(event) => applyNewChatActionHover(event.currentTarget, false)}
                                                        onFocus={(event) => applyNewChatActionFocus(event.currentTarget, true)}
                                                        onBlur={(event) => applyNewChatActionFocus(event.currentTarget, false)}
                                                        onClick={createNewChat}
                                                    >
                                                        {t('ai.newChat') || 'New Chat'}
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        type="text"
                                                        icon={<MenuFoldOutlined />}
                                                        onClick={() => setSidebarCollapsed((value) => !value)}
                                                        style={{ color: panelText, flexShrink: 0, width: 36, height: 36 }}
                                                    />
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                                    <Button
                                                        size="small"
                                                        type="text"
                                                        icon={<MenuUnfoldOutlined />}
                                                        onClick={() => setSidebarCollapsed((value) => !value)}
                                                        style={{ color: panelText, width: 36, height: 36 }}
                                                    />
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
                                        </div>
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
                                        {!showSessionSidebar && (
                                            <Button
                                                type="text"
                                                icon={<MenuUnfoldOutlined />}
                                                onClick={() => setSessionDrawerOpen(true)}
                                                style={{ color: panelText, width: 36, height: 36, flexShrink: 0 }}
                                            />
                                        )}
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}></div>
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
                                            background: panelBackground,
                                            backdropFilter: 'none',
                                            WebkitBackdropFilter: 'none',
                                            cursor: 'text',
                                            pointerEvents: 'auto',
                                            userSelect: 'text',
                                            WebkitUserSelect: 'text',
                                        }}
                                    >
                                        {activeMessages.length === 0 ? (
                                            <div className="ai-chat-message-inner" style={{ display: 'grid', gap: 16, margin: mobileChat ? '24px auto' : '42px auto' }}>
                                                <div style={{ textAlign: 'center', display: 'grid', gap: 6 }}>
                                                    <Typography.Text strong style={{ color: panelText, fontSize: mobileChat ? 15 : 16 }}>
                                                        {t('ai.startTitle')}
                                                    </Typography.Text>
                                                    <Typography.Text style={{ color: panelMutedText, fontSize: 13 }}>
                                                        {t('ai.startDescription')}
                                                    </Typography.Text>
                                                </div>
                                                <Typography.Text style={{ color: panelMutedText, fontSize: 13, textAlign: 'center', display: 'block' }}>
                                                    {t('ai.startHint') || 'Bạn có thể hỏi hoặc gửi ảnh để tôi phân tích.'}
                                                </Typography.Text>
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
                                                const bubbleBg = isUser ? 'var(--theme-accent)' : 'transparent'
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
                                                const messageAttachments = normalizeChatAttachments(message.attachments)
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
                                                            width: 'min(100%, 840px)',
                                                            margin: '0 auto 22px',
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
                                                            backdropFilter: 'none',
                                                            WebkitBackdropFilter: 'none',
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
                                                                <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <AiAssistantAvatar size={24} />
                                                                    <Typography.Text strong style={{ color: bubbleColor }}>AI GymPro</Typography.Text>
                                                                </div>
                                                            )}
                                                            {messageAttachments.length > 0 && (
                                                                <div className="ai-chat-message-attachments">
                                                                    {messageAttachments.map((attachment) => (
                                                                        <a
                                                                            key={attachment.url}
                                                                            href={attachment.url}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            onClick={(event) => event.stopPropagation()}
                                                                        >
                                                                            <img
                                                                                className="ai-chat-message-image"
                                                                                src={attachment.url}
                                                                                alt={attachment.name || 'Uploaded image'}
                                                                            />
                                                                        </a>
                                                                    ))}
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
                                                                                            {item?.image ? (
                                                                                                <img src={String(item.image)} alt={name}
                                                                                                    style={{ width: 54, height: 54, borderRadius: 10, objectFit: 'cover' }} />
                                                                                            ) : (
                                                                                                <div style={{
                                                                                                    width: 54,
                                                                                                    height: 54,
                                                                                                    borderRadius: 10,
                                                                                                    display: 'grid',
                                                                                                    placeItems: 'center',
                                                                                                    background: 'var(--theme-accent-muted)',
                                                                                                    color: 'var(--theme-accent)',
                                                                                                }}>
                                                                                                    <RobotOutlined />
                                                                                                </div>
                                                                                            )}
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
                                                                                {(Array.isArray(toolPayload.items) ? toolPayload.items : []).map((item, index) => (
                                                                                    <PTCard
                                                                                        key={`${item.email || item.phone || item.name}-${index}`}
                                                                                        item={item}
                                                                                        bubbleColor={bubbleColor}
                                                                                        panelMutedText={panelMutedText}
                                                                                    />
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                        {message.data?.inBodyAnalysis && !isUser && (
                                                                            <InBodyAnalysisCard
                                                                                result={message.data.inBodyAnalysis as InBodyAnalysisResult}
                                                                            />
                                                                        )}
                                                                        {!message.data?.inBodyAnalysis && !toolPayload && isUser && (
                                                                            visibleContent ? renderMarkdownText(visibleContent, bubbleColor) : null
                                                                        )}
                                                                        {!message.data?.inBodyAnalysis && !toolPayload && !isUser && (
                                                                            <AssistantMessageBubble
                                                                                message={message}
                                                                                content={visibleContent}
                                                                                loadingMessage={index === lastAssistantMessageIndex && !visibleContent ? (aiStatus?.message || null) : null}
                                                                            />
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
                                    </div>

                                    {/* INPUT */}
                                    <div className="ai-chat-composer" style={{
                                        padding: mobileChat ? '10px 12px 14px' : '14px 24px 18px',
                                        flexShrink: 0,
                                    }}>
                                        <div className="ai-chat-composer-inner">
                                        {visionImageType && selectedImage && (
                                            <div style={{
                                                marginBottom: 10,
                                                padding: '8px 14px',
                                                borderRadius: 14,
                                                background: 'color-mix(in srgb, var(--theme-accent) 10%, transparent)',
                                                border: '1px solid color-mix(in srgb, var(--theme-accent) 24%, transparent)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 10,
                                            }}>
                                                <Typography.Text style={{ color: 'var(--theme-accent)', fontSize: 13, fontWeight: 600 }}>
                                                    📷{' '}
                                                    {visionImageType === 'inbody' ? (t('ai.analyzingInBody') || 'Đang phân tích InBody...') :
                                                     visionImageType === 'food' ? (t('ai.analyzingFood') || 'Đang phân tích bữa ăn...') :
                                                     visionImageType === 'exercise' ? (t('ai.analyzingExercise') || 'Đang phân tích bài tập...') :
                                                     (t('ai.analyzingImage') || 'Đang phân tích ảnh...')}
                                                </Typography.Text>
                                            </div>
                                        )}
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
                                        {selectedImage && (
                                            <div className="ai-chat-image-preview">
                                                <img src={selectedImage.previewUrl} alt={selectedImage.file.name} />
                                                <div style={{ minWidth: 0, display: 'grid', gap: 6 }}>
                                                    <Typography.Text strong ellipsis style={{ color: panelText, fontSize: 13 }}>
                                                        {selectedImage.file.name}
                                                    </Typography.Text>
                                                    <Typography.Text style={{ color: panelMutedText, fontSize: 12 }}>
                                                        {(selectedImage.file.size / 1024 / 1024).toFixed(2)} MB
                                                    </Typography.Text>
                                                    <Button
                                                        size="small"
                                                        type="text"
                                                        onClick={clearSelectedImage}
                                                        style={{ justifySelf: 'start', color: panelMutedText, paddingInline: 0 }}
                                                    >
                                                        {t('ai.removeImage') || 'Remove'}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        <input
                                            ref={imageInputRef}
                                            type="file"
                                            accept="image/jpeg,image/jpg,image/png,image/webp"
                                            style={{ display: 'none' }}
                                            onChange={(event) => handleImageFileChange(event.target.files)}
                                        />
                                        <div className="ai-chat-composer-shell">
                                            <Tooltip title={t('ai.attach') || 'Attach'}>
                                                <Button
                                                    type="text"
                                                    icon={<PaperClipOutlined />}
                                                    onClick={() => imageInputRef.current?.click()}
                                                    disabled={loading}
                                                    style={{ color: panelMutedText, width: 36, height: 36, minWidth: 36 }}
                                                />
                                            </Tooltip>
                                            <Input.TextArea
                                                value={query}
                                                onChange={(e) => setQuery(e.target.value)}
                                                onPressEnter={(e) => {
                                                    if (!e.shiftKey) { e.preventDefault(); handleSend() }
                                                }}
                                                placeholder={selectedImage ? (t('ai.imageAttachedPlaceholder') || 'Thêm ghi chú (không bắt buộc)') : t('ai.inputPlaceholder')}
                                                autoSize={{ minRows: 1, maxRows: mobileChat ? 4 : 6 }}
                                                disabled={loading}
                                                style={{
                                                    background: 'transparent',
                                                    color: panelText,
                                                    fontSize: mobileChat ? 15 : 16,
                                                    lineHeight: 1.55,
                                                }}
                                            />
                                            <Tooltip title={t('ai.send')}>
                                                <Button
                                                    icon={<SendOutlined />}
                                                    onClick={() => handleSend()}
                                                    loading={loading}
                                                    disabled={!query.trim() && !selectedImage}
                                                    shape="circle"
                                                    style={{ background: 'var(--theme-button-bg)', color: 'var(--theme-button-text)', border: 'none', width: 38, height: 38, minWidth: 38 }}
                                                />
                                            </Tooltip>
                                        </div>
                                        {!mobileChat && (
                                            <Typography.Text style={{ display: 'block', marginTop: 8, textAlign: 'center', fontSize: 12, color: panelMutedText }}>
                                                {t('ai.enterToSend')} · {t('ai.shiftEnterNewLine')}
                                            </Typography.Text>
                                        )}
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
                <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--theme-border)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                    <Button
                        size="small"
                        type="text"
                        block
                        className="ai-new-chat-action-button focus:ring-2 focus:ring-offset-2"
                        icon={<PlusOutlined />}
                        style={{
                            height: 36,
                            color: newChatActionColor,
                            background: newChatActionBackground,
                            border: `1px solid ${newChatActionBorder}`,
                            borderRadius: 9,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: 'none',
                            transition: 'background 160ms ease, transform 160ms ease, box-shadow 160ms ease',
                            gap: 6,
                            fontSize: 13,
                            fontWeight: 500,
                            paddingInline: 12,
                        }}
                        onMouseEnter={(event) => applyNewChatActionHover(event.currentTarget, true)}
                        onMouseLeave={(event) => applyNewChatActionHover(event.currentTarget, false)}
                        onFocus={(event) => applyNewChatActionFocus(event.currentTarget, true)}
                        onBlur={(event) => applyNewChatActionFocus(event.currentTarget, false)}
                        onClick={() => { createNewChat(); setSessionDrawerOpen(false) }}
                    >
                        {t('ai.newChat') || 'New Chat'}
                    </Button>
                </div>
                {renderSessionList()}
            </Drawer>
        </>
    )

    return widgetContent
}


