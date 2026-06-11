import { useState, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from './lib/supabase'
import type { AppState, UserProfile } from './utils/storage'
import { getUser, saveAppState } from './utils/storage'
import { checkUserExists, saveNewUserToSupabase, loadUserFromSupabase, syncAppStateToSupabase } from './utils/supabaseStorage'
import SplashScreen from './screens/SplashScreen'
import AuthScreen from './screens/AuthScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import TodoScreen from './screens/TodoScreen'
import ProductivityScreen from './screens/ProductivityScreen'
import LeaderboardScreen from './screens/LeaderboardScreen'

type Screen = 'splash' | 'auth' | 'onboarding' | 'todo' | 'productivity' | 'leaderboard'
type MainTab = 'todo' | 'productivity' | 'leaderboard'

const DEFAULT_APP_STATE: AppState = {
  user: { name: '', avatar: '⭐', examTypes: [], createdAt: '' },
  streak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  history: [],
  totalTasksCompleted: 0,
}

const TAB_ITEMS: { id: MainTab; label: string; emoji: string }[] = [
  { id: 'todo', label: 'Tasks', emoji: '📋' },
  { id: 'productivity', label: 'Progress', emoji: '📈' },
  { id: 'leaderboard', label: 'Board', emoji: '🏆' },
]

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash')
  const [activeTab, setActiveTab] = useState<MainTab>('todo')
  const [showTabs, setShowTabs] = useState(false)
  const [appState, setAppState] = useState<AppState>(DEFAULT_APP_STATE)
  const userIdRef = useRef<string | null>(null)

  const handleSplashFinish = useCallback(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        userIdRef.current = session.user.id

        const pendingRaw = sessionStorage.getItem('tint_pending_profile')
        if (pendingRaw) {
          try {
            const pending = JSON.parse(pendingRaw) as UserProfile
            const exists = await checkUserExists(session.user.id)
            if (!exists) {
              await saveNewUserToSupabase(session.user.id, session.user.email || '', pending)
            }
          } catch {
            // ignore
          }
          sessionStorage.removeItem('tint_pending_profile')
        }

        const loaded = await loadUserFromSupabase(session.user.id)
        if (loaded) {
          setAppState(loaded)
          setShowTabs(true)
          setScreen('todo')
          return
        }
      }

      const localUser = getUser()
      if (localUser) {
        setShowTabs(true)
        setScreen('todo')
      } else {
        setScreen('auth')
      }
    })()
  }, [])

  const handleOnboardingComplete = useCallback((_profile: UserProfile) => {
    // onboarding uses OAuth redirect
  }, [])

  const handleStateChange = useCallback((newState: AppState) => {
    setAppState(newState)
    saveAppState(newState)
    if (userIdRef.current) {
      void syncAppStateToSupabase(userIdRef.current, newState)
    }
  }, [])

  const handleTabPress = (tab: MainTab) => {
    setActiveTab(tab)
    setScreen(tab)
  }

  const renderScreen = () => {
    switch (screen) {
      case 'todo': return <TodoScreen appState={appState} onStateChange={handleStateChange} />
      case 'productivity': return <ProductivityScreen appState={appState} />
      case 'leaderboard': return <LeaderboardScreen appState={appState} />
      default: return null
    }
  }

  const isMain = screen !== 'splash' && screen !== 'auth' && screen !== 'onboarding'

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', position: 'relative', minHeight: '100dvh' }}>
      <AnimatePresence mode="wait">
        {screen === 'splash' && (
          <motion.div key="splash" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <SplashScreen onFinish={handleSplashFinish} />
          </motion.div>
        )}

        {screen === 'auth' && (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AuthScreen onSignUp={() => setScreen('onboarding')} />
          </motion.div>
        )}

        {screen === 'onboarding' && (
          <motion.div key="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <OnboardingScreen onComplete={handleOnboardingComplete} />
          </motion.div>
        )}

        {isMain && (
          <motion.div
            key={screen}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {renderScreen()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav — matches original */}
      {showTabs && isMain && (
        <div
          className="nav-safe"
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 480,
            display: 'flex',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(5,7,15,0.97)',
            backdropFilter: 'blur(20px)',
            zIndex: 500,
          }}
        >
          {TAB_ITEMS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabPress(tab.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 0',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.38)',
                }}
              >
                <div style={{
                  width: isActive ? 40 : 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 14,
                  background: isActive ? 'rgba(99,102,241,0.35)' : 'none',
                  transition: 'all 0.2s',
                }}>
                  <span style={{ fontSize: 18 }}>{tab.emoji}</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, letterSpacing: 0.3 }}>{tab.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
