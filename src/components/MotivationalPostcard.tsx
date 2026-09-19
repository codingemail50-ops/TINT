import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { useHaptics } from '../hooks/useHaptics';
import { MotivationalMessage } from '../data/motivationalMessages';
import { parseMotivationalTemplate } from '../utils/motivation';

interface Props {
  visible: boolean;
  message: MotivationalMessage | null;
  goalText: string | null;
  onClose: () => void;
}

// Deliberately minimal — just the app's dark surface, centered text, and a
// single orange-highlighted phrase per message. No stats, no icons: this is
// a short daily nudge, not another dashboard card.
export const MotivationalPostcard: React.FC<Props> = ({ visible, message, goalText, onClose }) => {
  const { buttonPress } = useHaptics();

  const handleClose = async () => {
    await buttonPress();
    onClose();
  };

  if (!message) return null;
  const segments = parseMotivationalTemplate(message.template, goalText);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.eyebrow}>TODAY'S FOCUS</Text>
          <Text style={styles.message}>
            {segments.map((seg, i) => (
              <Text key={i} style={seg.highlight ? styles.highlight : undefined}>{seg.text}</Text>
            ))}
          </Text>
          <TouchableOpacity style={styles.dismissBtn} onPress={handleClose} activeOpacity={0.8}>
            <Text style={styles.dismissText}>Got it</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  card: {
    width: '100%', maxWidth: 340,
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 11, fontFamily: Fonts.medium, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: Spacing.lg,
  },
  message: {
    fontSize: 20, fontFamily: Fonts.semibold, color: Colors.textPrimary,
    textAlign: 'center', lineHeight: 28,
  },
  highlight: { color: Colors.pop },
  dismissBtn: {
    marginTop: Spacing.xl, paddingVertical: 10, paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full, backgroundColor: Colors.pop,
  },
  dismissText: { fontSize: 14, fontFamily: Fonts.bold, color: '#000' },
});
