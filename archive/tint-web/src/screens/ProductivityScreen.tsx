import { useState } from 'react'
import type { AppState } from '../utils/storage'

interface ProductivityScreenProps {
  appState: AppState
}

export default function ProductivityScreen({ appState }: ProductivityScreenProps) {
  const [period, setPeriod] = useState<'W' | 'M' | 'Y'>('W')

  const now = new Date()
  const totalDays = appState.history.length
  const perfectDays = appState.history.filter((h) => h.consistency >= 100).length
  const consistency = totalDays > 0 ? Math.round((perfectDays / totalDays) * 100) : 0

  // 14-day chart data
  const chartDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() - (13 - i))
    return d.toISOString().slice(0, 10)
  })
  const chartData = chartDays.map((date) => {
    const snap = appState.history.find((h) => h.date === date)
    return { date, pct: snap ? snap.consistency : null }
  })
  const valid = chartData.filter((d) => d.pct !== null) as { date: string; pct: number }[]

  // SVG chart
  const W = 320, H = 130, PAD_X = 28, PAD_Y = 16
  const plotW = W - PAD_X * 2
  const plotH = H - PAD_Y * 2
  const pts = valid.map((d) => {
    const idx = chartDays.indexOf(d.date)
    const x = PAD_X + (idx / (chartDays.length - 1)) * plotW
    const y = PAD_Y + plotH - (d.pct / 100) * plotH
    return { x, y, pct: d.pct, date: d.date }
  })
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = pts.length > 0
    ? `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(PAD_Y + plotH).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD_Y + plotH).toFixed(1)} Z`
    : ''

  // 30-day calendar heatmap
  const days30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() - (29 - i))
    return d.toISOString().slice(0, 10)
  })
  const statusColor: Record<string, string> = {
    green: '#22C55E', yellow: '#FBBF24', red: '#EF4444', none: 'rgba(255,255,255,0.07)',
  }
  const dayStatus = (date: string) => {
    const snap = appState.history.find((h) => h.date === date)
    if (!snap) return 'none'
    if (snap.consistency >= 100) return 'green'
    if (snap.consistency >= 50) return 'yellow'
    return 'red'
  }

  const stats = [
    { l: 'Current Streak', v: appState.streak + 'd', c: '#FB923C', bg: 'rgba(249,115,22,0.1)' },
    { l: 'Perfect Days', v: perfectDays, c: '#4ADE80', bg: 'rgba(34,197,94,0.1)' },
    { l: 'Consistency', v: consistency + '%', c: consistency >= 70 ? '#4ADE80' : consistency >= 40 ? '#FBBF24' : '#F87171', bg: 'rgba(99,102,241,0.08)' },
  ]

  return (
    <div
      className="app-screen"
      style={{ display: 'flex', flexDirection: 'column', background: '#080C14', fontFamily: 'Inter,sans-serif', overflow: 'hidden' }}
    >
      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg,#0D1321,#080C14)', padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <h1 style={{ color: '#F1F5F9', fontSize: 22, fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>Your Progress</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>You vs 100% consistency</p>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as never, padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 8 }}>
          {stats.map((s) => (
            <div key={s.l} style={{ flex: 1, textAlign: 'center', background: s.bg, borderRadius: 12, padding: '12px 6px', animation: 'revealUp 0.5s ease both' }}>
              <p style={{ color: s.c, fontSize: 18, fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>{s.v}</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 600, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Line chart */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 16, animation: 'revealUp 0.5s ease 0.05s both' }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>14-Day Consistency</p>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((v) => {
              const y = PAD_Y + plotH - (v / 100) * plotH
              return (
                <g key={v}>
                  <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                  <text x={PAD_X - 4} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={8}>{v}</text>
                </g>
              )
            })}
            {areaPath && (
              <path d={areaPath} fill="url(#areaGrad)" opacity={0.3} />
            )}
            {linePath && (
              <path d={linePath} fill="none" stroke="#6366F1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            )}
            {pts.map((p) => (
              <circle key={p.date} cx={p.x} cy={p.y} r={3} fill="#6366F1" />
            ))}
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366F1" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
              </linearGradient>
            </defs>
          </svg>
          {pts.length === 0 && (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12, marginTop: 8 }}>Complete tasks to see your chart</p>
          )}
        </div>

        {/* 30-day heatmap */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 16, animation: 'revealUp 0.5s ease 0.1s both' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>30-Day History</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ c: '#22C55E', l: 'All done' }, { c: '#FBBF24', l: 'Partial' }, { c: '#EF4444', l: 'Missed' }].map((s) => (
                <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.c }} />
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>{s.l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
            {days30.map((date) => {
              const status = dayStatus(date)
              return (
                <div
                  key={date}
                  title={date}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 4,
                    background: statusColor[status],
                    border: date === now.toISOString().slice(0, 10) ? '1px solid rgba(255,255,255,0.4)' : 'none',
                  }}
                />
              )
            })}
          </div>
        </div>

        {/* Period selector placeholder */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 16, animation: 'revealUp 0.5s ease 0.2s both' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Time per Category</p>
            <div style={{ display: 'flex', gap: 3 }}>
              {(['W', 'M', 'Y'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: '3px 9px',
                    borderRadius: 7,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 10,
                    fontWeight: 700,
                    background: period === p ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.06)',
                    color: period === p ? '#C7D2FE' : 'rgba(255,255,255,0.35)',
                    fontFamily: "'Syne',sans-serif",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          {appState.history.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>Complete tasks to see category breakdown</p>
          ) : (
            (() => {
              const nDays = period === 'W' ? 7 : period === 'M' ? 30 : 365
              const cutoff = new Date(now)
              cutoff.setDate(now.getDate() - nDays)
              const cutoffStr = cutoff.toISOString().slice(0, 10)
              const cats: Record<string, number> = {}
              for (const day of appState.history) {
                if (day.date < cutoffStr) continue
                for (const task of day.tasks) {
                  if (!task.completed) continue
                  const cat = (task as { category?: string }).category || 'Other'
                  cats[cat] = (cats[cat] || 0) + ((task as { duration?: number }).duration || 30)
                }
              }
              const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 5)
              const catColors: Record<string, string> = {
                Drawing: '#A78BFA', Aptitude: '#38BDF8', Theory: '#FBBF24', Health: '#4ADE80',
                Math: '#6366F1', Physics: '#38BDF8', Chemistry: '#4ADE80', Other: '#94A3B8',
              }
              if (entries.length === 0) return <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>No data for this period</p>
              const max = entries[0][1]
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {entries.map(([cat, mins]) => (
                    <div key={cat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: catColors[cat] || '#94A3B8', fontSize: 12, fontWeight: 600 }}>{cat}</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{Math.round(mins / 60)}h {mins % 60}m</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${(mins / max) * 100}%`, background: catColors[cat] || '#94A3B8', borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()
          )}
        </div>
      </div>
    </div>
  )
}
