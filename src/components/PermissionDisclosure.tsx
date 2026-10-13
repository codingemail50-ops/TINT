// The "why TINT needs these permissions" popup. Shown the first time the user
// taps a control that enables Usage access or Display over other apps (sign-up
// goal screen, Focus tab), BEFORE Android Settings opens. Exact wording lives
// in 08_in_app_disclosure_text.md; keep the two in step.
//
// "Enable" remembers the agreement on this phone and carries on to Android
// Settings. "Not now" (also the Android Back button or a tap outside the card)
// just closes it: nothing opens, nothing is saved, and it never reopens by
// itself. Reading the privacy policy from the popup leaves it open. It appears again only on the next
// tap, until the user has agreed once.

import React, { useCallback, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { Eyebrow, PrimaryButton } from './ChallengeParts';
import { openPrivacyPolicy } from '../utils/accountDeletion';
import { hasPermissionConsent, setPermissionConsent } from '../utils/permissionConsent';

interface Props {
  visible: boolean;
  onEnable: () => void;
  onNotNow: () => void;
}

export const PermissionDisclosure: React.FC<Props> = ({ visible, onEnable, onNotNow }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onNotNow}>
    <Pressable style={s.backdrop} onPress={onNotNow}>
      {/* Swallows taps so touching the card itself does not close it. */}
      <Pressable style={s.card} onPress={() => {}}>
        {/* Only the explanation scrolls. The agree line and the buttons stay
            pinned in view, so "Enable" and "Not now" are always reachable. */}
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
          <Eyebrow>Before you turn this on</Eyebrow>
          <Text style={s.title}>Why TINT needs these permissions</Text>
          <Text style={s.intro}>
            TINT blocks the apps you choose, during focus sessions and the 7 Day Lock In. To do that, it needs two
            permissions. You turn them on yourself in Android settings.
          </Text>

          <Text style={s.point}>
            <Text style={s.bold}>Usage access.</Text> Lets TINT see which app is open, so it can cover the ones you
            picked. It's used only for blocking. TINT doesn't upload a list of your apps or which apps you open.
          </Text>
          <Text style={s.point}>
            <Text style={s.bold}>Display over other apps.</Text> Lets TINT show its block screen over an app you picked.
          </Text>
          <Text style={s.point}>
            <Text style={s.bold}>It keeps running.</Text> Blocking keeps going when TINT isn't on screen: for a focus
            session until the timer ends, and for the 7 Day Lock In all day for 7 days. A notification stays up while it
            runs, when notifications are allowed.
          </Text>
          <Text style={s.point}>
            <Text style={s.bold}>Only for this.</Text> TINT uses these permissions only to block the apps you pick. No
            ads, and we don't sell your data.
          </Text>
          <Text style={s.point}>
            <Text style={s.bold}>You're in control.</Text> You can end a session, leave a challenge, switch the
            permissions off in Android settings, or delete your account at any time.
          </Text>
        </ScrollView>

        <View style={s.footer}>
          <Text style={s.consent}>
            By tapping "Enable", you allow TINT to use these two permissions to block the apps you pick.
          </Text>
          <PrimaryButton label="Enable" onPress={onEnable} />
          <View style={s.linkRow}>
            <TouchableOpacity onPress={openPrivacyPolicy} hitSlop={8}>
              <Text style={s.link}>Read the privacy policy</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onNotNow} hitSlop={8}>
              <Text style={s.link}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Pressable>
  </Modal>
);

/** Gate for any control that opens Android Settings for one of the two
 *  blocking permissions.
 *
 *    const { requestWithConsent, disclosureModal } = usePermissionConsentGate();
 *    ...
 *    requestWithConsent(() => openPermissionSettings(permission));
 *    ...
 *    {disclosureModal}   // render once, anywhere in the screen
 *
 *  Already agreed: runs the action straight away. Not yet: shows the popup
 *  and runs the action only after "Enable". */
export function usePermissionConsentGate() {
  const [pending, setPending] = useState<{ run: () => void | Promise<void> } | null>(null);
  const handling = useRef(false);

  const requestWithConsent = useCallback(async (run: () => void | Promise<void>) => {
    if (await hasPermissionConsent()) {
      await run();
      return;
    }
    setPending({ run });
  }, []);

  const close = useCallback(() => setPending(null), []);

  const enable = useCallback(async () => {
    // A fast double tap must not open Settings twice.
    if (handling.current || !pending) return;
    handling.current = true;
    const { run } = pending;
    setPending(null);
    try {
      await setPermissionConsent();
      await run();
    } finally {
      handling.current = false;
    }
  }, [pending]);

  const disclosureModal = <PermissionDisclosure visible={pending !== null} onEnable={enable} onNotNow={close} />;

  return { requestWithConsent, disclosureModal };
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', paddingHorizontal: Spacing.lg,
  },
  card: {
    maxHeight: '92%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { padding: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.md },
  footer: {
    padding: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface,
  },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.xs },
  title: { fontFamily: Fonts.pixel, fontSize: 30, color: Colors.textPrimary, letterSpacing: 0.5 },
  intro: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, fontFamily: Fonts.regular },
  point: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, fontFamily: Fonts.regular },
  bold: { color: Colors.textPrimary, fontFamily: Fonts.semibold },
  consent: { fontSize: 13, color: Colors.textPrimary, lineHeight: 19, fontFamily: Fonts.medium },
  link: { textAlign: 'center', fontSize: 13, color: Colors.textSecondary, fontFamily: Fonts.medium },
});
