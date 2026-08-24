import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp, TouchableOpacity } from 'react-native';
import { Colors, Fonts } from '../constants/theme';
import { PixelFlame } from './PixelFlame';
import { PixelIcon } from './PixelIcon';

interface Props {
  streak: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** The user's chosen avatar (from onboarding) — shown instead of the
   *  generic flame when known. */
  avatar?: string;
}

export const FlameBadge: React.FC<Props> = ({ streak, size = 38, style, onPress, avatar }) => {
  const content = (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {avatar ? (
        <PixelIcon name={avatar} size={size * 0.62} />
      ) : (
        <PixelFlame size={size * 0.42} state="static" />
      )}
      <Text style={[styles.n, { fontSize: size * 0.32 }]}>{streak}</Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1.5,
    borderColor: Colors.gray[400],
    backgroundColor: Colors.gray[800],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  n: { fontFamily: Fonts.retro, color: Colors.gray[400] },
});
