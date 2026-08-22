// Procedural pixel-art icon set for avatars — same technique as flameShapes.ts
// (shapes built from math, not hand-traced bitmaps): masks combined via
// union/subtract, an outline derived from the silhouette, then colored in
// flat chunky tones. Full color on purpose — these are the one place in the
// app that intentionally breaks from the greyscale/orange theme, matching
// the playful "game item" reference the user sent.

import {
  circleMask, rectMask, wedgeMask, starMask, union, subtract, intersect,
  belowRow, outlineOf, IconBuilder, PixelIconDef,
} from '../utils/pixelMask';

export type { PixelCell, PixelIconDef } from '../utils/pixelMask';

export type PixelIconName =
  | 'star' | 'heart' | 'bomb' | 'coin' | 'cherry' | 'watermelon'
  | 'strawberry' | 'mushroom' | 'cat' | 'fox' | 'panda' | 'pizza' | 'donut';

function buildStar(): PixelIconDef {
  const cols = 13, rows = 13, cx = 6, cy = 6;
  const outer = starMask(cols, rows, cx, cy, 6, 2.6, 5);
  const inner = starMask(cols, rows, cx, cy, 3.6, 1.5, 5);
  return new IconBuilder(cols, rows)
    .fill(outer, '#FFD400')
    .fill(intersect(inner, outer), '#FFF3B0')
    .outline(outer, '#8A5A00')
    .build();
}

function buildHeart(): PixelIconDef {
  const cols = 13, rows = 12, cx = 6;
  const lobes = union(circleMask(cols, rows, 3.6, 4, 3.1), circleMask(cols, rows, 9.4, 4, 3.1));
  const point = wedgeMask(cols, rows, cx, 6.4, true, 3, 11);
  const body = union(lobes, point);
  return new IconBuilder(cols, rows)
    .fill(body, (x, y) => (y >= 8 ? '#B0202F' : '#E63946'))
    .fill(circleMask(cols, rows, 4.4, 2.9, 1.3), '#FF8FA3')
    .outline(body, '#4A0E14')
    .build();
}

function buildBomb(): PixelIconDef {
  const cols = 13, rows = 14, cx = 6, cy = 9;
  const body = circleMask(cols, rows, cx, cy, 4.3);
  const fuse: [number, number][] = [[7, 5], [8, 4], [8, 3]];
  const b = new IconBuilder(cols, rows)
    .fill(body, '#1B1B1B')
    .fill(circleMask(cols, rows, cx - 1.6, cy - 1.6, 1.4), '#4A4A4A')
    .dot(cx - 2, cy - 2, '#8C8C8C');
  for (const [x, y] of fuse) b.dot(x, y, '#6B4226');
  const spark = starMask(cols, rows, 9, 2, 1.9, 0.8, 4);
  b.fill(spark, '#FF6A00').dot(9, 2, '#FFD400');
  b.outline(body, '#000000');
  return b.build();
}

function buildCoin(): PixelIconDef {
  const cols = 13, rows = 13, cx = 6, cy = 6;
  const outer = circleMask(cols, rows, cx, cy, 6);
  const face = circleMask(cols, rows, cx, cy, 4.4);
  const core = circleMask(cols, rows, cx, cy, 2.6);
  return new IconBuilder(cols, rows)
    .fill(outer, '#F2B705')
    .fill(face, '#D99A04')
    .fill(core, '#FFE070')
    .fill(intersect(outer, circleMask(cols, rows, cx - 2.2, cy - 2.2, 2.4)), '#FFF3B0')
    .outline(outer, '#8A5A00')
    .build();
}

function buildCherry(): PixelIconDef {
  const cols = 13, rows = 13;
  const left = circleMask(cols, rows, 3.2, 9.4, 2.7);
  const right = circleMask(cols, rows, 9.8, 9.4, 2.7);
  const leftOutline = outlineOf(left, cols, rows);
  const rightOutline = outlineOf(right, cols, rows);
  const stem: [number, number][] = [[3, 8], [3, 7], [4, 6], [5, 5], [6, 4], [7, 5], [8, 6], [9, 7], [9, 8]];
  const leaf: [number, number][] = [[5, 3], [6, 3], [7, 3], [6, 2]];
  const b = new IconBuilder(cols, rows)
    .fill(left, '#D62839')
    .fill(right, '#D62839')
    .fill(circleMask(cols, rows, 2.4, 8.4, 0.9), '#FF6B7A')
    .fill(circleMask(cols, rows, 9, 8.4, 0.9), '#FF6B7A');
  for (const [x, y] of leftOutline) b.dot(x, y, '#5C0E17');
  for (const [x, y] of rightOutline) b.dot(x, y, '#5C0E17');
  for (const [x, y] of stem) b.dot(x, y, '#6B4226');
  for (const [x, y] of leaf) b.dot(x, y, '#3FA34D');
  return b.build();
}

function buildWatermelon(): PixelIconDef {
  const cols = 13, rows = 11, cx = 6;
  const body = wedgeMask(cols, rows, cx, 6, true);
  const rindOuter = intersect(body, belowRow(cols, rows, 2, false));
  const rindInner = intersect(body, rectMask(cols, rows, 0, 2, cols - 1, 2));
  const flesh = intersect(body, belowRow(cols, rows, 3, true));
  const b = new IconBuilder(cols, rows)
    .fill(flesh, '#E63946')
    .fill(rindInner, '#DFF5C8')
    .fill(rindOuter, '#1E7A34')
    .outline(body, '#0E4A1F');
  for (const [x, y] of [[5, 5], [7, 5], [6, 7], [4, 6] as [number, number]]) b.dot(x, y, '#1B1B1B');
  return b.build();
}

function buildStrawberry(): PixelIconDef {
  const cols = 13, rows = 13, cx = 6;
  const cap = circleMask(cols, rows, cx, 3, 4.2);
  const cone = wedgeMask(cols, rows, cx, 5.6, true, 2, 12);
  const body = union(cap, cone);
  const b = new IconBuilder(cols, rows)
    .fill(body, (x, y) => (y >= 9 ? '#B0202F' : '#E63946'))
    .outline(body, '#5C0E17');
  for (const [x, y] of [[4, 5], [8, 5], [6, 6], [4, 8], [8, 8], [6, 10]] as [number, number][]) b.dot(x, y, '#FFD400');
  for (const [x, y] of [[4, 1], [6, 0], [8, 1], [5, 1], [7, 1]] as [number, number][]) b.dot(x, y, '#3FA34D');
  return b.build();
}

function buildMushroom(): PixelIconDef {
  const cols = 13, rows = 13, cx = 6;
  const capFull = circleMask(cols, rows, cx, 5, 5.4);
  const cap = intersect(capFull, belowRow(cols, rows, 6, false));
  const stem = rectMask(cols, rows, 4, 6, 8, 12);
  const b = new IconBuilder(cols, rows)
    .fill(cap, '#D6203D')
    .fill(stem, '#F4E3C1')
    .outline(union(cap, stem), '#3A1408');
  for (const [x, y] of [[4, 2], [8, 2], [6, 1], [3, 4], [9, 4]] as [number, number][]) b.dot(x, y, '#FFFFFF');
  return b.build();
}

function buildCat(): PixelIconDef {
  const cols = 13, rows = 13;
  const face = circleMask(cols, rows, 6, 7, 5.2);
  const earL = wedgeMask(cols, rows, 2.4, 2.6, false, 1, 5);
  const earR = wedgeMask(cols, rows, 9.6, 2.6, false, 1, 5);
  const body = union(face, earL, earR);
  return new IconBuilder(cols, rows)
    .fill(body, '#F2A65A')
    .dot(2, 3, '#D9843A').dot(10, 3, '#D9843A')
    .dot(4, 6, '#1B1B1B').dot(8, 6, '#1B1B1B')
    .dot(6, 8, '#F2879E')
    .outline(body, '#7A4A1E')
    .build();
}

function buildFox(): PixelIconDef {
  const cols = 13, rows = 13;
  const face = circleMask(cols, rows, 6, 7, 5.2);
  const earL = wedgeMask(cols, rows, 2.2, 3, false, 0, 5);
  const earR = wedgeMask(cols, rows, 9.8, 3, false, 0, 5);
  const body = union(face, earL, earR);
  const muzzle = circleMask(cols, rows, 6, 9.2, 2.6, 2.2);
  return new IconBuilder(cols, rows)
    .fill(body, '#E8722C')
    .fill(muzzle, '#FFF6E8')
    .dot(2, 1, '#1B1B1B').dot(10, 1, '#1B1B1B')
    .dot(5, 7, '#1B1B1B').dot(7, 7, '#1B1B1B')
    .dot(6, 9, '#1B1B1B')
    .outline(body, '#5C2E0E')
    .build();
}

function buildPanda(): PixelIconDef {
  const cols = 13, rows = 13;
  const face = circleMask(cols, rows, 6, 7, 5.4);
  const earL = circleMask(cols, rows, 2.4, 3, 1.9);
  const earR = circleMask(cols, rows, 9.6, 3, 1.9);
  const body = union(face, earL, earR);
  const patchL = circleMask(cols, rows, 4, 6.4, 1.7);
  const patchR = circleMask(cols, rows, 8, 6.4, 1.7);
  return new IconBuilder(cols, rows)
    .fill(body, '#FFFFFF')
    .fill(union(earL, earR), '#2B2B2B')
    .fill(union(patchL, patchR), '#2B2B2B')
    .dot(6, 9, '#3A3A3A')
    .outline(body, '#BFBFBF')
    .build();
}

function buildPizza(): PixelIconDef {
  const cols = 13, rows = 11, cx = 6;
  const body = wedgeMask(cols, rows, cx, 6, true);
  const crustOuter = intersect(body, belowRow(cols, rows, 1, false));
  const crustInner = intersect(body, rectMask(cols, rows, 0, 1, cols - 1, 1));
  const cheese = intersect(body, belowRow(cols, rows, 2, true));
  const b = new IconBuilder(cols, rows)
    .fill(cheese, '#FFC93C')
    .fill(crustInner, '#B97A3D')
    .fill(crustOuter, '#D9A05B')
    .outline(body, '#7A4A1E');
  for (const [x, y] of [[6, 4], [4, 6], [8, 6]] as [number, number][]) b.dot(x, y, '#C6362B');
  return b.build();
}

function buildDonut(): PixelIconDef {
  const cols = 13, rows = 13, cx = 6, cy = 6;
  const outer = circleMask(cols, rows, cx, cy, 6);
  const hole = circleMask(cols, rows, cx, cy, 2.1);
  const ring = subtract(outer, hole);
  const glaze = intersect(ring, belowRow(cols, rows, 7, false));
  const dough = subtract(ring, glaze);
  const b = new IconBuilder(cols, rows)
    .fill(dough, '#E8B979')
    .fill(glaze, '#FF8FB1')
    .outline(ring, '#7A4A1E');
  for (const [x, y, c] of [[4, 3, '#4AA3FF'], [7, 2, '#3FD16B'], [9, 4, '#FFD400'], [5, 5, '#4AA3FF']] as [number, number, string][]) {
    b.dot(x, y, c);
  }
  return b.build();
}

export const PIXEL_ICONS: Record<PixelIconName, PixelIconDef> = {
  star: buildStar(),
  heart: buildHeart(),
  bomb: buildBomb(),
  coin: buildCoin(),
  cherry: buildCherry(),
  watermelon: buildWatermelon(),
  strawberry: buildStrawberry(),
  mushroom: buildMushroom(),
  cat: buildCat(),
  fox: buildFox(),
  panda: buildPanda(),
  pizza: buildPizza(),
  donut: buildDonut(),
};

export const PIXEL_ICON_NAMES = Object.keys(PIXEL_ICONS) as PixelIconName[];
