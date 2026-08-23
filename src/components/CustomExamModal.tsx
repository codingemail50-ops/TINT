import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Modal,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { CustomExam } from '../data/examPresets';
import { useHaptics } from '../hooks/useHaptics';

interface DraftTask { title: string; duration: string }

interface Props {
  visible: boolean;
  initial?: CustomExam | null;
  onClose: () => void;
  onSave: (exam: CustomExam) => void;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDraftTasks(exam?: CustomExam | null): DraftTask[] {
  if (exam && exam.tasks.length > 0) return exam.tasks.map(t => ({ title: t.title, duration: String(t.duration) }));
  return [{ title: '', duration: '30' }];
}

// "Other" — a user-authored exam, for anyone prepping for something outside
// JEE/UCEED/NID/NIFT. Same idea as a preset (name, exam date, a list of
// timed tasks) except typed in by hand instead of preloaded.
export const CustomExamModal: React.FC<Props> = ({ visible, initial, onClose, onSave }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [tasks, setTasks] = useState<DraftTask[]>(toDraftTasks(initial));
  const { buttonPress } = useHaptics();

  const updateTask = (index: number, patch: Partial<DraftTask>) => {
    setTasks(prev => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  const addTaskRow = () => {
    buttonPress();
    setTasks(prev => [...prev, { title: '', duration: '30' }]);
  };

  const removeTaskRow = (index: number) => {
    buttonPress();
    setTasks(prev => prev.filter((_, i) => i !== index));
  };

  const validTasks = tasks
    .map(t => ({ title: t.title.trim(), duration: parseInt(t.duration, 10) || 0 }))
    .filter(t => t.title.length > 0 && t.duration > 0);

  const canSave = name.trim().length > 0 && DATE_RE.test(date.trim()) && validTasks.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    buttonPress();
    onSave({ name: name.trim(), date: date.trim(), tasks: validTasks });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Your Exam</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Exam name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. CLAT, CA Foundation..."
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Exam date</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            />

            <Text style={styles.label}>Daily tasks</Text>
            {tasks.map((t, i) => (
              <View key={i} style={styles.taskRow}>
                <TextInput
                  style={[styles.input, styles.taskTitleInput]}
                  value={t.title}
                  onChangeText={v => updateTask(i, { title: v })}
                  placeholder="Task name"
                  placeholderTextColor={Colors.textMuted}
                />
                <TextInput
                  style={[styles.input, styles.taskDurationInput]}
                  value={t.duration}
                  onChangeText={v => updateTask(i, { duration: v.replace(/[^0-9]/g, '') })}
                  placeholder="min"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeTaskRow(i)}
                  disabled={tasks.length <= 1}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={18} color={tasks.length <= 1 ? Colors.textMuted : Colors.danger} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addTaskBtn} onPress={addTaskRow} activeOpacity={0.75}>
              <Ionicons name="add" size={18} color={Colors.pop} />
              <Text style={styles.addTaskText}>Add task</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.85}
            >
              <Text style={[styles.saveText, !canSave && { color: Colors.textMuted }]}>Save Exam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: 58, paddingBottom: Spacing.md,
  },
  title: { fontSize: 22, fontFamily: Fonts.bold, color: Colors.textPrimary, letterSpacing: -0.5 },
  closeBtn: {
    width: 34, height: 34, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.xs },
  label: { fontSize: 13, fontFamily: Fonts.semibold, color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: 6 },
  input: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 12, color: Colors.textPrimary,
    fontSize: 15, fontFamily: Fonts.regular, borderWidth: 1, borderColor: Colors.border,
  },
  taskRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  taskTitleInput: { flex: 1 },
  taskDurationInput: { width: 64, textAlign: 'center' },
  removeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  addTaskBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingVertical: 10, paddingHorizontal: 4,
  },
  addTaskText: { fontSize: 14, fontFamily: Fonts.semibold, color: Colors.pop },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, paddingTop: Spacing.sm },
  saveBtn: { backgroundColor: Colors.pop, borderRadius: BorderRadius.md, paddingVertical: 16, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: Colors.surfaceElevated },
  saveText: { fontSize: 16, fontFamily: Fonts.bold, color: '#000' },
});
