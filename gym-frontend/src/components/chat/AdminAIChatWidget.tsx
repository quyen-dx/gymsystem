import { RobotOutlined, SendOutlined, CloseOutlined } from '@ant-design/icons'
import { Avatar, Button, Input, Typography } from 'antd'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../../context/ThemeProvider'
import { useAuth } from '../../hooks/useAuth'
import api from '../../services/api'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function AdminAIChatWidget() {
  const { dark } = useTheme()
  const { user } = useAuth()

  const [visible, setVisible] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const panelBg = dark ? '#1f1f1f' : '#ffffff'
  const panelText = dark ? '#f0f0f0' : '#1a1a1a'
  const panelMuted = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'
  const inputBg = dark ? '#2a2a2a' : '#f5f5f5'
  const bubbleUser = '#7c3aed'
  const bubbleAssistant = dark ? '#2a2a2a' : '#f0f0f0'
  const bubbleAssistantText = dark ? '#f0f0f0' : '#1a1a1a'
  const borderColor = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await api.post('/admin/ai/chat', { messages: newMessages })
      const reply = res.data.reply || 'Xin lỗi, mình không có câu trả lời.'
      setMessages([...newMessages, { role: 'assistant', content: reply }])
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Đã có lỗi xảy ra. Vui lòng thử lại.' }])
    } finally {
      setLoading(false)
    }
  }

  if (user?.role !== 'admin') return null

  return createPortal(
    <>
      <style>{`
        .admin-ai-trigger {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 10500;
          width: 52px;
          height: 52px;
          border-radius: 999px;
          border: none;
          background: #7c3aed;
          color: #fff;
          font-size: 22px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 24px rgba(124,58,237,0.35);
          transition: transform 180ms ease, box-shadow 180ms ease;
        }
        .admin-ai-trigger:hover {
          transform: scale(1.08);
          box-shadow: 0 8px 32px rgba(124,58,237,0.5);
        }
        .admin-ai-panel {
          position: fixed;
          bottom: 88px;
          right: 24px;
          z-index: 10500;
          width: 480px;
          max-width: calc(100vw - 48px);
          height: 650px;
          max-height: calc(100dvh - 120px);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 24px 80px rgba(0,0,0,0.28);
          transition: all 220ms ease;
          border: 1px solid ${borderColor};
        }
        .admin-ai-header {
          background: #7c3aed;
          color: #fff;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .admin-ai-messages {
          flex: 1;
          overflow-y: auto;
          padding: 14px;
          background: ${panelBg};
        }
        .admin-ai-message {
          max-width: 88%;
          padding: 12px 18px;
          border-radius: 16px;
          margin-bottom: 10px;
          white-space: pre-wrap;
          line-height: 1.55;
          word-break: break-word;
          font-size: 1rem;
        }
        .admin-ai-footer {
          padding: 12px 14px;
          border-top: 1px solid ${borderColor};
          background: ${panelBg};
          flex-shrink: 0;
        }
      `}</style>

      <button className="admin-ai-trigger" onClick={() => setVisible(!visible)}>
        <RobotOutlined />
      </button>

      {visible && (
        <div className="admin-ai-panel" style={{ background: panelBg, color: panelText }}>
          <div className="admin-ai-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar size={28} icon={<RobotOutlined />} style={{ background: 'rgba(255,255,255,0.2)' }} />
              <Typography.Text strong style={{ color: '#fff', fontSize: 15 }}>
                Admin Assistant
              </Typography.Text>
            </div>
            <Button type="text" size="small" icon={<CloseOutlined />} style={{ color: '#fff' }} onClick={() => setVisible(false)} />
          </div>

          <div className="admin-ai-messages" ref={scrollRef}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: 40, color: panelMuted }}>
                <RobotOutlined style={{ fontSize: 40, opacity: 0.3 }} />
                <Typography.Text style={{ display: 'block', marginTop: 10, color: panelMuted }}>
                  Hỏi mình bất cứ điều gì về hệ thống nhé!
                </Typography.Text>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div
                    className="admin-ai-message"
                    style={{
                      background: msg.role === 'user' ? bubbleUser : bubbleAssistant,
                      color: msg.role === 'user' ? '#fff' : bubbleAssistantText,
                      borderTopRightRadius: msg.role === 'user' ? 4 : 16,
                      borderTopLeftRadius: msg.role === 'user' ? 16 : 4,
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div className="admin-ai-message" style={{ background: bubbleAssistant, color: bubbleAssistantText, borderTopLeftRadius: 4 }}>
                  <Typography.Text style={{ color: panelMuted }}>Đang trả lời...</Typography.Text>
                </div>
              </div>
            )}
          </div>

          <div className="admin-ai-footer">
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Nhập câu hỏi..."
              rows={2}
              disabled={loading}
              className="text-base"
              style={{
                borderRadius: 12,
                background: inputBg,
                border: `1px solid ${borderColor}`,
                color: panelText,
                marginBottom: 8,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                icon={<SendOutlined />}
                onClick={handleSend}
                loading={loading}
                style={{ background: '#7c3aed', color: '#fff', border: 'none' }}
              >
                Gửi
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* hihi */}
    </>,
    document.body,
  )
}
