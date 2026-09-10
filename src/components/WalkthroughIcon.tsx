import React, { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { WALKTHROUGH_ICONS, WalkthroughIconName } from './walkthroughIcons';

interface Props {
  name: WalkthroughIconName;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// Same rendering approach as PixelIcon (one <Path> per distinct color,
// not one shape per cell) — reads from the walkthrough-only icon set
// instead of the avatar set.
export const WalkthroughIcon: React.FC<Props> = ({ name, size = 40, style }) => {
  const def = WALKTHROUGH_ICONS[name];
  const px = size / def.cols;
  const height = px * def.rows;

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
