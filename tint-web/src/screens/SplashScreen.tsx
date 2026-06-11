import { useEffect, useState } from 'react'
import { MOTIVATIONAL_QUOTES } from '../data/examPresets'

interface SplashScreenProps {
  onFinish: () => void
}

type Phase = 'tint' | 'tagline' | 'quote' | 'loading' | 'done'

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [phase, setPhase] = useState<Phase>('tint')
  const [dots, setDots] = useState('')
  const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    timers.push(setTimeout(() => setPhase('tagline'), 800))
    timers.push(setTimeout(() => setPhase('quote'), 1800))
    timers.push(setTimeout(() => setPhase('loading'), 3000))
    timers.push(setTimeout(() => { setPhase('done'); onFinish() }, 5000))
    return () => timers.forEach(clearTimeout)
  }, [onFinish])

  useEffect(() => {
    if (phase !== 'loading') return
    let count = 0
    const iv = setInterval(() => {
      count = (count + 1) % 4
      setDots('.'.repeat(count))
    }, 300)
    return () => clearInterval(iv)
  }, [phase])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#080810',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        zIndex: 9999,
      }}
    >
      {/* TINT Logo */}
      <div
        className="bebas"
        style={{
          fontSize: 96,
          color: '#7C3AED',
          letterSpacing: '0.1em',
          opacity: phase !== 'done' ? 1 : 0,
          transform: phase === 'tint' ? 'scale(0.8)' : 'scale(1)',
          transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          textShadow: '0 0 40px #7C3AED88',
        }}
      >
        TINT
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 16,
          color: '#A0A0C0',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          opacity: phase === 'tagline' || phase === 'quote' || phase === 'loading' ? 1 : 0,
          transform: phase === 'tagline' || phase === 'quote' || phase === 'loading' ? 'translateY(0)' : 'translateY(10px)',
          transition: 'all 0.5s ease',
        }}
      >
        THERE IS NO TOMORROW
      </div>

      {/* Quote */}
      <div
        style={{
          maxWidth: 320,
          textAlign: 'center',
          marginTop: 24,
          opacity: phase === 'quote' || phase === 'loading' ? 1 : 0,
          transform: phase === 'quote' || phase === 'loading' ? 'translateY(0)' : 'translateY(10px)',
          transition: 'all 0.5s ease',
        }}
      >
        <div style={{ fontSize: 14, color: '#F0F0FF', fontStyle: 'italic', lineHeight: 1.5 }}>
          "{quote.quote}"
        </div>
        <div style={{ fontSize: 12, color: '#6060A0', marginTop: 8 }}>— {quote.author}</div>
      </div>

      {/* Loading dots */}
      <div
        style={{
          marginTop: 32,
          opacity: phase === 'loading' ? 1 : 0,
          transition: 'opacity 0.3s',
        }}
      >
        <span style={{ fontSize: 20, color: '#7C3AED', letterSpacing: '0.2em' }}>
          {dots}
        </span>
      </div>
    </div>
  )
}
