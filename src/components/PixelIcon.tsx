import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
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

  return (
    <Svg width={size} height={height} viewBox={`0 0 ${def.cols} ${def.rows}`} style={style}>
      {def.cells.map((c, i) => (
        <Rect key={i} x={c.x} y={c.y} width={1} height={1} fill={c.color} />
      ))}
    </Svg>
  );
};
