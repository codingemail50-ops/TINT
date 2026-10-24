// "Choose your avatar": shown once, right after someone moves from the 7 Day
// Lock In to everyday studying and lands in the app. They already have an
// avatar (the default star unless they picked another when they signed up), so
// this is optional: "Keep it for now" (or a tap outside, or Back) changes nothing.

import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView } from 'react-native';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { AVATARS } from '../data/examPresets';
import { PixelIcon } from './PixelIcon';
import { PrimaryButton, challengeStyles } from './ChallengeParts';

interface Props {
  visible: boolean;
  /** The avatar the account has now. */
  current: string;
  onSave: (avatar: string) => void;
  onSkip: () => void;
}

export const AvatarPrompt: React.FC<Props> = ({ visible, current, onSave, onSkip }) => {
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = picked ?? current;
  const close = () => { setPicked(null); onSkip(); };
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={s.backdrop}>
        {/* Tapping outside the card closes it. This is a sibling UNDER the card,
            not a Pressable wrapped around it: a touchable parent grabbed the
            drag from the scroll list inside, so the list would not scroll on a
            real phone. */}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={close} />
        <View style={[challengeStyles.card, s.card]}>
          <Text style={s.title}>Choose your avatar</Text>
          <Text style={challengeStyles.sub}>This is how you show up to friends and on the leaderboard. You can change it any time in Profile.</Text>
          <ScrollView style={s.gridBox} contentContainerStyle={s.grid} showsVerticalScrollIndicator nestedScrollEnabled>
            {AVATARS.map(a => (
              <TouchableOpacity
                key={a}
                style={[s.item, chosen === a && s.itemOn]}
                onPress={() => setPicked(a)}
                activeOpacity={0.75}
              >
                <PixelIcon name={a} size={28} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <PrimaryButton
            label={chosen === current ? 'Keep this avatar' : 'Use this avatar'}
            onPress={() => { const a = chosen; setPicked(null); if (a === current) onSkip(); else onSave(a); }}
          />
          <TouchableOpacity onPress={close} hitSlop={8}>
            <Text style={s.skip}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: Spacing.xl },
  card: { gap: Spacing.md, maxHeight: '90%' },
  title: { fontFamily: Fonts.pixel, fontSize: 26, color: Colors.textPrimary },
  gridBox: { flexGrow: 0, maxHeight: 300 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingVertical: 4 },
  item: {
    width: 52, height: 52, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated, borderWidth: 2, borderColor: Colors.border,
  },
  itemOn: { borderColor: Colors.pop },
  skip: { textAlign: 'center', color: Colors.pop, fontFamily: Fonts.semibold, fontSize: 15 },
});
