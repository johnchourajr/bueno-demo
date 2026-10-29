import { Easing, interpolate } from "remotion";

/** Screen Studio's feel: slow in, slow out, no overshoot. */
export const ease = Easing.bezier(0.45, 0, 0.15, 1);

/** Seconds the camera takes to zoom in before a click, and out after. */
export const ZOOM_IN = 0.88;
export const ZOOM_OUT = 1.0;
/** How long the camera holds on the last click before easing out. */
export const HOLD = 1.4;
/** The shortest wide rest between two shots. Any shorter reads as a flinch. */
export const MIN_WIDE = 0.8;
/**
 * Points closer together than this share one zoom and the camera pans. Further
 * apart, there is room to hold, zoom all the way out, rest wide and zoom back
 * in, so two shots never overlap.
 */
export const SHOT_GAP = HOLD + ZOOM_OUT + MIN_WIDE + ZOOM_IN;
/** Seconds a pan takes within a shot. It starts as the cursor heads off, so
 *  something that opens out of view comes into frame quickly. */
export const PAN = 0.5;

export type Point = { x: number; y: number };
/** `lead`: when the cursor set off toward this point; the pan starts then. */
export type Focus = { t: number; x: number; y: number; lead?: number };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Zooming clicks and focus hovers grouped into shots: in before the first,
 *  out after the last. */
export function shots(points: Focus[]): Focus[][] {
  const out: Focus[][] = [];
  for (const c of points) {
    const last = out.at(-1);
    if (last && c.t - last[last.length - 1].t < SHOT_GAP) last.push(c);
    else out.push([c]);
  }
  return out;
}

/**
 * 0 (wide) to 1 (zoomed in) at time t, and the point the camera follows.
 * Shots shouldn't overlap, but if two ever do, the camera blends them rather
 * than cutting from one to the other: the deeper zoom wins, and the focus is
 * weighted by each shot's zoom, so neither can jump.
 */
export function camera(t: number, groups: Focus[][]): { amount: number; focus: Point | null } {
  let amount = 0;
  let weight = 0;
  let x = 0;
  let y = 0;
  for (const g of groups) {
    const start = g[0].t - ZOOM_IN;
    const end = g[g.length - 1].t + HOLD + ZOOM_OUT;
    if (t < start || t > end) continue;
    const inAmt = interpolate(t, [start, g[0].t], [0, 1], { ...clamp, easing: ease });
    const outAmt = interpolate(t, [end - ZOOM_OUT, end], [1, 0], { ...clamp, easing: ease });
    const a = Math.min(inAmt, outAmt);
    if (a <= 0) continue;
    const p = followPoint(t, g);
    amount = Math.max(amount, a);
    weight += a;
    x += p.x * a;
    y += p.y * a;
  }
  return { amount, focus: weight > 0 ? { x: x / weight, y: y / weight } : null };
}

/** Where the camera looks within a shot: each click in turn, panning between. */
export function followPoint(t: number, g: Focus[]): Point {
  if (t <= g[0].t) return g[0];
  for (let i = 1; i < g.length; i++) {
    if (t < g[i].t) {
      const from = Math.max(g[i - 1].t, g[i].lead ?? g[i].t - PAN);
      const to = Math.min(from + PAN, g[i].t);
      const p = interpolate(t, [from, Math.max(to, from + 0.01)], [0, 1], { ...clamp, easing: ease });
      return { x: g[i - 1].x + (g[i].x - g[i - 1].x) * p, y: g[i - 1].y + (g[i].y - g[i - 1].y) * p };
    }
  }
  return g[g.length - 1];
}
