import { useCallback, useEffect, useRef, useState } from 'react'
import AutoFitText from './AutoFitText'

type TypewriterSlogansProps = {
  slogans: string[]
  language?: string
  className?: string
  typeSpeed?: number
  deleteSpeed?: number
  pauseAfterTyping?: number
  pauseAfterDeleting?: number
}

type Phase = 'typing' | 'pause-typing' | 'deleting' | 'pause-deleting'

const combiningMarkRegex = /\p{Mark}/u

const splitGraphemes = (value: string) => {
  const normalized = value.normalize('NFC')
  const Segmenter = (Intl as any).Segmenter

  if (Segmenter) {
    const segmenter = new Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(normalized), (part: any) => part.segment)
  }

  return Array.from(normalized).reduce<string[]>((parts, char) => {
    if (parts.length > 0 && combiningMarkRegex.test(char)) {
      parts[parts.length - 1] += char
    } else {
      parts.push(char)
    }
    return parts
  }, [])
}

export default function TypewriterSlogans({
  slogans,
  language,
  className = '',
  typeSpeed = 60,
  deleteSpeed = 35,
  pauseAfterTyping = 1500,
  pauseAfterDeleting = 300,
}: TypewriterSlogansProps) {
  const [displayText, setDisplayText] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const idxRef = useRef(0)
  const charIndexRef = useRef(0)
  const phaseRef = useRef<Phase>('typing')
  const slogansRef = useRef(slogans)
  const timingsRef = useRef({ typeSpeed, deleteSpeed, pauseAfterTyping, pauseAfterDeleting })

  slogansRef.current = slogans
  timingsRef.current = { typeSpeed, deleteSpeed, pauseAfterTyping, pauseAfterDeleting }

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const tick = useCallback(() => {
    if (!mountedRef.current) return
    clearTimer()

    const idx = idxRef.current
    const charIndex = charIndexRef.current
    const ph = phaseRef.current
    const sl = slogansRef.current
    const { typeSpeed: ts, deleteSpeed: ds, pauseAfterTyping: pat, pauseAfterDeleting: pad } = timingsRef.current
    const slogan = splitGraphemes(sl[idx] || '')

    if (!slogan.length) return

    if (ph === 'typing') {
      if (charIndex < slogan.length) {
        const nextIndex = charIndex + 1
        const next = slogan.slice(0, nextIndex).join('')
        charIndexRef.current = nextIndex
        setDisplayText(next)
        timerRef.current = setTimeout(tick, ts)
      } else {
        phaseRef.current = 'pause-typing'
        timerRef.current = setTimeout(tick, pat)
      }
    } else if (ph === 'pause-typing') {
      phaseRef.current = 'deleting'
      timerRef.current = setTimeout(tick, ds)
    } else if (ph === 'deleting') {
      if (charIndex > 0) {
        const nextIndex = charIndex - 1
        const next = slogan.slice(0, nextIndex).join('')
        charIndexRef.current = nextIndex
        setDisplayText(next)
        timerRef.current = setTimeout(tick, ds)
      } else {
        phaseRef.current = 'pause-deleting'
        timerRef.current = setTimeout(tick, pad)
      }
    } else if (ph === 'pause-deleting') {
      idxRef.current = (idx + 1) % sl.length
      charIndexRef.current = 0
      phaseRef.current = 'typing'
      timerRef.current = setTimeout(tick, ts)
    }
  }, [clearTimer])

  useEffect(() => {
    mountedRef.current = true
    idxRef.current = 0
    charIndexRef.current = 0
    phaseRef.current = 'typing'
    setDisplayText('')
    clearTimer()

    if (slogans.length > 0) {
      timerRef.current = setTimeout(tick, typeSpeed)
    }

    return () => {
      mountedRef.current = false
      clearTimer()
    }
  }, [slogans, language, tick, clearTimer, typeSpeed])

  if (!slogans.length) return null

  return (
    <>
      <AutoFitText text={displayText} className={`leading-[1.2] py-[0.06em] ${className}`.trim()}>
        {displayText}
        <span
          className="inline-block w-[3px] h-[1em] ml-0.5 align-middle"
          style={{
            backgroundColor: 'var(--theme-text)',
            animation: 'tw-blink 0.8s step-end infinite',
          }}
        />
      </AutoFitText>
      <style>{`@keyframes tw-blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }`}</style>
    </>
  )
}
