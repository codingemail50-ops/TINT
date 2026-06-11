import { useState } from 'react'
import type { AppState } from '../utils/storage'
import type { LeaderboardEntry } from '../data/leaderboard'
import { MOCK_LEADERBOARD } from '../data/leaderboard'
import LeaderboardCard from '../components/LeaderboardCard'

interface LeaderboardScreenProps {
  appState: AppState
}

const EXAM_FILTERS = ['ALL', 'JEE', 'UCEED', 'NID', 'NIFT']
const EXAM_COLORS: Record<string, string> = {
  JEE: '#7C3AED',
  UCEED: '#0EA5E9',
  NID: '#EC4899',
  NIFT: '#F59E0B',
}

export default function LeaderboardScreen({ appState }: LeaderboardScreenProps) {
  const [filter, setFilter] = useState('ALL')

  // Build user entry
  const userExam = appState.user.examTypes[0] || 'JEE'
  const history7 = appState.history.slice(-7)
  const userConsistency = history7.length > 0
    ? Math.round(history7.reduce((s, d) => s + d.consistency, 0) / history7.length)
    : 0

  const userEntry: LeaderboardEntry = {
    id: 'user',
    name: appState.user.name,
    avatar: appState.user.avatar,
    exam: userExam,
    streak: appState.streak,
    consistency: userConsistency,
    totalTasks: appState.totalTasksCompleted,
  }

  // Combine and filter
  const allEntries = [...MOCK_LEADERBOARD, userEntry]
  const filtered = filter === 'ALL' ? allEntries : allEntries.filter((e) => e.exam === filter)

  // Sort by consistency desc
  const sorted = [...filtered].sort((a, b) => b.consistency - a.consistency || b.streak - a.streak)

  // Top 3 and rest
  const top3 = sorted.slice(0, 3)
  const rest = sorted.slice(3)

  const getPodiumOrder = () => {
    // Podium: 2nd, 1st, 3rd
    if (top3.length < 3) return top3.map((e, i) => ({ entry: e, rank: i + 1 }))
    return [
      { entry: top3[1], rank: 2 },
      { entry: top3[0], rank: 1 },
      { entry: top3[2], rank: 3 },
    ]
  }

  const podiumHeights: Record<number, number> = { 1: 90, 2: 70, 3: 55 }
  const podiumColors: Record<number, string> = { 1: '#F59E0B', 2: '#A0A0C0', 3: '#CD7C4E' }

  return (
    <div style={{ minHeight: '100dvh', background: '#080810', padding: '16px 16px 88px' }}>
      <div className="bebas" style={{ fontSize: 28, color: '#7C3AED', marginBottom: 16, letterSpacing: '0.05em' }}>
        LEADERBOARD
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto' }}>
        {EXAM_FILTERS.map((f) => {
          const color = f === 'ALL' ? '#7C3AED' : EXAM_COLORS[f]
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                flexShrink: 0,
                padding: '7px 14px',
                borderRadius: 20,
                background: filter === f ? (f === 'ALL' ? '#7C3AED' : color) : 'transparent',
                color: filter === f ? '#F0F0FF' : '#A0A0C0',
                fontSize: 12,
                fontWeight: 600,
                border: `1px solid ${filter === f ? (f === 'ALL' ? '#7C3AED' : color) : '#1E1E35'}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f}
            </button>
          )
        })}
      </div>

      {/* Podium */}
      {top3.length >= 2 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 24,
            padding: '0 8px',
          }}
        >
          {getPodiumOrder().map(({ entry, rank }) => {
            const isUser = entry.id === 'user'
            const examColor = EXAM_COLORS[entry.exam] || '#7C3AED'
            const podH = podiumHeights[rank] || 55
            const medalColor = podiumColors[rank] || '#A0A0C0'

            return (
              <div
                key={entry.id}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: 110 }}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>{entry.avatar}</div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: isUser ? '#7C3AED' : '#A0A0C0',
                    textAlign: 'center',
                    marginBottom: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                  }}
                >
                  {entry.name}
                  {isUser && ' 👤'}
                </div>
                <div style={{ fontSize: 11, color: '#6060A0', marginBottom: 4 }}>
                  {entry.consistency}%
                </div>
                <div
                  style={{
                    width: '100%',
                    height: podH,
                    background: `${examColor}22`,
                    border: `2px solid ${medalColor}`,
                    borderRadius: '8px 8px 0 0',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    paddingTop: 8,
                  }}
                >
                  <span style={{ fontSize: rank === 1 ? 20 : 16 }}>
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Rest of the list */}
      <div>
        {rest.map((entry, i) => (
          <LeaderboardCard
            key={entry.id}
            entry={entry}
            rank={i + 4}
            isUser={entry.id === 'user'}
            index={i}
          />
        ))}
        {sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#6060A0', fontSize: 14 }}>
            No entries for this filter
          </div>
        )}
      </div>
    </div>
  )
}
