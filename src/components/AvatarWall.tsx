import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, TouchableOpacity, Dimensions, Easing } from 'react-native';
import { PixelIcon } from './PixelIcon';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  /** Sequence cycled across each row — pass one icon repeated for a
   *  decorative single-icon wallpaper, or the full avatar list for a
   *  tap-to-pick wall. */
  icons: string[];
  /** Rows must be enough to actually fill the wrapper's rendered box
   *  (rows * (cellSize + gap) >= wrapper height * ~1.6, since the wall is
   *  pre-sized to that height before the scale/rotate transform) — the row
   *  stack does not stretch to fill leftover space, it just stops, leaving
   *  a plain black gap at the bottom if under-sized. For a wall meant to
   *  cover a full screen, size generously (e.g. 25-30 rows). */
  rows?: number;
  cellSize?: number;
  gap?: number;
  angleDeg?: number;
  /** Odd rows scroll one way, even rows the other — off by default (all
   *  rows drift the same direction). */
  alternateDirection?: boolean;
  durationMs?: number;
  selected?: string;
  onPick?: (icon: string) => void;
}

// A tiled, continuously-scrolling wall of pixel-icon "bricks" at a slight
// angle — same idea as the reference screenshots (Tomb of the Mask's tiled
// icon backgrounds). Each row is its own seamless horizontal loop: the icon
// sequence is repeated enough times to cover more than 2 screen-widths, then
// duplicated once more so animating from 0 to -(one copy's width) loops
// with no visible seam.
export const AvatarWall: React.FC<Props> = ({
  icons, rows = 8, cellSize = 60, gap = 4, angleDeg = -7,
  alternateDirection = false, durationMs = 14000, selected, onPick,
}) => {
  const cell = cellSize + gap;
  const repeatCount = Math.max(3, Math.ceil((SCREEN_W * 1.7) / (cell * icons.length))) * icons.length;
  const unit: string[] = [];
  for (let i = 0; i < repeatCount; i++) unit.push(icons[i % icons.length]);
  const unitWidth = unit.length * cell;
  const doubled = [...unit, ...unit];

  const anims = useRef(Array.from({ length: rows }, () => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, i) => {
      anim.setValue(0);
      const dir = alternateDirection && i % 2 === 1 ? 1 : -1;
      anim.setValue(dir === -1 ? 0 : -unitWidth);
      return Animated.loop(
        Animated.timing(anim, {
          toValue: dir === -1 ? -unitWidth : 0,
          duration: durationMs,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
    });
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [unitWidth, durationMs, alternateDirection]);

  return (
    <View style={styles.clip} pointerEvents={onPick ? 'box-none' : 'none'}>
      <View style={[styles.rotated, { transform: [{ rotate: `${angleDeg}deg` }, { scale: 1.35 }] }]}>
        {anims.map((anim, rowIndex) => (
          <Animated.View
            key={rowIndex}
            style={[
              styles.row,
              {
                marginLeft: rowIndex % 2 === 1 ? -cell / 2 : 0,
                transform: [{ translateX: anim }],
              },
            ]}
          >
            {doubled.map((name, i) => {
              const isSelected = !!selected && name === selected;
              const Wrapper = onPick ? TouchableOpacity : View;
              return (
                <Wrapper
                  key={i}
                  style={[
                    styles.cell,
                    { width: cellSize, height: cellSize },
                    isSelected && styles.cellSelected,
                  ]}
                  {...(onPick ? { onPress: () => onPick(name), activeOpacity: 0.7 } : {})}
                >
                  <PixelIcon name={name} size={cellSize * 0.66} />
                </Wrapper>
              );
            })}
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  rotated: {
    position: 'absolute',
    top: '-30%',
    left: '-35%',
    width: '170%',
    height: '160%',
  },
  row: { flexDirection: 'row', marginBottom: 4 },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  cellSelected: {
    backgroundColor: 'rgba(255,106,0,0.22)',
    borderRadius: 14,
  },
});
