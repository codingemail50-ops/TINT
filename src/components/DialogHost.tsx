// Draws every tintAlert() message box (see utils/dialog.ts) in TINT's own look:
// the same card and pixel-font title as the rest of the app, an orange main
// button, a red outlined button for a choice that cannot be undone, and an
// orange "cancel" link. Mounted once, near the top of the app.
//
// Boxes that arrive while one is showing wait their turn, and a button that
// opens another box (delete account asks twice) simply shows the next one.
// The Android Back button and a tap outside the card both mean "cancel": they
// run the cancel button if there is one, otherwise they just close a plain notice.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { PrimaryButton, SecondaryButton, challengeStyles } from './ChallengeParts';
import { registerDialogHost, DialogSpec, DialogButton } from '../utils/dialog';

export const DialogHost: React.FC = () => {
  const [current, setCurrent] = useState<DialogSpec | null>(null);
  const queue = useRef<DialogSpec[]>([]);
  const currentRef = useRef<DialogSpec | null>(null);
  // Keep showing the last text while the box fades out, so it does not go blank.
  const last = useRef<DialogSpec | null>(null);
  if (current) last.current = current;
  const d = current ?? last.current;

  const show = useCallback((spec: DialogSpec | null) => {
    currentRef.current = spec;
    setCurrent(spec);
  }, []);

  useEffect(() => registerDialogHost(spec => {
    if (currentRef.current) queue.current.push(spec);
    else show(spec);
  }), [show]);

  const close = useCallback((button?: DialogButton) => {
    show(queue.current.shift() ?? null);
    if (button?.onPress) {
      try { void button.onPress(); } catch {}
    }
  }, [show]);

  const dismiss = useCallback(() => {
    const cancel = currentRef.current?.buttons.find(b => b.style === 'cancel');
    // A plain notice with only an "OK" just closes; it never runs that button's action.
    const onlyOne = (currentRef.current?.buttons.length ?? 0) === 1;
    close(cancel && !onlyOne ? cancel : undefined);
  }, [close]);

  const buttons = d?.buttons ?? [];
  const cancelButton = buttons.length > 1 ? buttons.find(b => b.style === 'cancel') : undefined;
  const actions = buttons.filter(b => b !== cancelButton);

  return (
    <Modal visible={current !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      {/* A Modal is its own window, so it needs its own gesture-handler root for the scroll list inside. */}
      <GestureHandlerRootView style={s.backdrop}>
        {/* Tapping outside the card closes it. This is a sibling UNDER the card,
            not a Pressable wrapped around it: a touchable parent grabbed the
            drag from the scroll list inside, so the list would not scroll on a
            real phone. */}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} />
        <View style={[challengeStyles.card, s.card]}>
          {d && (
            <>
              <Text style={s.title}>{d.title}</Text>
              {d.message ? (
                <ScrollView style={s.messageBox} showsVerticalScrollIndicator nestedScrollEnabled>
                  <Text style={challengeStyles.sub}>{d.message}</Text>
                </ScrollView>
              ) : null}
              {actions.map((b, i) => {
                if (b.style === 'destructive') {
                  return (
                    <TouchableOpacity key={i} style={s.danger} onPress={() => close(b)} activeOpacity={0.85}>
                      <Text style={s.dangerText}>{b.text}</Text>
                    </TouchableOpacity>
                  );
                }
                // The first ordinary action is the main (orange) one; any further
                // ordinary action is an outlined button.
                const firstOrdinary = actions.findIndex(a => a.style !== 'destructive') === i;
                return firstOrdinary
                  ? <PrimaryButton key={i} label={b.text} onPress={() => close(b)} />
                  : <SecondaryButton key={i} label={b.text} onPress={() => close(b)} />;
              })}
              {cancelButton ? (
                <TouchableOpacity onPress={() => close(cancelButton)} hitSlop={8}>
                  <Text style={s.cancel}>{cancelButton.text}</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: Spacing.xl },
  card: { gap: Spacing.md },
  title: { fontFamily: Fonts.pixel, fontSize: 26, color: Colors.textPrimary },
  messageBox: { flexGrow: 0, maxHeight: 280 },
  danger: {
    borderRadius: BorderRadius.md, borderWidth: 2, borderColor: Colors.danger,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  dangerText: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.danger },
  cancel: { textAlign: 'center', color: Colors.pop, fontFamily: Fonts.semibold, fontSize: 15 },
});
