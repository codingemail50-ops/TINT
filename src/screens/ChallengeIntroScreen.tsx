import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors, Spacing, Typography } from '../constants/theme';
import { PixelFlame } from '../components/PixelFlame';
import { PixelIcon } from '../components/PixelIcon';
import { Eyebrow, PrimaryButton } from '../components/ChallengeParts';
import { useHaptics } from '../hooks/useHaptics';

const { width: W } = Dimensions.get('window');

interface Props {
  avatar: string;
  onDone: () => void;
}

// Three short slides for people who came in through the 7 Day Lock In
// button, in place of the regular focus walkthrough.
export const ChallengeIntroScreen: React.FC<Props> = ({ avatar, onDone }) => {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { buttonPress } = useHaptics();

  const slides = [
    {
      key: 'what',
      art: <PixelFlame size={110} state="flicker" intensity="pop" />,
      eyebrow: '7 Day Lock In',
      title: 'No reels. No shorts.\n7 days.',
      body: 'The apps you pick stay blocked, all day, every day, for a week.',
    },
    {
      key: 'squad',
      art: (
        <View style={styles.squadArt}>
          {[avatar, 'fox', 'cat'].map((icon, i) => (
            <View key={i} style={[styles.squadAvatar, i === 0 && styles.squadAvatarYou]}>
              <PixelIcon name={icon} size={40} />
            </View>
          ))}
        </View>
      ),
      eyebrow: 'Solo or squad',
      title: 'Lock in with your friends.',
      body: 'Up to 6 of you, one code. Everyone sees who is still in.',
    },
    {
      key: 'luck',
      art: <PixelFlame size={110} state="flicker" intensity="pop" />,
      eyebrow: 'Good luck',
      title: 'The first days are the hardest.',
      body: 'Every time the urge hits, TINT will be there. Just get through today.',
    },
  ];

  const last = index === slides.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / W);
    if (next !== index) setIndex(next);
  };

  const next = () => {
    void buttonPress();
    if (last) {
      onDone();
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * W, animated: true });
    setIndex(index + 1);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={styles.pager}
      >
        {slides.map(slide => (
          <View key={slide.key} style={styles.slide}>
            <View style={styles.art}>{slide.art}</View>
            <Eyebrow>{slide.eyebrow}</Eyebrow>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <PrimaryButton label={last ? "Let's lock in" : 'Next'} onPress={next} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  pager: { flex: 1 },
  slide: { width: W, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  art: { minHeight: 140, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  title: { ...Typography.displayMedium, color: Colors.textPrimary, textAlign: 'center' },
  body: { ...Typography.bodyLarge, color: Colors.textSecondary, textAlign: 'center' },
  squadArt: { flexDirection: 'row' },
  squadAvatar: {
    width: 72, height: 72, borderRadius: 36, marginHorizontal: -6,
    backgroundColor: Colors.surfaceElevated, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  squadAvatarYou: { borderColor: Colors.pop, zIndex: 1 },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 2, backgroundColor: Colors.surfaceElevated },
  dotActive: { backgroundColor: Colors.pop, width: 20 },
});
