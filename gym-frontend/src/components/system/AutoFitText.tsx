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
  if (vw >= 1024) return 48
  if (vw >= 768) return 40
  return 32
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

    inner.style.fontSize = bestFit + 'px'

    if (bestFit <= minFs && measurer.scrollWidth > containerWidth) {
      inner.style.whiteSpace = 'normal'
      const prev = statusRef.current
      statusRef.current = 'wrapped'
      if (prev !== 'wrapped') onStatus?.('wrapped')
    } else {
      inner.style.whiteSpace = 'nowrap'
      const prev = statusRef.current
      statusRef.current = 'scaled'
      if (prev !== 'scaled') onStatus?.('scaled')
    }
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
    <div ref={outerRef} className={className} style={{ overflow: 'hidden', width: '100%' }}>
      <span ref={innerRef} style={{ display: 'block', overflow: 'hidden' }}>
        {children}
      </span>
      <span
        ref={measurerRef}
        style={{ position: 'fixed', visibility: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none', top: 0, left: '-9999px' }}
      />
    </div>
  )
}
