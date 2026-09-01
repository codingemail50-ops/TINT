import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Fonts, Typography } from '../constants/theme';
import { PixelIcon } from '../components/PixelIcon';
import { AppState, StorageService } from '../utils/storage';
import {
  CloudLeaderboardRow, FriendRequestRow,
  loadFriendsLeaderboard, loadIncomingRequests, loadOutgoingRequests,
  findUserByEmail, sendFriendRequest, respondToFriendRequest, removeFriend,
} from '../utils/supabaseStorage';
import { saveFocusLog } from '../utils/focusLog';
import { saveDistractionLog } from '../utils/distractionLog';
import { clearActiveSession } from '../utils/activeFocusSession';
import { supabase } from '../lib/supabase';
import { FocusGoalScreen } from './FocusGoalScreen';
import { useHaptics } from '../hooks/useHaptics';

interface Props {
  appState: AppState;
  userId?: string;
  onStateChange: (state: AppState) => void;
  onBack: () => void;
  /** Signs out of Supabase and clears local device data, then sends the
   *  user back to onboarding — owned by AppNavigator since it needs to
   *  reset navigation/screen state too, not just this screen's own. */
  onLogout: () => void;
}

export const ProfileScreen: React.FC<Props> = ({ appState, userId, onStateChange, onBack, onLogout }) => {
  const [friends, setFriends] = useState<CloudLeaderboardRow[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestRow[]>([]);
  const [outgoingIds, setOutgoingIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CloudLeaderboardRow[]>([]);
  const [searching, setSearching] = useState(false);
  // Only shown after an actual lookup attempt returns nothing — not while
  // the field is simply empty or mid-typing.
  const [notFound, setNotFound] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const { buttonPress } = useHaptics();

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

  // Triggered on submit (not per-keystroke) — this is an exact-match email
  // lookup, not a live fuzzy search, so there's nothing useful to query
  // until the user has typed the whole address.
  const handleSearch = async () => {
    setNotFound(false);
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    const found = await findUserByEmail(query);
    setSearching(false);
    if (!found || found.id === userId) {
      setResults([]);
      setNotFound(true);
      return;
    }
    setResults([found]);
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

  // A custom modal instead of a multi-button Alert.alert — React Native
  // Web doesn't actually implement Alert's button callbacks (it's a no-op
  // there), so a native-only Alert here would silently do nothing when
  // tested on web and could easily hide a real bug from that testing path.
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  // Clears local device data too, not just the Supabase session — otherwise
  // the next account to sign in on this device would inherit the previous
  // one's streak/focus history, since none of it is namespaced per-user.
  const performLogout = async () => {
    setLogoutConfirmOpen(false);
    void buttonPress();
    // signOut is the one call that has to finish first (onLogout below
    // immediately starts a fresh anonymous session, which would race with
    // an in-flight signOut) -- the four local clears after it are fully
    // independent of each other and were only ever sequential by accident,
    // not because any of them depend on the last one finishing.
    await supabase.auth.signOut();
    await Promise.all([
      StorageService.clearAllUserData(),
      saveFocusLog([]),
      saveDistractionLog([]),
      clearActiveSession(),
    ]);
    onLogout();
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
            onChangeText={text => { setQuery(text); setNotFound(false); }}
            onSubmitEditing={handleSearch}
            placeholder="Add by exact email..."
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="search"
          />
          {searching && <ActivityIndicator size="small" color={Colors.textMuted} />}
        </View>
        {notFound && <Text style={styles.emptyText}>No user found with that email.</Text>}
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
            <Text style={styles.sectionLabel}>Friend requests ({incoming.length})</Text>
            {incoming.map(req => (
              <View key={req.id} style={styles.requestCard}>
                <View style={styles.requestAvatar}>
                  <PixelIcon name={req.fromAvatar || 'star'} size={30} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestName}>{req.fromName || 'Someone'}</Text>
                  <Text style={styles.requestSub}>wants to be your friend</Text>
                </View>
                <TouchableOpacity style={styles.requestAcceptBtn} onPress={() => handleRespond(req, true)} activeOpacity={0.8}>
                  <Ionicons name="checkmark" size={20} color={Colors.background} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.requestDeclineBtn} onPress={() => handleRespond(req, false)} activeOpacity={0.8}>
                  <Ionicons name="close" size={20} color={Colors.textPrimary} />
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

        <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutConfirmOpen(true)} activeOpacity={0.75}>
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={goalModalOpen} animationType="slide" onRequestClose={() => setGoalModalOpen(false)}>
        {/* React Native's Modal renders in its own native view hierarchy,
            outside the app's root GestureHandlerRootView (in App.tsx) --
            without its own nested one here, the BlobDial's drag gesture
            inside FocusGoalScreen silently doesn't register at all. */}
        <GestureHandlerRootView style={{ flex: 1 }}>
          <FocusGoalScreen
            initialMins={goalMins}
            onComplete={handleGoalChange}
            onBack={() => setGoalModalOpen(false)}
          />
        </GestureHandlerRootView>
      </Modal>

      <Modal visible={logoutConfirmOpen} transparent animationType="fade" onRequestClose={() => setLogoutConfirmOpen(false)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Log out?</Text>
            <Text style={styles.confirmBody}>This clears your data on this device and signs you out.</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setLogoutConfirmOpen(false)} activeOpacity={0.75}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmLogoutBtn} onPress={performLogout} activeOpacity={0.85}>
                <Text style={styles.confirmLogoutText}>Log out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.danger + '55', paddingVertical: 14, marginTop: Spacing.lg,
  },
  logoutText: { fontSize: 15, fontFamily: Fonts.semibold, color: Colors.danger },

  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  confirmCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    width: '84%', borderWidth: 1, borderColor: Colors.border, gap: Spacing.xs,
  },
  confirmTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.textPrimary },
  confirmBody: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },
  confirmActions: { flexDirection: 'row', gap: Spacing.sm },
  confirmCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  confirmCancelText: { fontSize: 15, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  confirmLogoutBtn: { flex: 1, paddingVertical: 13, borderRadius: BorderRadius.md, backgroundColor: Colors.danger, alignItems: 'center' },
  confirmLogoutText: { fontSize: 15, fontFamily: Fonts.bold, color: '#000' },

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

  // Deliberately bigger and more visually distinct than a plain friend row —
  // an incoming request needs a decision, not just a glance, so it gets a
  // full card with the sender's identity front and center instead of a
  // cramped one-liner.
  requestCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.pop + '55',
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  requestAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surface,
    borderWidth: 2, borderColor: Colors.pop,
    alignItems: 'center', justifyContent: 'center',
  },
  requestName: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary },
  requestSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  requestAcceptBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.pop, alignItems: 'center', justifyContent: 'center' },
  requestDeclineBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
});
