import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, NativeSyntheticEvent, NativeScrollEvent, Modal } from 'react-native';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { useHaptics } from '../hooks/useHaptics';

const ITEM_H = 44;
const VISIBLE_ROWS = 5;
const WHEEL_H = ITEM_H * VISIBLE_ROWS;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function daysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

interface WheelProps {
  values: string[];
  index: number;
  onChange: (index: number) => void;
}

// One scrollable column of a picker wheel — snaps to whichever row ends up
// centered under the fixed highlight box, same interaction as a native iOS
// date picker (no extra native dependency, just ScrollView snapping).
const Wheel: React.FC<WheelProps> = ({ values, index, onChange }) => {
  const scrollRef = useRef<ScrollView>(null);
  const { dialTick } = useHaptics();
  const lastIndex = useRef(index);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    if (i !== lastIndex.current && i >= 0 && i < values.length) {
      lastIndex.current = i;
      void dialTick();
    }
  };

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(values.length - 1, i));
    onChange(clamped);
  };

  return (
    <View style={{ height: WHEEL_H, width: 90 }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={32}
        contentOffset={{ x: 0, y: index * ITEM_H }}
      >
        {values.map((v, i) => (
          <View key={i} style={styles.wheelItem}>
            <Text style={[styles.wheelText, i === index && styles.wheelTextActive]}>{v}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

interface Props {
  visible: boolean;
  /** ISO date string (YYYY-MM-DD) to open pre-set to, defaults to today. */
  initialDate?: string;
  onClose: () => void;
  onConfirm: (isoDate: string) => void;
}

// Replaces a free-text "YYYY-MM-DD" field (easy to mistype into something
// that silently fails a format check) with three scroll wheels that can
// only ever produce a valid, correctly-formatted date.
export const DateWheelPicker: React.FC<Props> = ({ visible, initialDate, onClose, onConfirm }) => {
  const seed = initialDate ? new Date(initialDate + 'T00:00:00') : new Date();
  const validSeed = isNaN(seed.getTime()) ? new Date() : seed;
  const currentYear = new Date().getFullYear();

  const [day, setDay] = useState(validSeed.getDate() - 1);
  const [month, setMonth] = useState(validSeed.getMonth());
  const [yearIndex, setYearIndex] = useState(Math.max(0, validSeed.getFullYear() - currentYear));
  const { buttonPress } = useHaptics();

  const years = Array.from({ length: 8 }, (_, i) => String(currentYear + i));
  const dim = daysInMonth(month, currentYear + yearIndex);
  const days = Array.from({ length: dim }, (_, i) => String(i + 1));
  const dayClamped = Math.min(day, dim - 1);

  const handleConfirm = () => {
    void buttonPress();
    const y = currentYear + yearIndex;
    const iso = `${y}-${String(month + 1).padStart(2, '0')}-${String(dayClamped + 1).padStart(2, '0')}`;
    onConfirm(iso);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Exam Date</Text>

          <View style={styles.wheelRow}>
            <View style={styles.highlightBox} pointerEvents="none" />
            <Wheel values={days} index={dayClamped} onChange={setDay} />
            <Wheel values={MONTHS} index={month} onChange={setMonth} />
            <Wheel values={years} index={yearIndex} onChange={setYearIndex} />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.75}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
              <Text style={styles.confirmText}>Set Date</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    width: '86%', borderWidth: 1, borderColor: Colors.border,
  },
  title: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  wheelRow: { flexDirection: 'row', justifyContent: 'center', position: 'relative' },
  highlightBox: {
    position: 'absolute', top: ITEM_H * 2, left: 0, right: 0, height: ITEM_H,
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: Colors.pop + '55',
  },
  wheelItem: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  wheelText: { fontSize: 16, fontFamily: Fonts.regular, color: Colors.textMuted },
  wheelTextActive: { color: Colors.textPrimary, fontFamily: Fonts.bold, fontSize: 18 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelText: { fontSize: 15, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  confirmBtn: { flex: 1.4, paddingVertical: 14, borderRadius: BorderRadius.md, backgroundColor: Colors.pop, alignItems: 'center' },
  confirmText: { fontSize: 15, fontFamily: Fonts.bold, color: '#000' },
});
