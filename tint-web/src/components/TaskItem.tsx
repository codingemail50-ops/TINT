import { motion } from 'framer-motion'
import type { Task } from '../data/examPresets'

const CATEGORY_COLORS: Record<string, string> = {
  'Math': '#7C3AED',
  'Physics': '#0EA5E9',
  'Chemistry': '#10B981',
  'PYQs': '#F59E0B',
  'Revision': '#6060A0',
  'Drawing': '#EC4899',
  'Visual Design': '#0EA5E9',
  'Spatial': '#8B5CF6',
  'Design Theory': '#F59E0B',
  'Portfolio': '#10B981',
  'Studio Drawing': '#EC4899',
  'Memory Drawing': '#F97316',
  'Design Aptitude': '#8B5CF6',
  'Design History': '#6B7280',
  'Creative Exploration': '#10B981',
  'Fashion Illustration': '#F59E0B',
  'Creative Ability': '#EC4899',
  'General Ability': '#0EA5E9',
  'Situation Test': '#F97316',
}

interface TaskItemProps {
  task: Task
  index: number
  onToggle: (id: string) => void
  onDelete?: (id: string) => void
  onLongPress?: (task: Task) => void
  readOnly?: boolean
}

export default function TaskItem({ task, index, onToggle, onDelete, onLongPress, readOnly }: TaskItemProps) {
  const catColor = CATEGORY_COLORS[task.category] || '#7C3AED'

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      onContextMenu={(e) => {
        e.preventDefault()
        if (onLongPress) onLongPress(task)
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: '#0F0F1A',
        borderRadius: 12,
        border: '1px solid #1E1E35',
        marginBottom: 8,
        opacity: readOnly && !task.completed ? 0.5 : 1,
        cursor: readOnly ? 'default' : 'pointer',
      }}
    >
      {/* Checkbox */}
      <button
        onClick={() => !readOnly && onToggle(task.id)}
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: `2px solid ${task.completed ? catColor : '#3A3A5C'}`,
          background: task.completed ? catColor : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.2s',
          cursor: readOnly ? 'default' : 'pointer',
        }}
        disabled={readOnly}
      >
        {task.completed && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: task.completed ? '#6060A0' : '#F0F0FF',
              textDecoration: task.completed ? 'line-through' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {task.title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: catColor,
              background: `${catColor}22`,
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {task.category}
          </span>
          <span style={{ fontSize: 11, color: '#6060A0' }}>
            {task.duration}m
          </span>
          {task.repeat && (
            <span style={{ fontSize: 11, color: '#6060A0' }}>↻</span>
          )}
        </div>
      </div>

      {/* Delete button for custom tasks */}
      {task.isCustom && onDelete && !readOnly && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6060A0',
            flexShrink: 0,
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#6060A0')}
        >
          ✕
        </button>
      )}
    </motion.div>
  )
}
