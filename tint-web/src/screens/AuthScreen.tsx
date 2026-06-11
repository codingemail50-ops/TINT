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
    <div
      style={{
        minHeight: '100dvh',
        background: '#080810',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 0,
      }}
    >
      {/* Logo / Brand */}
      <div style={{ marginBottom: 8 }}>
        <div className="bebas" style={{ fontSize: 72, color: '#7C3AED', letterSpacing: '0.1em', lineHeight: 1 }}>
          TINT
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#6060A0', marginBottom: 56, letterSpacing: '0.05em' }}>
        STUDY SMARTER. RANK HIGHER.
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 300 }}>
        {/* Sign In */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '15px 24px',
            background: '#FFFFFF',
            color: '#111',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
            transition: 'opacity 0.2s',
            border: 'none',
          }}
        >
          <span style={{ fontSize: 18 }}>G</span>
          {loading ? 'Redirecting...' : 'Sign in with Google'}
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: '#1E1E35' }} />
          <span style={{ fontSize: 11, color: '#3A3A5C' }}>NEW HERE?</span>
          <div style={{ flex: 1, height: 1, background: '#1E1E35' }} />
        </div>

        {/* Sign Up */}
        <button
          onClick={onSignUp}
          style={{
            padding: '15px 24px',
            background: '#7C3AED',
            color: '#F0F0FF',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            transition: 'opacity 0.2s',
          }}
        >
          Create Account →
        </button>
      </div>

      <p style={{ fontSize: 11, color: '#3A3A5C', marginTop: 40, textAlign: 'center', maxWidth: 260 }}>
        Your progress syncs across all devices via Google
      </p>
    </div>
  )
}
