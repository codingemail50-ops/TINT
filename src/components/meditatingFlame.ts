// The flame mascot for the active Focus timer — a single curled flame-lick
// silhouette (rounded bulb tapering into a tail that curls back on itself),
// matching the reference image, not a face/creature. Colored with the
// flame's existing "pop" orange palette (flameShapes.ts).

import { circleMask, wedgeMask, union, IconBuilder, PixelIconDef } from '../utils/pixelMask';
import { FLAME_PALETTES } from './flameShapes';

const palette = FLAME_PALETTES.pop;

function stemMask(cols: number, rows: number, points: [number, number][], r: number) {
  return union(...points.map(([x, y]) => circleMask(cols, rows, x, y, r)));
}

export function buildMeditatingFlame(): PixelIconDef {
  const cols = 16, rows = 20, cx = 8;

  const cap = circleMask(cols, rows, cx, 6, 5);
  const cone = wedgeMask(cols, rows, cx, 4.2, true, 6, 14);
  const body = union(cap, cone);

  // The tail curls back into a small hook instead of ending in a sharp point.
  const curl = stemMask(cols, rows, [[8, 13], [7, 14], [6, 14.5], [5, 14], [4.5, 13]], 1.3);

  const full = union(body, curl);
  const highlight = circleMask(cols, rows, cx - 1.5, 4.5, 2);

  const b = new IconBuilder(cols, rows)
    .fill(body, (x, y) => (y >= 11 ? palette.shades[0] : palette.shades[1]))
    .fill(curl, palette.shades[0])
    .fill(highlight, palette.shades[2])
    .outline(full, palette.outline);

  return b.build();
}

export const MEDITATING_FLAME = buildMeditatingFlame();
