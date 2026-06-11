import { useState, useEffect, useRef } from 'react'

type Phase = 'setup' | 'breathe' | 'active' | 'done'

const DURATIONS = [15, 25, 45, 60, 90]
const FOCUS_APPS = [
  { id: 'instagram', name: 'Instagram' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'twitter', name: 'Twitter/X' },
  { id: 'reddit', name: 'Reddit' },
  { id: 'snapchat', name: 'Snapchat' },
]

function saveFocusSession(mins: number) {
  try {
    const prev = JSON.parse(localStorage.getItem('tint_focus_sessions') || '[]') as { date: string; mins: number }[]
    prev.push({ date: new Date().toISOString().slice(0, 10), mins })
    localStorage.setItem('tint_focus_sessions', JSON.stringify(prev))
  } catch { /* ignore */ }
}

function getFocusStats() {
  try {
    const ss = JSON.parse(localStorage.getItem('tint_focus_sessions') || '[]') as { date: string; mins: number }[]
    const tod = new Date().toISOString().slice(0, 10)
    const wk = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
    const todM = ss.filter((s) => s.date === tod).reduce((a, s) => a + s.mins, 0)
    const wkM = ss.filter((s) => s.date >= wk).reduce((a, s) => a + s.mins, 0)
    const allM = ss.reduce((a, s) => a + s.mins, 0)
    return { todM, wkM, allM }
  } catch { return { todM: 0, wkM: 0, allM: 0 } }
}

function fmt(m: number) { return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m` }

export default function FocusScreen() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [duration, setDuration] = useState(25)
  const [timeLeft, setTimeLeft] = useState(0)
  const [blocked, setBlocked] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('tint_blocked_apps') || '[]') as string[] } catch { return ['instagram', 'youtube', 'tiktok'] }
  })
  const [showBlockSheet, setShowBlockSheet] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stats = getFocusStats()

  const toggleBlocked = (id: string) => {
    setBlocked((b) => {
      const next = b.includes(id) ? b.filter((x) => x !== id) : [...b, id]
      localStorage.setItem('tint_blocked_apps', JSON.stringify(next))
      return next
    })
  }

  const startFocus = () => setPhase('breathe')

  useEffect(() => {
    if (phase !== 'breathe') return
    const timer = setTimeout(() => {
      setTimeLeft(duration * 60)
      setPhase('active')
      timerRef.current = setInterval(() => {
        setTimeLeft((p) => {
          if (p <= 1) { clearInterval(timerRef.current!); saveFocusSession(duration); setPhase('done'); return 0 }
          return p - 1
        })
      }, 1000)
    }, 20000)
    return () => clearTimeout(timer)
  }, [phase, duration])

  const endFocus = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    const elapsedMins = Math.round((duration * 60 - timeLeft) / 60)
    if (elapsedMins >= 1) saveFocusSession(elapsedMins)
    setPhase('setup')
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const secs = String(timeLeft % 60).padStart(2, '0')
  const pct = phase === 'active' ? (duration * 60 - timeLeft) / (duration * 60) * 100 : 0

  const HG_W = 110, HG_H = 200
  const neckY = HG_H / 2, neckR = 5
  const topFill = 1 - pct / 100
  const botFill = pct / 100
  const topH = Math.round(topFill * (neckY - 16))
  const botH = Math.round(botFill * (neckY - 16))

  return (
    <div className="app-screen" style={{ background: '#05070F', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Inter,sans-serif' }}>
      {/* Distraction block sheet */}
      {showBlockSheet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end' }}
          onClick={(e) => e.target === e.currentTarget && setShowBlockSheet(false)}>
          <div style={{ background: '#0F172A', borderRadius: '24px 24px 0 0', width: '100%', padding: '24px 20px 40px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ color: '#F1F5F9', fontSize: 17, fontWeight: 700, marginBottom: 16, fontFamily: "'Syne',sans-serif" }}>Distraction Block</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FOCUS_APPS.map((app) => {
                const sel = blocked.includes(app.id)
                return (
                  <button key={app.id} onClick={() => toggleBlocked(app.id)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 12,
                    background: sel ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
                    border: '1px solid ' + (sel ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'),
                    color: sel ? '#FCA5A5' : 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}>
                    <span>{app.name}</span>
                    <div style={{
                      width: 20, height: 20, borderRadius: 4,
                      border: sel ? '2px solid #EF4444' : '2px solid rgba(255,255,255,0.2)',
                      background: sel ? '#EF4444' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {sel && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
                    </div>
                  </button>
                )
              })}
            </div>
            <button onClick={() => setShowBlockSheet(false)} style={{ marginTop: 20, width: '100%', padding: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 12, color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)' }}>Done</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: -0.3 }}>Focus Mode</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 }}>DEEP WORK</div>
          <button onClick={() => setShowBlockSheet(true)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 14, cursor: 'pointer', padding: '4px 8px' }}>⚙️</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>

        {phase === 'setup' && <>
          <div style={{ marginTop: 24, marginBottom: 8, fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>Session length</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
            {DURATIONS.map((d) => (
              <button key={d} onClick={() => setDuration(d)} style={{
                padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                background: duration === d ? '#6366F1' : 'rgba(255,255,255,0.07)',
                color: duration === d ? '#fff' : 'rgba(255,255,255,0.55)',
                transition: 'all 0.15s',
              }}>{d} min</button>
            ))}
          </div>

          <div style={{ marginBottom: 28 }}>
            <button onClick={() => setShowBlockSheet(true)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
              borderRadius: 14, border: '1.5px solid rgba(239,68,68,0.25)',
              background: 'rgba(239,68,68,0.05)', cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ fontSize: 22 }}>🔒</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>Distraction Block</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                  {blocked.length > 0
                    ? `${blocked.length} app${blocked.length > 1 ? 's' : ''} marked — ${blocked.map((id) => FOCUS_APPS.find((a) => a.id === id)?.name).filter(Boolean).join(', ')}`
                    : 'Tap to configure apps to avoid'}
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>⚙️</span>
            </button>
          </div>

          {stats.allM > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[{ l: 'Today', v: fmt(stats.todM) }, { l: 'This Week', v: fmt(stats.wkM) }, { l: 'All Time', v: fmt(stats.allM) }].map((st) => (
                <div key={st.l} style={{ flex: 1, textAlign: 'center', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.13)', borderRadius: 12, padding: '10px 4px' }}>
                  <div style={{ color: '#A5B4FC', fontSize: 13, fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>{st.v}</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, marginTop: 3, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{st.l}</div>
                </div>
              ))}
            </div>
          )}

          <button onClick={startFocus} style={{
            width: '100%', padding: 16, borderRadius: 16, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
            color: '#fff', fontSize: 16, fontWeight: 700, letterSpacing: 0.3,
            boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
          }}>Start Focus Session ⚡</button>
        </>}

        {phase === 'breathe' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 32 }}>Before you begin</div>
            <div style={{ position: 'relative', width: 180, height: 180, marginBottom: 32 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.3),rgba(99,102,241,0.05))', border: '2px solid rgba(99,102,241,0.4)', animation: 'breatheCircle 7s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', inset: '20%', borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,0.4),rgba(99,102,241,0.1))', animation: 'breatheCircle 7s ease-in-out infinite 0.3s' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 28 }}>🧘</span>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>BREATHE</div>
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>Breathe in... hold... breathe out</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 32 }}>Session starts in 20 seconds</div>
            <button onClick={() => {
              setTimeLeft(duration * 60)
              setPhase('active')
              timerRef.current = setInterval(() => {
                setTimeLeft((p) => {
                  if (p <= 1) { clearInterval(timerRef.current!); setPhase('done'); return 0 }
                  return p - 1
                })
              }, 1000)
            }} style={{ padding: '10px 24px', borderRadius: 12, border: '1px solid rgba(99,102,241,0.3)', background: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }}>Skip breathing</button>
          </div>
        )}

        {phase === 'active' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 28 }}>
            <div style={{ position: 'relative', width: HG_W, height: HG_H, marginBottom: 24 }}>
              <svg width={HG_W} height={HG_H} viewBox={`0 0 ${HG_W} ${HG_H}`}>
                <path d={`M10,0 L${HG_W - 10},0 L${HG_W / 2 + neckR},${neckY} L${HG_W - 10},${HG_H} L10,${HG_H} L${HG_W / 2 - neckR},${neckY} Z`}
                  fill="rgba(99,102,241,0.06)" stroke="rgba(99,102,241,0.25)" strokeWidth="1.5" />
                {topH > 0 && <>
                  <clipPath id="topClip"><rect x="0" y={neckY - topH} width={HG_W} height={topH} /></clipPath>
                  <path d={`M10,0 L${HG_W - 10},0 L${HG_W / 2 + neckR},${neckY} L${HG_W / 2 - neckR},${neckY} Z`}
                    fill="rgba(99,102,241,0.55)" clipPath="url(#topClip)" style={{ transition: 'all 1s linear' }} />
                </>}
                {botH > 0 && <>
                  <clipPath id="botClip"><rect x="0" y={HG_H - botH} width={HG_W} height={botH} /></clipPath>
                  <path d={`M${HG_W / 2 - neckR},${neckY} L${HG_W / 2 + neckR},${neckY} L${HG_W - 10},${HG_H} L10,${HG_H} Z`}
                    fill="rgba(139,92,246,0.6)" clipPath="url(#botClip)" style={{ transition: 'all 1s linear' }} />
                </>}
                {topFill > 0.02 && <>
                  <circle cx={HG_W / 2 - 1} cy={neckY} r="1.5" fill="rgba(168,85,247,0.9)" />
                  <circle cx={HG_W / 2 + 1} cy={neckY} r="1" fill="rgba(99,102,241,0.8)" />
                </>}
                <line x1={HG_W / 2 - neckR} y1={neckY} x2={HG_W / 2 + neckR} y2={neckY} stroke="rgba(99,102,241,0.4)" strokeWidth="1" />
              </svg>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>{mins}:{secs}</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', marginBottom: 20, fontWeight: 500 }}>Stay locked in</div>
            {blocked.length > 0 && (
              <div style={{ marginBottom: 20, padding: '6px 14px', borderRadius: 20, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 11, color: '#FCA5A5', letterSpacing: 0.3 }}>
                🔒 {blocked.length} app{blocked.length > 1 ? 's' : ''} blocked
              </div>
            )}
            <button onClick={endFocus} style={{ padding: '10px 28px', borderRadius: 14, border: '1.5px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: 'rgba(252,165,165,0.7)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>End Session</button>
          </div>
        )}

        {phase === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🔥</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Session Complete!</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>{duration} minutes of pure focus</div>
            <button onClick={() => setPhase('setup')} style={{ padding: '14px 32px', borderRadius: 16, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: 15, fontWeight: 700 }}>Start Another</button>
          </div>
        )}
      </div>
    </div>
  )
}
