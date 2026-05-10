import { useCallback, useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import './VolumeControl.css'

const SHORTS_VOLUME_KEY = 'gym-shorts-volume'
const DEFAULT_VOLUME = 0
const RESTORE_VOLUME = 70

export const readStoredShortsVolume = () => {
  if (typeof window === 'undefined') return DEFAULT_VOLUME
  const stored = Number(window.localStorage.getItem(SHORTS_VOLUME_KEY))
  if (!Number.isFinite(stored)) return DEFAULT_VOLUME
  return Math.min(100, Math.max(0, stored))
}

interface VolumeControlProps {
  onVolumeChange: (volume: number) => void
}

export default function VolumeControl({ onVolumeChange }: VolumeControlProps) {
  const [volume, setVolume] = useState(readStoredShortsVolume)

  useEffect(() => {
    onVolumeChange(volume)
  }, [onVolumeChange, volume])

  const updateVolume = useCallback((nextVolume: number) => {
    const normalizedVolume = Math.min(100, Math.max(0, nextVolume))
    setVolume(normalizedVolume)
    window.localStorage.setItem(SHORTS_VOLUME_KEY, String(normalizedVolume))
  }, [])

  const toggleVolume = useCallback(() => {
    updateVolume(volume === 0 ? RESTORE_VOLUME : 0)
  }, [updateVolume, volume])

  const stopSwipeCapture = (event: React.SyntheticEvent) => {
    event.stopPropagation()
  }

  return (
    <div
      className="shorts-volume-control"
      onClick={stopSwipeCapture}
      onDoubleClick={stopSwipeCapture}
      onPointerDown={stopSwipeCapture}
      onTouchStart={stopSwipeCapture}
      onWheel={stopSwipeCapture}
    >
      <button
        type="button"
        className="shorts-volume-trigger"
        aria-label={volume === 0 ? 'Bật âm thanh' : 'Tắt âm thanh'}
        onClick={toggleVolume}
      >
        {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>
      <div className="shorts-volume-slider-wrap">
        <input
          className="shorts-volume-slider"
          type="range"
          min={0}
          max={100}
          value={volume}
          aria-label="Âm lượng Shorts"
          onChange={(event) => updateVolume(Number(event.target.value))}
        />
      </div>
    </div>
  )
}
