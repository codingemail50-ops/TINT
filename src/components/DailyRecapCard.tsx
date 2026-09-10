import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { useHaptics } from '../hooks/useHaptics';
import { DailyRecapData } from '../utils/dailyRecap';

interface Props {
  visible: boolean;
  data: DailyRecapData;
  onClose: () => void;
}

// A shareable, Instagram-postable recap of yesterday — deliberately the
// inverse of the app's usual black theme (white card, black text, orange
// for the one or two numbers that matter, grey for everything else) so it
// reads as a distinct "artifact" worth posting, not just another app screen.
export const DailyRecapCard: React.FC<Props> = ({ visible, data, onClose }) => {
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const { buttonPress } = useHaptics();

  const handleShare = async () => {
    await buttonPress();
    setSharing(true);
    try {
      // React Native's own core Share.share() only ever reads title/message
      // on Android — its "url" field is silently dropped there (iOS-only),
      // so it can't actually attach the captured image to the share sheet
      // on the one platform this app ships on. expo-sharing's shareAsync()
      // is built specifically for handing a local file to the native share
      // sheet on both platforms, FileProvider handling included.
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your day' });
      }
    } catch {
      // Sharing is a nice-to-have here — a failed capture/share shouldn't
      // trap the user behind a broken button, the card is still on screen.
    } finally {
      setSharing(false);
    }
  };

  const handleClose = async () => {
    await buttonPress();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View ref={cardRef} collapsable={false} style={styles.card}>
            <Text style={styles.wordmark}>THERE IS NO TOMORROW</Text>
            <Text style={styles.heading}>{data.name}'s day — {data.dateLabel}</Text>

            {data.goalText && (
              <View style={styles.goalRow}>
                <Text style={styles.goalText} numberOfLines={2}>{data.goalText}</Text>
                {data.daysLeft !== null && (
                  <Text style={styles.daysLeft}>{Math.max(0, data.daysLeft)} days left</Text>
                )}
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.statsRow}>
              <View style={styles.statBlock}>
                <Text style={styles.statValue}>{data.completedCount}/{data.totalCount}</Text>
                <Text style={styles.statLabel}>Tasks done</Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statValue}>{data.focusMins}m</Text>
                <Text style={styles.statLabel}>Focused</Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={[styles.statValue, styles.statValuePop]}>{data.focusAccuracy}%</Text>
                <Text style={styles.statLabel}>Accuracy</Text>
              </View>
            </View>

            {data.tasks.length > 0 && (
              <View style={styles.taskList}>
                {data.tasks.map(task => (
                  <View key={task.id} style={styles.taskRow}>
                    <Text style={[styles.taskMark, task.completed && styles.taskMarkDone]}>
                      {task.completed ? '✓' : '✕'}
                    </Text>
                    <Text style={[styles.taskTitle, !task.completed && styles.taskTitleMissed]} numberOfLines={1}>
                      {task.title}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={18} color="#000" />
            <Text style={styles.shareText}>{sharing ? 'Preparing…' : 'Share'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', paddingTop: 70 },
  closeBtn: { position: 'absolute', top: 58, right: Spacing.xl, zIndex: 2 },
  scrollContent: { alignItems: 'center', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },

  card: {
    width: '100%', maxWidth: 380,
    backgroundColor: '#FFFFFF', borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  wordmark: {
    fontFamily: Fonts.pixel, fontSize: 13, color: Colors.pop,
    letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'center', marginBottom: Spacing.md,
  },
  heading: {
    fontSize: 19, fontFamily: Fonts.bold, color: '#0A0A0A', textAlign: 'center', marginBottom: Spacing.lg,
  },

  goalRow: { alignItems: 'center', marginBottom: Spacing.lg },
  goalText: { fontSize: 15, fontFamily: Fonts.semibold, color: '#0A0A0A', textAlign: 'center' },
  daysLeft: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.pop, marginTop: 4 },

  divider: { height: 1, backgroundColor: '#E6E6E6', marginBottom: Spacing.lg },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.lg },
  statBlock: { alignItems: 'center' },
  statValue: { fontSize: 22, fontFamily: Fonts.bold, color: '#0A0A0A' },
  statValuePop: { color: Colors.pop },
  statLabel: { fontSize: 11, fontFamily: Fonts.medium, color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },

  taskList: { gap: 10 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskMark: { fontSize: 14, fontFamily: Fonts.bold, color: '#C6C6C6', width: 16, textAlign: 'center' },
  taskMarkDone: { color: Colors.pop },
  taskTitle: { flex: 1, fontSize: 14, fontFamily: Fonts.medium, color: '#0A0A0A' },
  taskTitleMissed: { color: '#B0B0B0', textDecorationLine: 'line-through' },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.pop, borderRadius: BorderRadius.full,
    paddingVertical: 14, paddingHorizontal: Spacing.xl, marginTop: Spacing.xl,
    width: '100%', maxWidth: 380,
  },
  shareText: { fontSize: 15, fontFamily: Fonts.bold, color: '#000' },
});
