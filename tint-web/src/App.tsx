import { useState, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from './lib/supabase'
import type { AppState, UserProfile } from './utils/storage'
import { getUser, saveAppState } from './utils/storage'
import { checkUserExists, saveNewUserToSupabase, loadUserFromSupabase, syncAppStateToSupabase } from './utils/supabaseStorage'
import SplashScreen from './screens/SplashScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import TodoScreen from './screens/TodoScreen'
import ProductivityScreen from './screens/ProductivityScreen'
import LeaderboardScreen from './screens/LeaderboardScreen'

type Screen = 'splash' | 'onboarding' | 'todo' | 'productivity' | 'leaderboard'
type MainTab = 'todo' | 'productivity' | 'leaderboard'

const DEFAULT_APP_STATE: AppState = {
  user: { name: '', avatar: '🎯', examTypes: [], createdAt: '' },
  streak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  history: [],
  totalTasksCompleted: 0,
}

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

        // Check for pending profile from onboarding redirect
        const pendingRaw = sessionStorage.getItem('tint_pending_profile')
        if (pendingRaw) {
          try {
            const pending = JSON.parse(pendingRaw) as UserProfile
            const exists = await checkUserExists(session.user.id)
            if (!exists) {
              await saveNewUserToSupabase(session.user.id, session.user.email || '', pending)
            }
          } catch {
            // ignore parse errors
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

      // Fallback to localStorage
      const localUser = getUser()
      if (localUser) {
        setShowTabs(true)
        setScreen('todo')
      } else {
        setScreen('onboarding')
      }
    })()
  }, [])

  const handleOnboardingComplete = useCallback((_profile: UserProfile) => {
    // kept for type compat - onboarding now uses OAuth redirect
  }, [])

  const handleStateChange = useCallback((newState: AppState) => {
    setAppState(newState)
    saveAppState(newState)
    if (userIdRef.current) {
      void syncAppStateToSupabase(userIdRef.current, newState)
    }
  }, [])

  const TAB_ITEMS: { id: MainTab; label: string; emoji: string }[] = [
    { id: 'todo', label: 'Today', emoji: '📋' },
    { id: 'productivity', label: 'Progress', emoji: '📊' },
    { id: 'leaderboard', label: 'Rank', emoji: '🏆' },
  ]

  const tabToScreen = (tab: MainTab): Screen => tab

  const handleTabPress = (tab: MainTab) => {
    setActiveTab(tab)
    setScreen(tabToScreen(tab))
  }

  const renderScreen = () => {
    switch (screen) {
      case 'todo':
        return <TodoScreen appState={appState} onStateChange={handleStateChange} />
      case 'productivity':
        return <ProductivityScreen appState={appState} />
      case 'leaderboard':
        return <LeaderboardScreen appState={appState} />
      default:
        return null
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', position: 'relative', minHeight: '100dvh' }}>
      <AnimatePresence mode="wait">
        {screen === 'splash' && (
          <motion.div key="splash" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <SplashScreen onFinish={handleSplashFinish} />
          </motion.div>
        )}

        {screen === 'onboarding' && (
          <motion.div key="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <OnboardingScreen onComplete={handleOnboardingComplete} />
          </motion.div>
        )}

        {screen !== 'splash' && screen !== 'onboarding' && (
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

      {/* Bottom tab bar */}
      {showTabs && screen !== 'splash' && screen !== 'onboarding' && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 480,
            background: '#0F0F1A',
            borderTop: '1px solid #1E1E35',
            display: 'flex',
            zIndex: 500,
            paddingBottom: 'env(safe-area-inset-bottom, 0)',
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
                  padding: '10px 0 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '20%',
                      right: '20%',
                      height: 2,
                      background: '#7C3AED',
                      borderRadius: '0 0 2px 2px',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span style={{ fontSize: 20 }}>{tab.emoji}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: isActive ? '#7C3AED' : '#6060A0',
                    letterSpacing: '0.03em',
                    transition: 'color 0.15s',
                  }}
                >
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
