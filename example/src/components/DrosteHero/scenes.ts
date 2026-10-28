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
const PAPER = "#f3ebe6";
const BOLD = "GoshaSans-Ultrabold, sans-serif";
const REGULAR = "GoshaSans-Regular, sans-serif";

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

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

// ── Meta: the page, recursing into its own hero ──

const META_BOX: HeroBox = { x: 0.47, y: 0.2, k: 0.46 };
// The map into the box has one fixed point. Zooming around it by exactly one
// box per step lands each level on the next, so the loop never seams.
const FIXED = [META_BOX.x / (1 - META_BOX.k), META_BOX.y / (1 - META_BOX.k)];

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
    const f = t - Math.floor(t);
    const s = Math.pow(META_BOX.k, f);
    const step = Math.floor(t) % this.steps.length;
    return {
      camera: {
        cx: FIXED[0] + (0.5 - FIXED[0]) * s,
        cy: FIXED[1] + (0.5 - FIXED[1]) * s,
        s,
        depth: 12,
      },
      step,
      cursor: this.steps[step].at,
      clicked:
        this.steps[step].verb === "click" &&
        Math.floor(t) === Math.floor(previous) &&
        f >= 0.3 &&
        previous - Math.floor(previous) < 0.3,
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
    ctx.fillStyle = PAPER;
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
      ctx.fillStyle = REC60;
      ctx.fillText(title, x + 24, 772);
      ctx.fillStyle = "rgba(243, 235, 230, 0.14)";
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
  const local = ((t % 4) + 4) % 4;
  const i = Math.floor(local);
  const f = local - i;
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
    const prev = plainState(previous);
    return {
      camera: {
        cx: clamp(cursor[0], s / 2, 1 - s / 2),
        cy: clamp(cursor[1], s / 2, 1 - s / 2),
        s,
        depth: 0,
      },
      step: i,
      cursor,
      clicked: (i === 1 || i === 2) && prev.i === i && f >= 0.4 && prev.f < 0.4,
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

/** Projects a source-frame point to the stage, picking the nesting level that is on screen. */
export function project(
  scene: Scene,
  point: [number, number],
  camera: Camera,
): [number, number] {
  const { x, y, k } = scene.box;
  let px = point[0];
  let py = point[1];
  const levels = scene.id === "meta" ? 3 : 1;
  let fallback: [number, number] | null = null;
  for (let n = 0; n < levels; n++) {
    const sx = (px - camera.cx) / camera.s + 0.5;
    const sy = (py - camera.cy) / camera.s + 0.5;
    fallback ??= [sx, sy];
    if (sx > 0.03 && sx < 0.86 && sy > 0.05 && sy < 0.92) return [sx, sy];
    px = x + k * px;
    py = y + k * py;
  }
  return [clamp(fallback![0], 0.03, 0.86), clamp(fallback![1], 0.05, 0.92)];
}
