// Scalloped blob outline — same wavy-radius technique used for the Focus
// timer's squiggly circle. Returns both the path string and its points, so
// callers can measure its actual perimeter (react-native-svg has no
// `pathLength` normalization — unlike web SVG, it strokes in real path
// units, so dasharray/dashoffset need the real length, not an assumed
// 0-100 scale).
export function scallopPath(cx: number, cy: number, rBase: number, bumps = 15, amp = 5, n = 120) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 * Math.PI;
    const r = rBase + amp * Math.sin(bumps * t);
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  const d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} ` +
    pts.slice(1).map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z';
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  length += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  return { d, length };
}
