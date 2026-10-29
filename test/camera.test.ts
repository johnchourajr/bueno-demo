import assert from "node:assert/strict";
import { test } from "node:test";
import { camera, HOLD, MIN_WIDE, shots, ZOOM_IN, ZOOM_OUT, type Focus } from "../src/camera.ts";

const FRAME = 1 / 30;
/** Most the zoom may change in a frame. The steepest frame of the ease, on the
 *  0.88s zoom in, is about 0.12; a cut between shots is several times that. */
const EPSILON = 0.15;
/** Most the focus may move in a frame, as a share of the distance it travels.
 *  A pan over PAN (0.5s) moves about 0.21 of it on its steepest frame. */
const PAN_STEP = 0.25;

/** camera() every frame from before the first shot zooms in to after the last zooms out. */
function sample(groups: Focus[][]) {
  const from = groups[0][0].t - ZOOM_IN - 0.5;
  const to = groups.at(-1)!.at(-1)!.t + HOLD + ZOOM_OUT + 0.5;
  const frames = [];
  for (let t = from; t <= to; t += FRAME) frames.push({ t, ...camera(t, groups) });
  return frames;
}

function maxStep(values: number[]) {
  return Math.max(...values.slice(1).map((v, i) => Math.abs(v - values[i])));
}

test("points 3.1s apart share one shot, held all the way through", () => {
  const groups = shots([
    { t: 0, x: 100, y: 100 },
    { t: 3.1, x: 900, y: 500 },
    { t: 6.2, x: 300, y: 700 },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].length, 3);

  const frames = sample(groups);
  assert.ok(maxStep(frames.map((f) => f.amount)) <= EPSILON);
  for (const f of frames.filter((f) => f.t >= 0 && f.t <= 6.2)) assert.equal(f.amount, 1, `t=${f.t}`);
});

test("points far enough apart rest wide between shots", () => {
  const groups = shots([
    { t: 0, x: 100, y: 100 },
    { t: 4.5, x: 900, y: 500 },
  ]);
  assert.equal(groups.length, 2);

  const frames = sample(groups);
  assert.ok(maxStep(frames.map((f) => f.amount)) <= EPSILON);
  const wide = frames.filter((f) => f.t > 0 && f.t < 4.5 && f.amount === 0);
  assert.ok(wide.length * FRAME >= MIN_WIDE - FRAME, `wide for ${wide.length * FRAME}s`);
});

test("overlapping shots blend instead of jumping", () => {
  // shots() won't build these, but camera() mustn't cut between them if it's handed them.
  const groups = [[{ t: 0, x: 100, y: 100 }], [{ t: 2.5, x: 1500, y: 800 }]];
  const frames = sample(groups);
  assert.ok(maxStep(frames.map((f) => f.amount)) <= EPSILON);
  // Weighted by zoom, so it moves no faster than a pan would.
  const zoomed = frames.filter((f) => f.focus);
  assert.ok(maxStep(zoomed.map((f) => f.focus!.x)) <= 1400 * PAN_STEP);
});

test("a long pan inside a shot eases from the cursor's lead to the point", () => {
  const groups = shots([
    { t: 0, x: 100, y: 100 },
    { t: 3.5, x: 900, y: 100, lead: 2.6 },
  ]);
  assert.equal(groups.length, 1);

  const xs = sample(groups)
    .filter((f) => f.t >= 0 && f.t <= 3.5)
    .map((f) => ({ t: f.t, x: f.focus!.x }));
  // Holds on the first point until the cursor sets off.
  for (const f of xs.filter((f) => f.t < 2.6)) assert.equal(f.x, 100);
  // Then pans the whole way without stopping or turning back.
  const pan = xs.filter((f) => f.t > 2.6 + FRAME && f.t < 3.1 - FRAME);
  for (let i = 1; i < pan.length; i++) assert.ok(pan[i].x > pan[i - 1].x, `stalled at t=${pan[i].t}`);
  assert.ok(maxStep(xs.map((f) => f.x)) <= 800 * PAN_STEP);
  // And arrives before the click.
  for (const f of xs.filter((f) => f.t >= 3.1)) assert.equal(f.x, 900);
});
