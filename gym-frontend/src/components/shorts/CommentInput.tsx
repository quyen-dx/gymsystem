import { PictureOutlined, SmileOutlined } from '@ant-design/icons'
import { Button, Input } from 'antd'
import type { InputRef } from 'antd/es/input'
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const quickReactions = ['😂', '😍', '🔥', '💪', '❤️']

interface CommentInputProps {
  dark: boolean
  text: string
  inputRef: React.RefObject<InputRef | null>
  imagePreview: string
  submitting: boolean
  placeholder: string
  onTextChange: (value: string) => void
  onSubmit: () => void
  onChooseImage: () => void
  onClearImage: () => void
}

export default function CommentInput({
  dark,
  text,
  inputRef,
  imagePreview,
  submitting,
  placeholder,
  onTextChange,
  onSubmit,
  onChooseImage,
  onClearImage,
}: CommentInputProps) {
  const [emojiOpen, setEmojiOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)

  const insertEmoji = useCallback((emoji: string) => {
    const input = inputRef.current?.input
    const start = input?.selectionStart ?? text.length
    const end = input?.selectionEnd ?? text.length
    const nextText = `${text.slice(0, start)}${emoji}${text.slice(end)}`
    const nextCursor = start + emoji.length

    onTextChange(nextText)
    window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.input?.setSelectionRange(nextCursor, nextCursor)
    }, 0)
  }, [inputRef, onTextChange, text])

  useEffect(() => {
    if (!emojiOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (pickerRef.current?.contains(target)) return
      if (emojiButtonRef.current?.contains(target)) return
      setEmojiOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEmojiOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [emojiOpen])

  return (
    <>
      {imagePreview && (
        <div className="shorts-comment-image-preview">
          <img src={imagePreview} alt="Ảnh sẽ gửi" />
          <button type="button" onClick={onClearImage}>Xóa ảnh</button>
        </div>
      )}

      <Button
        className="shorts-comment-image-button"
        shape="circle"
        icon={<PictureOutlined />}
        onClick={onChooseImage}
      />

      <div className="shorts-comment-input-wrap">
        <Input
          ref={inputRef}
          value={text}
          maxLength={1000}
          placeholder={placeholder}
          onChange={(event) => onTextChange(event.target.value)}
          onPressEnter={() => onSubmit()}
        />

        <button
          ref={emojiButtonRef}
          className="shorts-comment-emoji-button"
          type="button"
          aria-label="Thêm emoji"
          onClick={() => setEmojiOpen((current) => !current)}
        >
          <SmileOutlined />
        </button>

        {emojiOpen && (
          <div className="shorts-emoji-popover" ref={pickerRef}>
            <div className="shorts-emoji-quick-reactions">
              {quickReactions.map((emoji) => (
                <button type="button" key={emoji} onClick={() => insertEmoji(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
            <EmojiPicker
              theme={dark ? Theme.DARK : Theme.LIGHT}
              width="100%"
              height={360}
              lazyLoadEmojis
              searchDisabled={false}
              previewConfig={{ showPreview: false }}
              onEmojiClick={(emojiData: EmojiClickData) => insertEmoji(emojiData.emoji)}
            />
          </div>
        )}
      </div>

      <Button type="primary" loading={submitting} onClick={onSubmit}>
        Gửi
      </Button>
    </>
  )
}
