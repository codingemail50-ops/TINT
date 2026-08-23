// The "meditating flame" brand mascot — a calm, closed-eyed flame with
// curled steam wisps at the sides, drifting sparks, and small curled
// tendrils resting at its base. Built from the same mask toolkit as
// pixelIcons.ts/flameShapes.ts (masks combined via union, shaded by
// distance from a core point, outlined from the silhouette) instead of a
// hand-traced bitmap, so it stays crisp at any size.
import {
  Mask, emptyMask, circleMask, union, IconBuilder, PixelIconDef,
} from '../utils/pixelMask';
import { FLAME_PALETTES } from './flameShapes';

const COLS = 30;
const ROWS = 32;
const CX = 14.5;

const FACE_DARK = '#1A0800';
const WISP_GREY = '#7A7A7A';
const WISP_GREY_FAINT = '#4E4E4E';

// A cone that curves as it rises (cx drifts by `lean` toward the tip)
// instead of a straight-sided wedge — reads as a flame lick, not a
// triangle. `pow` > 1 keeps it narrow near the tip longer before flaring.
function tongueMask(y0: number, y1: number, cxBase: number, maxHalf: number, lean: number, pow: number): Mask {
  const grid = emptyMask(COLS, ROWS);
  const span = y1 - y0;
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / span; // 0 at tip, 1 at base
    const halfWidth = maxHalf * Math.pow(t, pow);
    const cx = cxBase + lean * (1 - t);
    for (let x = 0; x < COLS; x++) if (Math.abs(x - cx) <= halfWidth) grid[y][x] = true;
  }
  return grid;
}

function buildBody(): Mask {
  const belly = circleMask(COLS, ROWS, CX, 19.5, 10, 8.5);
  // One main tongue that hooks left toward its tip, plus a shorter,
  // lower secondary flick to its right — reads as a single flame with a
  // subordinate lick, not a symmetric double-peaked crown.
  const mainTongue = tongueMask(3, 15, CX, 9, -2.4, 0.85);
  const sideTongue = tongueMask(9, 14, CX + 5.5, 3.6, 0.8, 0.85);
  return union(mainTongue, sideTongue, belly);
}

export function buildMeditatingFlame(intensity: keyof typeof FLAME_PALETTES = 'pop'): PixelIconDef {
  const palette = FLAME_PALETTES[intensity];
  const body = buildBody();
  // Off-center and modest radius so the pale "hottest" patch reads as a
  // soft highlight, not a blob that swallows the mouth.
  const coreX = CX - 2, coreY = 21;

  const b = new IconBuilder(COLS, ROWS)
    .fill(body, (x, y) => {
      const d = Math.hypot(x - coreX, y - coreY);
      if (d < 2.5) return palette.shades[3];
      if (d < 6) return palette.shades[2];
      if (d < 10) return palette.shades[1];
      return palette.shades[0];
    })
    .outline(body, palette.outline);

  // Closed eyes + flat, calm mouth.
  [11, 12, 17, 18].forEach(x => b.dot(x, 18, FACE_DARK));
  [13, 14, 15, 16].forEach(x => b.dot(x, 21, FACE_DARK));

  // Thin comma-curl wisps drifting off both sides, with a couple of
  // fading dissipation dots trailing outward.
  const leftWisp: [number, number][] = [[4, 10], [3, 10], [2, 11], [2, 12], [3, 13]];
  const leftTail: [number, number][] = [[1, 16], [0, 17]];
  leftWisp.forEach(([x, y]) => b.dot(x, y, WISP_GREY));
  leftTail.forEach(([x, y]) => b.dot(x, y, WISP_GREY_FAINT));
  leftWisp.forEach(([x, y]) => b.dot(COLS - 1 - x, y, WISP_GREY));
  leftTail.forEach(([x, y]) => b.dot(COLS - 1 - x, y, WISP_GREY_FAINT));

  // Small sparks drifting above the flame.
  const sparks: [number, number][] = [[16, 0], [9, 3], [21, 4], [7, 7], [23, 8]];
  sparks.forEach(([x, y]) => b.dot(x, y, palette.shades[2]));

  // Curled tendrils resting at the base, like folded hands.
  const leftCurl: [number, number][] = [[8, 25], [7, 26], [6, 27], [6, 28], [7, 29], [8, 29], [9, 28]];
  leftCurl.forEach(([x, y]) => b.dot(x, y, palette.shades[1]));
  leftCurl.forEach(([x, y]) => b.dot(COLS - 1 - x, y, palette.shades[1]));

  return b.build();
}
