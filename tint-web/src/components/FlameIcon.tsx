import { useEffect, useRef, useState } from 'react'

interface FlameIconProps {
  streak: number
  consistency: number
  size?: number
}

export default function FlameIcon({ streak, consistency, size = 64 }: FlameIconProps) {
  const rafRef = useRef<number>(0)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    let start: number | null = null
    const animate = (ts: number) => {
      if (!start) start = ts
      const elapsed = (ts - start) / 1000
      const breathe = 1 + 0.06 * Math.sin(elapsed * 2)
      setScale(breathe)
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  let color = '#6060A0'
  if (consistency >= 90) color = '#3B82F6'
  else if (consistency >= 75) color = '#F97316'
  else if (consistency >= 50) color = '#F59E0B'
  else if (consistency >= 25) color = '#EF4444'

  let emoji = '🌑'
  if (consistency >= 90) emoji = '💙'
  else if (consistency > 0) emoji = '🔥'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div
        style={{
          fontSize: size,
          lineHeight: 1,
          transform: `scale(${scale})`,
          filter: consistency > 0 ? `drop-shadow(0 0 12px ${color})` : 'none',
          transition: 'filter 0.3s',
          userSelect: 'none',
        }}
      >
        {emoji}
      </div>
      {streak > 0 && (
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color,
            letterSpacing: '0.03em',
          }}
        >
          {streak} day{streak !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}
