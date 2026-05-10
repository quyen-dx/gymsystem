import { useCallback, useRef } from 'react'

interface TapPoint {
  x: number
  y: number
}

interface UseDoubleTapOptions {
  onDoubleTap: (point: TapPoint) => void
  delay?: number
  maxMove?: number
}

export default function useDoubleTap({
  onDoubleTap,
  delay = 280,
  maxMove = 18,
}: UseDoubleTapOptions) {
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY }
  }, [])

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (!start) return

    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y)
    if (moved > maxMove) return

    const now = Date.now()
    const lastTap = lastTapRef.current
    if (
      lastTap &&
      now - lastTap.time <= delay &&
      Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <= 48
    ) {
      lastTapRef.current = { time: now, x: event.clientX, y: event.clientY }
      const rect = event.currentTarget.getBoundingClientRect()
      onDoubleTap({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
      return
    }

    lastTapRef.current = { time: now, x: event.clientX, y: event.clientY }
  }, [delay, maxMove, onDoubleTap])

  return { onPointerDown, onPointerUp }
}
