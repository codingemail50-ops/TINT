// A calm, seated flame mascot for the active Focus timer — same procedural
// mask technique as pixelIcons.ts, colored with the flame's existing "pop"
// orange palette (flameShapes.ts) so it reads as the same character, just
// in a meditating pose: a rounded body, a wide crossed-legs base, small
// resting arms, and a closed-eyes/smile face.

import { circleMask, union, IconBuilder, PixelIconDef } from '../utils/pixelMask';
import { FLAME_PALETTES } from './flameShapes';

const palette = FLAME_PALETTES.pop;

export function buildMeditatingFlame(): PixelIconDef {
  const cols = 24, rows = 22, cx = 12;

  const upperBody = circleMask(cols, rows, cx, 8, 7);
  const base = circleMask(cols, rows, cx, 17, 8, 3.2);
  const kneeL = circleMask(cols, rows, cx - 8, 17, 2.2);
  const kneeR = circleMask(cols, rows, cx + 8, 17, 2.2);
  const armL = circleMask(cols, rows, cx - 7.5, 11, 2);
  const armR = circleMask(cols, rows, cx + 7.5, 11, 2);
  const body = union(upperBody, base, kneeL, kneeR, armL, armR);
  const highlight = circleMask(cols, rows, cx - 3, 5, 2.2);

  const b = new IconBuilder(cols, rows)
    .fill(body, (x, y) => {
      if (y >= 14) return palette.shades[0]; // legs/base — deepest tone
      if (y >= 10) return palette.shades[1]; // torso/arms
      return palette.shades[2]; // head — brightest
    })
    .fill(highlight, palette.shades[3])
    .outline(body, palette.outline);

  // Closed eyes (short dashes) and a shallow smile — calm, meditating face.
  b.dot(cx - 3, 6, palette.outline).dot(cx - 2, 6, palette.outline);
  b.dot(cx + 2, 6, palette.outline).dot(cx + 3, 6, palette.outline);
  b.dot(cx - 1, 9, palette.outline).dot(cx, 10, palette.outline).dot(cx + 1, 9, palette.outline);

  return b.build();
}

export const MEDITATING_FLAME = buildMeditatingFlame();
