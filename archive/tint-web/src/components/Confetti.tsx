import { useEffect, useRef } from 'react'

interface ConfettiProps {
  onComplete?: () => void
}

const COLORS = ['#7C3AED', '#F59E0B', '#10B981', '#EF4444', '#0EA5E9', '#EC4899', '#F97316']

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  alpha: number
  size: number
  isSquare: boolean
  rotation: number
  rotationSpeed: number
}

export default function Confetti({ onComplete }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: Particle[] = []
    for (let i = 0; i < 70; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 50,
        vx: (Math.random() - 0.5) * 4,
        vy: -(Math.random() * 6 + 4),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 1,
        size: Math.random() * 8 + 4,
        isSquare: Math.random() > 0.5,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      })
    }

    const startTime = Date.now()

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      let allDone = true
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.25 // gravity
        p.rotation += p.rotationSpeed

        // Fade in upper 30% of screen
        if (p.y < canvas.height * 0.3) {
          p.alpha = Math.max(0, p.alpha - 0.02)
        }

        if (p.alpha > 0) allDone = false

        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color

        if (p.isSquare) {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.restore()
      }

      const elapsed = Date.now() - startTime
      if (allDone || elapsed > 4000) {
        cancelAnimationFrame(rafRef.current)
        onComplete?.()
        return
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(rafRef.current)
  }, [onComplete])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  )
}
