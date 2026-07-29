import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface AuthScreenProps {
  onSignUp: () => void
}

export default function AuthScreen({ onSignUp }: AuthScreenProps) {
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05070F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '0 0 32px', fontFamily: 'Inter,sans-serif' }}>
      {/* Orbs */}
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.15),transparent 70%)', top: -200, left: -200, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,0.1),transparent 70%)', bottom: -150, right: -150, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 420, padding: '0 24px', animation: 'fadeInUp 0.5s ease forwards' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginBottom: 8 }}>
            {['T', 'I', 'N', 'T'].map((l, i) => (
              <span key={i} style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 48, color: '#fff', textShadow: '0 0 20px rgba(99,102,241,0.5)' }}>{l}</span>
            ))}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>There Is No Tomorrow</p>
        </div>

        {/* Sign In */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', padding: '16px', background: '#FFFFFF', color: '#111', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 2px 12px rgba(0,0,0,0.4)', border: 'none', marginBottom: 14 }}
        >
          <span style={{ fontSize: 18, fontWeight: 700 }}>G</span>
          {loading ? 'Redirecting...' : 'Sign in with Google'}
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em' }}>NEW HERE?</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Sign Up */}
        <button
          onClick={onSignUp}
          style={{ width: '100%', padding: 16, background: 'linear-gradient(135deg,rgba(99,102,241,0.45),rgba(139,92,246,0.35))', border: '1px solid rgba(99,102,241,0.5)', borderRadius: 16, color: '#C7D2FE', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}
        >
          Create Account →
        </button>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 24, textAlign: 'center' }}>
          Your progress syncs across all devices via Google
        </p>
      </div>
    </div>
  )
}
