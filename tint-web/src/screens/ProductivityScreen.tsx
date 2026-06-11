import { useState } from 'react'
import { motion } from 'framer-motion'
import type { AppState } from '../utils/storage'
import { getConsistencyData, getHeatmapData } from '../utils/storage'
import FlameIcon from '../components/FlameIcon'
import ConsistencyGraph from '../components/ConsistencyGraph'
import { REALITY_CHECK_MESSAGES } from '../data/examPresets'

interface ProductivityScreenProps {
  appState: AppState
}

const HEATMAP_COLORS = ['#1E1E35', '#10B98133', '#10B98166', '#10B98199', '#10B981']

export default function ProductivityScreen({ appState }: ProductivityScreenProps) {
  const [graphMode, setGraphMode] = useState<'week' | 'youvsyou'>('week')

  const chartData = getConsistencyData(appState.history)
  const heatmapData = getHeatmapData(appState.history)
  const avg7Day = chartData.length > 0
    ? Math.round(chartData.reduce((s, p) => s + p.value, 0) / chartData.length)
    : 0

  const realityMsg = REALITY_CHECK_MESSAGES.slice().reverse().find((r) => avg7Day >= r.threshold)
    || REALITY_CHECK_MESSAGES[0]

  const insights: string[] = []
  if (avg7Day >= 80) insights.push('🔥 You\'re in the top tier — stay consistent!')
  if (avg7Day >= 50 && avg7Day < 80) insights.push('📈 Good momentum! Aim for 80%+ this week.')
  if (avg7Day < 50) insights.push('💡 Try completing at least 2 tasks a day to build the habit.')
  if (appState.streak >= 7) insights.push(`⚡ ${appState.streak}-day streak! Don\'t break the chain.`)
  if (appState.streak === 0) insights.push('🌱 Start your streak today — day 1 is always the hardest.')

  const statCards = [
    { emoji: '🔥', label: 'Current Streak', value: `${appState.streak}d`, color: '#F59E0B' },
    { emoji: '🏆', label: 'Best Streak', value: `${appState.longestStreak}d`, color: '#7C3AED' },
    { emoji: '✅', label: 'Total Tasks', value: String(appState.totalTasksCompleted), color: '#10B981' },
    { emoji: '📊', label: '7-Day Avg', value: `${avg7Day}%`, color: avg7Day >= 70 ? '#10B981' : avg7Day >= 40 ? '#F59E0B' : '#EF4444' },
  ]

  return (
    <div style={{ minHeight: '100dvh', background: '#080810', padding: '16px 16px 88px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <FlameIcon streak={appState.streak} consistency={avg7Day} size={48} />
        <div>
          <div className="bebas" style={{ fontSize: 24, color: '#F0F0FF', letterSpacing: '0.05em' }}>
            {appState.user.name}
          </div>
          <div style={{ fontSize: 12, color: '#6060A0' }}>
            {appState.user.examTypes.join(' · ')}
          </div>
        </div>
      </div>

      {/* Stat cards 2x2 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginBottom: 20,
        }}
      >
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            style={{
              background: '#0F0F1A',
              border: '1px solid #1E1E35',
              borderRadius: 12,
              padding: '14px 16px',
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 4 }}>{card.emoji}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 11, color: '#6060A0', marginTop: 2 }}>{card.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Graph tabs */}
      <div style={{ background: '#0F0F1A', border: '1px solid #1E1E35', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 0, background: '#13132A', borderRadius: 8, padding: 3, marginBottom: 16 }}>
          {(['week', 'youvsyou'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setGraphMode(mode)}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 6,
                background: graphMode === mode ? '#7C3AED' : 'transparent',
                color: graphMode === mode ? '#F0F0FF' : '#6060A0',
                fontSize: 12,
                fontWeight: 600,
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
            >
              {mode === 'week' ? 'This Week' : 'You vs You'}
            </button>
          ))}
        </div>
        <ConsistencyGraph data={chartData} showYouVsYou={graphMode === 'youvsyou'} />
      </div>

      {/* Heatmap */}
      <div style={{ background: '#0F0F1A', border: '1px solid #1E1E35', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#A0A0C0', marginBottom: 12 }}>
          Last 70 Days
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(10, 1fr)',
            gap: 4,
          }}
        >
          {heatmapData.map((cell, i) => (
            <motion.div
              key={cell.date}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.005, duration: 0.2 }}
              title={`${cell.date}: ${cell.value}%`}
              style={{
                aspectRatio: '1',
                borderRadius: 3,
                background: HEATMAP_COLORS[cell.level],
                cursor: 'default',
              }}
            />
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 10, color: '#6060A0' }}>Less</span>
          {HEATMAP_COLORS.map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
          ))}
          <span style={{ fontSize: 10, color: '#6060A0' }}>More</span>
        </div>
      </div>

      {/* Reality check */}
      <div
        style={{
          background: '#0F0F1A',
          border: `1px solid ${realityMsg.color}44`,
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 13, color: realityMsg.color, fontWeight: 600, marginBottom: 4 }}>
          Reality Check
        </div>
        <div style={{ fontSize: 13, color: '#A0A0C0', lineHeight: 1.5 }}>{realityMsg.message}</div>
      </div>

      {/* Insights */}
      {insights.slice(0, 3).map((tip, i) => (
        <div
          key={i}
          style={{
            background: '#0F0F1A',
            border: '1px solid #1E1E35',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 8,
            fontSize: 13,
            color: '#A0A0C0',
            lineHeight: 1.4,
          }}
        >
          {tip}
        </div>
      ))}
    </div>
  )
}
