import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Fonts, Typography } from '../constants/theme';
import { PixelIcon } from '../components/PixelIcon';
import { AppState, DayRecord, computeStreak } from '../utils/storage';
import {
  CloudLeaderboardRow, FriendRequestRow,
  loadFriendsLeaderboard, loadIncomingRequests, loadOutgoingRequests,
  findUsersByName, sendFriendRequest, respondToFriendRequest, removeFriend,
} from '../utils/supabaseStorage';
import { loadFocusLog, saveFocusLog } from '../utils/focusLog';
import { saveDistractionLog } from '../utils/distractionLog';
import { now as devNow, advanceDevDay, resetDevOffset, getDevDayOffset, subscribeDevClock } from '../utils/devClock';
import { FocusGoalScreen } from './FocusGoalScreen';
import { useHaptics } from '../hooks/useHaptics';

interface Props {
  appState: AppState;
  userId?: string;
  onStateChange: (state: AppState) => void;
  onBack: () => void;
}

export const ProfileScreen: React.FC<Props> = ({ appState, userId, onStateChange, onBack }) => {
  const [friends, setFriends] = useState<CloudLeaderboardRow[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestRow[]>([]);
  const [outgoingIds, setOutgoingIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CloudLeaderboardRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [devDayOffset, setDevDayOffset] = useState(getDevDayOffset());
  const { buttonPress } = useHaptics();

  useEffect(() => subscribeDevClock(() => setDevDayOffset(getDevDayOffset())), []);

  const refreshFriends = useCallback(async () => {
    if (!userId) return;
    const [friendsList, incomingList, outgoingList] = await Promise.all([
      loadFriendsLeaderboard(),
      loadIncomingRequests(userId),
      loadOutgoingRequests(userId),
    ]);
    setFriends(friendsList);
    setIncoming(incomingList);
    setOutgoingIds(new Set(outgoingList.map(r => r.toUser)));
  }, [userId]);

  useEffect(() => { void refreshFriends(); }, [refreshFriends]);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const found = await findUsersByName(text);
    setResults(found.filter(r => r.id !== userId));
    setSearching(false);
  };

  const handleAddFriend = async (targetId: string) => {
    if (!userId) return;
    await buttonPress();
    setOutgoingIds(prev => new Set(prev).add(targetId));
    await sendFriendRequest(userId, targetId);
  };

  const handleRespond = async (req: FriendRequestRow, accept: boolean) => {
    await buttonPress();
    await respondToFriendRequest(req.id, accept);
    void refreshFriends();
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!userId) return;
    await buttonPress();
    setFriends(prev => prev.filter(f => f.id !== friendId));
    await removeFriend(userId, friendId);
  };

  const handleGoalChange = (mins: number) => {
    setGoalModalOpen(false);
    if (!appState.user) return;
    onStateChange({ ...appState, user: { ...appState.user, dailyFocusGoalMins: mins } });
  };

  // Dev-only shortcuts for testing streak/progress logic without waiting on
  // real time — gated by __DEV__ so this is simply absent from a production
  // build, no manual removal needed before shipping.
  const handleAddFocusMinutes = async () => {
    await buttonPress();
    const log = await loadFocusLog();
    log.push({ date: devNow().toDateString(), mins: 30 });
    await saveFocusLog(log);
    Alert.alert('Dev', '+30 min added to today’s focus log. Reopen Today to see it.');
  };

  // Advances the app's notion of "today" by a day (see devClock.ts) and
  // notifies every screen that stayed mounted through the jump so Insights,
  // the heatmap, and streak logic can all be tested ahead of the real clock.
  const handleSkipDay = async () => {
    await buttonPress();
    await advanceDevDay(1);
    Alert.alert('Dev', `Now ${getDevDayOffset()} day(s) ahead of real time.`);
  };

  const handleResetDayOffset = async () => {
    await buttonPress();
    await resetDevOffset();
    Alert.alert('Dev', 'Back to real time.');
  };

  const handleAddStreakDay = () => {
    buttonPress();
    const nextOffset = appState.streak + 1;
    const d = devNow();
    d.setDate(d.getDate() - nextOffset);
    const record: DayRecord = { date: d.toDateString(), tasks: [], completedCount: 1, totalCount: 1, consistency: 100 };
    const history = [...appState.history.filter(h => h.date !== record.date), record].slice(-60);
    const streak = computeStreak(history);
    onStateChange({
      ...appState,
      history,
      streak,
      longestStreak: Math.max(appState.longestStreak, streak),
    });
  };

  const handleResetTestData = async () => {
    buttonPress();
    await saveFocusLog([]);
    await saveDistractionLog([]);
    onStateChange({ ...appState, history: [], streak: 0, longestStreak: 0, totalTasksCompleted: 0 });
    Alert.alert('Dev', 'Streak, history, focus log, and distraction log reset.');
  };

  const user = appState.user;
  const goalMins = user?.dailyFocusGoalMins ?? 60;
  const goalLabel = goalMins >= 60
    ? `${Math.floor(goalMins / 60)}h${goalMins % 60 ? ` ${goalMins % 60}m` : ''}`
    : `${goalMins}m`;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.closeBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.avatarWrap}>
          <View style={styles.avatarCircle}>
            <PixelIcon name={user?.avatar ?? 'star'} size={64} />
          </View>
          <Text style={styles.name}>{user?.name || 'Anonymous'}</Text>
          {!!user?.email && <Text style={styles.email}>{user.email}</Text>}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{appState.streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{appState.longestStreak}</Text>
            <Text style={styles.statLabel}>Best</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{appState.totalTasksCompleted}</Text>
            <Text style={styles.statLabel}>Tasks Done</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.goalRow} onPress={() => setGoalModalOpen(true)} activeOpacity={0.75}>
          <View style={{ flex: 1 }}>
            <Text style={styles.goalLabel}>Daily focus goal</Text>
            <Text style={styles.goalValue}>{goalLabel} / day</Text>
          </View>
          <Text style={styles.goalChange}>Change</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Add a friend</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={handleSearch}
            placeholder="Search by name..."
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />
          {searching && <ActivityIndicator size="small" color={Colors.textMuted} />}
        </View>
        {results.map(r => (
          <View key={r.id} style={styles.friendRow}>
            <View style={styles.friendAvatar}>
              <PixelIcon name={r.avatar} size={22} />
            </View>
            <Text style={styles.friendName}>{r.name}</Text>
            <TouchableOpacity
              style={[styles.addBtn, outgoingIds.has(r.id) && styles.addBtnSent]}
              onPress={() => handleAddFriend(r.id)}
              disabled={outgoingIds.has(r.id)}
            >
              <Text style={styles.addBtnText}>{outgoingIds.has(r.id) ? 'Requested' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {incoming.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Friend requests</Text>
            {incoming.map(req => (
              <View key={req.id} style={styles.friendRow}>
                <Text style={[styles.friendName, { flex: 1 }]}>Request from a user</Text>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => handleRespond(req, true)}>
                  <Ionicons name="checkmark" size={16} color={Colors.background} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineBtn} onPress={() => handleRespond(req, false)}>
                  <Ionicons name="close" size={16} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionLabel}>Friends ({friends.length})</Text>
        {friends.length === 0 ? (
          <Text style={styles.emptyText}>No friends yet — search above to add some.</Text>
        ) : (
          friends.map(f => (
            <View key={f.id} style={styles.friendRow}>
              <View style={styles.friendAvatar}>
                <PixelIcon name={f.avatar} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.friendName}>{f.name}</Text>
                <Text style={styles.friendMeta}>{f.streak}d streak · {f.consistency}% consistent</Text>
              </View>
              <TouchableOpacity onPress={() => handleRemoveFriend(f.id)}>
                <Ionicons name="person-remove-outline" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))
        )}

        {__DEV__ && (
          <>
            <Text style={styles.sectionLabel}>Developer Tools</Text>
            <View style={styles.devRow}>
              <TouchableOpacity style={styles.devBtn} onPress={handleAddFocusMinutes}>
                <Text style={styles.devBtnText}>+30 min today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.devBtn} onPress={handleAddStreakDay}>
                <Text style={styles.devBtnText}>+1 day streak</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.devBtn} onPress={handleSkipDay}>
                <Text style={styles.devBtnText}>Skip to next day</Text>
              </TouchableOpacity>
              {devDayOffset !== 0 && (
                <TouchableOpacity style={styles.devBtn} onPress={handleResetDayOffset}>
                  <Text style={styles.devBtnText}>Back to real time ({devDayOffset}d)</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.devBtn, styles.devBtnDanger]} onPress={handleResetTestData}>
                <Text style={[styles.devBtnText, styles.devBtnDangerText]}>Reset test data</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={goalModalOpen} animationType="slide" onRequestClose={() => setGoalModalOpen(false)}>
        <FocusGoalScreen
          initialMins={goalMins}
          onComplete={handleGoalChange}
          onBack={() => setGoalModalOpen(false)}
        />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: 56, paddingBottom: Spacing.xl },
  closeBtn: {
    alignSelf: 'flex-end', width: 34, height: 34, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },

  avatarWrap: { alignItems: 'center', marginBottom: Spacing.lg },
  avatarCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.surfaceElevated, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  name: { ...Typography.headlineLarge, color: Colors.textPrimary },
  email: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: {
    flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', gap: 2,
  },
  statValue: { fontFamily: Fonts.bold, fontSize: 22, color: Colors.textPrimary },
  statLabel: { ...Typography.bodySmall, color: Colors.textSecondary },

  goalRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg,
  },
  goalLabel: { ...Typography.bodySmall, color: Colors.textSecondary },
  goalValue: { fontFamily: Fonts.semibold, fontSize: 16, color: Colors.textPrimary, marginTop: 2 },
  goalChange: { color: Colors.primary, fontFamily: Fonts.semibold, fontSize: 13 },

  sectionLabel: { ...Typography.labelSmall, color: Colors.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.md },
  emptyText: { ...Typography.bodySmall, color: Colors.textMuted },

  devRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  devBtn: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, paddingVertical: 10, paddingHorizontal: 14,
  },
  devBtnText: { fontSize: 13, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  devBtnDanger: { borderColor: Colors.danger + '55' },
  devBtnDangerText: { color: Colors.danger },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontFamily: Fonts.regular, fontSize: 14 },

  friendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  friendAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  friendName: { ...Typography.bodyMedium, color: Colors.textPrimary, fontFamily: Fonts.medium },
  friendMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  addBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: Colors.primary },
  addBtnSent: { backgroundColor: Colors.surfaceElevated },
  addBtnText: { fontSize: 12, fontFamily: Fonts.semibold, color: Colors.background },
  acceptBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
});
