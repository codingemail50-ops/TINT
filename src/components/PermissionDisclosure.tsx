// The "why TINT needs this permission" popup. Shown the first time the user
// taps a control that enables Usage access or Display over other apps (sign-up
// goal screen, Focus tab, 7 Day Lock In permissions page), BEFORE Android
// Settings opens. It names the one permission being turned on. In the 7 Day
// Lock In it also says what is saved to the account and what squads can see.
// Exact wording lives in 08_in_app_disclosure_text.md; keep the two in step.
//
// "Enable" remembers the agreement on this phone and carries on to Android
// Settings. "Not now" (also the Android Back button or a tap outside the card)
// just closes it: nothing opens, nothing is saved, and it never reopens by
// itself. Reading the privacy policy from the popup leaves it open. It appears again only on the next
// tap, until the user has agreed once.

import React, { useCallback, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { Eyebrow, PrimaryButton } from './ChallengeParts';
import { openPrivacyPolicy } from '../utils/accountDeletion';
import { hasPermissionConsent, setPermissionConsent, ConsentPermission } from '../utils/permissionConsent';

const PERMISSION_LABEL: Record<ConsentPermission, string> = {
  usageAccess: 'Usage access',
  overlay: 'Display over other apps',
};

// What each permission does, in the words shown to the user.
const PERMISSION_WHY: Record<ConsentPermission, string> = {
  usageAccess: "Lets TINT see which app is open, so it can cover the ones you picked. It doesn't upload your app list or which apps you open.",
  overlay: 'Lets TINT show its block screen over an app you picked.',
};

/** Where the popup is shown from. The 7 Day Lock In also saves a few counts to
 *  the account and shows squad members a few details, so it says so here. */
export type DisclosureContext = 'focus' | 'lockin';

interface Props {
  visible: boolean;
  /** Which permission is being turned on, shown under the title. */
  permission: ConsentPermission | null;
  context?: DisclosureContext;
  onEnable: () => void;
  onNotNow: () => void;
}

export const PermissionDisclosure: React.FC<Props> = ({ visible, permission, context = 'focus', onEnable, onNotNow }) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const lockIn = context === 'lockin';
  // More text than fits: say so, until the end has been reached.
  const [bodyH, setBodyH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const overflowing = contentH > bodyH + 4;
  const showHint = overflowing && !atEnd;
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onNotNow}>
      {/* A Modal is its own window, so it needs its own gesture-handler root for the scroll list inside. */}
      <GestureHandlerRootView style={[s.backdrop, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.md }]}>
        {/* Tapping outside the card closes it. This is a sibling UNDER the
            card, not a Pressable wrapped around it: a touchable parent grabbed
            the drag from the scroll list inside, so the text would not scroll
            on a real phone. The card never grows past the visible screen, so
            the buttons are always on screen. */}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onNotNow} />
        <View style={[s.card, { maxHeight: height - insets.top - insets.bottom - Spacing.md * 2 }]}>
          {/* Only the explanation scrolls. The agree line and the buttons stay
              pinned in view, so "Enable" and "Not now" are always reachable. */}
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.body}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            persistentScrollbar
            onLayout={e => setBodyH(e.nativeEvent.layout.height)}
            onContentSizeChange={(_, h) => setContentH(h)}
            scrollEventThrottle={32}
            onScroll={e => {
              const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
              setAtEnd(contentOffset.y + layoutMeasurement.height >= contentSize.height - 8);
            }}
          >
            <Eyebrow>Before you turn this on</Eyebrow>
            <Text style={s.title}>Why TINT needs this</Text>
            {permission ? (
              <Text style={s.point}>
                <Text style={s.turningOnName}>{PERMISSION_LABEL[permission]}.</Text> {PERMISSION_WHY[permission]}
              </Text>
            ) : null}
            <Text style={s.point}>
              <Text style={s.bold}>It keeps running.</Text> Blocking continues when TINT is closed: until the timer ends
              for a focus session, all day for 7 days in a 7 Day Lock In. A notification shows while it runs.
            </Text>
            {lockIn ? (
              <Text style={s.point}>
                <Text style={s.bold}>Saved to your account</Text> (only you see it): your tries to open each blocked app,
                and your use of those apps in the 7 days before you start.{' '}
                <Text style={s.bold}>Squad members see</Text> your username, avatar, picked apps and whether you're still in.
              </Text>
            ) : null}
            <Text style={s.point}>
              <Text style={s.bold}>Nothing else.</Text> TINT takes no other data and uses this for nothing else. No ads,
              no selling. Turn it off in Android settings, or delete your account, any time.
            </Text>
          </ScrollView>

          <View style={s.footer}>
            {showHint ? <Text style={s.moreHint}>Scroll down to read it all</Text> : null}
            <Text style={s.consent}>
              By tapping "Enable", you allow TINT to use {permission ? PERMISSION_LABEL[permission] : 'this permission'}.
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
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

/** Gate for any control that opens Android Settings for one of the two
 *  blocking permissions.
 *
 *    const { requestWithConsent, disclosureModal } = usePermissionConsentGate();
 *    ...
 *    requestWithConsent(permission, () => openPermissionSettings(permission));
 *    ...
 *    {disclosureModal}   // render once, anywhere in the screen
 *
 *  Already agreed for THIS permission: runs the action straight away. Not yet:
 *  shows the popup and runs the action only after "Enable". */
export function usePermissionConsentGate(context: DisclosureContext = 'focus') {
  const [pending, setPending] = useState<{ permission: ConsentPermission; run: () => void | Promise<void> } | null>(null);
  const handling = useRef(false);
  // Keep the permission name on screen while the popup fades out.
  const lastPermission = useRef<ConsentPermission | null>(null);
  if (pending) lastPermission.current = pending.permission;

  const requestWithConsent = useCallback(async (permission: ConsentPermission, run: () => void | Promise<void>) => {
    if (await hasPermissionConsent(permission)) {
      await run();
      return;
    }
    setPending({ permission, run });
  }, []);

  const close = useCallback(() => setPending(null), []);

  const enable = useCallback(async () => {
    // A fast double tap must not open Settings twice.
    if (handling.current || !pending) return;
    handling.current = true;
    const { permission, run } = pending;
    setPending(null);
    try {
      await setPermissionConsent(permission);
      await run();
    } finally {
      handling.current = false;
    }
  }, [pending]);

  const disclosureModal = (
    <PermissionDisclosure visible={pending !== null} permission={lastPermission.current} context={context} onEnable={enable} onNotNow={close} />
  );

  return { requestWithConsent, disclosureModal };
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', paddingHorizontal: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { padding: Spacing.lg, paddingBottom: Spacing.md, gap: 12 },
  footer: {
    padding: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface,
  },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: Spacing.lg, rowGap: Spacing.sm, paddingHorizontal: Spacing.xs },
  title: { fontFamily: Fonts.pixel, fontSize: 26, color: Colors.textPrimary, letterSpacing: 0.5 },
  moreHint: { textAlign: 'center', fontSize: 12, color: Colors.pop, fontFamily: Fonts.medium },
  turningOnName: { color: Colors.pop, fontFamily: Fonts.semibold },
  point: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, fontFamily: Fonts.regular },
  bold: { color: Colors.textPrimary, fontFamily: Fonts.semibold },
  consent: { fontSize: 13, color: Colors.textPrimary, lineHeight: 19, fontFamily: Fonts.medium },
  link: { textAlign: 'center', fontSize: 13, color: Colors.textSecondary, fontFamily: Fonts.medium },
});
