import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Fonts, Typography } from '../constants/theme';
import { PixelIcon } from '../components/PixelIcon';
import { AVATARS, EXAM_TYPES, ExamType, CustomExam } from '../data/examPresets';
import { AppState, StorageService } from '../utils/storage';
import { FriendsPanel } from '../components/FriendsPanel';
import { saveFocusLog } from '../utils/focusLog';
import { saveDistractionLog } from '../utils/distractionLog';
import { clearActiveSession } from '../utils/activeFocusSession';
import { supabase } from '../lib/supabase';
import { FocusGoalScreen } from './FocusGoalScreen';
import { CustomExamModal } from '../components/CustomExamModal';
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
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('star');
  const [editExamOpen, setEditExamOpen] = useState(false);
  const [editExamTypes, setEditExamTypes] = useState<Set<ExamType>>(new Set());
  const [editCustomExam, setEditCustomExam] = useState<CustomExam | null>(null);
  const [customExamModalOpen, setCustomExamModalOpen] = useState(false);
  const { buttonPress } = useHaptics();

  const handleGoalChange = (mins: number) => {
    setGoalModalOpen(false);
    if (!appState.user) return;
    onStateChange({ ...appState, user: { ...appState.user, dailyFocusGoalMins: mins } });
  };

  const openEditProfile = () => {
    setEditName(appState.user?.name ?? '');
    setEditAvatar(appState.user?.avatar ?? 'star');
    setEditProfileOpen(true);
  };

  const handleSaveProfile = () => {
    if (!appState.user || !editName.trim()) return;
    onStateChange({ ...appState, user: { ...appState.user, name: editName.trim(), avatar: editAvatar } });
    setEditProfileOpen(false);
  };

  const openEditExam = () => {
    setEditExamTypes(new Set((appState.user?.examTypes ?? []) as ExamType[]));
    setEditCustomExam(appState.user?.customExam ?? null);
    setEditExamOpen(true);
  };

  const toggleEditExamType = (id: ExamType) => {
    buttonPress();
    setEditExamTypes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Only touches this profile's own exam fields — the day's already-
  // generated task list (see TodoScreen's refreshDay) only regenerates
  // from these on the next new day, so changing your exam here never
  // rewrites tasks you already have in progress.
  const handleSaveExam = () => {
    if (!appState.user) return;
    if (editExamTypes.size === 0 && !editCustomExam) return;
    onStateChange({
      ...appState,
      user: {
        ...appState.user,
        examTypes: Array.from(editExamTypes),
        customExam: editCustomExam ?? undefined,
      },
    });
    setEditExamOpen(false);
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

  const examLabel = user?.customExam
    ? user.customExam.name
    : (user?.examTypes ?? []).length > 0
      ? (user!.examTypes as ExamType[]).join(', ')
      : 'Not set';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <TouchableOpacity style={styles.closeBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.avatarWrap} onPress={openEditProfile} activeOpacity={0.75}>
          <View style={styles.avatarCircle}>
            <PixelIcon name={user?.avatar ?? 'star'} size={64} />
          </View>
          <Text style={styles.name}>{user?.name || 'Anonymous'}</Text>
          {!!user?.email && <Text style={styles.email}>{user.email}</Text>}
          <Text style={styles.editProfileHint}>Edit name / avatar</Text>
        </TouchableOpacity>

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

        <TouchableOpacity style={styles.goalRow} onPress={openEditExam} activeOpacity={0.75}>
          <View style={{ flex: 1 }}>
            <Text style={styles.goalLabel}>Studying for</Text>
            <Text style={styles.goalValue} numberOfLines={1}>{examLabel}</Text>
          </View>
          <Text style={styles.goalChange}>Change</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>

        <FriendsPanel userId={userId} />

        <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutConfirmOpen(true)} activeOpacity={0.75}>
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>

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

      <Modal visible={editProfileOpen} transparent animationType="fade" onRequestClose={() => setEditProfileOpen(false)}>
        <KeyboardAvoidingView
          style={styles.editBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Edit Profile</Text>
            <TextInput
              style={styles.editNameInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={Colors.textMuted}
            />
            <ScrollView style={styles.avatarGridScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.avatarGrid}>
                {AVATARS.map(a => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.avatarGridItem, editAvatar === a && styles.avatarGridItemSelected]}
                    onPress={() => { buttonPress(); setEditAvatar(a); }}
                    activeOpacity={0.75}
                  >
                    <PixelIcon name={a} size={30} />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditProfileOpen(false)} activeOpacity={0.75}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editSaveBtn, !editName.trim() && styles.editSaveBtnDisabled]}
                onPress={handleSaveProfile}
                disabled={!editName.trim()}
                activeOpacity={0.85}
              >
                <Text style={styles.editSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={editExamOpen} transparent animationType="fade" onRequestClose={() => setEditExamOpen(false)}>
        <View style={styles.editBackdrop}>
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Studying For</Text>
            <TouchableOpacity
              style={[styles.examOtherBtn, !!editCustomExam && styles.examOtherBtnActive]}
              onPress={() => { buttonPress(); setCustomExamModalOpen(true); }}
              activeOpacity={0.75}
            >
              <Text style={[styles.examOtherText, !!editCustomExam && styles.examOtherTextActive]} numberOfLines={1}>
                {editCustomExam ? `✓ ${editCustomExam.name}` : 'Other'}
              </Text>
            </TouchableOpacity>
            <View style={styles.examGrid}>
              {EXAM_TYPES.map(exam => {
                const checked = editExamTypes.has(exam.id);
                return (
                  <TouchableOpacity
                    key={exam.id}
                    style={[styles.examCard, checked && styles.examCardActive]}
                    onPress={() => toggleEditExamType(exam.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.examCardText, checked && styles.examCardTextActive]}>{exam.label}</Text>
                    <View style={[styles.examCheckbox, checked && styles.examCheckboxActive]}>
                      {checked && <Text style={styles.examCheckmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditExamOpen(false)} activeOpacity={0.75}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editSaveBtn, editExamTypes.size === 0 && !editCustomExam && styles.editSaveBtnDisabled]}
                onPress={handleSaveExam}
                disabled={editExamTypes.size === 0 && !editCustomExam}
                activeOpacity={0.85}
              >
                <Text style={styles.editSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CustomExamModal
        visible={customExamModalOpen}
        initial={editCustomExam}
        onClose={() => setCustomExamModalOpen(false)}
        onSave={exam => { setEditCustomExam(exam); setCustomExamModalOpen(false); }}
      />
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

  editProfileHint: { fontSize: 11, color: Colors.pop, fontFamily: Fonts.semibold, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionLabelPop: { color: Colors.pop, fontFamily: Fonts.semibold },

  editBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  editCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    width: '86%', maxHeight: '80%', borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm,
  },
  editTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 4 },
  editNameInput: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 12, color: Colors.textPrimary,
    fontSize: 15, fontFamily: Fonts.regular, borderWidth: 1, borderColor: Colors.border,
  },
  avatarGridScroll: { maxHeight: 220 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: Spacing.xs },
  avatarGridItem: {
    width: 52, height: 52, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceElevated,
    borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  avatarGridItemSelected: { borderColor: Colors.pop, backgroundColor: Colors.pop + '22' },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  editCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  editCancelText: { fontSize: 15, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  editSaveBtn: { flex: 1, paddingVertical: 13, borderRadius: BorderRadius.md, backgroundColor: Colors.pop, alignItems: 'center' },
  editSaveBtnDisabled: { backgroundColor: Colors.surfaceElevated },
  editSaveText: { fontSize: 15, fontFamily: Fonts.bold, color: '#000' },

  examOtherBtn: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.full,
    borderWidth: 2, borderColor: Colors.border, paddingVertical: 12, alignItems: 'center',
  },
  examOtherBtnActive: { backgroundColor: Colors.pop, borderColor: Colors.pop },
  examOtherText: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.textSecondary },
  examOtherTextActive: { color: '#000' },
  examGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  examCard: {
    width: '47%', backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    padding: Spacing.sm, borderWidth: 2, borderColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  examCardActive: { borderColor: Colors.pop, backgroundColor: Colors.pop },
  examCardText: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.textPrimary },
  examCardTextActive: { color: '#000' },
  examCheckbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  examCheckboxActive: { backgroundColor: '#000', borderColor: '#000' },
  examCheckmark: { color: Colors.pop, fontSize: 11, fontFamily: Fonts.bold },
});
