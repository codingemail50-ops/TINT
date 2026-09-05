import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Fonts, Typography } from '../constants/theme';
import { PixelIcon } from './PixelIcon';
import {
  CloudLeaderboardRow, FriendRequestRow,
  loadFriendsLeaderboard, loadIncomingRequests, loadOutgoingRequests,
  findUserByEmail, sendFriendRequest, respondToFriendRequest, removeFriend,
} from '../utils/supabaseStorage';
import { useHaptics } from '../hooks/useHaptics';

interface Props {
  userId?: string;
}

// The friend-request feature is the app's main USP, but it used to live
// only inside Profile — a screen people rarely open. Extracted out of
// ProfileScreen so it can be rendered there AND in the leaderboard/Squad
// screen with byte-for-byte identical behavior, instead of two versions
// that could drift apart.
export const FriendsPanel: React.FC<Props> = ({ userId }) => {
  const [friends, setFriends] = useState<CloudLeaderboardRow[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestRow[]>([]);
  const [outgoingIds, setOutgoingIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CloudLeaderboardRow[]>([]);
  const [searching, setSearching] = useState(false);
  // Only shown after an actual lookup attempt returns nothing — not while
  // the field is simply empty or mid-typing.
  const [notFound, setNotFound] = useState(false);
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

  return (
    <View>
      <Text style={[styles.sectionLabel, styles.sectionLabelPop]}>Add a friend</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  sectionLabel: { ...Typography.labelSmall, color: Colors.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.md },
  sectionLabelPop: { color: Colors.pop, fontFamily: Fonts.semibold },
  emptyText: { ...Typography.bodySmall, color: Colors.textMuted },

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
