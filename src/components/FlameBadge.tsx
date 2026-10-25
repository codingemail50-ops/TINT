import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/theme';
import { PixelFlame } from './PixelFlame';
import { PixelIcon } from './PixelIcon';

interface Props {
  size?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** The user's chosen avatar (from onboarding) — shown instead of the
   *  generic flame when known. */
  avatar?: string;
  /** Small red dot in the corner — flags a pending incoming friend request
   *  so it's noticeable from Today without opening Profile to check. */
  showNotificationDot?: boolean;
}

export const FlameBadge: React.FC<Props> = ({ size = 38, style, onPress, avatar, showNotificationDot }) => {
  const content = (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {avatar ? (
        // Sized to sit fully inside the circle with room for the border
        // (it used to share the circle with the streak number, which pushed
        // it out of the ring).
        <PixelIcon name={avatar} size={size * 0.58} />
      ) : (
        <PixelFlame size={size * 0.42} state="static" />
      )}
      {showNotificationDot && <View style={styles.notificationDot} />}
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
  },
  notificationDot: {
    position: 'absolute',
    top: -1, right: -1,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.danger,
    borderWidth: 1.5, borderColor: Colors.background,
  },
});
