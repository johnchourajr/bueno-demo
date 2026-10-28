import { logotypeLines } from "../SvgHeader/logotype";
import type { Camera, HeroBox } from "./renderers";

// A scene is what the hero shows: a source frame to draw, a script whose steps
// it walks through, and a camera for any point on its timeline. Time is
// measured in steps, so 2.5 is halfway through the third step.

export const SOURCE_W = 1600;
export const SOURCE_H = 1000;

export type ScriptLine = { text: string; step?: number };

export type Step = {
  verb: "hover" | "click" | "type" | "wait";
  /** Where the step points, in source-frame UV. */
  at: [number, number];
  /** What the narrator says on this step. */
  say: string;
  /** Tailwind position classes for the storyboard pin; static so Tailwind can see them. */
  pin: string;
};

export type Frame = {
  camera: Camera;
  step: number;
  /** Where the cursor sits, in source-frame UV. */
  cursor: [number, number];
  /** True on the frame a click lands. */
  clicked: boolean;
};

export type Scene = {
  id: "meta" | "plain";
  file: string;
  script: ScriptLine[];
  steps: Step[];
  /** Length of one loop, in steps. */
  period: number;
  box: HeroBox;
  frame: (t: number, previous: number) => Frame;
  draw: (ctx: CanvasRenderingContext2D, t: number, ms: number) => void;
};

const REC = "#ff3b2f";
const REC60 = "rgba(255, 59, 47, 0.6)";
const BOLD = "GoshaSans-Ultrabold, sans-serif";
const REGULAR = "GoshaSans-Regular, sans-serif";

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const ease = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const easeInOut = (x: number) => {
  const v = clamp(x, 0, 1);
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(2 - 2 * v, 3) / 2;
};
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
/** Rises from 0 to 1 and back over x in 0 to 1: how far through a move the camera is. */
const swell = (x: number) => Math.sin(Math.PI * clamp(x, 0, 1));
/** Where t sits in the loop: step index and how far through it. */
const split = (t: number, period: number) => {
  const local = ((t % period) + period) % period;
  const i = Math.floor(local);
  return { i, f: local - i };
};
/** True when the playhead moved forward across `at` within one step. */
const crossed = (t: number, previous: number, at: number) =>
  Math.floor(t) === Math.floor(previous) &&
  t - Math.floor(t) >= at &&
  previous - Math.floor(previous) < at;

/** How much the frame defocuses at the middle of a camera move, in levels. */
const TRAVEL_BLUR = 0.7;

type Shot = { c: [number, number]; s: number };

/** Eases from one shot to another, scaling geometrically so the zoom rate feels even. */
function between(a: Shot, b: Shot, x: number): Shot {
  const e = easeInOut(x);
  return {
    c: [lerp(a.c[0], b.c[0], e), lerp(a.c[1], b.c[1], e)],
    s: a.s * Math.pow(b.s / a.s, e),
  };
}

function timecode(ms: number) {
  const frames = Math.floor(ms / (1000 / 30));
  const s = Math.floor(frames / 30);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(frames % 30)}`;
}

function dotted(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.save();
  ctx.setLineDash([3, 6]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

// ── Meta: the page, holding a recording of itself ──
//
// The camera tours the page one step at a time while the cursor stays on the
// outer layer. The last step dives into the hero box, racking focus onto the
// copy inside. That copy is the page again at full size, so the loop restarts
// on exactly the frame the dive ends on.

const META_BOX: HeroBox = { x: 0.47, y: 0.2, k: 0.46 };
const WIDE: Shot = { c: [0.5, 0.5], s: 1 };
const META_SHOTS: Shot[] = [
  { c: [0.28, 0.3], s: 0.55 },
  { c: [0.32, 0.5], s: 0.5 },
  { c: [0.3, 0.725], s: 0.55 },
  { c: [0.6, 0.5], s: 0.8 },
];
const INSIDE: Shot = {
  c: [META_BOX.x + META_BOX.k / 2, META_BOX.y + META_BOX.k / 2],
  s: META_BOX.k,
};
/** Each step's camera move and cursor move finish by these points in the step. */
const MOVE = 0.45;
const CLICK = 0.5;
const DIVE = 0.55;

let wordmark: Path2D[] | null = null;

export const metaScene: Scene = {
  id: "meta",
  file: "demos/hero.json",
  script: [
    { text: "{" },
    { text: '  "url": "/",' },
    { text: '  "viewport": [1600, 1000],' },
    { text: '  "steps": [' },
    { text: '    { "hover": "#wordmark", "zoom": true },', step: 0 },
    { text: '    { "click": "[data-testid=copy]" },', step: 1 },
    { text: '    { "hover": "#anatomy" },', step: 2 },
    { text: '    { "click": "#hero", "after": 1400 }', step: 3 },
    { text: "  ]" },
    { text: "}" },
  ],
  steps: [
    {
      verb: "hover",
      at: [0.2, 0.27],
      say: "That's the wordmark.",
      pin: "left-[20%] top-[27%]",
    },
    {
      verb: "click",
      at: [0.38, 0.54],
      say: "This copies the install command.",
      pin: "left-[38%] top-[54%]",
    },
    {
      verb: "hover",
      at: [0.18, 0.8],
      say: "Down here, the anatomy.",
      pin: "left-[18%] top-[80%]",
    },
    {
      verb: "click",
      at: [0.7, 0.43],
      say: "Clicking the hero. Here we go again.",
      pin: "left-[70%] top-[43%]",
    },
  ],
  period: 4,
  box: META_BOX,
  frame(t, previous) {
    const { i, f } = split(t, this.period);
    let shot = between(
      i === 0 ? WIDE : META_SHOTS[i - 1],
      META_SHOTS[i],
      f / MOVE,
    );
    let focus = 0;
    let blur = TRAVEL_BLUR * swell(f / MOVE);
    if (i === 3 && f > DIVE) {
      const dive = (f - DIVE) / (1 - DIVE);
      shot = between(META_SHOTS[3], INSIDE, dive);
      focus = easeInOut(dive);
      blur = 0;
    }
    // The dive ends with the hero's centre in the middle of the stage, which is
    // where the cursor starts the next loop.
    const from = i === 0 ? WIDE.c : this.steps[i - 1].at;
    const to = this.steps[i].at;
    const move = ease(f / (MOVE - 0.05));
    return {
      camera: {
        cx: shot.c[0],
        cy: shot.c[1],
        s: shot.s,
        depth: 6,
        focus,
        blur,
      },
      step: i,
      cursor: [lerp(from[0], to[0], move), lerp(from[1], to[1], move)],
      clicked: this.steps[i].verb === "click" && crossed(t, previous, CLICK),
    };
  },
  draw(ctx, _t, ms) {
    wordmark ??= logotypeLines.map((d) => new Path2D(d));
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SOURCE_W, SOURCE_H);
    ctx.textBaseline = "alphabetic";
    ctx.font = `22px ${REGULAR}`;
    ctx.fillStyle = REC;
    ctx.textAlign = "left";
    ctx.fillText("@BUENO-DEV/SCREEN-DEMO", 64, 72);
    ctx.textAlign = "right";
    ctx.fillText(`● REC  ${timecode(ms)}`, SOURCE_W - 64, 72);
    ctx.textAlign = "left";

    ctx.save();
    ctx.translate(64 - 2 * 1.84, 200);
    ctx.scale(1.84, 1.84);
    wordmark.forEach((p) => ctx.fill(p));
    ctx.restore();

    ctx.font = `36px ${BOLD}`;
    ctx.fillStyle = REC;
    ctx.fillText("Demo videos that", 64, 412);
    ctx.fillText("record themselves.", 64, 454);
    dotted(ctx, 64, 500, 600, 72, REC60);
    ctx.font = `22px ${REGULAR}`;
    ctx.fillText("npm i -D @bueno-dev/screen-demo", 88, 544);
    ctx.fillStyle = REC;
    ctx.fillRect(560, 514, 88, 44);
    ctx.fillStyle = "#000";
    ctx.fillText("COPY", 578, 543);

    ["ANATOMY", "DIALS", "RAW VS. RENDERED"].forEach((title, i) => {
      const x = 64 + i * 498;
      dotted(ctx, x, 730, 474, 200, REC60);
      ctx.font = `20px ${REGULAR}`;
      ctx.fillStyle = REC;
      ctx.fillText(title, x + 24, 772);
      ctx.fillStyle = "rgba(255, 59, 47, 0.3)";
      ctx.fillRect(x + 24, 800, 300, 14);
      ctx.fillRect(x + 24, 828, 220, 14);
    });

    // Drawn just outside the box, since everything inside it is replaced.
    dotted(
      ctx,
      META_BOX.x * SOURCE_W - 4,
      META_BOX.y * SOURCE_H - 4,
      META_BOX.k * SOURCE_W + 8,
      META_BOX.k * SOURCE_H + 8,
      REC,
    );
  },
};

// ── Plain: the bundled settings example, the way the CLI would record it ──

const PLAIN_ZOOM = 1.6;
const PLAIN_START: [number, number] = [0.86, 0.84];
const PLAIN_TARGETS: [number, number][] = [
  [0.5, 0.341],
  [0.674, 0.436],
  [0.348, 0.525],
];
const TEAM = "Northwind";

function plainState(t: number) {
  const { i, f } = split(t, 4);
  return {
    i,
    f,
    typed:
      i === 0
        ? TEAM.slice(0, Math.round(TEAM.length * clamp((f - 0.4) / 0.45, 0, 1)))
        : TEAM,
    switchOn: i > 1 || (i === 1 && f >= 0.4),
    saved: i > 2 || (i === 2 && f >= 0.4),
  };
}

export const plainScene: Scene = {
  id: "plain",
  file: "examples/settings.json",
  script: [
    { text: "{" },
    { text: '  "url": "settings.html",' },
    { text: '  "viewport": [1280, 800],' },
    { text: '  "steps": [' },
    { text: '    { "type": "[data-testid=team-name]",', step: 0 },
    { text: '      "text": "Northwind", "clear": true },', step: 0 },
    { text: '    { "click": "[data-testid=summaries]" },', step: 1 },
    { text: '    { "click": "[data-testid=save]" }', step: 2 },
    { text: "  ]" },
    { text: "}" },
  ],
  steps: [
    {
      verb: "type",
      at: PLAIN_TARGETS[0],
      say: "Typing the team name.",
      pin: "left-[50%] top-[34.1%]",
    },
    {
      verb: "click",
      at: PLAIN_TARGETS[1],
      say: "Turning on weekly summaries.",
      pin: "left-[67.4%] top-[43.6%]",
    },
    {
      verb: "click",
      at: PLAIN_TARGETS[2],
      say: "Saving.",
      pin: "left-[34.8%] top-[52.5%]",
    },
    {
      verb: "wait",
      at: PLAIN_TARGETS[2],
      say: "Saved. The camera eases out.",
      pin: "left-[42%] top-[52.5%]",
    },
  ],
  period: 4,
  box: { x: 0, y: 0, k: 1 },
  frame(t, previous) {
    const { i, f } = plainState(t);
    const from = i === 0 ? PLAIN_START : PLAIN_TARGETS[Math.min(i, 3) - 1];
    const to = i === 3 ? PLAIN_TARGETS[2] : PLAIN_TARGETS[i];
    const travel = ease(f / 0.35);
    const cursor: [number, number] = [
      lerp(from[0], to[0], travel),
      lerp(from[1], to[1], travel),
    ];
    const zoom =
      i === 0
        ? lerp(1, PLAIN_ZOOM, ease(f / 0.35))
        : i === 3
          ? lerp(PLAIN_ZOOM, 1, ease((f - 0.2) / 0.5))
          : PLAIN_ZOOM;
    const s = 1 / zoom;
    return {
      camera: {
        cx: clamp(cursor[0], s / 2, 1 - s / 2),
        cy: clamp(cursor[1], s / 2, 1 - s / 2),
        s,
        depth: 0,
        focus: 0,
        blur: TRAVEL_BLUR * swell(i === 3 ? (f - 0.2) / 0.5 : f / 0.35),
      },
      step: i,
      cursor,
      clicked: (i === 1 || i === 2) && crossed(t, previous, 0.4),
    };
  },
  draw(ctx, t) {
    const { typed, switchOn, saved } = plainState(t);
    ctx.fillStyle = "#f6f5f1";
    ctx.fillRect(0, 0, SOURCE_W, SOURCE_H);
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.roundRect(450, 180, 700, 420, 20);
    ctx.fill();
    ctx.restore();

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#1d1b16";
    ctx.font = "600 34px system-ui, sans-serif";
    ctx.fillText("Team settings", 500, 250);
    ctx.fillStyle = "#6b675e";
    ctx.font = "18px system-ui, sans-serif";
    ctx.fillText("Team name", 500, 300);
    ctx.strokeStyle = "#d9d5ca";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(500, 315, 600, 52, 12);
    ctx.stroke();
    ctx.fillStyle = "#1d1b16";
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText(typed || "Acme", 516, 349);

    ctx.fillText("Email me weekly summaries", 500, 443);
    ctx.fillStyle = switchOn ? "#fa763d" : "#d9d5ca";
    ctx.beginPath();
    ctx.roundRect(1050, 420, 58, 32, 16);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(switchOn ? 1092 : 1066, 436, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1d1b16";
    ctx.beginPath();
    ctx.roundRect(500, 500, 112, 50, 12);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText("Save", 533, 532);
    if (saved) {
      ctx.fillStyle = "#2f8a4c";
      ctx.fillText("Saved", 630, 532);
    }
  },
};

export const scenes = { meta: metaScene, plain: plainScene };

/** Projects a point on the outer layer of the source frame to the stage, in 0 to 1. */
export function project(
  point: [number, number],
  camera: Camera,
): [number, number] {
  return [
    (point[0] - camera.cx) / camera.s + 0.5,
    (point[1] - camera.cy) / camera.s + 0.5,
  ];
}
