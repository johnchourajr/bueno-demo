import {
  AbsoluteFill,
  Freeze,
  Easing,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useMemo, useState } from "react";
import { END_CAP, EndCap, LowerThird, loadBrandFonts, resolveBrand, type ResolvedBrand } from "./brand";
import type { DemoEvent, DemoProps } from "./types";

/** Screen Studio's feel: slow in, slow out, no overshoot. */
const ease = Easing.bezier(0.45, 0, 0.15, 1);

/** Seconds the camera takes to zoom in before a click, and out after. */
const ZOOM_IN = 0.88;
const ZOOM_OUT = 1.0;
/** Clicks closer together than this share one zoom and the camera pans. */
const CLUSTER_GAP = 2.6;
/** How long the camera holds on the last click before easing out. */
const HOLD = 1.4;
/** Seconds a pan takes within a shot. It starts as the cursor heads off, so
 *  something that opens out of view comes into frame quickly. */
const PAN = 0.5;

type Point = { x: number; y: number };
type Click = Extract<DemoEvent, { type: "click" }>;
type Say = Extract<DemoEvent, { type: "say" }>;
/** `lead`: when the cursor set off toward this point; the pan starts then. */
type Focus = { t: number; x: number; y: number; lead?: number };

/** Zooming clicks and focus hovers grouped into shots: in before the first,
 *  out after the last. */
function shots(points: Focus[]): Focus[][] {
  const out: Focus[][] = [];
  for (const c of points) {
    const last = out.at(-1);
    if (last && c.t - last[last.length - 1].t < CLUSTER_GAP) last.push(c);
    else out.push([c]);
  }
  return out;
}

/** 0 (wide) to 1 (zoomed in) at time t, and the point the camera follows. */
function camera(t: number, groups: Focus[][]): { amount: number; focus: Point | null } {
  for (const g of groups) {
    const start = g[0].t - ZOOM_IN;
    const end = g[g.length - 1].t + HOLD + ZOOM_OUT;
    if (t < start || t > end) continue;
    const inAmt = interpolate(t, [start, g[0].t], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
    const outAmt = interpolate(t, [end - ZOOM_OUT, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
    return { amount: Math.min(inAmt, outAmt), focus: followPoint(t, g) };
  }
  return { amount: 0, focus: null };
}

/** Where the camera looks within a shot: each click in turn, panning between. */
function followPoint(t: number, g: Focus[]): Point {
  if (t <= g[0].t) return g[0];
  for (let i = 1; i < g.length; i++) {
    if (t < g[i].t) {
      const from = Math.max(g[i - 1].t, g[i].lead ?? g[i].t - PAN);
      const to = Math.min(from + PAN, g[i].t);
      const p = interpolate(t, [from, Math.max(to, from + 0.01)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
      return { x: g[i - 1].x + (g[i].x - g[i - 1].x) * p, y: g[i - 1].y + (g[i].y - g[i - 1].y) * p };
    }
  }
  return g[g.length - 1];
}

/**
 * The cursor's path, one point per frame. It chases each target on a
 * critically damped spring, the way Screen Studio smooths a cursor: it
 * eases out of rest, accelerates naturally, and settles without overshoot,
 * arriving in about half a second (well before the click). A slight arc on
 * the way reads as a hand, not a robot.
 */
const CURSOR_OMEGA = 8.1; // spring frequency (rad/s): higher arrives sooner
const SUBSTEPS = 8;

function cursorPath(events: DemoEvent[], start: Point, fps: number, frames: number): Point[] {
  const moves = events.filter((e): e is Extract<DemoEvent, { type: "move" }> => e.type === "move");
  const path: Point[] = [];
  let pos = { ...start };
  let vel = { x: 0, y: 0 };
  let target = { ...start };
  let from = { ...start };
  let next = 0;
  const dt = 1 / fps / SUBSTEPS;
  for (let f = 0; f < frames; f++) {
    for (let k = 0; k < SUBSTEPS; k++) {
      const t = (f * SUBSTEPS + k) * dt;
      while (next < moves.length && moves[next].t <= t) {
        from = { ...pos };
        target = { x: moves[next].x, y: moves[next].y };
        next++;
      }
      // x'' = -w^2 (x - target) - 2w x'  (critical damping)
      for (const axis of ["x", "y"] as const) {
        const acc = -(CURSOR_OMEGA ** 2) * (pos[axis] - target[axis]) - 2 * CURSOR_OMEGA * vel[axis];
        vel[axis] += acc * dt;
        pos[axis] += vel[axis] * dt;
      }
    }
    const span = Math.hypot(target.x - from.x, target.y - from.y);
    const left = Math.hypot(target.x - pos.x, target.y - pos.y);
    const progress = span > 1 ? 1 - Math.min(1, left / span) : 1;
    const lift = Math.sin(progress * Math.PI) * Math.min(36, span * 0.07);
    path.push({ x: pos.x, y: pos.y - lift });
  }
  return path;
}

/**
 * The finished clip: the take, with an optional opening title over it and an
 * optional end cap after it. The take holds on its last frame under the cap.
 */
export function Demo(props: DemoProps) {
  useState(() => loadBrandFonts(props.brand));
  const brand = resolveBrand(props.brand);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const takeFrames = Math.max(1, Math.round((props.duration / props.speed) * fps));
  const t = frame / fps;
  const capT = (frame - takeFrames) / fps;
  const capping = props.endCap && capT >= 0;
  const settle = capping ? interpolate(capT, [0, END_CAP.in], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: brand.paper }}>
      <AbsoluteFill style={{ transform: `scale(${1 - 0.05 * settle})`, filter: `blur(${18 * settle}px)` }}>
        <Freeze frame={Math.min(frame, takeFrames - 1)}>
          <Take {...props} brand={brand} />
        </Freeze>
      </AbsoluteFill>
      {props.title && <LowerThird t={t} kicker={props.kicker ?? brand.kicker ?? null} title={props.title} brand={brand} />}
      {capping && <EndCap t={capT} title={props.title ?? ""} brand={brand} />}
    </AbsoluteFill>
  );
}

function Take({
  video,
  viewport,
  startAt,
  events,
  cursorStart,
  matte,
  zoom,
  speed,
  brand,
}: Omit<DemoProps, "brand"> & { brand: ResolvedBrand }) {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  // Seconds into the take: slower playback steps through it more finely.
  const t = (frame / fps) * speed;

  // Event times are from the start of the recording; the demo starts later.
  const evs = events.map((e) => ({ ...e, t: e.t - startAt }));
  const clicks = evs.filter((e): e is Click => e.type === "click");
  // Each point remembers when the cursor set off toward it.
  const moves = evs.filter((e) => e.type === "move");
  const groups = shots(
    evs
      .filter(
        (e): e is Click | Extract<DemoEvent, { type: "focus" }> =>
          (e.type === "click" && e.zoom) || e.type === "focus",
      )
      .map((e) => ({
        ...e,
        lead: [...moves].reverse().find((m) => m.t <= e.t && m.x === e.x && m.y === e.y)?.t,
      })),
  );

  // Edge to edge by default; with a matte, a window inside an even border.
  const pad = matte ? Math.round(width * 0.06) : 0;
  const scale = Math.min((width - pad * 2) / viewport.width, (height - pad * 2) / viewport.height);
  const winW = viewport.width * scale;
  const winH = viewport.height * scale;

  const { amount, focus } = camera(t, groups);
  const z = 1 + (zoom - 1) * amount;
  const half = { x: viewport.width / (2 * z), y: viewport.height / (2 * z) };
  const f = focus ?? { x: viewport.width / 2, y: viewport.height / 2 };
  const cx = Math.min(Math.max(f.x, half.x), viewport.width - half.x);
  const cy = Math.min(Math.max(f.y, half.y), viewport.height - half.y);
  const tx = viewport.width / 2 - cx * z;
  const ty = viewport.height / 2 - cy * z;

  // Computed once per take, not every frame.
  const path = useMemo(
    () =>
      cursorPath(
        events.map((e) => ({ ...e, t: e.t - startAt })),
        cursorStart ?? { x: viewport.width * 0.62, y: viewport.height * 0.78 },
        fps / speed,
        durationInFrames,
      ),
    [events, startAt, cursorStart, viewport.width, viewport.height, fps, speed, durationInFrames],
  );
  const cursor = path[Math.min(frame, path.length - 1)];
  const lastClick = [...clicks].reverse().find((c) => c.t <= t);
  const sinceClick = lastClick ? t - lastClick.t : Infinity;
  const press = sinceClick < 0.25 ? interpolate(sinceClick, [0, 0.1, 0.25], [1, 0.82, 1]) : 1;
  const ripple = sinceClick < 0.5 ? sinceClick / 0.5 : null;

  // The cursor's line, if any: the latest say, or the one just cleared while it fades.
  const says = evs.filter((e): e is Say => e.type === "say" && e.t <= t);
  const lastSay = says.at(-1);
  const line = lastSay?.text ?? says.at(-2)?.text ?? null;
  const sinceSay = lastSay ? t - lastSay.t : 0;
  const shown = lastSay?.text
    ? interpolate(sinceSay, [0, SAY_IN], [0, 1], { extrapolateRight: "clamp", easing: ease })
    : interpolate(sinceSay, [0, SAY_OUT], [1, 0], { extrapolateRight: "clamp", easing: ease });
  // Where the cursor sits in the window, so the bubble stays one size through the zoom.
  const tip = { x: (tx + cursor.x * z) * scale, y: (ty + cursor.y * z) * scale };

  return (
    <AbsoluteFill style={{ backgroundColor: matte ?? "#000", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: winW,
          height: winH,
          overflow: "hidden",
          position: "relative",
          ...(matte && {
            borderRadius: 18,
            boxShadow: "0 30px 80px rgba(40, 30, 10, 0.18), 0 0 0 1px rgba(0,0,0,0.06)",
          }),
        }}
      >
        <div
          style={{
            width: viewport.width,
            height: viewport.height,
            transformOrigin: "0 0",
            transform: `scale(${scale}) translate(${tx}px, ${ty}px) scale(${z})`,
            position: "relative",
          }}
        >
          <OffthreadVideo
            src={staticFile(video)}
            startFrom={Math.round(startAt * fps)}
            playbackRate={speed}
            muted
            // Fill the page's box exactly: the recording is at 2x.
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill" }}
          />
          {ripple !== null && lastClick && (
            <div
              style={{
                position: "absolute",
                left: lastClick.x,
                top: lastClick.y,
                width: 44,
                height: 44,
                marginLeft: -22,
                marginTop: -22,
                borderRadius: "50%",
                background: brand.accent,
                transform: `scale(${0.3 + ripple * 1.2})`,
                opacity: 1 - ripple,
              }}
            />
          )}
          <Cursor x={cursor.x} y={cursor.y} press={press} />
        </div>
        {line && shown > 0 && <Bubble text={line} at={tip} shown={shown} room={winW} size={width} brand={brand} />}
      </div>
    </AbsoluteFill>
  );
}

/** Seconds a line takes to pop in, and to fade once cleared. */
const SAY_IN = 0.22;
const SAY_OUT = 0.18;

/**
 * The cursor's speech bubble, beside the arrow in the brand's ink and paper.
 * It sits to the right of the tip, or to the left when that would run out of
 * the window. Sized against a 1920px-wide output.
 */
function Bubble({
  text,
  at,
  shown,
  room,
  size,
  brand,
}: {
  text: string;
  at: Point;
  shown: number;
  room: number;
  size: number;
  brand: ResolvedBrand;
}) {
  const u = size / 1920;
  const font = 26 * u;
  // A rough width, good enough to choose a side.
  const w = text.length * font * 0.56 + 44 * u;
  const flip = at.x + 36 * u + w > room;
  return (
    <div
      style={{
        position: "absolute",
        top: at.y + 30 * u,
        ...(flip ? { right: room - at.x + 8 * u } : { left: at.x + 30 * u }),
        padding: `${12 * u}px ${22 * u}px`,
        borderRadius: 999,
        background: brand.ink,
        color: brand.paper,
        fontFamily: brand.display,
        fontSize: font,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        boxShadow: `0 ${8 * u}px ${24 * u}px rgba(0, 0, 0, 0.25)`,
        opacity: shown,
        transform: `scale(${0.92 + 0.08 * shown})`,
        transformOrigin: flip ? "top right" : "top left",
      }}
    >
      {text}
    </div>
  );
}

/** A macOS-style arrow, tip at (x, y). */
function Cursor({ x, y, press }: { x: number; y: number; press: number }) {
  return (
    <svg
      width={22}
      height={30}
      viewBox="0 0 22 30"
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-3px, -2px) scale(${press})`,
        transformOrigin: "3px 2px",
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.3))",
      }}
    >
      <path d="M3 2 L3 24 L8.5 18.5 L12.5 27.5 L16 26 L12 17 L19.5 17 Z" fill="#111" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}
