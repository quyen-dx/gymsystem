import { HeartFilled } from '@ant-design/icons'

export interface FloatingHeart {
  id: string
  x: number
  y: number
  rotate: number
  driftX: number
  scale: number
}

interface HeartAnimationLayerProps {
  hearts: FloatingHeart[]
  onHeartDone: (id: string) => void
}

export default function HeartAnimationLayer({ hearts, onHeartDone }: HeartAnimationLayerProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      {hearts.map((heart) => (
        <HeartFilled
          key={heart.id}
          className="absolute text-[92px] text-[#ff2d55] opacity-0 drop-shadow-[0_16px_32px_rgba(0,0,0,0.48)] [filter:drop-shadow(0_0_12px_rgba(255,45,85,0.35))]"
          style={{
            left: heart.x,
            top: heart.y,
            transform: `translate(-50%, -50%) rotate(${heart.rotate}deg) scale(${heart.scale})`,
            animation: `shorts-floating-heart 900ms cubic-bezier(.2,.8,.2,1) forwards`,
            ['--heart-drift-x' as string]: `${heart.driftX}px`,
            ['--heart-rotate' as string]: `${heart.rotate}deg`,
            ['--heart-scale' as string]: heart.scale,
          }}
          onAnimationEnd={() => onHeartDone(heart.id)}
        />
      ))}
    </div>
  )
}
