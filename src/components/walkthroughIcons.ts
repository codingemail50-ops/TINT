// Small procedural pixel icons for the walkthrough screens — built from the
// same mask toolkit as the avatar set (pixelIcons.ts) and the mascot
// (pixelMascot.ts), so they read as part of the same visual system instead
// of a different icon style bolted on. Kept in their own map (not added to
// PIXEL_ICONS) since these are UI glyphs, not selectable avatars.
import {
  Mask, rectMask, circleMask, wedgeMask, barMask, union, subtract, IconBuilder, PixelIconDef,
} from '../utils/pixelMask';
import { Colors } from '../constants/theme';

const OUTLINE = '#2B0E00';
const POP = Colors.pop; // '#FF6A00'
const POP_LIGHT = Colors.popLight; // '#FFA352'

// ── Checklist — a clipboard with two blank lines and one checked line ────
function buildChecklist(): PixelIconDef {
  const cols = 13, rows = 14;
  const board = rectMask(cols, rows, 2, 1, 10, 12);
  const clip = rectMask(cols, rows, 4, 0, 8, 2);
  const body = union(board, clip);

  const b = new IconBuilder(cols, rows)
    .fill(board, Colors.gray[800])
    .fill(clip, Colors.gray[600])
    .outline(body, OUTLINE);

  // Two plain list lines, one checked (pop-colored check) — enough to read
  // as "tasks, one of them marked" without drawing real text.
  [4, 6].forEach(x => { b.dot(x, 5, Colors.gray[500]); b.dot(x, 8, Colors.gray[500]); });
  b.dot(3, 5, POP).dot(4, 6, POP); // checkmark stroke over the first line
  [4, 6, 8].forEach(x => b.dot(x, 10, Colors.gray[500]));
  return b.build();
}

// ── Shield — rounded top tapering to a point, classic "protection" silhouette
function buildShield(): PixelIconDef {
  const cols = 13, rows = 14;
  const top = circleMask(cols, rows, 6, 4, 5.2, 4.2);
  const bottom = wedgeMask(cols, rows, 6, 5.2, true, 4, 13);
  const body = subtract(union(top, bottom), rectMask(cols, rows, 0, 0, 12, 0));

  return new IconBuilder(cols, rows)
    .fill(body, (x, y) => (y < 6 ? POP : POP_LIGHT))
    .outline(body, OUTLINE)
    .build();
}

// ── Trophy — cup + stem + base, for the compete/squad screen ─────────────
function buildTrophy(): PixelIconDef {
  const cols = 13, rows = 14;
  const cup = wedgeMask(cols, rows, 6, 4.2, true, 1, 6);
  const stem = barMask(cols, rows, 6, 9, 6, 6, 0.8);
  const base = rectMask(cols, rows, 3, 10, 9, 12);
  const body = union(cup, stem, base);

  return new IconBuilder(cols, rows)
    .fill(cup, POP_LIGHT)
    .fill(stem, POP)
    .fill(base, POP)
    .outline(body, OUTLINE)
    .build();
}

// ── Flag — planted pole with a flap, for "where you're going" ────────────
function buildFlag(): PixelIconDef {
  const cols = 13, rows = 14;
  const pole = barMask(cols, rows, 1, 13, 4, 4, 0.6);
  const flap = rectMask(cols, rows, 4, 1, 10, 5);
  const body = union(pole, flap);

  return new IconBuilder(cols, rows)
    .fill(pole, Colors.gray[500])
    .fill(flap, POP)
    .outline(body, OUTLINE)
    .build();
}

export type WalkthroughIconName = 'checklist' | 'shield' | 'trophy' | 'flag';

export const WALKTHROUGH_ICONS: Record<WalkthroughIconName, PixelIconDef> = {
  checklist: buildChecklist(),
  shield: buildShield(),
  trophy: buildTrophy(),
  flag: buildFlag(),
};
