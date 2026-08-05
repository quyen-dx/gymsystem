import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { message } from 'antd'
import { sendChatMessage, sendVisionImage, streamChatMessage } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import AIMessageFormatter from './AIMessageFormatter'
import { useQuickActions } from './useQuickActions'

interface ActionButton {
  label: string
  route: string
  icon: string
  variant: 'primary' | 'secondary'
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  imageUrl?: string
  cards?: unknown[]
  suggestions?: string[]
  links?: { label: string; path: string }[]
  actions?: ActionButton[]
}

type StoredMessage = {
  id: string; role: 'user' | 'assistant'; content: string
  createdAt: string; imageUrl?: string; cards?: unknown[]
  suggestions?: string[]; links?: { label: string; path: string }[]
  actions?: ActionButton[]
}

type PersistedState = {
  messages: StoredMessage[]
  inputValue: string
}

function getStorageKey(userId: string) {
  return `gympro-chat-${userId}`
}

function loadState(key: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.messages)) return null
    return { messages: parsed.messages as StoredMessage[], inputValue: parsed.inputValue ?? '' }
  } catch { return null }
}

function saveState(key: string, state: { messages: ChatMessage[]; inputValue: string }) {
  try {
    const mini = state.messages.slice(-50).map(m => ({
      id: m.id, role: m.role, content: m.content,
      createdAt: m.createdAt, imageUrl: m.imageUrl,
      cards: m.cards, suggestions: m.suggestions,
      links: m.links, actions: m.actions,
    }))
    localStorage.setItem(key, JSON.stringify({
      messages: mini,
      inputValue: state.inputValue,
    }))
  } catch { /* quota exceeded */ }
}

function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const ROUTE_SUGGESTIONS: Record<string, { text: string; label: string }[]> = {
  '/policies': [
    { text: 'Chính sách hoàn tiền như thế nào?', label: 'Hoàn tiền' },
    { text: 'Điều khoản sử dụng phòng gym?', label: 'Điều khoản' },
    { text: 'Chính sách hội viên có những gì?', label: 'Hội viên' },
    { text: 'Chính sách thanh toán ra sao?', label: 'Thanh toán' },
    { text: 'Bảo mật thông tin cá nhân thế nào?', label: 'Bảo mật' },
  ],
  '/help': [
    { text: 'Tôi quên mật khẩu, phải làm sao?', label: 'Quên mật khẩu' },
    { text: 'Cách đặt lịch tập với PT?', label: 'Đặt lịch PT' },
    { text: 'Làm sao để check-in?', label: 'Check-in' },
    { text: 'Cách gia hạn gói tập?', label: 'Gia hạn gói' },
    { text: 'Làm sao liên hệ hỗ trợ?', label: 'Liên hệ' },
  ],
  '/feedback': [
    { text: 'Tôi muốn gửi góp ý về phòng gym', label: 'Góp ý' },
    { text: 'Báo lỗi ứng dụng', label: 'Báo lỗi' },
    { text: 'Đề xuất tính năng mới', label: 'Đề xuất' },
    { text: 'Khiếu nại về dịch vụ', label: 'Khiếu nại' },
    { text: 'Xem phản hồi của tôi', label: 'Phản hồi' },
  ],
  '/my-feedback': [
    { text: 'Tôi muốn gửi góp ý mới', label: 'Góp ý' },
    { text: 'Cách xem lại phản hồi đã gửi?', label: 'Xem lại' },
    { text: 'Phản hồi được xử lý trong bao lâu?', label: 'Thời gian' },
  ],
}

const SUGGESTION_POOL: { text: string; label: string }[] = [
  // Nutrition
  { text: 'Phân tích bữa ăn hôm nay của tôi', label: 'Bữa ăn' },
  { text: 'Thực đơn giảm cân trong 1 tuần?', label: 'Giảm cân' },
  { text: 'Nên ăn gì trước khi tập gym?', label: 'Trước tập' },
  { text: 'Nên ăn gì sau khi tập để tăng cơ?', label: 'Sau tập' },
  { text: 'Cần bao nhiêu protein mỗi ngày?', label: 'Protein' },
  { text: 'Thực phẩm nào giàu protein nhất?', label: 'Thực phẩm' },
  { text: 'Có nên dùng whey protein không?', label: 'Whey' },
  { text: 'Chế độ ăn keto có tốt không?', label: 'Keto' },
  { text: 'Cách tính calo cần nạp mỗi ngày', label: 'Calo' },
  { text: 'Ăn carb có béo không?', label: 'Carb' },
  // Workout
  { text: 'Bài tập giảm mỡ bụng hiệu quả', label: 'Mỡ bụng' },
  { text: 'Lịch tập cho người mới bắt đầu', label: 'Người mới' },
  { text: 'Làm sao để tăng cơ nhanh?', label: 'Tăng cơ' },
  { text: 'Có nên tập cardio mỗi ngày?', label: 'Cardio' },
  { text: 'Bài tập nào đốt calo nhiều nhất?', label: 'Đốt calo' },
  { text: 'Tập gym bao lâu thì có kết quả?', label: 'Kết quả' },
  { text: 'Cách squat đúng kỹ thuật', label: 'Squat' },
  { text: 'Push-up mỗi ngày có tốt không?', label: 'Push-up' },
  { text: 'Deadlift có nguy hiểm không?', label: 'Deadlift' },
  { text: 'Bài tập cho người đau lưng', label: 'Đau lưng' },
  // GymPro features
  { text: 'Lịch tập tuần này của tôi', label: 'Lịch tập' },
  { text: 'Làm sao để chọn PT phù hợp?', label: 'Chọn PT' },
  { text: 'Có ưu đãi gì cho hội viên mới?', label: 'Ưu đãi' },
  { text: 'Cách kiểm tra số buổi tập còn lại', label: 'Buổi tập' },
  { text: 'Các gói tập có gì khác nhau?', label: 'So sánh' },
  { text: 'Phòng gym mở cửa lúc mấy giờ?', label: 'Giờ mở cửa' },
  { text: 'Có phòng tắm và tủ đồ không?', label: 'Tiện ích' },
  { text: 'Check-in bằng QR code thế nào?', label: 'QR Code' },
  { text: 'Làm sao đổi lịch tập với PT?', label: 'Đổi lịch' },
  { text: 'Hủy gói tập có mất phí không?', label: 'Hủy gói' },
  // Fitness tips
  { text: 'Tập gym có giúp giảm stress không?', label: 'Stress' },
  { text: 'Ngủ bao nhiêu tiếng là đủ cho gymer?', label: 'Giấc ngủ' },
  { text: 'Có nên tập khi bị đau cơ không?', label: 'Đau cơ' },
  { text: 'Uống bao nhiêu nước khi tập gym?', label: 'Nước' },
  { text: 'Tập gym có ảnh hưởng chiều cao không?', label: 'Chiều cao' },
  { text: 'Bao lâu nên nghỉ tập 1 lần?', label: 'Nghỉ tập' },
  { text: 'Có nên tập gym khi đang ốm?', label: 'Ốm' },
  { text: 'Tập gym buổi sáng hay tối tốt hơn?', label: 'Thời gian' },
  { text: 'Làm sao để duy trì động lực tập?', label: 'Động lực' },
  { text: 'Các mẹo tránh chấn thương khi tập', label: 'Chấn thương' },
  // General
  { text: 'Phân tích body của tôi', label: 'Body' },
  { text: 'Làm sao cải thiện sức bền?', label: 'Sức bền' },
  { text: 'Bài tập giãn cơ sau khi tập', label: 'Giãn cơ' },
  { text: 'Có nên tập yoga kết hợp gym?', label: 'Yoga' },
  { text: 'Lợi ích của tập gym với sức khỏe', label: 'Sức khỏe' },
]

function pickRandom(pool: { text: string; label: string }[], count: number) {
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, count)
}

function resolveSuggestions(pathname: string): { text: string; label: string }[] {
  // Special pages: return all route-specific suggestions
  if (ROUTE_SUGGESTIONS[pathname]) return ROUTE_SUGGESTIONS[pathname]
  for (const [route, suggestions] of Object.entries(ROUTE_SUGGESTIONS)) {
    if (route !== '/' && pathname.startsWith(route + '/')) return suggestions
  }
  // All other pages: 3 random picks from the general pool
  return pickRandom(SUGGESTION_POOL, 3)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const q = window.matchMedia('(max-width: 768px)')
    setMobile(q.matches)
    const h = (e: MediaQueryListEvent) => setMobile(e.matches)
    q.addEventListener('change', h)
    return () => q.removeEventListener('change', h)
  }, [])
  return mobile
}

export default function AiChatWidget({ drawerOpen = false }: { drawerOpen?: boolean }) {
  const { user } = useAuth()
  const userId = user?._id
  const storageKey = userId ? getStorageKey(userId) : null

  // Restore persisted chat data only (not open state)
  const restored = useMemo(() => {
    if (!storageKey) return null
    return loadState(storageKey)
  }, [storageKey])

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(restored?.messages ?? [])
  const [inputValue, setInputValue] = useState(restored?.inputValue ?? '')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const location = useLocation()

  const suggestions = useMemo(() => resolveSuggestions(location.pathname), [location.pathname, isOpen])

  const [typingProgress, setTypingProgress] = useState<Record<string, number>>({})
  const typingRef = useRef<Record<string, number>>({})
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const messagesRef = useRef<ChatMessage[]>(messages)

  useEffect(() => { messagesRef.current = messages }, [messages])

  // Context-aware quick actions
  const lastUserMsg = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].content
    }
    return ''
  }, [messages])
  const lastAssistantContent = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].content
    }
    return ''
  }, [messages])

  const contextActions = useQuickActions(lastUserMsg, lastAssistantContent)

  const handleNavigateAndClose = useCallback((route: string) => {
    navigate(route)
    setIsOpen(false)
  }, [navigate])

  // Revoke all blob URLs on unmount
  useEffect(() => {
    return () => {
      messagesRef.current.forEach(m => {
        if (m.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(m.imageUrl)
      })
    }
  }, [])

  // Clear chat when userId changes (logout/login as different user)
  const prevUserIdRef = useRef<string | undefined>(userId)
  useEffect(() => {
    const prev = prevUserIdRef.current
    prevUserIdRef.current = userId
    if (prev && prev !== userId) {
      messages.forEach(m => {
        if (m.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(m.imageUrl)
      })
      setMessages([])
      setInputValue('')
      setIsOpen(false)
      setTypingProgress({})
      typingRef.current = {}
    }
  }, [userId])

  // Persist: messages + inputValue only (NOT isOpen)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    if (!storageKey) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveState(storageKey, { messages, inputValue })
    }, 300)
    return () => clearTimeout(saveTimerRef.current)
  }, [messages, inputValue, storageKey])

  // Typing animation
  useEffect(() => {
    let active = true
    function schedule() {
      if (!active) return
      const delay = 26 + (Math.floor(Math.random() * 11) - 5)
      timeoutRef.current = setTimeout(() => {
        const next: Record<string, number> = {}
        let changed = false
        for (const [id, current] of Object.entries(typingRef.current)) {
          const msg = messages.find((m) => m.id === id)
          if (!msg || current >= msg.content.length) continue
          const fullLen = msg.content.length
          const step = fullLen < 80 ? 1 : fullLen <= 300 ? 2 : Math.ceil(fullLen / 50)
          const updated = Math.min(current + step, fullLen)
          typingRef.current[id] = updated
          next[id] = updated
          changed = true
        }
        if (changed) setTypingProgress((prev) => ({ ...prev, ...next }))
        schedule()
      }, delay)
    }
    schedule()
    return () => { active = false; clearTimeout(timeoutRef.current) }
  }, [messages])

  const startTyping = useCallback((msgId: string) => { typingRef.current[msgId] = 0 }, [])

  // Scroll
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, isLoading, typingProgress])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [inputValue])

  // ESC to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) setIsOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [isOpen])

  // Overlay priority: close chat when any drawer opens (via custom event)
  useEffect(() => {
    const handler = () => setIsOpen(false)
    window.addEventListener('gympro:overlay-open', handler)
    return () => window.removeEventListener('gympro:overlay-open', handler)
  }, [])

  // Focus textarea on open
  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 100)
  }, [isOpen])



  // Image validation
  const validateAndSetImage = (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) { alert('Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.'); return }
    if (file.size > 20 * 1024 * 1024) { alert('Kích thước ảnh tối đa 20MB.'); return }
    const previewUrl = URL.createObjectURL(file)
    setSelectedImage(file)
    setImagePreview(previewUrl)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) validateAndSetImage(file)
  }

  // Paste image
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) validateAndSetImage(file)
        return
      }
    }
  }, [])

  // Drag & drop
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) setIsDragOver(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) validateAndSetImage(file)
  }

  const handleRemoveImage = (skipRevoke = false) => {
    setSelectedImage(null)
    if (imagePreview) {
      if (!skipRevoke) URL.revokeObjectURL(imagePreview)
      setImagePreview(null)
    }
  }

  // Clear conversation
  const handleClear = () => {
    messages.forEach(m => {
      if (m.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(m.imageUrl)
    })
    setMessages([])
    setInputValue('')
    if (storageKey) localStorage.removeItem(storageKey)
  }

  // Message actions
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      message.success('✓ Đã sao chép')
    } catch { /* clipboard unavailable */ }
  }

  // Suggested question click
  const handleSuggested = (text: string) => {
    setInputValue(text)
    handleSend(text)
  }

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? inputValue).trim()

    if (selectedImage) {
      setInputValue('')
      const userMsg: ChatMessage = { id: generateId(), role: 'user', content: text, createdAt: new Date().toISOString(), imageUrl: imagePreview || undefined }
      setMessages(prev => [...prev, userMsg])
      setIsImageLoading(true)
      handleRemoveImage(true)

      try {
        const data = await sendVisionImage(selectedImage, text)
        const botId = generateId()
        const botMsg: ChatMessage = { id: botId, role: 'assistant', content: data.analysis || 'Không thể phân tích hình ảnh.', createdAt: new Date().toISOString() }
        setMessages(prev => [...prev, botMsg])
        startTyping(botId)
      } catch {
        setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: 'Đã xảy ra lỗi khi phân tích hình ảnh.', createdAt: new Date().toISOString() }])
      }
      setIsImageLoading(false)
      return
    }

    if (!text || isLoading) return
    setInputValue('')

    const userMsg: ChatMessage = { id: generateId(), role: 'user', content: text, createdAt: new Date().toISOString() }
    const botId = generateId()
    const botMsg: ChatMessage = { id: botId, role: 'assistant', content: '', createdAt: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg, botMsg])
    setIsLoading(true)

    const abortController = new AbortController()
    abortRef.current = abortController

    let streamError: string | null = null

    const streamed = await streamChatMessage(text, {
      onToken: (t: string) => setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: m.content + t } : m)),
      onCard: (card) => setMessages(prev => prev.map(m => m.id === botId ? { ...m, cards: [...(m.cards || []), card] as unknown[] } : m)),
      onSuggestion: (t: string) => setMessages(prev => prev.map(m => m.id === botId ? { ...m, suggestions: [...(m.suggestions || []), t] } : m)),
      onDeeplink: (url: string) => setMessages(prev => prev.map(m => m.id === botId ? { ...m, links: [...(m.links || []), { label: 'Xem chi tiết', path: url }] } : m)),
      onAction: (action) => setMessages(prev => prev.map(m => m.id === botId ? { ...m, actions: [...(m.actions || []), action] } : m)),
      onDone: (reply: string) => { startTyping(botId); setIsLoading(false); abortRef.current = null },
      onError: (msg: string) => { streamError = msg },
    }, abortController.signal)

    if (!streamed) {
      if (abortController.signal.aborted) {
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: m.content || 'Đã dừng tạo phản hồi.' } : m))
      } else {
        try {
          const data = await sendChatMessage(text)
          setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: data.reply || 'Đã xảy ra lỗi.', cards: data.cards as unknown[] | undefined, suggestions: data.suggestions, links: data.deeplinks?.map(path => ({ label: 'Xem chi tiết', path })), actions: data.actions } : m))
          startTyping(botId)
        } catch {
          setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: streamError || 'Đã xảy ra lỗi, vui lòng thử lại sau.' } : m))
        }
      }
      setIsLoading(false); abortRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
      setIsLoading(false)
    }
  }

  // Styles
  const isSent = useMemo(() => (inputValue.trim() || selectedImage) && !isLoading && !isImageLoading, [inputValue, selectedImage, isLoading, isImageLoading])

  const panelStyle: React.CSSProperties = isMobile ? {
    position: 'fixed', top: `calc(60px + env(safe-area-inset-top, 0px))`, left: 0, right: 0, bottom: 0,
    background: 'var(--theme-card)', display: 'flex', flexDirection: 'column', zIndex: 1050,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    boxShadow: '0 -4px 24px rgba(0,0,0,0.3)', overflow: 'hidden',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    animation: `${isOpen ? 'slideUp 0.25s ease-out' : 'slideDown 0.2s ease-in forwards'}`,
  } : {
    position: 'fixed', bottom: 92, right: 24, width: 430, height: 640, maxHeight: 'calc(100vh - 120px)',
    background: 'var(--theme-card)', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
    display: 'flex', flexDirection: 'column', zIndex: 1050, overflow: 'hidden', border: '1px solid var(--theme-border)',
    animation: 'widgetPopup 0.22s ease-out',
  }

  const bubbleBase = (role: string): React.CSSProperties => ({
    padding: '10px 16px', borderRadius: role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
    fontSize: 14, lineHeight: 1.6, maxWidth: '82%', wordBreak: 'break-word',
    animation: 'msgSlideIn 0.25s ease-out',
    transition: 'transform 0.15s, opacity 0.15s',
    width: 'fit-content',
    ...(role === 'user' ? { alignSelf: 'flex-end', background: 'var(--theme-button-bg)', color: 'var(--theme-button-text)' } : { alignSelf: 'flex-start', background: 'var(--theme-input-bg)', color: 'var(--theme-text)' }),
  })

  return (
    <>
      <style>{`
        @keyframes msgSlideIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes blink { 0%, 100% { opacity:0 } 50% { opacity:1 } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
        @keyframes slideDown { from { transform:translateY(0) } to { transform:translateY(100%) } }
        @keyframes widgetPopup { from { opacity:0; transform:scale(0.95) translateY(8px) } to { opacity:1; transform:scale(1) translateY(0) } }
        @keyframes backdropIn { from { opacity:0 } to { opacity:1 } }
        @media (min-width: 1024px) {
          .chat-launcher {
            width: 68px !important;
            height: 68px !important;
            font-size: 32px !important;
            box-shadow: 0 6px 28px rgba(0,0,0,0.3) !important;
          }
          .chat-launcher:hover {
            box-shadow: 0 8px 32px rgba(0,0,0,0.38) !important;
            transform: scale(1.08) !important;
          }
        }
      `}</style>

      {!isOpen && !(isMobile && drawerOpen) && (
        <button type="button" onClick={() => setIsOpen(true)} className="chat-launcher" aria-label="Mở chat"
          style={{ position:'fixed', bottom:24, right:24, width:56, height:56, borderRadius:'50%', border:'none', background:'var(--theme-button-bg)', color:'var(--theme-button-text)', fontSize:24, cursor:'pointer', boxShadow:'0 4px 20px rgba(0,0,0,0.25)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1060, transition:'transform 0.18s,box-shadow 0.18s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.32)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.25)' }}>
          💬
        </button>
      )}

      {isOpen && (
        <>
          {/* Backdrop (mobile only) */}
          {isMobile && (
            <div onClick={() => setIsOpen(false)}
              style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1049, animation:'backdropIn 0.2s ease' }} />
          )}
          {/* Click-outside overlay (desktop only, invisible) */}
          {!isMobile && (
            <div onClick={() => setIsOpen(false)}
              style={{ position:'fixed', inset:0, zIndex:1049 }} />
          )}
          <div ref={panelRef} style={panelStyle}
            onClick={e => e.stopPropagation()}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onPaste={handlePaste}
          >
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid var(--theme-border)', fontWeight:700, fontSize:15, color:'var(--theme-text)', background:'var(--theme-elevated)', flexShrink:0 }}>
            <span>💬 Trợ lý GymPro</span>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {isLoading && <button type="button" onClick={handleStop} style={{ background:'var(--theme-button-bg)', border:'none', color:'var(--theme-button-text)', fontSize:12, fontWeight:700, padding:'4px 10px', borderRadius:8, cursor:'pointer' }}>Dừng</button>}
              <button type="button" onClick={handleClear} title="Xoá hội thoại" style={{ background:'none', border:'none', color:'var(--theme-muted)', fontSize:14, cursor:'pointer', padding:'2px 4px', lineHeight:1 }}>🗑</button>
              <button type="button" onClick={() => setIsOpen(false)} style={{ background:'none', border:'none', color:'var(--theme-muted)', fontSize:18, cursor:'pointer', padding:0, lineHeight:1 }} aria-label="Đóng">✕</button>
            </div>
          </div>

          {/* Messages */}
          <div ref={listRef} style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
            {/* Drag overlay */}
            {isDragOver && (
              <div style={{ position:'absolute', inset:0, background:'var(--theme-accent-muted, rgba(59,130,246,0.08))', border:'2px dashed var(--theme-accent)', borderRadius:16, zIndex:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:600, color:'var(--theme-accent)' }}>
                Thả hình ảnh để tải lên
              </div>
            )}

            {/* Empty state */}
            {messages.length === 0 && !isLoading && (
              <div style={{ textAlign:'center', padding:'20px 8px', animation:'fadeIn 0.3s ease' }}>
                <div style={{ fontSize:36, marginBottom:12 }}>👋</div>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--theme-text)', marginBottom:4 }}>Xin chào!</div>
                <div style={{ fontSize:13, color:'var(--theme-muted)', marginBottom:20 }}>Tôi là Trợ lý GymPro — có thể giúp gì cho bạn?</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
                  {suggestions.map((q, i) => (
                    <button key={i} type="button" onClick={() => handleSuggested(q.text)}
                      style={{ background:'var(--theme-input-bg)', border:'1px solid var(--theme-border)', borderRadius:18, padding:'8px 14px', fontSize:13, color:'var(--theme-text)', cursor:'pointer', display:'flex', alignItems:'center', gap:6, transition:'background 0.15s, transform 0.15s', whiteSpace:'nowrap' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--theme-elevated)'; e.currentTarget.style.transform = 'scale(1.03)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--theme-input-bg)'; e.currentTarget.style.transform = 'scale(1)' }}>
                      {q.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => {
              const progress = typingProgress[msg.id]
              const display = msg.role === 'assistant' && progress !== undefined ? msg.content.slice(0, progress) : msg.content
              const bubble = bubbleBase(msg.role)
              const hasImage = !!msg.imageUrl
              const showText = !hasImage || msg.content.length > 0

              return (
                <div key={msg.id} style={{ display:'flex', flexDirection:'column', alignItems:msg.role==='user'?'flex-end':'flex-start', position:'relative' }}>
                  <div style={bubble}>
                    {hasImage && (
                      <div
                        onClick={() => window.open(msg.imageUrl, '_blank')}
                        style={{
                          cursor:'pointer', marginBottom: showText ? 8 : 0,
                          overflow:'hidden', borderRadius:12, width:'fit-content',
                        }}
                      >
                        <img
                          src={msg.imageUrl}
                          alt="Uploaded"
                          style={{
                            display:'block', maxWidth: isMobile ? 140 : 180,
                            maxHeight: isMobile ? 140 : 180, width:'auto', height:'auto',
                            borderRadius:12, objectFit:'cover',
                          }}
                        />
                      </div>
                    )}
                    {showText && (
                      <AIMessageFormatter
                        content={display}
                        externalActions={
                          msg.role === 'assistant' && (progress === undefined || progress >= msg.content.length)
                            ? contextActions.map(a => ({
                                label: a.label,
                                onClick: () => handleNavigateAndClose(a.route),
                              }))
                            : undefined
                        }
                      />
                    )}
                    {msg.role === 'assistant' && progress !== undefined && progress < msg.content.length && <span style={{ display:'inline-block', width:2, height:14, background:'var(--theme-text)', marginLeft:2, animation:'blink 0.7s infinite' }} />}
                  </div>
                  {/* Copy action below completed assistant messages */}
                  {msg.role === 'assistant' && msg.content && (progress === undefined || progress >= msg.content.length) && (
                    <button onClick={() => handleCopy(msg.content)} style={{ background:'none', border:'none', fontSize:12, color:'var(--theme-muted)', cursor:'pointer', padding:'2px 0', textDecoration:'none', userSelect:'none', lineHeight:1.4 }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--theme-text)'; e.currentTarget.style.textDecoration = 'underline' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--theme-muted)'; e.currentTarget.style.textDecoration = 'none' }}>
                      Sao chép
                    </button>
                  )}
                </div>
              )
            })}

            {/* Loading indicator */}
            {(isLoading || isImageLoading) && (
              <div style={{ ...bubbleBase('assistant'), animation:'none' }}>
                <span style={{ display:'flex', alignItems:'center', gap:3 }}>
                  <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:'var(--theme-muted)', animation:'aiThinking 1.2s infinite', animationDelay:'0s' }} />
                  <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:'var(--theme-muted)', animation:'aiThinking 1.2s infinite', animationDelay:'0.2s' }} />
                  <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:'var(--theme-muted)', animation:'aiThinking 1.2s infinite', animationDelay:'0.4s' }} />
                </span>
              </div>
            )}
          </div>

          {/* Image preview (larger) */}
          {imagePreview && (
            <div style={{ padding:'8px 16px 0', display:'flex', gap:10, alignItems:'center' }}>
              <div style={{ position:'relative', width:90, height:90, borderRadius:10, overflow:'hidden', flexShrink:0, border:'1px solid var(--theme-border)', background:'var(--theme-input-bg)' }}>
                <img src={imagePreview} alt="Preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                <button type="button" onClick={handleRemoveImage} style={{ position:'absolute', top:4, right:4, width:22, height:22, border:'none', borderRadius:'50%', background:'rgba(0,0,0,0.65)', color:'#fff', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} aria-label="Xoá ảnh">✕</button>
              </div>
              {selectedImage && (
                <div style={{ fontSize:12, color:'var(--theme-muted)', lineHeight:1.6 }}>
                  <div style={{ fontWeight:600, color:'var(--theme-text)', marginBottom:2 }}>{selectedImage.name}</div>
                  <div>{formatFileSize(selectedImage.size)}</div>
                </div>
              )}
            </div>
          )}

          {/* Composer */}
          <div style={{ display:'flex', gap:8, padding:'12px 16px', borderTop:'1px solid var(--theme-border)', background:'var(--theme-elevated)', alignItems:'flex-end', flexShrink:0 }}>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isImageLoading} title="Đính kèm ảnh"
              style={{ background:'none', border:'1px solid var(--theme-border)', borderRadius:20, padding:'8px 10px', fontSize:16, cursor:(isLoading||isImageLoading)?'default':'pointer', color:'var(--theme-muted)', lineHeight:1, flexShrink:0 }}>
              🖼
            </button>
            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleImageSelect} style={{ display:'none' }} />
            <textarea ref={textareaRef} value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={selectedImage ? 'Thêm mô tả (không bắt buộc)...' : 'Nhập tin nhắn...'} disabled={isLoading || isImageLoading}
              rows={1}
              style={{ flex:1, border:'1px solid var(--theme-border)', borderRadius:20, padding:'9px 16px', fontSize:14, outline:'none', background:'var(--theme-input-bg)', color:'var(--theme-text)', resize:'none', maxHeight:120, fontFamily:'inherit', lineHeight:1.5 }} />
            <button type="button" onClick={() => handleSend()} disabled={!isSent}
              style={{ background:isSent?'var(--theme-button-bg)':'var(--theme-border)', color:isSent?'var(--theme-button-text)':'var(--theme-muted)', border:'none', borderRadius:20, padding:'8px 18px', fontSize:14, fontWeight:600, cursor:isSent?'pointer':'default', flexShrink:0, transition:'background 0.15s' }}>
              {selectedImage ? 'Phân tích' : 'Gửi'}
            </button>
          </div>
          </div>
        </>
      )}
    </>
  )
}
