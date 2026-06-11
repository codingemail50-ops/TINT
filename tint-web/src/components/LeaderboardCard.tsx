import { motion } from 'framer-motion'
import type { LeaderboardEntry } from '../data/leaderboard'

const EXAM_COLORS: Record<string, string> = {
  JEE: '#7C3AED',
  UCEED: '#0EA5E9',
  NID: '#EC4899',
  NIFT: '#F59E0B',
}

interface LeaderboardCardProps {
  entry: LeaderboardEntry
  rank: number
  isUser?: boolean
  index: number
}

export default function LeaderboardCard({ entry, rank, isUser, index }: LeaderboardCardProps) {
  const examColor = EXAM_COLORS[entry.exam] || '#7C3AED'

  const rankDisplay = () => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: isUser ? '#13132A' : '#0F0F1A',
        borderRadius: 12,
        border: isUser ? '1px solid #7C3AED55' : '1px solid #1E1E35',
        marginBottom: 8,
      }}
    >
      {/* Rank */}
      <div
        style={{
          width: 36,
          textAlign: 'center',
          fontSize: rank <= 3 ? 20 : 13,
          fontWeight: 700,
          color: '#A0A0C0',
          flexShrink: 0,
        }}
      >
        {rankDisplay()}
      </div>

      {/* Avatar */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: '#13132A',
          border: `2px solid ${examColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {entry.avatar}
      </div>

      {/* Name + details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#F0F0FF',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.name}
          </span>
          {isUser && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#7C3AED',
                background: '#7C3AED22',
                padding: '1px 5px',
                borderRadius: 4,
                flexShrink: 0,
              }}
            >
              YOU
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: '#6060A0' }}>🔥 {entry.streak}d</span>
          <span style={{ fontSize: 11, color: '#6060A0' }}>✅ {entry.totalTasks}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: examColor,
              background: `${examColor}22`,
              padding: '1px 5px',
              borderRadius: 3,
            }}
          >
            {entry.exam}
          </span>
        </div>
      </div>

      {/* Consistency */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F0FF' }}>{entry.consistency}%</div>
        <div style={{ fontSize: 10, color: '#6060A0' }}>consistency</div>
      </div>
    </motion.div>
  )
}
