// Procedural pixel-flame silhouette: one tapering "core" body plus three
// rounded toes at the base, shaded by distance from a core anchor low in
// the body (mirrors classic pixel-fire sprites — pale/hot core low-center,
// darker toward the edges). Multiple frames (different toe/tip offsets)
// let the flame flicker by swapping silhouettes, not just recoloring.

export interface FlameCell {
  x: number;
  y: number;
  shade: 1 | 2 | 3 | 4; // 1 = outer/darkest .. 4 = core/palest
}

export interface FlameFrame {
  cols: number;
  rows: number;
  cells: FlameCell[];
  outline: { x: number; y: number }[];
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 2;
}

function buildGrid(cols: number, rows: number, seed: number): boolean[][] {
  const cx = (cols - 1) / 2;
  const grid: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

  const tipLean = seed * 0.6; // frame-to-frame tip sway
  const maxHalf = cx * 0.88;

  for (let y = 0; y < rows; y++) {
    const t = y / (rows - 1);
    // A single continuous curve (no piecewise join, which was creating a
    // visible "shoulder" kink): exponent > 1 keeps the argument small
    // near the tip for longer, so it narrows to a real point instead of
    // rounding off, then opens into the body and tapers back down.
    const halfWidth = maxHalf * Math.sin(Math.PI * Math.pow(Math.min(t, 0.97), 1.7));

    const lean = tipLean * (1 - t) * (t < 0.5 ? 1 : 0.3);
    const rowCx = cx + lean;

    for (let x = 0; x < cols; x++) {
      if (Math.abs(x - rowCx) <= halfWidth) grid[y][x] = true;
    }
  }

  // Three downward flame "tongues" at the base, overlapping the tapered
  // body so they read as licks pointing down, not ears sticking sideways.
  const toeRow = rows - 1;
  const toes = [
    { cx: cx - cx * 0.36 + seed * 0.25, cy: toeRow - 0.4, r: 2.1 },
    { cx: cx + seed * 0.2, cy: toeRow + 0.4, r: 2.4 },
    { cx: cx + cx * 0.36 - seed * 0.25, cy: toeRow - 0.4, r: 1.9 },
  ];
  for (const toe of toes) {
    const minX = Math.max(0, Math.floor(toe.cx - toe.r - 1));
    const maxX = Math.min(cols - 1, Math.ceil(toe.cx + toe.r + 1));
    const minY = Math.max(0, Math.floor(toe.cy - toe.r - 1));
    const maxY = Math.min(rows - 1, Math.ceil(toe.cy + toe.r + 1));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (Math.hypot(x - toe.cx, y - toe.cy) <= toe.r) grid[y][x] = true;
      }
    }
  }

  return grid;
}

function shadeGrid(grid: boolean[][], cols: number, rows: number): FlameCell[] {
  // Core anchor sits low-center, where the reference art shows the
  // palest/hottest patch — shading is just distance from that point.
  const coreX = (cols - 1) / 2;
  const coreY = rows * 0.66;
  const maxDist = Math.hypot(cols * 0.55, rows * 0.5);

  const cells: FlameCell[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!grid[y][x]) continue;
      const d = Math.hypot(x - coreX, y - coreY) / maxDist;
      const shade: FlameCell['shade'] = d < 0.28 ? 4 : d < 0.5 ? 3 : d < 0.75 ? 2 : 1;
      cells.push({ x, y, shade });
    }
  }
  return cells;
}

function outlineCells(grid: boolean[][], cols: number, rows: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!grid[y][x]) continue;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        if (grid[ny][nx]) continue;
        const key = `${nx},${ny}`;
        if (!seen.has(key)) { seen.add(key); out.push({ x: nx, y: ny }); }
      }
    }
  }
  return out;
}

export const FLAME_COLS = 16;
export const FLAME_ROWS = 24;

export function buildFlameFrame(seed: number): FlameFrame {
  const grid = buildGrid(FLAME_COLS, FLAME_ROWS, seed);
  return {
    cols: FLAME_COLS,
    rows: FLAME_ROWS,
    cells: shadeGrid(grid, FLAME_COLS, FLAME_ROWS),
    outline: outlineCells(grid, FLAME_COLS, FLAME_ROWS),
  };
}

// Five frames with different tip/toe seeds — cycling through them is what
// actually reads as "flicker" (silhouette changes), not just a recolor or
// scale pulse. Five instead of three so the loop is less noticeably
// repetitive, combined with randomized timing in PixelFlame.
export const FLAME_FRAMES: FlameFrame[] = [-0.6, 0.35, -0.15, 0.6, -0.4].map(buildFlameFrame);

export interface FlamePalette {
  outline: string;
  shades: [string, string, string, string]; // index 0 = outer, 3 = core
}

export const FLAME_PALETTES: Record<string, FlamePalette> = {
  // 'cold' is the only palette actually used now — the app is fully
  // monochrome, so it's built from the exact same neutral grey scale as
  // everything else (theme.ts's `gray`) instead of a tinted grey. The
  // warm/hot/blazing/gold/ice color-fire palettes are kept for reference
  // only — nothing in the app selects them anymore.
  cold:    { outline: '#0D0D0D', shades: ['#434343', '#767676', '#D6D6D6', '#F5F5F5'] },
  warm:    { outline: '#3D0F02', shades: ['#8A230D', '#D85A17', '#F5941F', '#FFD84D'] },
  hot:     { outline: '#3D0602', shades: ['#9A1505', '#E8420F', '#FF8A1F', '#FFE066'] },
  blazing: { outline: '#33020A', shades: ['#7A0B1E', '#D81B3F', '#FF5C3D', '#FFF0A8'] },
  // Aesthetic skins — same silhouette, fully different color story, same
  // idea as Opal's gold/black and blue/ice egg re-skins.
  gold:    { outline: '#1A1204', shades: ['#5C4308', '#A67C0E', '#E0A81A', '#FFE694'] },
  ice:     { outline: '#08151F', shades: ['#1D4E6E', '#3A87B0', '#7FC4E0', '#EAF8FF'] },
};
