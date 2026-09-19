import React, { useEffect, useRef, useState } from 'react';
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

  // Reacts to `index` changing for reasons other than the user's own
  // scroll (e.g. the day wheel getting auto-bumped forward past today when
  // the month wheel changes) by physically scrolling to match — without
  // this, a parent-driven correction would update which value counts as
  // "selected" while the wheel visually kept sitting wherever the user
  // last left it.
  useEffect(() => {
    if (index !== lastIndex.current) {
      lastIndex.current = index;
      scrollRef.current?.scrollTo({ y: index * ITEM_H, animated: true });
    }
  }, [index]);

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
  /** Defaults to this component's original (only) use case — exam-date
   *  entry. Overridable so other callers (e.g. the walkthrough's own
   *  future-goal date) aren't stuck with a modal that says "Exam Date". */
  title?: string;
}

// Replaces a free-text "YYYY-MM-DD" field (easy to mistype into something
// that silently fails a format check) with three scroll wheels that can
// only ever produce a valid, correctly-formatted date.
export const DateWheelPicker: React.FC<Props> = ({ visible, initialDate, onClose, onConfirm, title = 'Exam Date' }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  // Never seed into an already-past date -- if initialDate is behind today
  // (or missing/invalid), start on today instead, so the picker never opens
  // into a state its own "no past dates" rule would immediately reject.
  const parsedSeed = initialDate ? new Date(initialDate + 'T00:00:00') : today;
  const seed = isNaN(parsedSeed.getTime()) || parsedSeed < today ? today : parsedSeed;

  // day/month state are always the ACTUAL calendar values (0-based day
  // index, 0-11 month) regardless of what's currently visible in each
  // wheel -- only the rendering below truncates the displayed list to
  // exclude the past; the state itself is never lied to.
  const [day, setDay] = useState(seed.getDate() - 1);
  const [month, setMonth] = useState(seed.getMonth());
  const [yearIndex, setYearIndex] = useState(Math.max(0, seed.getFullYear() - currentYear));
  const { buttonPress } = useHaptics();

  const isCurrentYear = yearIndex === 0;
  // This year, months before the current one are entirely in the past --
  // every day in them would be too -- so they're dropped from the wheel
  // instead of being scrollable to and then having nothing valid in them.
  const displayedMonths = isCurrentYear ? MONTHS.slice(todayMonth) : MONTHS;
  const monthIndex = isCurrentYear ? month - todayMonth : month;

  const isCurrentMonth = isCurrentYear && month === todayMonth;
  const dim = daysInMonth(month, currentYear + yearIndex);
  // 1-indexed lower bound: today's date if we're looking at the current
  // month, otherwise the 1st -- this is what makes "today" the first row
  // in the day wheel instead of one more scrollable-past entry above it.
  const minDay = isCurrentMonth ? todayDate : 1;
  const dayClamped = Math.max(minDay - 1, Math.min(day, dim - 1));
  const days = Array.from({ length: dim - minDay + 1 }, (_, i) => String(minDay + i));
  const dayIndex = dayClamped - (minDay - 1);

  const years = Array.from({ length: 8 }, (_, i) => String(currentYear + i));

  const handleDayChange = (displayIndex: number) => {
    setDay(minDay - 1 + displayIndex);
  };

  const handleMonthChange = (displayIndex: number) => {
    const actualMonth = isCurrentYear ? displayIndex + todayMonth : displayIndex;
    setMonth(actualMonth);
    // Switching month can invalidate the current day (e.g. landing back on
    // the current month should never leave a past day selected, and a
    // shorter month needs the day pulled back in).
    const newIsCurrentMonth = isCurrentYear && actualMonth === todayMonth;
    const newMinDay = newIsCurrentMonth ? todayDate : 1;
    const newDim = daysInMonth(actualMonth, currentYear + yearIndex);
    setDay(prev => Math.max(newMinDay - 1, Math.min(prev, newDim - 1)));
  };

  const handleYearChange = (newYearIndex: number) => {
    setYearIndex(newYearIndex);
    if (newYearIndex === 0 && month < todayMonth) {
      // Was parked on a month that only made sense in a future year --
      // landing back on the current year makes that month entirely past.
      setMonth(todayMonth);
      setDay(todayDate - 1);
    }
  };

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
          <Text style={styles.title}>{title}</Text>

          <View style={styles.wheelRow}>
            <View style={styles.highlightBox} pointerEvents="none" />
            <Wheel values={days} index={dayIndex} onChange={handleDayChange} />
            <Wheel values={displayedMonths} index={monthIndex} onChange={handleMonthChange} />
            <Wheel values={years} index={yearIndex} onChange={handleYearChange} />
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
