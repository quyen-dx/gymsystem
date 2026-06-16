import { useEffect, useRef, useState } from 'react'

let idCounter = 0

export default function useScrollReveal(threshold = 0.15) {
  const [scrollId] = useState(() => `sr-${++idCounter}`)
  const [visible, setVisible] = useState(false)
  const observedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const sel = `[data-scroll="${scrollId}"]`

    const observe = (el: HTMLElement) => {
      observedRef.current = el
      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setVisible(true) },
        { threshold },
      )
      observer.observe(el)
      return observer
    }

    const el = document.querySelector(sel) as HTMLElement | null
    if (el) {
      const obs = observe(el)
      return () => obs.disconnect()
    }

    const mo = new MutationObserver(() => {
      const found = document.querySelector(sel) as HTMLElement | null
      if (found && found !== observedRef.current) {
        observe(found)
        mo.disconnect()
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [scrollId, threshold])

  return { attr: { 'data-scroll': scrollId }, visible }
}