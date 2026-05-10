import { useEffect, useRef, useState } from 'react'

const getDefaultPosition = (size) => {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  return {
    x: Math.max(0, window.innerWidth - size - 24),
    y: Math.max(0, window.innerHeight - size - 24),
  }
}

const clampPosition = (position, size) => {
  if (typeof window === 'undefined') return position
  return {
    x: Math.max(0, Math.min(position.x, window.innerWidth - size)),
    y: Math.max(0, Math.min(position.y, window.innerHeight - size)),
  }
}

export function useDraggable(initialPos, size = 56) {
  const [pos, setPos] = useState(() => clampPosition(initialPos || getDefaultPosition(size), size))
  const dragging = useRef(false)
  const pressed = useRef(false)
  const offset = useRef({ x: 0, y: 0 })
  const hasMoved = useRef(false)
  const pressTimer = useRef(null)
  const startPoint = useRef({ x: 0, y: 0 })
  const posRef = useRef(pos)
  const sizeRef = useRef(size)

  useEffect(() => {
    posRef.current = pos
  }, [pos])

  useEffect(() => {
    sizeRef.current = size
  }, [size])

  const stopDrag = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    pressed.current = false
    dragging.current = false
  }

  const onStart = (event) => {
    if (event.button !== undefined && event.button !== 0) return
    if (event.cancelable) event.preventDefault()
    pressed.current = true
    dragging.current = false
    hasMoved.current = false
    const point = event.touches ? event.touches[0] : event
    startPoint.current = { x: point.clientX, y: point.clientY }
    offset.current = { x: point.clientX - posRef.current.x, y: point.clientY - posRef.current.y }
    if (pressTimer.current) window.clearTimeout(pressTimer.current)
    pressTimer.current = window.setTimeout(() => {
      if (pressed.current) dragging.current = true
      pressTimer.current = null
    }, 300)
  }

  useEffect(() => {
    const onMove = (event) => {
      const point = event.touches ? event.touches[0] : event
      if (!point) return

      if (pressed.current && event.cancelable) {
        event.preventDefault()
      }

      const movedFar =
        Math.abs(point.clientX - startPoint.current.x) +
        Math.abs(point.clientY - startPoint.current.y) > 6

      if (!dragging.current) {
        if (pressed.current && movedFar) {
          dragging.current = true
          hasMoved.current = true
          if (event.cancelable) event.preventDefault()
          if (pressTimer.current) {
            window.clearTimeout(pressTimer.current)
            pressTimer.current = null
          }
        } else {
          return
        }
      }

      if (event.cancelable) event.preventDefault()
      hasMoved.current = true
      setPos(clampPosition({
        x: point.clientX - offset.current.x,
        y: point.clientY - offset.current.y,
      }, sizeRef.current))
    }

    const onResize = () => {
      setPos((current) => {
        const next = clampPosition(current, sizeRef.current)
        return next
      })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', stopDrag)
    window.addEventListener('mouseleave', stopDrag)
    window.addEventListener('blur', stopDrag)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', stopDrag)
    document.addEventListener('touchcancel', stopDrag)
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', stopDrag)
      window.removeEventListener('mouseleave', stopDrag)
      window.removeEventListener('blur', stopDrag)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', stopDrag)
      document.removeEventListener('touchcancel', stopDrag)
      window.removeEventListener('resize', onResize)
      stopDrag()
    }
  }, [])

  return { pos, onStart, hasMoved }
}
