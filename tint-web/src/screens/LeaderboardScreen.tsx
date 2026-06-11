import { useState, useEffect } from 'react'
import type { AppState } from '../utils/storage'
import { loadLeaderboard, type LeaderboardRow } from '../utils/supabaseStorage'
import { supabase } from '../lib/supabase'

interface LeaderboardScreenProps {
  appState: AppState
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function LeaderboardScreen({ appState }: LeaderboardScreenProps) {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [myId, setMyId] = useState<string | null>(null)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setMyId(session.user.id)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    void loadLeaderboard().then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [])

  const totalDays = appState.history.length
  const perfectDays = appState.history.filter((h) => h.consistency >= 100).length
  const myConsistency = totalDays > 0 ? Math.round((perfectDays / totalDays) * 100) : 0

  const allRows: LeaderboardRow[] = rows.some((r) => r.id === myId)
    ? rows
    : [
        ...rows,
        {
          id: myId || 'me',
          name: appState.user.name || 'You',
          avatar: appState.user.avatar,
          streak: appState.streak,
          consistency_score: myConsistency,
        },
      ]

  const sorted = [...allRows]
    .sort((a, b) => b.consistency_score - a.consistency_score || b.streak - a.streak || (a.name || '').localeCompare(b.name || ''))
    .map((r, i) => ({ ...r, rank: i + 1, isYou: r.id === myId }))

  const myRank = sorted.find((r) => r.isYou)?.rank ?? 0

  return (
    <div
      className="app-screen"
      style={{ display: 'flex', flexDirection: 'column', background: '#080C14', fontFamily: 'Inter,sans-serif', overflow: 'hidden' }}
    >
      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg,#0D1321,#080C14)', padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ color: '#F1F5F9', fontSize: 22, fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>Leaderboard</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 3 }}>Ranked by Consistency Score</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['daily', 'weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                  background: period === p ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.06)',
                  color: period === p ? '#C7D2FE' : 'rgba(255,255,255,0.35)',
                  fontFamily: "'Syne',sans-serif",
                  border: 'none',
                }}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {myRank > 0 && (
          <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 12, padding: '8px 14px', marginTop: 12, textAlign: 'center' }}>
            <p style={{ color: '#FBBF24', fontSize: 18, fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>#{myRank}</p>
            <p style={{ color: 'rgba(251,191,36,0.5)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Rank</p>
          </div>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as never, padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 40 }}>Loading...</p>
        ) : sorted.map((u, i) => {
          const isTop = i < 3
          const isYou = u.isYou
          return (
            <div
              key={u.id}
              className="rank-row"
              style={{
                animationDelay: `${i * 0.045}s`,
                background: isYou ? 'rgba(99,102,241,0.1)' : isTop ? 'rgba(251,191,36,0.05)' : 'rgba(255,255,255,0.03)',
                border: '1px solid ' + (isYou ? 'rgba(99,102,241,0.3)' : isTop ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)'),
                borderRadius: 16,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
                {isTop
                  ? <span style={{ fontSize: 18 }}>{MEDALS[i]}</span>
                  : <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600 }}>#{i + 1}</span>
                }
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: isYou ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                {u.avatar}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: isYou ? '#A5B4FC' : '#E2E8F0', fontSize: 14, fontWeight: isYou ? 700 : 500, fontFamily: isYou ? "'Syne',sans-serif" : 'Inter,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.name}{isYou ? ' (you)' : ''}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center' }}>
                  <span style={{ color: '#FB923C', fontSize: 11 }}>🔥 {u.streak}d</span>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>·</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{u.consistency_score}% consistent</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ color: i < 3 ? '#FBBF24' : i < 10 ? '#4ADE80' : 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>#{u.rank}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</p>
              </div>
            </div>
          )
        })}
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: 11, paddingTop: 8 }}>Rankings update daily based on task completion</p>
      </div>
    </div>
  )
}
