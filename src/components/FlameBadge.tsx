import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp, TouchableOpacity } from 'react-native';
import { Colors, Fonts } from '../constants/theme';
import { PixelFlame } from './PixelFlame';

interface Props {
  streak: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export const FlameBadge: React.FC<Props> = ({ streak, size = 38, style, onPress }) => {
  const content = (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <PixelFlame size={size * 0.42} state="static" />
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
    borderColor: Colors.blue[400],
    backgroundColor: Colors.blue[950],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  n: { fontFamily: Fonts.retro, color: Colors.blue[400] },
});
