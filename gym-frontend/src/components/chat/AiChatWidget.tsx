import { CloseOutlined, DeleteOutlined, EditOutlined, ExpandAltOutlined, MoreOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons'
import { Avatar, Badge, Button, Drawer, Dropdown, Input, Modal, Segmented, Select, Space, Spin, Tooltip, Typography } from 'antd'
import type { MouseEvent as ReactMouseEvent, ReactNode, TouchEvent as ReactTouchEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeProvider'
import { useAuth } from '../../hooks/useAuth'
import { useDraggable } from '../../hooks/useDraggable'
import { deleteAiChatSession, getAiChatHistory, renameAiChatSession, requestAiAssistant, requestAiAssistantStream, saveAiChatHistory, type AiMode } from '../../services/aiService'
import type { AiToolPayload, ChatMessage, ChatSession, ConversationContext, StoredChatState, WebSearchResult } from '../../types/aichat/aichat'

const STORAGE_KEY_PREFIX = 'chat_history_'
const MASCOT_WIDTH = 100
const MASCOT_HEIGHT = 100
const CHAT_PANEL_BACKGROUND_IMAGE = 'https://genk.mediacdn.vn/2019/7/3/photo-1-1562129061617297549771.jpg'
const AI_AVATAR_IMAGE = 'https://vcdn1-giaitri.vnecdn.net/2023/04/28/doraemon4-1682675790-8961-1682675801.jpg?w=500&h=300&q=100&dpr=1&fit=crop&s=3dxqum5l0xkhHX-R0z_a1g'

const AI_MODE_OPTIONS: { label: string; value: AiMode }[] = [
    { label: 'Gym', value: 'gym' },
    { label: 'Khác', value: 'general' },
]

const getSourceDomain = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, '')
    } catch {
        return ''
    }
}

const getSourceName = (source: WebSearchResult) => {
    const domain = getSourceDomain(source.url)
    const title = String(source.title || '').replace(/\s+/g, ' ').trim()
    if (!title) return domain || 'Nguồn web'
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
const DEFAULT_THEME_COMMAND_COLOR = '#e05a30'

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

const THEME_COLOR_PRESETS = [
    { themeName: 'cyberpunk', color: '#ff00ff', keywords: ['cyberpunk', 'cyber punk'] },
    { themeName: 'gym_dark', color: '#991b1b', keywords: ['dark gym', 'gym dark', 'gym toi', 'tone gym', 'mau gym', 'phong gym', 'gym'] },
    { themeName: 'minimal_light', color: '#ffffff', keywords: ['minimal light', 'toi gian sang', 'trang toi gian', 'light minimal'] },
    { themeName: 'ocean_blue', color: '#0ea5e9', keywords: ['ocean blue', 'bien', 'dai duong', 'xanh bien', 'xanh nuoc bien'] },
    { themeName: 'sunset', color: '#f97316', keywords: ['sunset', 'hoang hon', 'chieu ta'] },
    { themeName: 'neon', color: '#39ff14', keywords: ['neon', 'phat sang'] },
    { themeName: 'pastel', color: '#f9a8d4', keywords: ['pastel', 'nhe nhang'] },
    { themeName: 'red', color: '#ef4444', keywords: ['do', 'red'] },
    { themeName: 'green', color: '#22c55e', keywords: ['xanh la', 'xanh luc', 'luc', 'green'] },
    { themeName: 'cyan', color: '#06b6d4', keywords: ['xanh ngoc', 'cyan', 'aqua'] },
    { themeName: 'blue', color: '#3b82f6', keywords: ['xanh duong', 'xanh', 'blue'] },
    { themeName: 'purple', color: '#8b5cf6', keywords: ['tim', 'purple', 'violet'] },
    { themeName: 'yellow', color: '#eab308', keywords: ['vang', 'yellow'] },
    { themeName: 'orange', color: '#f97316', keywords: ['cam', 'orange'] },
    { themeName: 'pink', color: '#ec4899', keywords: ['hong', 'pink'] },
    { themeName: 'black', color: '#111827', keywords: ['dark mode', 'den', 'black', 'toi'] },
    { themeName: 'white', color: '#ffffff', keywords: ['light mode', 'trang', 'white', 'sang'] },
] as const

const findThemePreset = (normalized: string) => {
    return THEME_COLOR_PRESETS.find((preset) =>
        preset.keywords.some((keyword) => new RegExp(`(^|\\W)${keyword.replace(/\s+/g, '\\s+')}(\\W|$)`).test(normalized)),
    )
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

    const text = content.trim()
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

const getAiActionFallbackMessage = (action?: string) => {
    const messages: Record<string, string> = {
        change_theme: 'Đã đổi giao diện theo yêu cầu.',
        open_modal: 'Mình đã mở phần bạn cần.',
        navigate: 'Mình đã chuyển đến trang phù hợp.',
        search_web: 'Mình đã tìm thông tin liên quan cho bạn.',
    }
    return action ? messages[action] || 'Mình đã thực hiện yêu cầu của bạn.' : 'Mình đã thực hiện yêu cầu của bạn.'
}

const getAiActionDisplayMessage = (
    actionPayload: ReturnType<typeof parseAiActionPayload>,
    currentContent = '',
) => {
    if (!actionPayload) return currentContent
    const actionMessage = typeof actionPayload.message === 'string'
        ? actionPayload.message
        : ''
    return actionMessage.trim() ? actionMessage : getAiActionFallbackMessage(actionPayload.action)
}

const getAiObjectDisplayMessage = (content: unknown) => {
    const parsed = extractJsonObjectPayload(content)
    if (!parsed) return null
    const actionPayload = typeof parsed.action === 'string'
        ? parsed as AiActionPayload
        : null
    if (actionPayload) return getAiActionDisplayMessage(actionPayload)

    const naturalMessage = [parsed.message, parsed.text, parsed.answer, parsed.content]
        .find((value) => typeof value === 'string' && value.trim())
    return typeof naturalMessage === 'string'
        ? naturalMessage
        : 'Mình đã xử lý xong yêu cầu của bạn.'
}

const getSafeAssistantDisplayContent = (content: unknown, actionPayload: ReturnType<typeof parseAiActionPayload>) => {
    if (actionPayload) return getAiActionDisplayMessage(actionPayload)
    const objectMessage = getAiObjectDisplayMessage(content)
    if (objectMessage) return objectMessage
    return typeof content === 'string' ? content : ''
}

const splitAiAssistantResponse = (rawContent: unknown, currentContent = '') => {
    const actionPayload = parseAiActionPayload(rawContent)
    const chatContent = rawContent
        ? getSafeAssistantDisplayContent(rawContent, actionPayload)
        : currentContent

    return {
        actionPayload,
        chatContent,
    }
}

const extractAiResponseContent = (response: unknown, fallback = '') => {
    if (typeof response === 'string') return response
    if (!response || typeof response !== 'object') return fallback

    const payload = response as Record<string, unknown>
    const directContent = [payload.answer, payload.message, payload.text, payload.content]
        .find((value) => typeof value === 'string' && value.trim())

    if (typeof directContent === 'string') return directContent

    const objectMessage = getAiObjectDisplayMessage(payload.answer ?? payload.message ?? payload.text ?? payload.content ?? payload)
    return objectMessage || fallback
}

const normalizeChatContent = (content: unknown) => {
    if (typeof content === 'string') return content
    return getAiObjectDisplayMessage(content) || ''
}

const isPotentialJsonObjectResponse = (content: unknown) => {
    if (content && typeof content === 'object') return true
    if (typeof content !== 'string') return false
    const text = content.trimStart().toLowerCase()
    return text.startsWith('{') || text.startsWith('```json') || text.startsWith('```')
}

const getThemeDisplayName = (themeName: string) => {
    const labels: Record<string, string> = {
        custom: 'màu bạn chọn',
        default: 'màu mặc định',
        red: 'tone đỏ',
        green: 'tone xanh lục',
        blue: 'tone xanh dương',
        purple: 'tone tím',
        yellow: 'tone vàng',
        orange: 'tone cam',
        pink: 'tone hồng',
        black: 'dark mode',
        white: 'light mode',
        neon: 'tone neon',
        cyberpunk: 'cyberpunk',
        gym_dark: 'dark gym',
        minimal_light: 'minimal light',
        sunset: 'sunset',
        ocean_blue: 'ocean blue',
        pastel: 'pastel',
        cyan: 'tone xanh ngọc',
    }
    return labels[themeName] || themeName.replace(/_/g, ' ')
}

const buildThemeActionMessage = (themeName: string) => `Đã đổi giao diện sang ${getThemeDisplayName(themeName)}.`

const isShortFollowUpText = (normalized: string) => normalized.split(/\s+/).filter(Boolean).length <= 4

const resolveThemeFollowUp = (normalized: string, context?: ConversationContext) => {
    if (context?.lastIntent !== 'change_theme' && context?.lastAction !== 'change_theme') return null
    if (!isShortFollowUpText(normalized)) return null
    const preset = findThemePreset(normalized)
    if (preset) return preset
    if (/\b(toi hon|dam hon|dark hon)\b/.test(normalized)) return { themeName: 'black', color: '#111827' }
    if (/\b(sang hon|nhat hon|light hon)\b/.test(normalized)) return { themeName: 'white', color: '#ffffff' }
    if (/\b(dep hon|ngau hon|noi hon|chat hon)\b/.test(normalized)) return { themeName: 'cyberpunk', color: '#ff00ff' }
    return null
}

const getThemeCommand = (text: string, context?: ConversationContext): { color: string; message: string; themeName: string } | null => {
    const normalized = normalizeCommandText(text)
    const preset = findThemePreset(normalized)
    const followUpPreset = resolveThemeFollowUp(normalized, context)
    const hasChangeVerb = /\b(doi|thay|set|chuyen|change|apply|ap dung|cap nhat|chon|lam)\b/.test(normalized)
    const hasThemeTerm = /\b(mau|theme|giao dien|web|accent|color|tone|tong|nen|mode|ui|system|dark|light)\b/.test(normalized)
    const isStandaloneTone = preset
        ? preset.themeName !== 'gym_dark' && preset.keywords.some((keyword) => normalized.trim() === keyword)
        : false
    const isThemeIntent = isStandaloneTone
        || Boolean(followUpPreset)
        || (hasChangeVerb && (hasThemeTerm || Boolean(preset)))
        || (hasThemeTerm && Boolean(preset))

    if (!isThemeIntent) return null

    const resetIntent = /\b(mac dinh|default|reset|khoi phuc)\b/.test(normalized)
    const hex = normalizeHexColor(text.match(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/)?.[0] || '')

    if (hex) {
        return {
            themeName: 'custom',
            color: hex,
            message: buildThemeActionMessage('custom'),
        }
    }

    if (resetIntent) {
        return {
            themeName: 'default',
            color: DEFAULT_THEME_COMMAND_COLOR,
            message: buildThemeActionMessage('default'),
        }
    }

    const resolved = followUpPreset || preset || { themeName: 'gym_dark', color: '#991b1b' }

    return {
        themeName: resolved.themeName,
        color: resolved.color,
        message: buildThemeActionMessage(resolved.themeName),
    }
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
    return parts.map((part, index) => {
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
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
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
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
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

const renderWebSourceCards = (sources: WebSearchResult[], dark: boolean) => {
    const uniqueSources = sources
        .filter((source) => /^https:\/\//i.test(source.url || '') && getSourceDomain(source.url))
        .filter((source, index, list) => list.findIndex((item) => item.url === source.url) === index)
        .slice(0, 5)

    if (uniqueSources.length === 0) return null

    return (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            {uniqueSources.map((source) => {
                const domain = getSourceDomain(source.url)
                const name = getSourceName(source)
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

const getStorageKey = (userId?: string) => `${STORAGE_KEY_PREFIX}${userId ?? 'guest'}`

const loadChatState = (storageKey: string): StoredChatState => {
    try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return { sessions: [] }
        const parsed = JSON.parse(raw)
        const sessions = Array.isArray(parsed.sessions)
            ? normalizeChatSessions(parsed.sessions)
            : []
        return {
            sessions,
            activeSessionId: typeof parsed.activeSessionId === 'string' ? parsed.activeSessionId : undefined,
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

const normalizeChatMessage = (message: ChatMessage): ChatMessage => ({
    ...message,
    content: normalizeChatContent(message.content),
})

const normalizeChatSessions = (sessions: ChatSession[]) =>
    sessions.map((session) => ({
        ...session,
        messages: Array.isArray(session.messages)
            ? session.messages.map(normalizeChatMessage)
            : [],
    }))

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

const buildConversationContext = (messages: ChatMessage[], currentMode: AiMode): ConversationContext => {
    const recentMessages = messages.slice(-12).map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        intent: message.intent,
        action: message.action,
    }))
    const context: ConversationContext = {
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
        if (message.action && !context.lastAction) context.lastAction = message.action
        if (message.role === 'user' && !context.lastSearchQuery) {
            const productTopic = getProductTopicFromText(message.content)
            if (productTopic) {
                context.lastSearchQuery = message.content
                context.lastProduct = productTopic
            }
        }
        if (context.lastIntent && context.lastSearchQuery && context.lastThemeAction) break
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
    const navigate = useNavigate()
    const [visible, setVisible] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string>('')
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [aiActionLoading, setAiActionLoading] = useState(false)
    const [activeAiTool, setActiveAiTool] = useState('')
    const [errorInfo, setErrorInfo] = useState<{ code: number; message: string } | null>(null)
    const [retryCountdown, setRetryCountdown] = useState(0)
    const [lastQuery, setLastQuery] = useState('')
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
    const [editingTitle, setEditingTitle] = useState('')
    const [mode, setMode] = useState<AiMode>('gym')
    const scrollRef = useRef<HTMLDivElement>(null)
    const hydratedServerHistoryRef = useRef('')
    const streamTextBufferRef = useRef('')
    const streamTypingTimerRef = useRef<number | null>(null)
    const streamTargetMessageIdRef = useRef('')
    const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false)
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
                if (Array.isArray(data.sessions) && data.sessions.length > 0) {
                    const normalizedSessions = normalizeChatSessions(data.sessions)
                    setSessions(normalizedSessions)
                    setActiveSessionId(data.activeSessionId || normalizedSessions[0].sessionId)
                    saveChatState(storageKey, {
                        sessions: normalizedSessions,
                        activeSessionId: data.activeSessionId || normalizedSessions[0].sessionId,
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
        const element = scrollRef.current
        if (element) element.scrollTop = element.scrollHeight
    }, [sessions, visible])

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
                    messages: [...session.messages, safeMessage],
                }
            })
        )
    }

    const updateMessageInSession = (messageId: string, updater: (message: ChatMessage) => ChatMessage) => {
        setSessions((current) =>
            current.map((session) => ({
                ...session,
                messages: session.messages.map((message) =>
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
            title: 'Xóa cuộc trò chuyện',
            content: 'Bạn có chắc muốn xóa cuộc trò chuyện này không?',
            okText: 'Xóa',
            cancelText: 'Hủy',
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

    const handleSend = async (messageText?: string) => {
        const trimmed = (messageText ?? query).trim()
        if (!trimmed) return
        const userMessage: ChatMessage = {
            id: `${Date.now()}-user`,
            userId: user?._id ?? 'guest',
            role: 'user',
            content: trimmed,
            createdAt: new Date().toISOString(),
        }
        addMessageToSession(userMessage)
        setLastQuery(trimmed)
        setQuery('')
        const conversationContext = buildConversationContext(activeMessages, mode)
        const themeCommand = getThemeCommand(trimmed, conversationContext)
        if (themeCommand) {
            const assistantMessage: ChatMessage = {
                id: `${Date.now()}-assistant`,
                userId: user?._id ?? 'guest',
                role: 'assistant',
                content: themeCommand.message,
                intent: 'change_theme',
                action: 'change_theme',
                createdAt: new Date().toISOString(),
            }
            if (themeCommand.color) applyTheme(themeCommand.color)
            addMessageToSession(assistantMessage)
            setLoading(false)
            setErrorInfo(null)
            return
        }
        setLoading(true)
        setAiActionLoading(mode === 'gym')
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
            const response = await requestAiAssistantStream(trimmed, mode, {
                conversationContext,
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
                const fallbackResponse = await requestAiAssistant(trimmed, mode, conversationContext)
                const fallbackContent = extractAiResponseContent(fallbackResponse)
                const fallbackSplit = splitAiAssistantResponse(fallbackContent)
                const fallbackAction = fallbackSplit.actionPayload
                if (fallbackAction) executeAiAction(fallbackAction)
                setAiActionLoading(false)
                updateMessageInSession(assistantMessageId, (message) => ({
                    ...message,
                    content: fallbackContent
                        ? fallbackSplit.chatContent
                        : 'Mình không có câu trả lời cho câu hỏi này.',
                    intent: fallbackAction?.action,
                    action: fallbackAction?.action,
                    webSearch: fallbackResponse.webSearch,
                }))
                return
            }

            const responseContent = extractAiResponseContent(response, suppressedActionText)
            const splitResponse = splitAiAssistantResponse(responseContent, suppressedActionText)
            const actionPayload = splitResponse.actionPayload
            if (actionPayload) executeAiAction(actionPayload)

            if (responseContent) {
                await waitForStreamTypingDrain()
                setAiActionLoading(false)
                updateMessageInSession(assistantMessageId, (message) => ({
                    ...message,
                    content: splitResponse.chatContent
                        ? splitResponse.chatContent
                        : message.content,
                    intent: actionPayload?.action,
                    action: actionPayload?.action,
                    webSearch: response.webSearch,
                }))
            } else {
                await waitForStreamTypingDrain()
                setAiActionLoading(false)
                updateMessageInSession(assistantMessageId, (message) => ({
                    ...message,
                    content: splitResponse.chatContent
                        ? splitResponse.chatContent
                        : message.content || 'Mình không có câu trả lời cho câu hỏi này.',
                    intent: actionPayload?.action,
                    action: actionPayload?.action,
                    webSearch: response.webSearch,
                }))
            }
        } catch (error: any) {
            setAiActionLoading(false)
            const errMsg = error?.userMessage || 'Có lỗi khi gọi AI. Vui lòng thử lại.'
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
    const panelWidth = compactChat ? 'min(350px, calc(100vw - 24px))' : expanded ? 760 : 560
    const panelHeight = compactChat ? 'min(560px, calc(100vh - 140px))' : expanded ? 760 : 560
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
    const assistantBubbleBackground = tokens.elevated
    const inputBackground = 'color-mix(in srgb, var(--theme-elevated) 80%, transparent)'
    const inputBorder = 'var(--theme-accent-border)'
    const mascotCursor = 'pointer'
    const panelAlignRight = draggableChatPosition.x > viewport.width / 2

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
                                                {new Date(session.createdAt).toLocaleString('vi-VN')}
                                            </Typography.Text>
                                        </div>
                                        <Dropdown
                                            trigger={['click']}
                                            menu={{
                                                items: [
                                                    { key: 'rename', icon: <EditOutlined />, label: 'Đổi tên' },
                                                    { key: 'delete', icon: <DeleteOutlined />, label: 'Xóa', danger: true },
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
                    background: var(--theme-accent) !important;
                    color: var(--theme-button-text) !important;
                    border: none !important;
                }
                .ai-chat-panel .ant-segmented-thumb {
                    background: var(--theme-accent) !important;
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
                    touchAction: 'none',
                }}
            >
                <div className="ai-chat-wrapper" style={{ touchAction: 'none' }}>
                    {/* MASCOT BUTTON */}
                    <Tooltip placement="left">
                        <button
                            type="button"
                            className={`doraemon-chat-trigger ${visible ? 'is-active' : ''}`}
                            aria-label="Chat với AI"
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
                        className="ai-chat-panel ai-chat-popup"
                        onClick={handleFloatingWidgetClick}
                        style={{
                            left: panelAlignRight ? 'auto' : 0,
                            right: panelAlignRight ? 0 : 'auto',
                            width: panelWidth,
                            maxWidth: compactChat ? 'calc(100vw - 24px)' : 'calc(100vw - 48px)',
                            height: panelHeight,
                            maxHeight: compactChat ? 'calc(100vh - 140px)' : 'calc(100vh - 48px)',
                            zIndex: 11010,
                            // Chat panel must float above the member header/menu.
                            borderRadius: 16,
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
                            position: 'absolute',
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
                                    background: 'var(--theme-accent)',
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
                                        Gì cũng biết! Tò mò hỏi Doraemon
                                    </Typography.Title>
                                    {mode === 'gym' && (
                                        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                            <span style={{
                                                background: 'var(--theme-accent-muted)',
                                                color: 'var(--theme-button-text)',
                                                border: '1px solid var(--theme-accent-border)',
                                                borderRadius: 999,
                                                padding: '2px 8px',
                                                fontSize: 11,
                                                fontWeight: 700,
                                            }}>
                                                Gym Assistant
                                            </span>
                                            <span style={{
                                                background: 'var(--theme-accent-muted)',
                                                color: 'var(--theme-button-text)',
                                                border: '1px solid var(--theme-accent-border)',
                                                borderRadius: 999,
                                                padding: '2px 8px',
                                                fontSize: 11,
                                                fontWeight: 700,
                                            }}>
                                                AI Action
                                            </span>
                                        </div>
                                    )}
                                    {!mobileChat && (
                                        <Typography.Text style={{ color: 'var(--theme-button-text)', fontSize: 12 }}>
                                            Chồn đến từ thế kỉ 22
                                        </Typography.Text>
                                    )}
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
                                            Phiên ({sessions.length})
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

                            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

                                {/* SIDEBAR (desktop only) */}
                                {showSessionSidebar && (
                                    <div style={{
                                        width: 220,
                                        minWidth: 220,
                                        borderRight: panelBorder,
                                        background: panelBandBackground,
                                        backdropFilter: 'blur(12px)',
                                        WebkitBackdropFilter: 'blur(12px)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        overflow: 'hidden',
                                    }}>
                                        <div
                                            style={{
                                                padding: '12px 14px',
                                                borderBottom: panelBorder,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 8,
                                            }}
                                        >
                                            <Typography.Text strong style={{ color: panelText }}>Phiên chat</Typography.Text>
                                            <Button
                                                size="small"
                                                type="text"
                                                icon={<PlusOutlined />}
                                                style={{
                                                    color: 'var(--theme-accent)',
                                                    background: 'var(--theme-accent-muted)',
                                                    border: '1px solid var(--theme-accent-border)',
                                                    borderRadius: 6,
                                                }}
                                                onClick={createNewChat}
                                            />
                                        </div>
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
                                                                                { key: 'rename', icon: <EditOutlined />, label: 'Đổi tên' },
                                                                                { key: 'delete', icon: <DeleteOutlined />, label: 'Xóa', danger: true },
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
                                                            {new Date(session.createdAt).toLocaleString('vi-VN')}
                                                        </Typography.Text>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* MAIN CHAT AREA */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>

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
                                                {activeSession?.title || 'New Chat'}
                                            </Typography.Text>
                                            <Typography.Text style={{ fontSize: 11, color: panelMutedText }}>
                                                {activeSession?.messages.length
                                                    ? `${activeSession.messages.length} tin nhắn`
                                                    : 'Bắt đầu cuộc trò chuyện mới'}
                                            </Typography.Text>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                            <Segmented
                                                value={mode}
                                                onChange={(value) => setMode(value as AiMode)}
                                                options={AI_MODE_OPTIONS}
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
                                            <div style={{ textAlign: 'center', marginTop: 32 }}>
                                                <Typography.Text style={{ color: panelMutedText }}>
                                                    Viết câu hỏi, sau đó nhấn gửi để bắt đầu.
                                                </Typography.Text>
                                            </div>
                                        ) : (
                                            activeMessages.map((message) => {
                                                const isUser = message.role === 'user'
                                                const messageContent = normalizeChatContent(message.content)
                                                const bubbleBg = isUser ? 'var(--theme-accent)' : assistantBubbleBackground
                                                const bubbleColor = isUser ? 'var(--theme-button-text)' : panelText
                                                const toolPayload = !isUser && message.role === 'assistant'
                                                    ? parseAiToolPayload(messageContent)
                                                    : null
                                                const actionPayload = !isUser && message.role === 'assistant'
                                                    ? parseAiActionPayload(messageContent)
                                                    : null
                                                const sourceCards = !isUser
                                                    ? (message.webSearch?.results?.length
                                                        ? message.webSearch.results
                                                        : extractSourceResultsFromText(messageContent))
                                                    : []
                                                const safeAssistantContent = !isUser
                                                    ? getSafeAssistantDisplayContent(messageContent, actionPayload)
                                                    : messageContent
                                                const visibleContent = isUser
                                                    ? messageContent
                                                    : safeAssistantContent !== messageContent
                                                        ? safeAssistantContent
                                                        : sourceCards.length > 0
                                                            ? stripWebSourceSection(messageContent)
                                                            : safeAssistantContent
                                                return (
                                                    <div
                                                        key={message.id}
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent: isUser ? 'flex-end' : 'flex-start',
                                                            marginBottom: 10,
                                                        }}
                                                    >
                                                        <div style={{
                                                            maxWidth: mobileChat ? '92%' : '78%',
                                                            padding: mobileChat ? '9px 12px' : '12px 16px',
                                                            borderRadius: 20,
                                                            borderTopRightRadius: isUser ? 4 : 20,
                                                            borderTopLeftRadius: isUser ? 20 : 4,
                                                            background: bubbleBg,
                                                            color: bubbleColor,
                                                            boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                                                            whiteSpace: 'pre-wrap',
                                                            lineHeight: 1.6,
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
                                                                {toolPayload?.type === 'empty' && (
                                                                    <Typography.Text style={{ color: bubbleColor }}>{toolPayload.message}</Typography.Text>
                                                                )}
                                                                {toolPayload?.type === 'product_list' && (
                                                                    <div style={{ display: 'grid', gap: 10 }}>
                                                                        {toolPayload.message && (
                                                                            <Typography.Text style={{ color: bubbleColor }}>{toolPayload.message}</Typography.Text>
                                                                        )}
                                                                        {toolPayload.items.map((item, index) => (
                                                                            <a
                                                                                key={`${item.link}-${index}`}
                                                                                href={item.link}
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
                                                                                <img src={item.image || AI_AVATAR_IMAGE} alt={item.name}
                                                                                    style={{ width: 54, height: 54, borderRadius: 10, objectFit: 'cover' }} />
                                                                                <div style={{ minWidth: 0 }}>
                                                                                    <Typography.Text strong style={{ color: bubbleColor, display: 'block' }}>
                                                                                        {item.name}
                                                                                    </Typography.Text>
                                                                                    <Typography.Text style={{ color: 'var(--theme-accent)' }}>
                                                                                        {Number(item.price).toLocaleString('vi-VN')}đ
                                                                                    </Typography.Text>
                                                                                    {item.selectedVariant && (
                                                                                        <Typography.Text style={{ color: bubbleColor, display: 'block', fontSize: 12 }}>
                                                                                            Mức tạ tối đa: {item.selectedVariant}
                                                                                        </Typography.Text>
                                                                                    )}
                                                                                </div>
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {toolPayload?.type === 'category_list' && (
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                                        {toolPayload.items.map((item) => (
                                                                            <a
                                                                                key={item.slug}
                                                                                href={`/store?category=${encodeURIComponent(item.name)}`}
                                                                                style={{
                                                                                    padding: '7px 10px',
                                                                                    borderRadius: 999,
                                                                                    background: 'var(--theme-elevated)',
                                                                                    color: bubbleColor,
                                                                                    textDecoration: 'none',
                                                                                    fontSize: 13,
                                                                                }}
                                                                            >
                                                                                {item.name}
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {toolPayload?.type === 'pt_list' && (
                                                                    <div style={{ display: 'grid', gap: 10 }}>
                                                                        {toolPayload.items.map((item, index) => (
                                                                            <div
                                                                                key={`${item.email || item.phone || item.name}-${index}`}
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
                                                                                <Avatar src={item.avatar || undefined} size={44}>
                                                                                    {item.name?.charAt(0) || 'PT'}
                                                                                </Avatar>
                                                                                <div style={{ minWidth: 0 }}>
                                                                                    <Typography.Text strong style={{ color: bubbleColor, display: 'block' }}>
                                                                                        {item.name}
                                                                                    </Typography.Text>
                                                                                    <Typography.Text style={{ color: bubbleColor, display: 'block', fontSize: 12 }}>
                                                                                        {item.specialty || 'Huấn luyện viên'}
                                                                                    </Typography.Text>
                                                                                    <Typography.Text style={{ color: panelMutedText, display: 'block', fontSize: 12 }}>
                                                                                        {item.phone || 'Chưa có SĐT'} {item.email ? `• ${item.email}` : ''}
                                                                                    </Typography.Text>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {!toolPayload && (
                                                                    visibleContent
                                                                        ? renderMarkdownText(visibleContent, bubbleColor)
                                                                        : <Typography.Text style={{ color: panelMutedText }}>Đang trả lời...</Typography.Text>
                                                                )}
                                                                {!toolPayload && !actionPayload && sourceCards.length > 0 && renderWebSourceCards(sourceCards, dark)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}
                                        {loading && (
                                            <div style={{ textAlign: 'center', marginTop: 14 }}>
                                                <Spin />
                                                {aiActionLoading && (
                                                    <div style={{ marginTop: 8 }}>
                                                        <Typography.Text style={{ color: 'var(--theme-muted)', fontSize: 12 }}>
                                                            AI Action đang gọi dữ liệu GymPro{activeAiTool ? `: ${activeAiTool}` : ''}
                                                        </Typography.Text>
                                                    </div>
                                                )}
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
                                                    style={{ background: 'var(--theme-accent)', borderColor: 'var(--theme-accent)', color: 'var(--theme-text)' }}
                                                >
                                                    {retryCountdown > 0 ? `Thử lại sau ${retryCountdown}s` : 'Thử lại'}
                                                </Button>
                                            </div>
                                        )}
                                        <Input.TextArea
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            onPressEnter={(e) => {
                                                if (!e.shiftKey) { e.preventDefault(); handleSend() }
                                            }}
                                            placeholder="Nhập câu hỏi..."
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
                                                    Enter để gửi · Shift+Enter xuống dòng
                                                </Typography.Text>
                                            )}
                                            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                                                <Button
                                                    type="text"
                                                    size={mobileChat ? 'small' : 'middle'}
                                                    onClick={createNewChat}
                                                    style={{ color: panelText }}
                                                >
                                                    Mới
                                                </Button>
                                                <Button
                                                    icon={<SendOutlined />}
                                                    size={mobileChat ? 'small' : 'middle'}
                                                    onClick={() => handleSend()}
                                                    loading={loading}
                                                    style={{ background: 'var(--theme-accent)', color: 'var(--theme-button-text)', border: 'none' }}
                                                >
                                                    Gửi
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
                        <span>Phiên chat</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Badge count={sessions.length} color="var(--theme-accent)" />
                            <Button
                                size="small"
                                type="text"
                                icon={<PlusOutlined />}
                                style={{
                                    color: 'var(--theme-accent)',
                                    background: 'var(--theme-accent-muted)',
                                    border: '1px solid var(--theme-accent-border)',
                                    borderRadius: 6,
                                }}
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


