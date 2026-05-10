import type { MouseEvent, TouchEvent, MutableRefObject } from 'react'

export function useDraggable(
  initialPos?: { x: number; y: number },
  size?: number,
): {
  pos: { x: number; y: number }
  onStart: (event: MouseEvent<HTMLElement> | TouchEvent<HTMLElement>) => void
  hasMoved: MutableRefObject<boolean>
}
