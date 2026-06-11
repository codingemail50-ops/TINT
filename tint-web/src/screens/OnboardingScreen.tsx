import { useState } from 'react'
import { EXAM_TYPES, AVATARS } from '../data/examPresets'
import type { UserProfile } from '../utils/storage'
import { supabase } from '../lib/supabase'

interface OnboardingScreenProps {
  onComplete: (profile: UserProfile) => void
}

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
  transition: 'border-color 0.2s',
}

export default function OnboardingScreen({ onComplete: _onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('🦁')
  const [selectedExams, setSelectedExams] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const toggleExam = (id: string) => {
    setSelectedExams((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id])
  }

  const handleGoogleSignUp = async () => {
    setLoading(true)
    const profile: UserProfile = {
      name: name.trim(),
      avatar,
      examTypes: selectedExams,
      createdAt: new Date().toISOString(),
    }
    sessionStorage.setItem('tint_pending_profile', JSON.stringify(profile))
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const canStep0 = name.trim().length >= 2
  const canStep1 = selectedExams.length > 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05070F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '0 0 32px', fontFamily: 'Inter,sans-serif' }}>
      {/* Orbs */}
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.15),transparent 70%)', top: -200, left: -200, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,0.1),transparent 70%)', bottom: -150, right: -150, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 420, padding: '0 24px', animation: 'fadeInUp 0.5s ease forwards' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginBottom: 8 }}>
            {['T', 'I', 'N', 'T'].map((l, i) => (
              <span key={i} style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 32, color: '#fff', textShadow: '0 0 20px rgba(99,102,241,0.5)' }}>{l}</span>
            ))}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Let's set you up</p>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 28 }}>
          {[0, 1, 2].map((s) => (
            <div key={s} style={{ height: 4, width: s === step ? 24 : 8, borderRadius: 2, background: s <= step ? 'rgba(99,102,241,0.8)' : 'rgba(255,255,255,0.1)', transition: 'all 0.3s' }} />
          ))}
        </div>

        {/* Step 0: Name + Avatar */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name..."
                maxLength={30}
                autoFocus
                style={inp}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                onKeyDown={(e) => e.key === 'Enter' && canStep0 && setStep(1)}
              />
            </div>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Pick Your Avatar</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAvatar(a)}
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      fontSize: 22,
                      background: avatar === a ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.04)',
                      border: avatar === a ? '2px solid rgba(99,102,241,0.7)' : '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transform: avatar === a ? 'scale(1.1)' : 'scale(1)',
                      transition: 'all 0.15s',
                      boxShadow: avatar === a ? '0 0 14px rgba(99,102,241,0.4)' : 'none',
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setStep(1)}
              disabled={!canStep0}
              style={{ padding: 16, background: canStep0 ? 'linear-gradient(135deg,rgba(99,102,241,0.45),rgba(139,92,246,0.35))' : 'rgba(255,255,255,0.06)', border: canStep0 ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 16, color: canStep0 ? '#C7D2FE' : 'rgba(255,255,255,0.3)', fontSize: 16, fontWeight: 800, cursor: canStep0 ? 'pointer' : 'not-allowed', fontFamily: "'Syne',sans-serif", marginTop: 8 }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 1: Exams */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>Exams You're Preparing For</label>
              {selectedExams.length === 0 && <p style={{ color: 'rgba(239,68,68,0.8)', fontSize: 11, marginBottom: 8 }}>Select at least one to continue</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {EXAM_TYPES.map((exam) => {
                  const sel = selectedExams.includes(exam.id)
                  return (
                    <button
                      key={exam.id}
                      onClick={() => toggleExam(exam.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: sel ? `${exam.color}15` : 'rgba(255,255,255,0.03)', border: sel ? `1px solid ${exam.color}55` : '1px solid rgba(255,255,255,0.08)', borderRadius: 14, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                    >
                      <span style={{ fontSize: 24 }}>{exam.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: sel ? exam.color : '#F1F5F9' }}>{exam.label}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{exam.description}</div>
                      </div>
                      <div style={{ width: 20, height: 20, borderRadius: 4, border: sel ? `2px solid ${exam.color}` : '2px solid rgba(255,255,255,0.2)', background: sel ? exam.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {sel && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(0)} style={{ flex: 1, padding: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer' }}>← Back</button>
              <button
                onClick={() => setStep(2)}
                disabled={!canStep1}
                style={{ flex: 2, padding: 14, background: canStep1 ? 'linear-gradient(135deg,rgba(99,102,241,0.45),rgba(139,92,246,0.35))' : 'rgba(255,255,255,0.06)', border: canStep1 ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 14, color: canStep1 ? '#C7D2FE' : 'rgba(255,255,255,0.3)', fontSize: 15, fontWeight: 800, cursor: canStep1 ? 'pointer' : 'not-allowed', fontFamily: "'Syne',sans-serif" }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Review + Sign Up */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', border: '2px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>{avatar}</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 24, color: '#F1F5F9' }}>{name}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {selectedExams.map((id) => {
                const exam = EXAM_TYPES.find((e) => e.id === id)
                if (!exam) return null
                return (
                  <span key={id} style={{ padding: '4px 12px', background: `${exam.color}22`, color: exam.color, borderRadius: 20, fontSize: 12, fontWeight: 700, border: `1px solid ${exam.color}44` }}>
                    {exam.emoji} {exam.label}
                  </span>
                )
              })}
            </div>
            <button
              onClick={handleGoogleSignUp}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', padding: 16, background: '#FFFFFF', color: '#111', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 2px 12px rgba(0,0,0,0.4)', border: 'none', marginTop: 8 }}
            >
              <span style={{ fontSize: 18, fontWeight: 700 }}>G</span>
              {loading ? 'Redirecting...' : 'Sign up with Google'}
            </button>
            <button onClick={() => setStep(1)} style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
          </div>
        )}
      </div>
    </div>
  )
}
