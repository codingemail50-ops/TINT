import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AppState } from '../utils/storage'
import { getTodayTasks, saveTodayTasks, recordDayCompletion } from '../utils/storage'
import type { Task } from '../data/examPresets'
import TaskItem from '../components/TaskItem'
import Confetti from '../components/Confetti'

interface TodoScreenProps {
  appState: AppState
  onStateChange: (s: AppState) => void
  onSignOut?: () => void
}

const CATEGORIES = [
  'Math', 'Physics', 'Chemistry', 'PYQs', 'Revision',
  'Drawing', 'Visual Design', 'Spatial', 'Design Theory', 'Portfolio',
  'Studio Drawing', 'Memory Drawing', 'Design Aptitude', 'Design History',
  'Creative Exploration', 'Fashion Illustration', 'Creative Ability',
  'General Ability', 'Situation Test', 'Other',
]

function getDateStrings(count: number): { date: string; label: string; isToday: boolean }[] {
  const result = []
  const today = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
    result.push({
      date: dateStr,
      label: dayNames[d.getDay()] + ' ' + d.getDate(),
      isToday: i === 0,
    })
  }
  return result
}

export default function TodoScreen({ appState, onStateChange, onSignOut }: TodoScreenProps) {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [tasks, setTasks] = useState<Task[]>([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [showTrophy, setShowTrophy] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState<Task | null>(null)

  // Add task form state
  const [newTitle, setNewTitle] = useState('')
  const [newDuration, setNewDuration] = useState(30)
  const [newCategory, setNewCategory] = useState('Other')
  const [newRepeat, setNewRepeat] = useState(false)

  const dates = getDateStrings(15)
  const isToday = selectedDate === today
  const todayComplete = tasks.length > 0 && tasks.every((t) => t.completed)

  useEffect(() => {
    if (selectedDate === today) {
      const t = getTodayTasks(appState.user.examTypes)
      setTasks(t)
    } else {
      const rec = appState.history.find((h) => h.date === selectedDate)
      setTasks(rec ? rec.tasks : [])
    }
  }, [selectedDate, appState.history, appState.user.examTypes, today])

  const handleToggle = (id: string) => {
    if (!isToday) return
    const updated = tasks.map((t) =>
      t.id === id
        ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined }
        : t
    )
    setTasks(updated)
    saveTodayTasks(updated)

    const allDone = updated.length > 0 && updated.every((t) => t.completed)
    if (allDone && !todayComplete) {
      setShowConfetti(true)
      setShowTrophy(true)
    }

    const newState = recordDayCompletion(updated)
    onStateChange(newState)
  }

  const handleDelete = (id: string) => {
    if (!isToday) return
    const updated = tasks.filter((t) => t.id !== id)
    setTasks(updated)
    saveTodayTasks(updated)
    const newState = recordDayCompletion(updated)
    onStateChange(newState)
  }

  const handleAddTask = () => {
    if (!newTitle.trim()) return
    const newTask: Task = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      duration: newDuration,
      category: newCategory,
      isCustom: true,
      completed: false,
      repeat: newRepeat,
    }
    const updated = [...tasks, newTask]
    setTasks(updated)
    saveTodayTasks(updated)
    setNewTitle('')
    setNewDuration(30)
    setNewCategory('Other')
    setNewRepeat(false)
    setShowAddModal(false)
    const newState = recordDayCompletion(updated)
    onStateChange(newState)
  }

  const handleEditDuration = (task: Task, duration: number) => {
    const updated = tasks.map((t) => (t.id === task.id ? { ...t, duration } : t))
    setTasks(updated)
    saveTodayTasks(updated)
    setShowEditModal(null)
  }

  const completedCount = tasks.filter((t) => t.completed).length
  const consistency = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0

  return (
    <div style={{ minHeight: '100dvh', background: '#080810', paddingBottom: 80 }}>
      {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

      {/* Trophy popup */}
      {showTrophy && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: -20 }}
          style={{
            position: 'fixed',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#13132A',
            border: '1px solid #F59E0B44',
            borderRadius: 16,
            padding: '16px 24px',
            textAlign: 'center',
            zIndex: 9990,
            boxShadow: '0 4px 24px rgba(245,158,11,0.2)',
          }}
        >
          <div style={{ fontSize: 40 }}>🏆</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F59E0B', marginTop: 4 }}>All Done!</div>
          <div style={{ fontSize: 12, color: '#A0A0C0', marginTop: 2 }}>100% today!</div>
          <button
            onClick={() => setShowTrophy(false)}
            style={{ marginTop: 10, fontSize: 12, color: '#6060A0' }}
          >
            ✕ Close
          </button>
        </motion.div>
      )}

      {/* Header */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="bebas" style={{ fontSize: 28, color: '#7C3AED' }}>TODAY'S TASKS</div>
            <div style={{ fontSize: 13, color: '#6060A0', marginTop: 2 }}>
              {completedCount}/{tasks.length} completed · {consistency}%
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 13, color: '#A0A0C0' }}>
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                title="Sign out"
                style={{
                  background: 'none',
                  border: '1px solid #1E1E35',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 11,
                  color: '#6060A0',
                  cursor: 'pointer',
                }}
              >
                Sign out
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: '#1E1E35', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${consistency}%` }}
            style={{
              height: '100%',
              background: consistency >= 70 ? '#10B981' : consistency >= 40 ? '#F59E0B' : '#EF4444',
              borderRadius: 2,
            }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Date strip */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '12px 16px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {dates.map((d) => (
          <button
            key={d.date}
            onClick={() => setSelectedDate(d.date)}
            style={{
              flexShrink: 0,
              padding: '8px 10px',
              borderRadius: 10,
              background: selectedDate === d.date ? '#7C3AED' : d.isToday ? '#13132A' : '#0F0F1A',
              border: selectedDate === d.date ? '1px solid #7C3AED' : d.isToday ? '1px solid #3A3A5C' : '1px solid #1E1E35',
              color: selectedDate === d.date ? '#F0F0FF' : d.isToday ? '#A0A0C0' : '#6060A0',
              fontSize: 11,
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div style={{ padding: '4px 16px' }}>
        <AnimatePresence>
          {tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#6060A0' }}>
              <div style={{ fontSize: 32 }}>📭</div>
              <div style={{ marginTop: 8, fontSize: 14 }}>
                {isToday ? 'No tasks yet' : 'No data for this day'}
              </div>
            </div>
          ) : (
            tasks.map((task, i) => (
              <TaskItem
                key={task.id}
                task={task}
                index={i}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onLongPress={isToday ? (t) => setShowEditModal(t) : undefined}
                readOnly={!isToday}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* FAB */}
      {isToday && (
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            position: 'fixed',
            bottom: 88,
            right: 20,
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: '#7C3AED',
            color: '#F0F0FF',
            fontSize: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
            cursor: 'pointer',
            zIndex: 100,
            transition: 'transform 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          +
        </button>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8,8,16,0.8)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 1000,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            style={{
              width: '100%',
              background: '#0F0F1A',
              borderRadius: '16px 16px 0 0',
              padding: 20,
              border: '1px solid #1E1E35',
              borderBottom: 'none',
              maxWidth: 600,
              margin: '0 auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="bebas" style={{ fontSize: 22, color: '#7C3AED' }}>ADD TASK</div>
              <button onClick={() => setShowAddModal(false)} style={{ color: '#6060A0', fontSize: 18 }}>✕</button>
            </div>

            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title..."
              autoFocus
              style={{
                width: '100%',
                padding: '12px 14px',
                background: '#13132A',
                border: '1px solid #1E1E35',
                borderRadius: 8,
                color: '#F0F0FF',
                fontSize: 15,
                outline: 'none',
                marginBottom: 14,
              }}
            />

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#A0A0C0', marginBottom: 8 }}>
                Duration: {newDuration} min
              </div>
              <input
                type="range"
                min={15}
                max={180}
                step={15}
                value={newDuration}
                onChange={(e) => setNewDuration(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#7C3AED' }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#A0A0C0', marginBottom: 6 }}>Category</div>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#13132A',
                  border: '1px solid #1E1E35',
                  borderRadius: 8,
                  color: '#F0F0FF',
                  fontSize: 14,
                  outline: 'none',
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <button
                onClick={() => setNewRepeat(!newRepeat)}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: newRepeat ? '#7C3AED' : '#1E1E35',
                  position: 'relative',
                  transition: 'background 0.2s',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: newRepeat ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#F0F0FF',
                    transition: 'left 0.2s',
                  }}
                />
              </button>
              <span style={{ fontSize: 13, color: '#A0A0C0' }}>Repeat daily</span>
            </div>

            <button
              onClick={handleAddTask}
              disabled={!newTitle.trim()}
              style={{
                width: '100%',
                padding: '14px',
                background: newTitle.trim() ? '#7C3AED' : '#3A3A5C',
                color: '#F0F0FF',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: newTitle.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Add Task
            </button>
          </motion.div>
        </div>
      )}

      {/* Edit Duration Modal */}
      {showEditModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8,8,16,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowEditModal(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: '#0F0F1A',
              borderRadius: 16,
              padding: 20,
              border: '1px solid #1E1E35',
              width: '100%',
              maxWidth: 320,
            }}
          >
            <div className="bebas" style={{ fontSize: 20, color: '#7C3AED', marginBottom: 12 }}>
              EDIT DURATION
            </div>
            <div style={{ fontSize: 13, color: '#A0A0C0', marginBottom: 16 }}>{showEditModal.title}</div>

            <EditDurationSlider
              initial={showEditModal.duration}
              onConfirm={(d) => handleEditDuration(showEditModal, d)}
              onCancel={() => setShowEditModal(null)}
            />
          </motion.div>
        </div>
      )}
    </div>
  )
}

function EditDurationSlider({ initial, onConfirm, onCancel }: { initial: number; onConfirm: (d: number) => void; onCancel: () => void }) {
  const [val, setVal] = useState(initial)
  return (
    <>
      <div style={{ fontSize: 12, color: '#A0A0C0', marginBottom: 8 }}>Duration: {val} min</div>
      <input
        type="range"
        min={15}
        max={180}
        step={15}
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#7C3AED', marginBottom: 16 }}
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '10px',
            background: 'transparent',
            border: '1px solid #1E1E35',
            borderRadius: 8,
            color: '#A0A0C0',
            fontSize: 13,
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(val)}
          style={{
            flex: 1,
            padding: '10px',
            background: '#7C3AED',
            borderRadius: 8,
            color: '#F0F0FF',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Save
        </button>
      </div>
    </>
  )
}
