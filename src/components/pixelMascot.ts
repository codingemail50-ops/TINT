// The "meditating flame" brand mascot — a calm, closed-eyed flame with
// curled steam wisps at the sides, drifting sparks, and small curled
// tendrils resting at its base. Built from the same mask toolkit as
// pixelIcons.ts/flameShapes.ts (masks combined via union, shaded by
// distance from a core point, outlined from the silhouette) instead of a
// hand-traced bitmap, so it stays crisp at any size.
import {
  circleMask, wedgeMask, union, IconBuilder, PixelIconDef,
} from '../utils/pixelMask';
import { FLAME_PALETTES } from './flameShapes';

const COLS = 30;
const ROWS = 32;
const CX = 14.5;

const FACE_DARK = '#1A0800';
const WISP_GREY = '#7A7A7A';
const WISP_GREY_FAINT = '#4E4E4E';

function buildBody() {
  // Pointed lick tapering down into a wide, rounded chubby body — a
  // teardrop, not the narrow-toed silhouette flameShapes.ts uses, since
  // this mascot needs a broad round belly for the face to sit on.
  const tip = wedgeMask(COLS, ROWS, CX, 10, false, 3, 14);
  const belly = circleMask(COLS, ROWS, CX, 19, 10, 8.5);
  // Small back-curled flick at the very peak plus a shorter second lobe
  // beside it — the kinked, two-lobed tip visible in the reference art.
  const hook = circleMask(COLS, ROWS, CX - 2, 4, 2, 2.4);
  const lobe = circleMask(COLS, ROWS, CX + 3.5, 6, 2.2, 3);
  return union(tip, belly, hook, lobe);
}

export function buildMeditatingFlame(intensity: keyof typeof FLAME_PALETTES = 'pop'): PixelIconDef {
  const palette = FLAME_PALETTES[intensity];
  const body = buildBody();
  const coreX = CX, coreY = 23;

  const b = new IconBuilder(COLS, ROWS)
    .fill(body, (x, y) => {
      const d = Math.hypot(x - coreX, y - coreY);
      if (d < 4) return palette.shades[3];
      if (d < 7.5) return palette.shades[2];
      if (d < 11) return palette.shades[1];
      return palette.shades[0];
    })
    .outline(body, palette.outline);

  // Closed eyes + flat, calm mouth.
  [11, 12, 17, 18].forEach(x => b.dot(x, 17, FACE_DARK));
  [13, 14, 15, 16].forEach(x => b.dot(x, 20, FACE_DARK));

  // Curled steam wisps drifting off both sides, at head height.
  const leftWisp: [number, number][] = [[5, 11], [4, 11], [3, 12], [3, 13], [4, 14], [5, 14], [5, 13]];
  const leftTail: [number, number][] = [[2, 16], [1, 17]];
  leftWisp.forEach(([x, y]) => b.dot(x, y, WISP_GREY));
  leftTail.forEach(([x, y]) => b.dot(x, y, WISP_GREY_FAINT));
  leftWisp.forEach(([x, y]) => b.dot(COLS - 1 - x, y, WISP_GREY));
  leftTail.forEach(([x, y]) => b.dot(COLS - 1 - x, y, WISP_GREY_FAINT));

  // Small sparks drifting above the flame.
  const sparks: [number, number][] = [[15, 0], [10, 2], [20, 3], [8, 6], [22, 7]];
  sparks.forEach(([x, y]) => b.dot(x, y, palette.shades[2]));

  // Curled tendrils resting at the base, like folded hands.
  const leftCurl: [number, number][] = [[7, 25], [6, 26], [6, 27], [7, 28], [8, 28], [9, 27]];
  leftCurl.forEach(([x, y]) => b.dot(x, y, palette.shades[1]));
  leftCurl.forEach(([x, y]) => b.dot(COLS - 1 - x, y, palette.shades[1]));

  return b.build();
}
