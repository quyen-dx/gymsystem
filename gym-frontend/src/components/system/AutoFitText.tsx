import { useCallback, useEffect, useRef } from 'react'

type FitStatus = 'single' | 'scaled' | 'wrapped'

type AutoFitTextProps = {
  text: string
  children: React.ReactNode
  className?: string
  onStatus?: (status: FitStatus) => void
}

const getMinFontSize = () => {
  const vw = window.innerWidth
  if (vw >= 1024) return 36
  if (vw >= 768) return 28
  return 20
}

export default function AutoFitText({ text, children, className, onStatus }: AutoFitTextProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)
  const measurerRef = useRef<HTMLSpanElement>(null)
  const statusRef = useRef<FitStatus | null>(null)

  const fit = useCallback(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    const measurer = measurerRef.current
    if (!outer || !inner || !measurer) return

    const containerWidth = outer.clientWidth

    measurer.style.fontSize = ''
    measurer.style.whiteSpace = 'nowrap'
    measurer.textContent = text

    const baseSize = parseFloat(getComputedStyle(measurer).fontSize)
    if (!baseSize) return

    const textWidth = measurer.scrollWidth

    if (textWidth <= containerWidth) {
      inner.style.fontSize = ''
      inner.style.whiteSpace = 'nowrap'
      inner.style.overflowWrap = ''
      inner.style.wordBreak = ''
      const prev = statusRef.current
      statusRef.current = 'single'
      if (prev !== 'single') onStatus?.('single')
      return
    }

    const minFs = getMinFontSize()

    let lo = minFs
    let hi = baseSize
    let bestFit = baseSize

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      measurer.style.fontSize = mid + 'px'
      if (measurer.scrollWidth <= containerWidth) {
        bestFit = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }

    measurer.style.fontSize = minFs + 'px'
    if (measurer.scrollWidth > containerWidth) {
      inner.style.fontSize = minFs + 'px'
      inner.style.whiteSpace = 'normal'
      inner.style.overflowWrap = 'anywhere'
      inner.style.wordBreak = 'break-word'
      const prev = statusRef.current
      statusRef.current = 'wrapped'
      if (prev !== 'wrapped') onStatus?.('wrapped')
      return
    }

    inner.style.fontSize = bestFit + 'px'
    inner.style.whiteSpace = 'nowrap'
    inner.style.overflowWrap = ''
    inner.style.wordBreak = ''
    const prev = statusRef.current
    statusRef.current = 'scaled'
    if (prev !== 'scaled') onStatus?.('scaled')
  }, [text, onStatus])

  useEffect(() => {
    fit()
  }, [fit])

  useEffect(() => {
    const ro = new ResizeObserver(() => fit())
    if (outerRef.current) ro.observe(outerRef.current)
    return () => ro.disconnect()
  }, [fit])

  return (
    <div ref={outerRef} className={className} style={{ overflow: 'visible', width: '100%', maxWidth: '100%' }}>
      <span ref={innerRef} style={{ display: 'block', overflow: 'visible', maxWidth: '100%' }}>
        {children}
      </span>
      <span
        ref={measurerRef}
        style={{ position: 'fixed', visibility: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none', top: 0, left: '-9999px' }}
      />
    </div>
  )
}
