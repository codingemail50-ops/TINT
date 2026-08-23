// Shared toolkit for building procedural pixel-art shapes (avatars, mascots)
// out of math instead of hand-traced bitmaps — masks combined via
// union/subtract/intersect, an outline derived from the silhouette, then
// colored in flat chunky tones. Same technique flameShapes.ts uses for the
// flame, generalized so other shapes (pixelIcons.ts, the meditating-flame
// mascot) can share it instead of re-deriving the same grid math.

export type Mask = boolean[][];

export function emptyMask(cols: number, rows: number): Mask {
  return Array.from({ length: rows }, () => Array(cols).fill(false));
}

export function circleMask(cols: number, rows: number, cx: number, cy: number, r: number, ry: number = r): Mask {
  const grid = emptyMask(cols, rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 <= 1) grid[y][x] = true;
    }
  }
  return grid;
}

export function rectMask(cols: number, rows: number, x0: number, y0: number, x1: number, y1: number): Mask {
  const grid = emptyMask(cols, rows);
  for (let y = Math.max(0, y0); y <= Math.min(rows - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(cols - 1, x1); x++) grid[y][x] = true;
  }
  return grid;
}

// A simple triangular cone — wide at one end, a point at the other. Used for
// wedge shapes (watermelon/pizza slice) and, unioned with a circle cap, for
// teardrop shapes (strawberry).
export function wedgeMask(cols: number, rows: number, cx: number, maxHalf: number, pointAtBottom: boolean, y0 = 0, y1 = rows - 1): Mask {
  const grid = emptyMask(cols, rows);
  const span = y1 - y0 || 1;
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / span;
    const frac = pointAtBottom ? 1 - t : t;
    const halfWidth = maxHalf * frac;
    for (let x = 0; x < cols; x++) {
      if (Math.abs(x - cx) <= halfWidth) grid[y][x] = true;
    }
  }
  return grid;
}

// Rasterized 5(or n)-point star: boundary radius alternates outerR (at each
// point tip) / innerR (at each valley), linearly interpolated between —
// standard star-polygon construction, just evaluated per-cell instead of
// drawn as vector edges.
export function starMask(cols: number, rows: number, cx: number, cy: number, outerR: number, innerR: number, points: number): Mask {
  const grid = emptyMask(cols, rows);
  const sector = 360 / points;
  const half = sector / 2;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.001) { grid[y][x] = true; continue; }
      let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      const pos = angle % sector;
      const t = pos <= half ? pos / half : (sector - pos) / half; // 0 at tip, 1 at valley
      const boundary = outerR + (innerR - outerR) * t;
      if (dist <= boundary) grid[y][x] = true;
    }
  }
  return grid;
}

export function union(...masks: Mask[]): Mask {
  const rows = masks[0].length, cols = masks[0][0].length;
  const grid = emptyMask(cols, rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    grid[y][x] = masks.some(m => m[y][x]);
  }
  return grid;
}

export function subtract(a: Mask, b: Mask): Mask {
  const rows = a.length, cols = a[0].length;
  const grid = emptyMask(cols, rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) grid[y][x] = a[y][x] && !b[y][x];
  return grid;
}

export function intersect(a: Mask, b: Mask): Mask {
  const rows = a.length, cols = a[0].length;
  const grid = emptyMask(cols, rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) grid[y][x] = a[y][x] && b[y][x];
  return grid;
}

// A cone that curves as it rises — cx drifts by `lean` toward the tip
// instead of a straight-sided wedge — so it reads as a flame lick, not a
// triangle. `pow` > 1 keeps it narrow near the tip longer before flaring.
export function tongueMask(cols: number, rows: number, y0: number, y1: number, cxBase: number, maxHalf: number, lean: number, pow: number): Mask {
  const grid = emptyMask(cols, rows);
  const span = y1 - y0;
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / span; // 0 at tip, 1 at base
    const halfWidth = maxHalf * Math.pow(t, pow);
    const cx = cxBase + lean * (1 - t);
    for (let x = 0; x < cols; x++) if (Math.abs(x - cx) <= halfWidth) grid[y][x] = true;
  }
  return grid;
}

// A straight bar of constant width running from (cxAt0, y0) to (cxAt1, y1)
// — a cheap way to draw an angled log/stick without needing real rotation.
export function barMask(cols: number, rows: number, y0: number, y1: number, cxAt0: number, cxAt1: number, halfWidth: number): Mask {
  const grid = emptyMask(cols, rows);
  const span = y1 - y0 || 1;
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / span;
    const cx = cxAt0 + (cxAt1 - cxAt0) * t;
    for (let x = 0; x < cols; x++) if (Math.abs(x - cx) <= halfWidth) grid[y][x] = true;
  }
  return grid;
}

export function belowRow(cols: number, rows: number, y: number, keepBelow: boolean): Mask {
  const grid = emptyMask(cols, rows);
  for (let yy = 0; yy < rows; yy++) {
    if (keepBelow ? yy >= y : yy < y) for (let x = 0; x < cols; x++) grid[yy][x] = true;
  }
  return grid;
}

export function outlineOf(mask: Mask, cols: number, rows: number): [number, number][] {
  const out: [number, number][] = [];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  const seen = new Set<string>();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!mask[y][x]) continue;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        if (mask[ny][nx]) continue;
        const key = `${nx},${ny}`;
        if (!seen.has(key)) { seen.add(key); out.push([nx, ny]); }
      }
    }
  }
  return out;
}

export interface PixelCell { x: number; y: number; color: string; }
export interface PixelIconDef { cols: number; rows: number; cells: PixelCell[]; }

// A working canvas: base cells from a mask + color rule, then arbitrary
// point overrides (eyes, seeds, sprinkles, spec highlights) layered on top,
// then an outline traced from a (possibly different) silhouette mask.
export class IconBuilder {
  private cells = new Map<string, PixelCell>();
  constructor(public cols: number, public rows: number) {}
  fill(mask: Mask, colorFn: string | ((x: number, y: number) => string)) {
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      if (mask[y][x]) this.cells.set(`${x},${y}`, { x, y, color: typeof colorFn === 'string' ? colorFn : colorFn(x, y) });
    }
    return this;
  }
  dot(x: number, y: number, color: string) {
    if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) this.cells.set(`${x},${y}`, { x, y, color });
    return this;
  }
  outline(mask: Mask, color: string) {
    for (const [x, y] of outlineOf(mask, this.cols, this.rows)) {
      const key = `${x},${y}`;
      if (!this.cells.has(key)) this.cells.set(key, { x, y, color });
    }
    return this;
  }
  build(): PixelIconDef {
    return { cols: this.cols, rows: this.rows, cells: Array.from(this.cells.values()) };
  }
}
