import { createClient } from '@supabase/supabase-js';
import { UserProfile, Task, HistoryEntry, FocusLog } from '../types';
import { calcStreak, calcConsistency, calcFocusMetrics } from './logic';

const SUPABASE_URL = 'https://qjjnnmrlvkzdefrvkxtr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqam5ubXJsdmt6ZGVmcnZreHRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4NTQ2MTAsImV4cCI6MjA1OTQzMDYxMH0.qCOdDWCZsOkU5RCVA1MWf_-RxDxnyMhMFn3S4VvbL1E';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function syncToCloud(
  email: string,
  profile: UserProfile,
  tasks: Task[],
  history: HistoryEntry[],
  focusLog: FocusLog[],
): Promise<void> {
  try {
    const { streak, missedDays } = calcStreak(history);
    const consistency_score = calcConsistency(history);
    const { focusToday, focusWeek, focusTotal } = calcFocusMetrics(focusLog);
    const { data: { session } } = await supabase.auth.getSession();

    await supabase.from('user_data').upsert(
      {
        id: session?.user?.id,
        email,
        name: profile.name,
        avatar: profile.avatar,
        exams: profile.exams,
        tasks,
        history,
        focus_log: focusLog,
        streak,
        consistency_score,
        focus_today: focusToday,
        focus_week: focusWeek,
        focus_total: focusTotal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    );
  } catch {}
}

export async function loadFromCloud(email: string) {
  try {
    const { data } = await supabase
      .from('user_data')
      .select('*')
      .eq('email', email)
      .single();
    return data;
  } catch {
    return null;
  }
}

export async function fetchLeaderboard() {
  try {
    const { data } = await supabase
      .from('leaderboard_view')
      .select('name,avatar,email,streak,consistency_score,focus_today,focus_week,focus_total')
      .order('consistency_score', { ascending: false })
      .order('streak', { ascending: false })
      .limit(50);
    return data ?? [];
  } catch {
    return [];
  }
}
