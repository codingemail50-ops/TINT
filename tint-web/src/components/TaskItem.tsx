import type { Task } from '../data/examPresets'
import { useRef } from 'react'

const CAT_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  Math:                  { bg: 'rgba(99,102,241,0.15)',  border: 'rgba(99,102,241,0.35)',  text: '#818CF8' },
  Physics:               { bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.3)',   text: '#38BDF8' },
  Chemistry:             { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',    text: '#4ADE80' },
  PYQs:                  { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',   text: '#FBBF24' },
  Revision:              { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',   text: '#FBBF24' },
  Drawing:               { bg: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.35)',  text: '#A78BFA' },
  'Visual Design':       { bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.3)',   text: '#38BDF8' },
  Spatial:               { bg: 'rgba(99,102,241,0.15)',  border: 'rgba(99,102,241,0.35)',  text: '#818CF8' },
  'Design Theory':       { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',   text: '#FBBF24' },
  Portfolio:             { bg: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.35)',  text: '#A78BFA' },
  'Studio Drawing':      { bg: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.35)',  text: '#A78BFA' },
  'Memory Drawing':      { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)',   text: '#FB923C' },
  'Design Aptitude':     { bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.3)',   text: '#38BDF8' },
  'Design History':      { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',   text: '#FBBF24' },
  'Creative Exploration':{ bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',    text: '#4ADE80' },
  'Fashion Illustration':{ bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)',   text: '#FB923C' },
  'Creative Ability':    { bg: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.35)',  text: '#A78BFA' },
  'General Ability':     { bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.3)',   text: '#38BDF8' },
  'Situation Test':      { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',   text: '#FBBF24' },
  Other:                 { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)',  text: '#94A3B8' },
}

const CAT_EMOJIS: Record<string, string> = {
  Math: '🔢', Physics: '⚛️', Chemistry: '🧪', PYQs: '📓', Revision: '📏',
  Drawing: '✏️', 'Visual Design': '🎨', Spatial: '🧩', 'Design Theory': '💡',
  Portfolio: '🖌️', 'Studio Drawing': '✏️', 'Memory Drawing': '🎭',
  'Design Aptitude': '📐', 'Design History': '📷', 'Creative Exploration': '🌿',
  'Fashion Illustration': '🎭', 'Creative Ability': '🎨', 'General Ability': '📓',
  'Situation Test': '🎯', Other: '📋',
}

interface TaskItemProps {
  task: Task
  index: number
  onToggle: (id: string) => void
  onDelete?: (id: string) => void
  readOnly?: boolean
}

export default function TaskItem({ task, index, onToggle, onDelete, readOnly }: TaskItemProps) {
  const cc = CAT_STYLES[task.category] || CAT_STYLES.Other
  const emoji = CAT_EMOJIS[task.category] || '📋'
  const done = !!task.completed
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startPress = () => {
    if (readOnly || !onDelete || !task.isCustom) return
    pressTimer.current = setTimeout(() => onDelete(task.id), 600)
  }
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
  }

  return (
    <div
      onClick={() => !readOnly && onToggle(task.id)}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: done ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.035)',
        border: '1px solid ' + (done ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)'),
        borderRadius: 16,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: readOnly ? 'default' : 'pointer',
        animation: `slideUp 0.4s cubic-bezier(0.4,0,0.2,1) ${index * 0.04}s both`,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {done && (
        <div style={{ position: 'absolute', inset: 0, borderRadius: 16, background: 'rgba(34,197,94,0.08)', pointerEvents: 'none' }} />
      )}
      {/* Emoji icon */}
      <div style={{
        width: 42, height: 42, borderRadius: 13, flexShrink: 0,
        background: cc.bg, border: '1px solid ' + cc.border,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
      }}>
        {emoji}
      </div>
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14, fontWeight: 600,
          color: done ? 'rgba(74,222,128,0.7)' : '#E2E8F0',
          fontFamily: 'Inter,sans-serif',
          textDecoration: done ? 'line-through' : 'none',
          textDecorationColor: 'rgba(74,222,128,0.5)',
        }}>
          {task.title}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{
            background: cc.bg, color: cc.text, fontSize: 9, fontWeight: 700,
            padding: '2px 7px', borderRadius: 100, textTransform: 'uppercase' as const,
            letterSpacing: '0.05em', border: '1px solid ' + cc.border,
          }}>
            {task.category}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>⏱ {task.duration}m</span>
          {task.repeat && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>🔁</span>}
        </div>
      </div>
      {/* Circle checkbox */}
      <div style={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        background: done ? '#22C55E' : 'transparent',
        border: '2px solid ' + (done ? '#22C55E' : 'rgba(255,255,255,0.18)'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.25s ease',
        boxShadow: done ? '0 0 10px rgba(34,197,94,0.5)' : 'none',
      }}>
        {done && <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>✓</span>}
      </div>
    </div>
  )
}
