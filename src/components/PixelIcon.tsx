import React, { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { PIXEL_ICONS, PixelIconName } from './pixelIcons';

interface Props {
  /** Falls back to 'star' for any unrecognized name — covers older stored
   *  avatar values (e.g. Ionicons names from before this icon set existed). */
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export const PixelIcon: React.FC<Props> = ({ name, size = 40, style }) => {
  const def = PIXEL_ICONS[name as PixelIconName] ?? PIXEL_ICONS.star;
  const px = size / def.cols;
  const height = px * def.rows;

  // One <Path> per distinct color instead of one <Rect> per filled pixel —
  // a single icon can have 50-100+ cells, and AvatarWall mounts hundreds of
  // these at once for the onboarding wallpaper, so per-cell native views
  // there add up to tens of thousands and crash real Android devices
  // (never showed up on web/Playwright, which doesn't hit that limit).
  const paths = useMemo(() => {
    const byColor = new Map<string, string>();
    for (const c of def.cells) {
      byColor.set(c.color, (byColor.get(c.color) ?? '') + `M${c.x},${c.y}h1v1h-1z`);
    }
    return Array.from(byColor.entries());
  }, [def]);

  return (
    <Svg width={size} height={height} viewBox={`0 0 ${def.cols} ${def.rows}`} style={style}>
      {paths.map(([color, d]) => (
        <Path key={color} d={d} fill={color} />
      ))}
    </Svg>
  );
};
