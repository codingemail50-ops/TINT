import { useState, useEffect } from 'react'
import type { AppState } from '../utils/storage'
import { getTodayTasks, saveTodayTasks, recordDayCompletion } from '../utils/storage'
import type { Task } from '../data/examPresets'
import TaskItem from '../components/TaskItem'
import Confetti from '../components/Confetti'

interface TodoScreenProps {
  appState: AppState
  onStateChange: (s: AppState) => void
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

export default function TodoScreen({ appState, onStateChange }: TodoScreenProps) {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [tasks, setTasks] = useState<Task[]>([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [showAllDone, setShowAllDone] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState<Task | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newDuration, setNewDuration] = useState(30)
  const [newCategory, setNewCategory] = useState('Other')
  const [newRepeat, setNewRepeat] = useState(false)
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all')

  const dates = getDateStrings(15)
  const isToday = selectedDate === today
  const todayComplete = tasks.length > 0 && tasks.every((t) => t.completed)

  useEffect(() => {
    if (selectedDate === today) {
      setTasks(getTodayTasks(appState.user.examTypes))
    } else {
      const rec = appState.history.find((h) => h.date === selectedDate)
      setTasks(rec ? rec.tasks : [])
    }
  }, [selectedDate, appState.history, appState.user.examTypes, today])

  const handleToggle = (id: string) => {
    if (!isToday) return
    const updated = tasks.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    )
    setTasks(updated)
    saveTodayTasks(updated)
    const allDone = updated.length > 0 && updated.every((t) => t.completed)
    if (allDone && !todayComplete) {
      setShowConfetti(true)
      setShowAllDone(true)
    }
    onStateChange(recordDayCompletion(updated))
  }

  const handleDelete = (id: string) => {
    if (!isToday) return
    const updated = tasks.filter((t) => t.id !== id)
    setTasks(updated)
    saveTodayTasks(updated)
    onStateChange(recordDayCompletion(updated))
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
    onStateChange(recordDayCompletion(updated))
  }

  const handleEditDuration = (task: Task, duration: number) => {
    const updated = tasks.map((t) => (t.id === task.id ? { ...t, duration } : t))
    setTasks(updated)
    saveTodayTasks(updated)
    setShowEditModal(null)
  }

  const completedCount = tasks.filter((t) => t.completed).length
  const pct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0
  const todayDate = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

  const inp = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: '13px 16px',
    color: '#F1F5F9',
    fontSize: 15,
    fontFamily: 'Inter,sans-serif',
    outline: 'none',
  }

  return (
    <div className="app-screen" style={{ display: 'flex', flexDirection: 'column', background: '#080C14', fontFamily: 'Inter,sans-serif', overflow: 'hidden' }}>
      {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

      {/* All done popup */}
      {showAllDone && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
          <div style={{ background: '#1A1F2E', borderRadius: 20, padding: 24, width: '100%', maxWidth: 320, border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', animation: 'fadeInUp 0.4s ease' }}>
            <div style={{ fontSize: 48 }}>🏆</div>
            <h2 style={{ color: '#F1F5F9', fontSize: 22, fontWeight: 800, fontFamily: "'Syne',sans-serif", marginTop: 12 }}>All Done!</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 6 }}>100% today — keep the streak!</p>
            <p style={{ color: '#FB923C', fontSize: 16, fontWeight: 700, marginTop: 8 }}>🔥 {appState.streak} day streak</p>
            <button
              onClick={() => setShowAllDone(false)}
              style={{ marginTop: 20, padding: '12px 32px', background: 'rgba(99,102,241,0.35)', border: '1px solid rgba(99,102,241,0.5)', borderRadius: 12, color: '#C7D2FE', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}
            >
              Keep Going →
            </button>
          </div>
        </div>
      )}

      {/* Scrollable area */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as never }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(180deg,#0D1321 0%,#080C14 100%)', padding: '20px 20px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            {/* Avatar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 14, padding: '6px 8px' }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{appState.user.avatar || '⭐'}</span>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 8, fontWeight: 600, letterSpacing: '0.05em' }}>EDIT</span>
            </div>
            {/* Title */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <h1 style={{ color: '#F1F5F9', fontSize: 22, fontWeight: 800, fontFamily: "'Syne',system-ui,sans-serif", lineHeight: 1.1 }}>Today's Tasks</h1>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 3, fontWeight: 500 }}>{todayDate}</p>
            </div>
            {/* Streak */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              <span style={{ fontSize: 24 }}>🔥</span>
              <span style={{ color: '#FB923C', fontSize: 10, fontWeight: 700 }}>{appState.streak}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 10, marginBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Daily progress</span>
              <span style={{ color: pct === 100 ? '#4ADE80' : 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600 }}>{pct}%</span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 100 }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: pct >= 100 ? 'linear-gradient(90deg,#22C55E,#4ADE80)' : pct >= 65 ? 'linear-gradient(90deg,#EAB308,#4ADE80)' : pct >= 35 ? 'linear-gradient(90deg,#F97316,#EAB308)' : 'linear-gradient(90deg,#EF4444,#F97316)',
                borderRadius: 100,
                transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: pct >= 100 ? '0 0 12px rgba(34,197,94,0.6)' : pct >= 65 ? '0 0 10px rgba(234,179,8,0.5)' : pct >= 35 ? '0 0 10px rgba(249,115,22,0.5)' : '0 0 10px rgba(239,68,68,0.45)',
              }} />
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {[
              { l: 'Done',   v: completedCount,           c: '#4ADE80', bg: 'rgba(34,197,94,0.1)' },
              { l: 'Left',   v: tasks.length - completedCount, c: '#818CF8', bg: 'rgba(99,102,241,0.1)' },
              { l: 'Streak', v: appState.streak + 'd',    c: '#FB923C', bg: 'rgba(0,0,0,0.2)' },
            ].map((s) => (
              <div key={s.l} style={{ flex: 1, textAlign: 'center', background: s.bg, borderRadius: 10, padding: '8px 4px' }}>
                <p style={{ color: s.c, fontSize: 15, fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>{s.v}</p>
                <p style={{ color: s.c, fontSize: 9, fontWeight: 600, opacity: 0.7, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginTop: 2 }}>{s.l}</p>
              </div>
            ))}
            {/* Water-fill Today% */}
            <div style={{ flex: 1, textAlign: 'center', background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '8px 4px', position: 'relative', overflow: 'hidden', minHeight: 52 }}>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: `${pct}%`,
                background: pct === 100 ? 'rgba(34,197,94,0.28)' : 'rgba(99,102,241,0.22)',
                transition: 'height 0.9s cubic-bezier(0.4,0,0.2,1)',
                borderRadius: pct > 95 ? 10 : '0 0 10px 10px',
                animation: 'waterRise 2.2s ease-in-out infinite',
              }} />
              <p style={{ position: 'relative', zIndex: 1, color: pct === 100 ? '#4ADE80' : '#818CF8', fontSize: 15, fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>{pct}%</p>
              <p style={{ position: 'relative', zIndex: 1, color: pct === 100 ? '#4ADE80' : '#818CF8', fontSize: 9, fontWeight: 600, opacity: 0.7, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginTop: 2 }}>Today</p>
            </div>
          </div>
        </div>

        {/* Date strip */}
        <div style={{ display: 'flex', gap: 6, padding: '12px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {dates.map((d) => (
            <button
              key={d.date}
              onClick={() => setSelectedDate(d.date)}
              style={{
                flexShrink: 0,
                padding: '8px 10px',
                borderRadius: 10,
                background: selectedDate === d.date ? 'rgba(99,102,241,0.35)' : d.isToday ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                border: selectedDate === d.date ? '1px solid rgba(99,102,241,0.6)' : d.isToday ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.06)',
                color: selectedDate === d.date ? '#C7D2FE' : d.isToday ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)',
                fontSize: 11,
                fontWeight: selectedDate === d.date ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Filter + Add */}
        <div style={{ padding: '12px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {([['all', 'All'], ['todo', 'To do'], ['done', 'Done']] as const).map(([f, l]) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                background: filter === f ? '#6366F1' : 'rgba(255,255,255,0.07)',
                color: filter === f ? '#fff' : 'rgba(255,255,255,0.55)',
                boxShadow: filter === f ? '0 0 14px rgba(99,102,241,0.4)' : 'none',
                transition: 'all 0.2s',
              }}>{l}</button>
            ))}
          </div>
          {isToday && (
            <button onClick={() => setShowAddModal(true)} style={{
              padding: '6px 14px', borderRadius: 100, border: '1px solid rgba(99,102,241,0.35)',
              cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: 'rgba(99,102,241,0.12)', color: '#A5B4FC', fontFamily: 'Inter,sans-serif',
            }}>+ Add</button>
          )}
        </div>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, paddingLeft: 18, paddingTop: 6, paddingBottom: 2 }}>Hold a task to remove it</p>

        {/* Task list */}
        <div style={{ padding: '4px 16px 100px' }}>
          {tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)' }}>
              <div style={{ fontSize: 32 }}>📭</div>
              <div style={{ marginTop: 8, fontSize: 14 }}>{isToday ? 'No tasks yet' : 'No data for this day'}</div>
            </div>
          ) : tasks
            .filter((t) => filter === 'done' ? t.completed : filter === 'todo' ? !t.completed : true)
            .map((task, i) => (
            <TaskItem
              key={task.id}
              task={task}
              index={i}
              onToggle={handleToggle}
              onDelete={handleDelete}
              readOnly={!isToday}
            />
          ))}
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 }}
          onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}
        >
          <div style={{ width: '100%', background: '#0F172A', borderRadius: '24px 24px 0 0', padding: '24px 20px 40px', border: '1px solid rgba(255,255,255,0.08)', animation: 'fadeInUp 0.3s ease forwards', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: '#F1F5F9' }}>Add Task</h2>
              <button onClick={() => setShowAddModal(false)} style={{ color: 'rgba(255,255,255,0.45)', fontSize: 22, cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}>✕</button>
            </div>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title..."
              autoFocus
              style={{ ...inp, marginBottom: 14 }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
            />
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Duration: {newDuration} min</div>
              <input type="range" min={15} max={180} step={15} value={newDuration} onChange={(e) => setNewDuration(Number(e.target.value))} style={{ width: '100%', accentColor: '#6366F1' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Category</div>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ ...inp, marginBottom: 0 }}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <button
                onClick={() => setNewRepeat(!newRepeat)}
                style={{ width: 36, height: 20, borderRadius: 10, background: newRepeat ? '#6366F1' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}
              >
                <div style={{ position: 'absolute', top: 2, left: newRepeat ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#F1F5F9', transition: 'left 0.2s' }} />
              </button>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Repeat daily</span>
            </div>
            <button
              onClick={handleAddTask}
              disabled={!newTitle.trim()}
              style={{ width: '100%', padding: 16, background: newTitle.trim() ? 'linear-gradient(135deg,rgba(99,102,241,0.45),rgba(139,92,246,0.35))' : 'rgba(255,255,255,0.06)', border: newTitle.trim() ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 16, color: newTitle.trim() ? '#C7D2FE' : 'rgba(255,255,255,0.3)', fontSize: 16, fontWeight: 800, cursor: newTitle.trim() ? 'pointer' : 'not-allowed', fontFamily: "'Syne',sans-serif" }}
            >
              Add Task
            </button>
          </div>
        </div>
      )}

      {/* Edit Duration Modal */}
      {showEditModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={(e) => e.target === e.currentTarget && setShowEditModal(null)}
        >
          <div style={{ background: '#1A1F2E', borderRadius: 20, padding: 24, border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: 320 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: '#F1F5F9', marginBottom: 6 }}>Edit Duration</h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>{showEditModal.title}</p>
            <EditDurationSlider
              initial={showEditModal.duration}
              onConfirm={(d) => handleEditDuration(showEditModal, d)}
              onCancel={() => setShowEditModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function EditDurationSlider({ initial, onConfirm, onCancel }: { initial: number; onConfirm: (d: number) => void; onCancel: () => void }) {
  const [val, setVal] = useState(initial)
  return (
    <>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Duration: {val} min</div>
      <input type="range" min={15} max={180} step={15} value={val} onChange={(e) => setVal(Number(e.target.value))} style={{ width: '100%', accentColor: '#6366F1', marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Cancel</button>
        <button onClick={() => onConfirm(val)} style={{ flex: 1, padding: 10, background: 'rgba(99,102,241,0.35)', border: '1px solid rgba(99,102,241,0.5)', borderRadius: 8, color: '#C7D2FE', fontSize: 13, fontWeight: 600 }}>Save</button>
      </div>
    </>
  )
}
