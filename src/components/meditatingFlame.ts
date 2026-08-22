// The flame mascot for the active Focus timer — the sketch's flame-blob
// head (rounded face, two curled tuft "ears", simple dot eyes and a small
// smile) sitting on a meditating body: a seated base with crossed-leg knee
// bumps and a single pair of hands resting together in front, not arms out
// to the sides. Colored with the flame's existing "pop" orange palette
// (flameShapes.ts) so it reads as the same character used elsewhere.

import { circleMask, union, IconBuilder, PixelIconDef } from '../utils/pixelMask';
import { FLAME_PALETTES } from './flameShapes';

const palette = FLAME_PALETTES.pop;

function stemMask(cols: number, rows: number, points: [number, number][], r: number) {
  return union(...points.map(([x, y]) => circleMask(cols, rows, x, y, r)));
}

export function buildMeditatingFlame(): PixelIconDef {
  const cols = 22, rows = 27, cx = 11;

  const head = circleMask(cols, rows, cx, 8, 6);
  const leftStem = stemMask(cols, rows, [[8, 5], [7, 4], [7, 3], [6, 2]], 1.1);
  const rightStem = stemMask(cols, rows, [[14, 5], [15, 4], [15, 3], [16, 2]], 1.1);
  const leftCap = circleMask(cols, rows, 5, 1, 1.6);
  const rightCap = circleMask(cols, rows, 17, 1, 1.6);
  const ears = union(leftStem, leftCap, rightStem, rightCap);

  const torso = circleMask(cols, rows, cx, 17, 6, 4);
  const base = circleMask(cols, rows, cx, 22, 7, 3);
  const kneeL = circleMask(cols, rows, cx - 7, 22, 2);
  const kneeR = circleMask(cols, rows, cx + 7, 22, 2);
  const hands = circleMask(cols, rows, cx, 19, 2);

  const face = union(head, ears);
  const body = union(torso, base, kneeL, kneeR, hands);
  const full = union(face, body);
  const highlight = circleMask(cols, rows, cx, 5, 1.7);

  const b = new IconBuilder(cols, rows)
    .fill(head, palette.shades[1])
    .fill(ears, palette.shades[1])
    .fill(torso, palette.shades[1])
    .fill(union(base, kneeL, kneeR), palette.shades[0])
    .fill(hands, palette.shades[2])
    .fill(highlight, palette.shades[3])
    .outline(full, palette.outline);

  // Simple open dot eyes and a small closed-mouth smile.
  b.dot(cx - 3, 9, palette.outline).dot(cx + 3, 9, palette.outline);
  b.dot(cx - 1, 12, palette.outline).dot(cx, 13, palette.outline).dot(cx + 1, 12, palette.outline);

  return b.build();
}

export const MEDITATING_FLAME = buildMeditatingFlame();
