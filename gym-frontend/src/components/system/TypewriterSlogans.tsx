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

export default function TypewriterSlogans({
  slogans,
  language,
  className = '',
  typeSpeed = 90,
  deleteSpeed = 45,
  pauseAfterTyping = 2200,
  pauseAfterDeleting = 500,
}: TypewriterSlogansProps) {
  const [displayText, setDisplayText] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const idxRef = useRef(0)
  const textRef = useRef('')
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
    const txt = textRef.current
    const ph = phaseRef.current
    const sl = slogansRef.current
    const { typeSpeed: ts, deleteSpeed: ds, pauseAfterTyping: pat, pauseAfterDeleting: pad } = timingsRef.current
    const slogan = sl[idx]

    if (!slogan) return

    if (ph === 'typing') {
      if (txt.length < slogan.length) {
        const next = slogan.slice(0, txt.length + 1)
        textRef.current = next
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
      if (txt.length > 0) {
        const next = txt.slice(0, -1)
        textRef.current = next
        setDisplayText(next)
        timerRef.current = setTimeout(tick, ds)
      } else {
        phaseRef.current = 'pause-deleting'
        timerRef.current = setTimeout(tick, pad)
      }
    } else if (ph === 'pause-deleting') {
      idxRef.current = (idx + 1) % sl.length
      phaseRef.current = 'typing'
      timerRef.current = setTimeout(tick, ts)
    }
  }, [clearTimer])

  useEffect(() => {
    mountedRef.current = true
    idxRef.current = 0
    textRef.current = ''
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
      <AutoFitText text={displayText} className={className}>
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
