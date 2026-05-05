import { CloseOutlined, DeleteOutlined, EditOutlined, ExpandAltOutlined, MoreOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons'
import { Avatar, Badge, Button, Drawer, Dropdown, Input, Modal, Segmented, Select, Space, Spin, Tooltip, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useTheme } from '../../context/ThemeProvider'
import { useAuth } from '../../hook/useAuth'
import { deleteAiChatSession, getAiChatHistory, renameAiChatSession, requestAiAssistant, saveAiChatHistory, type AiMode } from '../../services/aiService'

const STORAGE_KEY_PREFIX = 'chat_history_'
const MASCOT_POSITION_KEY = 'doraemon_chat_position'
const MASCOT_WIDTH = 88
const MASCOT_HEIGHT = 112
const VIEWPORT_PADDING = 10
const CHAT_PANEL_BACKGROUND_IMAGE = 'https://genk.mediacdn.vn/2019/7/3/photo-1-1562129061617297549771.jpg'
const AI_AVATAR_IMAGE = 'https://vcdn1-giaitri.vnecdn.net/2023/04/28/doraemon4-1682675790-8961-1682675801.jpg?w=500&h=300&q=100&dpr=1&fit=crop&s=3dxqum5l0xkhHX-R0z_a1g'

const AI_MODE_OPTIONS: { label: string; value: AiMode }[] = [
    { label: 'Gym', value: 'gym' },
    { label: 'Tất cả', value: 'general' },
]

type ChatMessage = {
    id: string
    userId: string
    role: 'user' | 'assistant' | 'system'
    content: string
    createdAt: string
}

type StoredChatState = {
    sessions: ChatSession[]
    activeSessionId?: string
}

type ChatSession = {
    sessionId: string
    title: string
    createdAt: string
    messages: ChatMessage[]
}

type MascotPosition = {
    x: number
    y: number
}

type DragState = {
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
}

type AiToolPayload =
    | {
        type: 'product_list'
        items: { name: string; price: number; image: string; link: string; selectedVariant?: string }[]
        message?: string
    }
    | {
        type: 'pt_list'
        items: { name: string; avatar: string; phone: string; email: string; specialty: string }[]
    }
    | {
        type: 'category_list'
        items: { name: string; slug: string }[]
    }
    | {
        type: 'empty'
        message: string
    }

const parseAiToolPayload = (content: string): AiToolPayload | null => {
    try {
        const parsed = JSON.parse(content)
        if (parsed?.type === 'product_list' && Array.isArray(parsed.items)) return parsed
        if (parsed?.type === 'pt_list' && Array.isArray(parsed.items)) return parsed
        if (parsed?.type === 'category_list' && Array.isArray(parsed.items)) return parsed
        if (parsed?.type === 'empty' && typeof parsed.message === 'string') return parsed
        return null
    } catch {
        return null
    }
}

const clamp = (value: number, min: number, max: number) => {
    if (max < min) return min
    return Math.min(Math.max(value, min), max)
}

const getDefaultMascotPosition = (): MascotPosition => ({
    x: Math.max(VIEWPORT_PADDING, window.innerWidth - MASCOT_WIDTH - 24),
    y: Math.max(VIEWPORT_PADDING, window.innerHeight - MASCOT_HEIGHT - 24),
})

const loadMascotPosition = (): MascotPosition => {
    try {
        const raw = localStorage.getItem(MASCOT_POSITION_KEY)
        if (!raw) return getDefaultMascotPosition()
        const parsed = JSON.parse(raw)
        return {
            x: Number(parsed.x) || getDefaultMascotPosition().x,
            y: Number(parsed.y) || getDefaultMascotPosition().y,
        }
    } catch {
        return getDefaultMascotPosition()
    }
}

const saveMascotPosition = (position: MascotPosition) => {
    try {
        localStorage.setItem(MASCOT_POSITION_KEY, JSON.stringify(position))
    } catch {}
}

const clampMascotPosition = (position: MascotPosition): MascotPosition => ({
    x: clamp(position.x, VIEWPORT_PADDING, window.innerWidth - MASCOT_WIDTH - VIEWPORT_PADDING),
    y: clamp(position.y, VIEWPORT_PADDING, window.innerHeight - MASCOT_HEIGHT - VIEWPORT_PADDING),
})

const getStorageKey = (userId?: string) => `${STORAGE_KEY_PREFIX}${userId ?? 'guest'}`

const loadChatState = (storageKey: string): StoredChatState => {
    try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return { sessions: [] }
        const parsed = JSON.parse(raw)
        return {
            sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
            activeSessionId: typeof parsed.activeSessionId === 'string' ? parsed.activeSessionId : undefined,
        }
    } catch {
        return { sessions: [] }
    }
}

const saveChatState = (storageKey: string, state: StoredChatState) => {
    try {
        localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {}
}

const createSession = (): ChatSession => ({
    sessionId: `session-${Date.now()}`,
    title: 'New Chat',
    createdAt: new Date().toISOString(),
    messages: [],
})

const getSessionTitle = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return 'New Chat'
    return trimmed.length > 30 ? `${trimmed.slice(0, 30)}...` : trimmed
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
    } catch {}
}

const DoraemonChatMascot = ({ active }: { active: boolean }) => (
    <div className={`doraemon-chat-mascot ${active ? 'is-active' : ''}`}>
        <svg viewBox="0 0 140 180" role="img" aria-label="Doraemon chat assistant">
            <defs>
                <radialGradient id="doraemonBlue" cx="35%" cy="25%" r="75%">
                    <stop offset="0%" stopColor="#58d7ff" />
                    <stop offset="58%" stopColor="#0aa7e6" />
                    <stop offset="100%" stopColor="#067bb7" />
                </radialGradient>
                <radialGradient id="doraemonWhite" cx="35%" cy="25%" r="70%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#edf8ff" />
                </radialGradient>
                <filter id="doraemonSoftShadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#00435c" floodOpacity="0.25" />
                </filter>
            </defs>
            <ellipse cx="70" cy="169" rx="42" ry="8" fill="rgba(0,50,80,0.18)" />
            <g className="mascot-body" filter="url(#doraemonSoftShadow)">
                <circle cx="70" cy="55" r="42" fill="url(#doraemonBlue)" />
                <ellipse cx="70" cy="66" rx="33" ry="30" fill="url(#doraemonWhite)" />
                <ellipse cx="70" cy="120" rx="34" ry="43" fill="url(#doraemonBlue)" />
                <ellipse cx="70" cy="121" rx="25" ry="31" fill="url(#doraemonWhite)" />
                <g className="mascot-left-arm">
                    <path d="M39 105 C20 111 17 132 32 138 C45 143 53 129 50 114" fill="#0aa7e6" stroke="#066b9c" strokeWidth="2.4" />
                    <circle cx="31" cy="139" r="10" fill="#fff" stroke="#066b9c" strokeWidth="2.2" />
                </g>
                <g className="mascot-right-arm">
                    <path d="M99 103 C119 92 126 74 117 66 C108 58 96 78 93 98" fill="#0aa7e6" stroke="#066b9c" strokeWidth="2.4" />
                    <circle cx="118" cy="65" r="10" fill="#fff" stroke="#066b9c" strokeWidth="2.2" />
                </g>
                <ellipse cx="55" cy="44" rx="10" ry="13" fill="#fff" stroke="#0d587b" strokeWidth="2" />
                <ellipse cx="85" cy="44" rx="10" ry="13" fill="#fff" stroke="#0d587b" strokeWidth="2" />
                <circle className="mascot-eye" cx="59" cy="47" r="3.3" fill="#151515" />
                <circle className="mascot-eye" cx="81" cy="47" r="3.3" fill="#151515" />
                <circle cx="70" cy="55" r="5.5" fill="#e62635" stroke="#94131c" strokeWidth="1.5" />
                <path d="M70 61 L70 75" stroke="#222" strokeWidth="2" strokeLinecap="round" />
                <path className="mascot-mouth-idle" d="M57 74 Q70 83 83 74" fill="none" stroke="#222" strokeWidth="2.4" strokeLinecap="round" />
                <path className="mascot-mouth-happy" d="M54 72 Q70 94 86 72 Q70 82 54 72" fill="#e94455" stroke="#222" strokeWidth="2" strokeLinejoin="round" />
                <path d="M38 60 L59 63" stroke="#222" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M37 70 L59 68" stroke="#222" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M39 80 L60 73" stroke="#222" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M102 60 L81 63" stroke="#222" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M103 70 L81 68" stroke="#222" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M101 80 L80 73" stroke="#222" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M38 91 H102" stroke="#d8232f" strokeWidth="5" strokeLinecap="round" />
                <circle cx="70" cy="96" r="7" fill="#ffd43b" stroke="#9a6a00" strokeWidth="2" />
                <path d="M65 95 H75" stroke="#9a6a00" strokeWidth="1.6" />
                <path d="M70 98 V103" stroke="#9a6a00" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M48 118 H92" stroke="#202020" strokeWidth="2" strokeLinecap="round" />
                <path d="M52 118 C54 135 86 135 88 118 Z" fill="#fff" stroke="#202020" strokeWidth="2" />
                <path d="M40 156 C46 145 62 146 65 160 C58 168 45 168 35 164 C35 160 37 158 40 156 Z" fill="#fff" stroke="#066b9c" strokeWidth="2.4" />
                <path d="M100 156 C94 145 78 146 75 160 C82 168 95 168 105 164 C105 160 103 158 100 156 Z" fill="#fff" stroke="#066b9c" strokeWidth="2.4" />
            </g>
        </svg>
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
    const { dark } = useTheme()
    const { user } = useAuth()
    const [visible, setVisible] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string>('')
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [errorInfo, setErrorInfo] = useState<{ code: number; message: string } | null>(null)
    const [retryCountdown, setRetryCountdown] = useState(0)
    const [lastQuery, setLastQuery] = useState('')
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
    const [editingTitle, setEditingTitle] = useState('')
    const [mode, setMode] = useState<AiMode>('gym')
    const scrollRef = useRef<HTMLDivElement>(null)
    const dragStateRef = useRef<DragState | null>(null)
    const hydratedServerHistoryRef = useRef('')
    const [mascotPosition, setMascotPosition] = useState<MascotPosition | null>(null)
    const [isDraggingMascot, setIsDraggingMascot] = useState(false)
    const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false)
    const [viewport, setViewport] = useState(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
    }))

    const storageKey = getStorageKey(user?._id)

    useEffect(() => {
        const initialPosition = clampMascotPosition(loadMascotPosition())
        setMascotPosition(initialPosition)
        const handleResize = () => {
            setViewport({ width: window.innerWidth, height: window.innerHeight })
            setMascotPosition((current) => {
                const next = clampMascotPosition(current || getDefaultMascotPosition())
                saveMascotPosition(next)
                return next
            })
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
                    setSessions(data.sessions)
                    setActiveSessionId(data.activeSessionId || data.sessions[0].sessionId)
                    saveChatState(storageKey, {
                        sessions: data.sessions,
                        activeSessionId: data.activeSessionId || data.sessions[0].sessionId,
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
            saveAiChatHistory({ sessions, activeSessionId }).catch(() => {})
        }, 450)
        return () => window.clearTimeout(timer)
    }, [sessions, activeSessionId, user?._id])

    useEffect(() => {
        if (!visible) return
        const element = scrollRef.current
        if (element) element.scrollTop = element.scrollHeight
    }, [sessions, visible])

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>
        if (retryCountdown > 0) timer = setTimeout(() => setRetryCountdown(retryCountdown - 1), 1000)
        return () => { if (timer) clearTimeout(timer) }
    }, [retryCountdown])

    const activeSession = sessions.find((s) => s.sessionId === activeSessionId) || sessions[0]
    const activeMessages = activeSession?.messages || []

    const addMessageToSession = (message: ChatMessage) => {
        if (!activeSession) return
        setSessions((current) =>
            current.map((session) => {
                if (session.sessionId !== activeSession.sessionId) return session
                return {
                    ...session,
                    title: session.title === 'New Chat' && message.role === 'user'
                        ? getSessionTitle(message.content)
                        : session.title,
                    messages: [...session.messages, message],
                }
            })
        )
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
            }).catch(() => {})
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
            onOk: () => deleteSession(sessionId),
        })
    }

    const toggleWidget = () => {
        playDoraemonClickSound()
        if (!visible) { setVisible(true); setExpanded(true); return }
        if (!expanded) { setExpanded(true); return }
        setVisible(false); setExpanded(false)
    }

    const handleMascotPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (!mascotPosition) return
        event.currentTarget.setPointerCapture(event.pointerId)
        dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: mascotPosition.x,
            originY: mascotPosition.y,
            moved: false,
        }
        setIsDraggingMascot(true)
    }

    const handleMascotPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
        const drag = dragStateRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        const deltaX = event.clientX - drag.startX
        const deltaY = event.clientY - drag.startY
        if (Math.abs(deltaX) + Math.abs(deltaY) > 4) drag.moved = true
        const next = clampMascotPosition({ x: drag.originX + deltaX, y: drag.originY + deltaY })
        setMascotPosition(next)
    }

    const handleMascotPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
        const drag = dragStateRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        const finalPosition = clampMascotPosition(mascotPosition || getDefaultMascotPosition())
        setMascotPosition(finalPosition)
        saveMascotPosition(finalPosition)
        setIsDraggingMascot(false)
        dragStateRef.current = null
        if (!drag.moved) toggleWidget()
    }

    const handleMascotPointerCancel = () => {
        if (mascotPosition) saveMascotPosition(clampMascotPosition(mascotPosition))
        setIsDraggingMascot(false)
        dragStateRef.current = null
    }

    const closeWidget = () => {
        setVisible(false)
        setExpanded(false)
        setErrorInfo(null)
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
        setLoading(true)
        setErrorInfo(null)
        try {
            const response = await requestAiAssistant(trimmed, mode)
            const assistantMessage: ChatMessage = {
                id: `${Date.now()}-assistant`,
                userId: user?._id ?? 'guest',
                role: 'assistant',
                content: response.answer || 'Mình không có câu trả lời cho câu hỏi này.',
                createdAt: new Date().toISOString(),
            }
            addMessageToSession(assistantMessage)
        } catch (error: any) {
            const errMsg = error?.userMessage || 'Có lỗi khi gọi AI. Vui lòng thử lại.'
            if (error?.code === 429) setRetryCountdown(4)
            setErrorInfo({ code: error?.code || 500, message: errMsg })
            addMessageToSession({
                id: `${Date.now()}-assistant-error`,
                userId: user?._id ?? 'guest',
                role: 'system',
                content: errMsg,
                createdAt: new Date().toISOString(),
            })
        } finally {
            setLoading(false)
        }
    }

    // ─── Layout calculations ───────────────────────────────────────────────────
    const compactChat = viewport.width <= 720
    const mobileChat = viewport.width <= 560
    const showSessionSidebar = expanded && !compactChat
    const panelWidth = compactChat ? Math.max(300, viewport.width - 20) : expanded ? 760 : 560
    const panelHeight = compactChat ? Math.max(420, viewport.height - 20) : expanded ? 760 : 560
    const panelBackground = dark ? 'rgba(17,19,24,0.86)' : 'rgba(255,255,255,0.94)'
    const panelBandBackground = dark ? 'rgba(13,17,25,0.70)' : 'rgba(255,255,255,0.80)'
    const panelTint = dark
        ? 'linear-gradient(135deg, rgba(10,10,15,0.82), rgba(20,22,30,0.64))'
        : 'linear-gradient(135deg, rgba(255,255,255,0.78), rgba(255,247,243,0.88))'
    const panelImageFilter = dark
        ? 'blur(12px) brightness(0.82) saturate(1.2) contrast(1.45)'
        : 'blur(12px) brightness(1.18) saturate(0.95) contrast(1.02)'
    const panelText = dark ? '#f3f3f3' : '#141414'
    const panelMutedText = dark ? '#d8d8d8' : '#666666'
    const panelBorder = dark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.10)'
    const assistantBubbleBackground = dark ? 'rgba(31,34,43,0.96)' : 'rgba(255,255,255,0.98)'
    const inputBackground = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.98)'
    const inputBorder = dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)'
    const resolvedMascotPosition = mascotPosition || {
        x: window.innerWidth - MASCOT_WIDTH - 24,
        y: window.innerHeight - MASCOT_HEIGHT - 24,
    }
    const panelLeft = compactChat
        ? 10
        : clamp(
            resolvedMascotPosition.x + MASCOT_WIDTH - panelWidth,
            12,
            viewport.width - Math.min(panelWidth, viewport.width - 24) - 12,
        )
    const preferredPanelTop = resolvedMascotPosition.y - panelHeight - 12
    const panelTop = compactChat
        ? 10
        : clamp(
            preferredPanelTop > 12 ? preferredPanelTop : resolvedMascotPosition.y + MASCOT_HEIGHT + 12,
            12,
            viewport.height - Math.min(panelHeight, viewport.height - 24) - 12,
        )

    // ─── Session list renderer (shared between sidebar & drawer) ──────────────
    const renderSessionList = () => (
        <>
            <div style={{ padding: 14, borderBottom: panelBorder }}>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    block
                    onClick={createNewChat}
                    style={{ background: '#b6462f', borderColor: '#b6462f' }}
                >
                    Cuộc trò chuyện mới
                </Button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {sessions.map((session) => (
                    <div
                        key={session.sessionId}
                        className="ai-chat-session-item"
                        onClick={() => selectSession(session.sessionId)}
                        style={{
                            padding: '12px 14px',
                            cursor: 'pointer',
                            borderLeft: session.sessionId === activeSession?.sessionId
                                ? '4px solid #b6462f'
                                : '4px solid transparent',
                            borderBottom: dark
                                ? '1px solid rgba(255,255,255,0.08)'
                                : '1px solid rgba(0,0,0,0.06)',
                            background: session.sessionId === activeSession?.sessionId
                                ? (dark ? 'rgba(182,70,47,0.18)' : 'rgba(182,70,47,0.08)')
                                : 'transparent',
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
                                        <Typography.Text strong style={{ color: panelText, display: 'block' }}>
                                            {session.title}
                                        </Typography.Text>
                                        <Typography.Text style={{ fontSize: 12, color: panelMutedText }}>
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
                ))}
            </div>
        </>
    )

    return (
        <>
            <style>{`
                .doraemon-chat-trigger {
                    position: fixed;
                    z-index: 9999;
                    width: ${MASCOT_WIDTH}px;
                    height: ${MASCOT_HEIGHT}px;
                    border: 0;
                    border-radius: 24px;
                    padding: 0;
                    background: transparent;
                    box-shadow: 0 0 0 4px rgba(255,255,255,0.16), 0 16px 34px rgba(0,116,170,0.4), 0 0 28px rgba(43,195,255,0.35);
                    cursor: pointer;
                    transform: translateZ(0);
                    transition: transform 180ms ease, filter 180ms ease, box-shadow 180ms ease;
                    touch-action: none;
                    user-select: none;
                    -webkit-user-select: none;
                }
                .doraemon-chat-trigger:hover,
                .doraemon-chat-trigger.is-active,
                .doraemon-chat-trigger.is-dragging {
                    transform: translateY(-4px) scale(1.05);
                    filter: saturate(1.08);
                    box-shadow: 0 0 0 4px rgba(255,255,255,0.2), 0 20px 44px rgba(0,116,170,0.48), 0 0 34px rgba(43,195,255,0.5);
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

                /* ── FIX: Drawer luôn nằm trên panel chat ── */
                .ai-session-drawer .ant-drawer-content-wrapper {
                    z-index: 10100 !important;
                }
                .ai-session-drawer .ant-drawer-mask {
                    z-index: 10099 !important;
                }
                /* Ant Design drawer z-index override */
                .ant-drawer.ai-session-drawer {
                    z-index: 10100 !important;
                }

                .ai-chat-session-actions {
                    opacity: 0;
                    transition: opacity 160ms ease;
                }
                .ai-chat-session-item:hover .ai-chat-session-actions,
                .ai-chat-session-actions.is-open { opacity: 1; }

                .ai-chat-panel textarea::placeholder {
                    color: ${dark ? 'rgba(255,255,255,0.48)' : 'rgba(0,0,0,0.42)'};
                }

                @media (max-width: 640px) {
                    .doraemon-chat-trigger { width: 72px; height: 92px; }
                    .doraemon-chat-mascot, .doraemon-chat-mascot svg { width: 72px; height: 92px; }
                }
            `}</style>

            {/* MASCOT BUTTON */}
            <Tooltip title="Nói chuyện với Doraemon" placement="left">
                <Badge count={sessions.length} offset={[-4, 8]} color="#b6462f">
                    <button
                        type="button"
                        className={`doraemon-chat-trigger ${visible ? 'is-active' : ''} ${isDraggingMascot ? 'is-dragging' : ''}`}
                        aria-label="Chat với AI"
                        style={{ left: resolvedMascotPosition.x, top: resolvedMascotPosition.y }}
                        onPointerDown={handleMascotPointerDown}
                        onPointerMove={handleMascotPointerMove}
                        onPointerUp={handleMascotPointerUp}
                        onPointerCancel={handleMascotPointerCancel}
                    >
                        <DoraemonChatMascot active={visible} />
                    </button>
                </Badge>
            </Tooltip>

            {/* CHAT PANEL */}
            <div
                className="ai-chat-panel"
                style={{
                    position: 'fixed',
                    left: panelLeft,
                    top: panelTop,
                    width: panelWidth,
                    maxWidth: compactChat ? 'calc(100vw - 20px)' : 'calc(100vw - 48px)',
                    height: panelHeight,
                    maxHeight: compactChat ? 'calc(100vh - 20px)' : 'calc(100vh - 48px)',
                    // FIX: z-index thấp hơn drawer (10100) để drawer hiện lên trên
                    zIndex: visible && compactChat ? 10000 : 1199,
                    borderRadius: compactChat ? 20 : 28,
                    background: panelBackground,
                    border: panelBorder,
                    boxShadow: visible
                        ? '0 28px 100px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.08)'
                        : '0 24px 80px rgba(0,0,0,0.18)',
                    transform: visible ? 'scale(1)' : 'scale(0.75)',
                    opacity: visible ? 1 : 0,
                    visibility: visible ? 'visible' : 'hidden',
                    transition: 'all 220ms ease',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    backdropFilter: 'blur(18px)',
                    WebkitBackdropFilter: 'blur(18px)',
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
                            opacity: dark ? 0.72 : 0.34,
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
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: mobileChat ? '12px 14px' : '16px 18px',
                        background: 'linear-gradient(135deg, #b6462f, #e8722a)',
                        color: '#fff',
                        flexShrink: 0,
                    }}>
                        <div style={{ minWidth: 0 }}>
                            <Typography.Title level={5} style={{ margin: 0, color: '#fff', fontSize: mobileChat ? 14 : 16 }}>
                                Gì cũng biết! Tò mò hỏi Doraemon
                            </Typography.Title>
                            {!mobileChat && (
                                <Typography.Text style={{ color: '#ffe0d6', fontSize: 12 }}>
                                    Chồn đến từ thế kỉ 22
                                </Typography.Text>
                            )}
                        </div>
                        <Space size={mobileChat ? 2 : 8} style={{ flexShrink: 0 }}>
                            <Button size="small" type="text" icon={<PlusOutlined />} style={{ color: '#fff' }} onClick={createNewChat} />
                            {/* FIX: Nút "Phiên" chỉ hiện trên mobile/tablet, mở drawer với z-index cao */}
                            {compactChat && (
                                <Button
                                    size="small"
                                    type="text"
                                    style={{ color: '#fff', fontWeight: 600 }}
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
                                    style={{ color: '#fff' }}
                                    onClick={() => setExpanded(!expanded)}
                                />
                            )}
                            <Button size="small" type="text" icon={<CloseOutlined />} style={{ color: '#fff' }} onClick={closeWidget} />
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
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                            }}>
                                <div style={{ padding: '12px 14px', borderBottom: panelBorder }}>
                                    <Typography.Text strong style={{ color: panelText }}>Phiên chat</Typography.Text>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                    {sessions.map((session) => (
                                        <div
                                            key={session.sessionId}
                                            className="ai-chat-session-item"
                                            onClick={() => selectSession(session.sessionId)}
                                            style={{
                                                padding: '12px 14px',
                                                cursor: 'pointer',
                                                borderLeft: session.sessionId === activeSession?.sessionId
                                                    ? '3px solid #b6462f'
                                                    : '3px solid transparent',
                                                background: session.sessionId === activeSession?.sessionId
                                                    ? (dark ? 'rgba(182,70,47,0.15)' : 'rgba(182,70,47,0.08)')
                                                    : 'transparent',
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
                                                        <Typography.Text strong style={{ color: panelText, flex: 1, fontSize: 13 }}>
                                                            {session.title}
                                                        </Typography.Text>
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
                                                    </div>
                                                )}
                                            </div>
                                            <Typography.Text style={{ fontSize: 11, color: panelMutedText }}>
                                                {new Date(session.createdAt).toLocaleString('vi-VN')}
                                            </Typography.Text>
                                        </div>
                                    ))}
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
                                        const bubbleBg = isUser ? '#b6462f' : assistantBubbleBackground
                                        const bubbleColor = isUser ? '#fff' : panelText
                                        const toolPayload = !isUser && message.role === 'assistant'
                                            ? parseAiToolPayload(message.content)
                                            : null
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
                                                }}>
                                                    {message.role === 'assistant' && (
                                                        <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <Avatar size={22} style={{ backgroundColor: '#0aa7e6' }} icon={<DoraemonMiniAvatar />} />
                                                            <Typography.Text strong style={{ color: bubbleColor }}>Doraemon</Typography.Text>
                                                        </div>
                                                    )}
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
                                                                        background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(182,70,47,0.06)',
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
                                                                        <Typography.Text style={{ color: '#b6462f' }}>
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
                                                                    href={`/dashboard/member/store?category=${encodeURIComponent(item.name)}`}
                                                                    style={{
                                                                        padding: '7px 10px',
                                                                        borderRadius: 999,
                                                                        background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(182,70,47,0.08)',
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
                                                                        background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(182,70,47,0.06)',
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
                                                        <Typography.Text style={{ color: bubbleColor }}>{message.content}</Typography.Text>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                                {loading && (
                                    <div style={{ textAlign: 'center', marginTop: 14 }}>
                                        <Spin />
                                    </div>
                                )}
                            </div>

                            {/* INPUT */}
                            <div style={{
                                borderTop: panelBorder,
                                padding: mobileChat ? '10px 12px' : '14px 16px',
                                background: panelBackground,
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
                                        <Typography.Text style={{ color: '#a8071a', fontSize: 13 }}>{errorInfo.message}</Typography.Text>
                                        <Button
                                            size="small"
                                            disabled={retryCountdown > 0}
                                            onClick={handleRetry}
                                            style={{ background: '#b6462f', borderColor: '#b6462f', color: '#fff' }}
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
                                        borderColor: inputBorder,
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
                                            style={{ background: '#b6462f', borderColor: '#b6462f', color: '#fff' }}
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
            {/* FIX: zIndex cao hơn panel (10000) để hiện trên cùng */}
            <Drawer
                className="ai-session-drawer"
                title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Phiên chat</span>
                        <Badge count={sessions.length} color="#b6462f" />
                    </div>
                }
                placement="bottom"
                open={sessionDrawerOpen}
                onClose={() => {
                    setSessionDrawerOpen(false)
                    cancelEditingSession()
                }}
                height="72vh"
                zIndex={10100}
                styles={{
                    body: {
                        padding: 0,
                        background: dark ? '#14161d' : '#fff',
                        display: 'flex',
                        flexDirection: 'column',
                    },
                    header: {
                        background: dark ? '#14161d' : '#fff',
                        borderBottom: dark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.08)',
                    },
                    wrapper: {
                        zIndex: 10100,
                    },
                }}
            >
                {renderSessionList()}
            </Drawer>
        </>
    )
}