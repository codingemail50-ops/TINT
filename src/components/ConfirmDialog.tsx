// An in-app confirmation box in TINT's own look (same card, pixel-font title,
// red outline for the risky choice and an orange "stay" link as the "Hold to
// leave" card), instead of Android's plain system alert.
//
// Give it a config to show it, null to hide it. The Android Back button and a
// tap outside the card both count as the safe choice (cancel). With no
// cancelLabel it is a plain notice with one button.

import React, { useRef } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { PrimaryButton, challengeStyles } from './ChallengeParts';

export interface DialogConfig {
  title: string;
  message: string;
  confirmLabel: string;
  /** Leave out for a notice with a single button. */
  cancelLabel?: string;
  /** Red outlined button for a choice that cannot be undone. */
  destructive?: boolean;
  onConfirm?: () => void;
}

interface Props {
  dialog: DialogConfig | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<Props> = ({ dialog, onConfirm, onCancel }) => {
  // Keep showing the last text while the box fades out, so it does not go blank.
  const last = useRef<DialogConfig | null>(dialog);
  if (dialog) last.current = dialog;
  const d = last.current;

  return (
    <Modal visible={dialog !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={s.backdrop} onPress={onCancel}>
        {/* Swallows taps so touching the card itself does not close it. */}
        <Pressable style={[challengeStyles.card, s.card]} onPress={() => {}}>
          {d && (
            <>
              <Text style={s.title}>{d.title}</Text>
              <Text style={challengeStyles.sub}>{d.message}</Text>
              {d.destructive ? (
                <TouchableOpacity style={s.danger} onPress={onConfirm} activeOpacity={0.85}>
                  <Text style={s.dangerText}>{d.confirmLabel}</Text>
                </TouchableOpacity>
              ) : (
                <PrimaryButton label={d.confirmLabel} onPress={onConfirm} />
              )}
              {d.cancelLabel ? (
                <TouchableOpacity onPress={onCancel} hitSlop={8}>
                  <Text style={s.cancel}>{d.cancelLabel}</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: Spacing.xl },
  card: { gap: Spacing.md },
  title: { fontFamily: Fonts.pixel, fontSize: 30, color: Colors.textPrimary },
  danger: {
    borderRadius: BorderRadius.md, borderWidth: 2, borderColor: Colors.danger,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  dangerText: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.danger },
  cancel: { textAlign: 'center', color: Colors.pop, fontFamily: Fonts.semibold, fontSize: 15 },
});
