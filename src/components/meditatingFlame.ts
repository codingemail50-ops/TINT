// The flame mascot for the active Focus timer — a rounded flame-blob body
// with two curled tuft "ears" (short curved stems ending in a small round
// tip), matching the creature drawn in the user's sketch, not an invented
// humanoid pose. Colored with the flame's existing "pop" orange palette
// (flameShapes.ts) so it reads as the same character used elsewhere.

import { circleMask, union, IconBuilder, PixelIconDef } from '../utils/pixelMask';
import { FLAME_PALETTES } from './flameShapes';

const palette = FLAME_PALETTES.pop;

function stemMask(cols: number, rows: number, points: [number, number][], r: number) {
  return union(...points.map(([x, y]) => circleMask(cols, rows, x, y, r)));
}

export function buildMeditatingFlame(): PixelIconDef {
  const cols = 20, rows = 20, cx = 10;

  const body = circleMask(cols, rows, cx, 12, 7);

  // Each ear is a short curved stem rising off the body's shoulder, capped
  // with a small round tuft — a curled flame-lick, not a straight point.
  const leftStem = stemMask(cols, rows, [[7, 8], [6, 7], [6, 6], [5, 5]], 1.1);
  const rightStem = stemMask(cols, rows, [[12, 8], [13, 7], [13, 6], [14, 5]], 1.1);
  const leftCap = circleMask(cols, rows, 4, 4, 1.7);
  const rightCap = circleMask(cols, rows, 15, 4, 1.7);
  const ears = union(leftStem, leftCap, rightStem, rightCap);

  const full = union(body, ears);
  const highlight = circleMask(cols, rows, cx, 8, 1.8);

  const b = new IconBuilder(cols, rows)
    .fill(body, (x, y) => (y >= 15 ? palette.shades[0] : palette.shades[1]))
    .fill(ears, palette.shades[1])
    .fill(highlight, palette.shades[2])
    .outline(full, palette.outline);

  // Simple open dot eyes and a small closed-mouth smile — calm, not sleepy.
  b.dot(cx - 3, 11, palette.outline).dot(cx + 3, 11, palette.outline);
  b.dot(cx - 1, 14, palette.outline).dot(cx, 15, palette.outline).dot(cx + 1, 14, palette.outline);

  return b.build();
}

export const MEDITATING_FLAME = buildMeditatingFlame();
