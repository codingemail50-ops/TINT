// The home-screen bonfire's 6 growth stages, keyed by today's focus
// progress toward the daily goal — unlit ash, then kindling with smoke,
// then a small flame that grows and gains logs/licks as the day goes on.
// Color (which of FLAME_PALETTES) is a separate axis driven by streak, not
// baked into the stage — see intensityForStage's caller in Bonfire.tsx.
import {
  Mask, circleMask, tongueMask, barMask, union, IconBuilder, PixelIconDef,
} from '../utils/pixelMask';
import { FLAME_PALETTES } from './flameShapes';

const COLS = 34;
const ROWS = 28;

const ASH_DARK = '#2B2622';
const ASH_MID = '#4A4038';
const ASH_OUTLINE = '#161311';
const EMBER = '#7A1F0A';
const LOG_BROWN = '#5A3A22';
const LOG_BROWN_DARK = '#3A2415';
const STONE = '#5C5A56';
const STONE_DARK = '#3A3936';
const SMOKE = '#B8B4AC';
const SMOKE_FAINT = '#6E6A62';
const GROUND_SHADOW = '#0A0908';

export const BONFIRE_STAGE_COUNT = 6;

function groundShadow(b: IconBuilder) {
  b.fill(circleMask(COLS, ROWS, 17, 26, 13, 2.2), GROUND_SHADOW);
}

function addStones(b: IconBuilder, cxs: number[], y: number) {
  cxs.forEach(cx => {
    const m = circleMask(COLS, ROWS, cx, y, 1.6, 1.3);
    b.fill(m, STONE).outline(m, STONE_DARK);
  });
}

function addLogs(b: IconBuilder, y0: number, y1: number, cxLeft0: number, cxLeft1: number, cxRight0: number, cxRight1: number, half: number) {
  const logA = barMask(COLS, ROWS, y0, y1, cxLeft0, cxLeft1, half);
  const logB = barMask(COLS, ROWS, y0 - 1, y1 - 1, cxRight0, cxRight1, half);
  [logA, logB].forEach(log => b.fill(log, LOG_BROWN).outline(log, LOG_BROWN_DARK));
}

function addFlame(b: IconBuilder, body: Mask, palette: typeof FLAME_PALETTES[keyof typeof FLAME_PALETTES], coreX: number, coreY: number) {
  b.fill(body, (x, y) => {
    const d = Math.hypot(x - coreX, y - coreY);
    if (d < 1.8) return palette.shades[3];
    if (d < 4) return palette.shades[2];
    if (d < 6.5) return palette.shades[1];
    return palette.shades[0];
  }).outline(body, palette.outline);
}

// Stage 1 — cold ash pile, unlit. No streak color applies yet.
function stage1(): PixelIconDef {
  const b = new IconBuilder(COLS, ROWS);
  groundShadow(b);
  const mound = union(
    circleMask(COLS, ROWS, 17, 23, 8, 3.2),
    circleMask(COLS, ROWS, 12, 24, 4, 2),
    circleMask(COLS, ROWS, 22, 24, 4, 2),
  );
  b.fill(mound, (_x, y) => (y < 22 ? ASH_MID : ASH_DARK)).outline(mound, ASH_OUTLINE);
  [[14, 22], [20, 23], [17, 21]].forEach(([x, y]) => b.dot(x, y, EMBER));
  return b.build();
}

// Stage 2 — kindling stacked into a teepee, unlit, first wisps of smoke.
function stage2(): PixelIconDef {
  const b = new IconBuilder(COLS, ROWS);
  groundShadow(b);
  const legs = union(
    barMask(COLS, ROWS, 11, 23, 12, 22, 1.3),
    barMask(COLS, ROWS, 11, 23, 22, 12, 1.3),
    barMask(COLS, ROWS, 14, 23, 9, 24, 1.1),
    barMask(COLS, ROWS, 14, 23, 25, 10, 1.1),
  );
  b.fill(legs, LOG_BROWN).outline(legs, LOG_BROWN_DARK);
  [[17, 22], [16, 23]].forEach(([x, y]) => b.dot(x, y, EMBER));
  const wispL: [number, number][] = [[13, 18], [12, 15], [13, 12], [12, 9], [13, 6]];
  const wispR: [number, number][] = [[21, 17], [22, 14], [21, 11], [22, 8]];
  wispL.forEach(([x, y], i) => b.dot(x, y, i % 2 === 0 ? SMOKE : SMOKE_FAINT));
  wispR.forEach(([x, y], i) => b.dot(x, y, i % 2 === 0 ? SMOKE : SMOKE_FAINT));
  return b.build();
}

// Stage 3 — small flame catches on a modest stone ring.
function stage3(palette: typeof FLAME_PALETTES[keyof typeof FLAME_PALETTES]): PixelIconDef {
  const b = new IconBuilder(COLS, ROWS);
  groundShadow(b);
  addStones(b, [9, 13, 21, 25], 23);
  const body = union(tongueMask(COLS, ROWS, 15, 22, 17, 4.5, -1, 0.8), circleMask(COLS, ROWS, 17, 21, 5, 3.5));
  addFlame(b, body, palette, 16, 20);
  return b.build();
}

// Stage 4 — flame fills out, stone ring more complete.
function stage4(palette: typeof FLAME_PALETTES[keyof typeof FLAME_PALETTES]): PixelIconDef {
  const b = new IconBuilder(COLS, ROWS);
  groundShadow(b);
  addStones(b, [7, 11, 15, 19, 23, 27], 23);
  const body = union(
    tongueMask(COLS, ROWS, 11, 22, 17, 6, -1.6, 0.8),
    tongueMask(COLS, ROWS, 15, 22, 22, 3, 1.2, 0.85),
    circleMask(COLS, ROWS, 17, 20.5, 6.5, 4.5),
  );
  addFlame(b, body, palette, 15, 19);
  return b.build();
}

// Stage 5 — bigger flame, crossed logs visible at the base.
function stage5(palette: typeof FLAME_PALETTES[keyof typeof FLAME_PALETTES]): PixelIconDef {
  const b = new IconBuilder(COLS, ROWS);
  groundShadow(b);
  addStones(b, [6, 10, 24, 28], 24);
  addLogs(b, 21, 23, 8, 26, 26, 8, 1.8);
  const body = union(
    tongueMask(COLS, ROWS, 6, 21, 17, 7.5, -2.2, 0.8),
    tongueMask(COLS, ROWS, 11, 20, 24, 4, 1.8, 0.85),
    circleMask(COLS, ROWS, 17, 19.5, 7.5, 5.5),
  );
  addFlame(b, body, palette, 14, 18);
  return b.build();
}

// Stage 6 — the biggest, most jagged flame, with smoke plumes and sparks.
function stage6(palette: typeof FLAME_PALETTES[keyof typeof FLAME_PALETTES]): PixelIconDef {
  const b = new IconBuilder(COLS, ROWS);
  groundShadow(b);
  addStones(b, [5, 9, 25, 29], 24);
  addLogs(b, 21, 23, 7, 27, 27, 7, 1.9);
  const body = union(
    tongueMask(COLS, ROWS, 1, 19, 17, 9, -2.8, 0.7),
    tongueMask(COLS, ROWS, 6, 18, 26, 5, 2.4, 0.75),
    tongueMask(COLS, ROWS, 8, 18, 8, 4, -2.2, 0.8),
    circleMask(COLS, ROWS, 17, 18, 9, 6.5),
  );
  addFlame(b, body, palette, 14, 17);
  const plumeL: [number, number][] = [[4, 12], [3, 9], [4, 6], [3, 3], [5, 1]];
  const plumeR: [number, number][] = [[30, 11], [31, 8], [30, 5], [31, 2]];
  plumeL.forEach(([x, y], i) => b.dot(x, y, i % 2 === 0 ? SMOKE : SMOKE_FAINT));
  plumeR.forEach(([x, y], i) => b.dot(x, y, i % 2 === 0 ? SMOKE : SMOKE_FAINT));
  [[17, 0], [22, 2], [12, 3]].forEach(([x, y]) => b.dot(x, y, palette.shades[2]));
  return b.build();
}

/** stage: 1 (unlit) through 6 (biggest/blazing). intensity only affects the
 *  lit stages (3-6) — stages 1-2 have no fire yet, so no color to tint. */
export function buildBonfireStage(stage: number, intensity: keyof typeof FLAME_PALETTES = 'pop'): PixelIconDef {
  const palette = FLAME_PALETTES[intensity];
  const clamped = Math.min(BONFIRE_STAGE_COUNT, Math.max(1, Math.round(stage)));
  switch (clamped) {
    case 1: return stage1();
    case 2: return stage2();
    case 3: return stage3(palette);
    case 4: return stage4(palette);
    case 5: return stage5(palette);
    default: return stage6(palette);
  }
}
