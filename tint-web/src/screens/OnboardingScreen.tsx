import { useState } from 'react'
import { EXAM_TYPES, AVATARS } from '../data/examPresets'
import type { UserProfile } from '../utils/storage'
import { supabase } from '../lib/supabase'

interface OnboardingScreenProps {
  onComplete: (profile: UserProfile) => void
}

export default function OnboardingScreen({ onComplete: _onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('🎯')
  const [selectedExams, setSelectedExams] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const canProceedStep0 = name.trim().length >= 2
  const canProceedStep2 = selectedExams.length > 0

  const toggleExam = (id: string) => {
    setSelectedExams((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    )
  }

  const handleGoogleSignIn = async () => {
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

  const stepContent = () => {
    switch (step) {
      case 0:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
            <div className="bebas" style={{ fontSize: 48, color: '#7C3AED', letterSpacing: '0.05em' }}>
              WHAT'S YOUR NAME?
            </div>
            <p style={{ color: '#A0A0C0', fontSize: 14, textAlign: 'center' }}>
              This is how you'll appear on the leaderboard
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name..."
              maxLength={30}
              autoFocus
              style={{
                width: '100%',
                maxWidth: 320,
                padding: '14px 16px',
                background: '#0F0F1A',
                border: '1px solid #1E1E35',
                borderRadius: 10,
                color: '#F0F0FF',
                fontSize: 16,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#7C3AED')}
              onBlur={(e) => (e.target.style.borderColor = '#1E1E35')}
              onKeyDown={(e) => e.key === 'Enter' && canProceedStep0 && setStep(1)}
            />
            <button
              onClick={() => setStep(1)}
              disabled={!canProceedStep0}
              style={{
                padding: '14px 40px',
                background: canProceedStep0 ? '#7C3AED' : '#3A3A5C',
                color: '#F0F0FF',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: canProceedStep0 ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s',
              }}
            >
              Continue →
            </button>
          </div>
        )

      case 1:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
            <div className="bebas" style={{ fontSize: 48, color: '#7C3AED', letterSpacing: '0.05em' }}>
              PICK YOUR AVATAR
            </div>
            <p style={{ color: '#A0A0C0', fontSize: 14 }}>Choose your battle symbol</p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 10,
                maxWidth: 280,
              }}
            >
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    fontSize: 24,
                    background: avatar === a ? '#7C3AED22' : '#0F0F1A',
                    border: avatar === a ? '2px solid #7C3AED' : '1px solid #1E1E35',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setStep(0)}
                style={{
                  padding: '12px 24px',
                  background: 'transparent',
                  color: '#A0A0C0',
                  borderRadius: 10,
                  fontSize: 14,
                  border: '1px solid #1E1E35',
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(2)}
                style={{
                  padding: '12px 32px',
                  background: '#7C3AED',
                  color: '#F0F0FF',
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )

      case 2:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
            <div className="bebas" style={{ fontSize: 44, color: '#7C3AED', letterSpacing: '0.05em', textAlign: 'center' }}>
              YOUR EXAM(S)
            </div>
            <p style={{ color: '#A0A0C0', fontSize: 14, textAlign: 'center' }}>
              Select all that apply — we'll build your daily plan
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 360 }}>
              {EXAM_TYPES.map((exam) => {
                const selected = selectedExams.includes(exam.id)
                return (
                  <button
                    key={exam.id}
                    onClick={() => toggleExam(exam.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 16px',
                      background: selected ? `${exam.color}15` : '#0F0F1A',
                      border: selected ? `1px solid ${exam.color}` : '1px solid #1E1E35',
                      borderRadius: 12,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 28 }}>{exam.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: selected ? exam.color : '#F0F0FF' }}>
                        {exam.label}
                      </div>
                      <div style={{ fontSize: 12, color: '#6060A0', marginTop: 2 }}>{exam.description}</div>
                    </div>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 5,
                        border: selected ? `2px solid ${exam.color}` : '2px solid #3A3A5C',
                        background: selected ? exam.color : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selected && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  padding: '12px 24px',
                  background: 'transparent',
                  color: '#A0A0C0',
                  borderRadius: 10,
                  fontSize: 14,
                  border: '1px solid #1E1E35',
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                style={{
                  padding: '12px 32px',
                  background: canProceedStep2 ? '#7C3AED' : '#3A3A5C',
                  color: '#F0F0FF',
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: canProceedStep2 ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s',
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )

      case 3:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
            <div className="bebas" style={{ fontSize: 44, color: '#7C3AED', letterSpacing: '0.05em' }}>
              READY?
            </div>

            {/* Avatar preview */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: '#0F0F1A',
                border: '3px solid #7C3AED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 40,
              }}
            >
              {avatar}
            </div>

            {/* Name */}
            <div className="bebas" style={{ fontSize: 32, color: '#F0F0FF', letterSpacing: '0.05em' }}>
              {name}
            </div>

            {/* Exam badges */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {selectedExams.map((id) => {
                const exam = EXAM_TYPES.find((e) => e.id === id)
                if (!exam) return null
                return (
                  <span
                    key={id}
                    style={{
                      padding: '4px 12px',
                      background: `${exam.color}22`,
                      color: exam.color,
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: 600,
                      border: `1px solid ${exam.color}44`,
                    }}
                  >
                    {exam.emoji} {exam.label}
                  </span>
                )
              })}
            </div>

            <div style={{ height: 8 }} />

            {/* Google sign-in */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 28px',
                background: '#FFFFFF',
                color: '#111',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                transition: 'opacity 0.2s',
                minWidth: 240,
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 18 }}>G</span>
              {loading ? 'Redirecting...' : 'Continue with Google'}
            </button>

            <p style={{ fontSize: 12, color: '#6060A0', textAlign: 'center', maxWidth: 280 }}>
              Your progress syncs across all devices
            </p>

            <button
              onClick={() => setStep(2)}
              style={{
                color: '#6060A0',
                fontSize: 13,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#080810',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
        {[0, 1, 2, 3].map((s) => (
          <div
            key={s}
            style={{
              width: s === step ? 24 : 8,
              height: 8,
              borderRadius: 4,
              background: s === step ? '#7C3AED' : s < step ? '#7C3AED88' : '#1E1E35',
              transition: 'all 0.3s',
            }}
          />
        ))}
      </div>

      {stepContent()}
    </div>
  )
}
