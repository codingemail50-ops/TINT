import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors, Fonts } from '../constants/theme';
import { PixelFlame } from './PixelFlame';

interface Props {
  streak: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export const FlameBadge: React.FC<Props> = ({ streak, size = 38, style }) => (
  <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.21 }, style]}>
    <PixelFlame size={size * 0.42} state="static" />
    <Text style={[styles.n, { fontSize: size * 0.32 }]}>{streak}</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1.5,
    borderColor: Colors.blue[400],
    backgroundColor: 'rgba(115,181,221,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  n: { fontFamily: Fonts.retro, color: Colors.blue[400] },
});
