import { logotypeLines } from "../SvgHeader/logotype";
import type { Camera, HeroBox } from "./renderers";

// A scene is what a stage shows: a source frame to draw, the steps it walks
// through, and a camera for any point on its timeline. Time is measured in
// steps, so 2.5 is halfway through the third step.

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
  id: "hero" | "prompt" | "capture" | "review";
  /** Describes the stage to screen readers. */
  label: string;
  steps: Step[];
  /** Length of one loop, in steps. */
  period: number;
  box: HeroBox;
  /** The moment the reduced-motion storyboard shows. */
  still: number;
  frame: (t: number, previous: number) => Frame;
  draw: (ctx: CanvasRenderingContext2D, t: number, ms: number) => void;
};

const REC = "#ff3b2f";
const REC60 = "rgba(255, 59, 47, 0.6)";
const REC30 = "rgba(255, 59, 47, 0.3)";
const WINDOW = "#0d0d0d";
const BOLD = "GoshaSans-Ultrabold, sans-serif";
const REGULAR = "GoshaSans-Regular, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

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
/** True once the loop has reached `at` within step `step`. */
const reached = (t: number, period: number, step: number, at = 0) => {
  const { i, f } = split(t, period);
  return i > step || (i === step && f >= at);
};
/** True when the playhead moved forward across `at` within one step. */
const crossed = (t: number, previous: number, at: number) =>
  Math.floor(t) === Math.floor(previous) &&
  t - Math.floor(t) >= at &&
  previous - Math.floor(previous) < at;

/** How much the frame defocuses at the middle of a camera move, in levels. */
const TRAVEL_BLUR = 0.7;
/** Each step's camera and cursor moves finish by MOVE; clicks land at CLICK. */
const MOVE = 0.45;
const CLICK = 0.5;
/** Where the last step starts its move back out: the hero dives, the takes ease out wide. */
const EXIT = 0.6;

type Shot = { c: [number, number]; s: number };

const WIDE: Shot = { c: [0.5, 0.5], s: 1 };

/** A shot centred as near to (cx, cy) as the frame's edges allow. */
const shot = (cx: number, cy: number, s: number): Shot => ({
  c: [clamp(cx, s / 2, 1 - s / 2), clamp(cy, s / 2, 1 - s / 2)],
  s,
});

/** Eases from one shot to another, scaling geometrically so the zoom rate feels even. */
function between(a: Shot, b: Shot, x: number): Shot {
  const e = easeInOut(x);
  return {
    c: [lerp(a.c[0], b.c[0], e), lerp(a.c[1], b.c[1], e)],
    s: a.s * Math.pow(b.s / a.s, e),
  };
}

/**
 * The camera work every scene shares: on each step the camera eases to that
 * step's shot while the cursor glides to its target, defocusing mid-move. The
 * last step leaves for `exit`, wide by default, so the loop closes on itself.
 */
function tour(
  scene: Scene,
  shots: Shot[],
  t: number,
  previous: number,
  exit: { shot: Shot; focus: number; from: [number, number] } = {
    shot: WIDE,
    focus: 0,
    from: scene.steps[scene.steps.length - 1].at,
  },
): Frame {
  const { i, f } = split(t, scene.period);
  const last = scene.steps.length - 1;
  let view = between(i === 0 ? WIDE : shots[i - 1], shots[i], f / MOVE);
  let focus = 0;
  let blur = TRAVEL_BLUR * swell(f / MOVE);
  if (i === last && f > EXIT) {
    const x = (f - EXIT) / (1 - EXIT);
    view = between(shots[last], exit.shot, x);
    focus = exit.focus * easeInOut(x);
    blur = exit.focus ? 0 : TRAVEL_BLUR * swell(x);
  }
  const from = i === 0 ? exit.from : scene.steps[i - 1].at;
  const to = scene.steps[i].at;
  const move = ease(f / (MOVE - 0.05));
  return {
    camera: {
      cx: view.c[0],
      cy: view.c[1],
      s: view.s,
      depth: scene.box.k < 1 ? 6 : 0,
      focus,
      blur,
    },
    step: i,
    cursor: [lerp(from[0], to[0], move), lerp(from[1], to[1], move)],
    clicked: scene.steps[i].verb === "click" && crossed(t, previous, CLICK),
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

/** A window with a title bar, filling the frame with a margin. Returns the content top. */
function windowChrome(ctx: CanvasRenderingContext2D, title: string) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SOURCE_W, SOURCE_H);
  ctx.fillStyle = WINDOW;
  ctx.strokeStyle = REC60;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(60, 60, SOURCE_W - 120, SOURCE_H - 120, 18);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(60, 124);
  ctx.lineTo(SOURCE_W - 60, 124);
  ctx.stroke();
  [96, 126, 156].forEach((x) => {
    ctx.beginPath();
    ctx.arc(x, 92, 8, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.fillStyle = REC;
  ctx.font = `22px ${REGULAR}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(title, SOURCE_W / 2, 100);
  ctx.textAlign = "left";
  return 124;
}

// ── Hero: the page, holding a recording of itself ──
//
// The camera tours the page one step at a time while the cursor stays on the
// outer layer. The last step dives into the hero box, racking focus onto the
// copy inside. That copy is the page again at full size, so the loop restarts
// on exactly the frame the dive ends on.

const HERO_BOX: HeroBox = { x: 0.47, y: 0.2, k: 0.46 };
const HERO_SHOTS: Shot[] = [
  shot(0.28, 0.3, 0.55),
  shot(0.28, 0.42, 0.5),
  shot(0.32, 0.5, 0.5),
  shot(0.3, 0.8, 0.55),
  shot(0.6, 0.5, 0.8),
];

export const heroScript: ScriptLine[] = [
  { text: "{" },
  { text: '  "url": "/",' },
  { text: '  "viewport": [1600, 1000],' },
  { text: '  "steps": [' },
  { text: '    { "hover": "#wordmark", "zoom": true },', step: 0 },
  { text: '    { "hover": "h2" },', step: 1 },
  { text: '    { "click": "[data-testid=copy]" },', step: 2 },
  { text: '    { "hover": "#takes" },', step: 3 },
  { text: '    { "click": "#hero", "after": 1400 }', step: 4 },
  { text: "  ]" },
  { text: "}" },
];

let wordmark: Path2D[] | null = null;

export const heroScene: Scene = {
  id: "hero",
  label:
    "A recording of this page touring itself, then diving into its own hero. Click it, then scroll to scrub.",
  steps: [
    {
      verb: "hover",
      at: [0.2, 0.27],
      say: "Have you ever wanted to…",
      pin: "left-[20%] top-[27%]",
    },
    {
      verb: "hover",
      at: [0.17, 0.43],
      say: "Make a demo video…",
      pin: "left-[17%] top-[43%]",
    },
    {
      verb: "click",
      at: [0.38, 0.54],
      say: "Where it points at things on your screen…",
      pin: "left-[38%] top-[54%]",
    },
    {
      verb: "hover",
      at: [0.18, 0.8],
      say: "Just like this…",
      pin: "left-[18%] top-[80%]",
    },
    {
      verb: "click",
      at: [0.7, 0.43],
      say: "Let's show that again…",
      pin: "left-[70%] top-[43%]",
    },
  ],
  period: 5,
  box: HERO_BOX,
  still: 0,
  frame(t, previous) {
    // The dive ends with the hero's centre in the middle of the stage, which
    // is the middle of the page one level up: where the next loop's cursor starts.
    return tour(this, HERO_SHOTS, t, previous, {
      shot: {
        c: [HERO_BOX.x + HERO_BOX.k / 2, HERO_BOX.y + HERO_BOX.k / 2],
        s: HERO_BOX.k,
      },
      focus: 1,
      from: WIDE.c,
    });
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
    ctx.fillRect(560, 514, 88, 44);
    ctx.fillStyle = "#000";
    ctx.fillText("COPY", 578, 543);

    ["01 / PROMPT", "02 / CAPTURE", "03 / REVIEW"].forEach((title, i) => {
      const x = 64 + i * 498;
      dotted(ctx, x, 730, 474, 200, REC60);
      ctx.font = `20px ${REGULAR}`;
      ctx.fillStyle = REC;
      ctx.fillText(title, x + 24, 772);
      ctx.fillStyle = REC30;
      ctx.fillRect(x + 24, 800, 300, 14);
      ctx.fillRect(x + 24, 828, 220, 14);
    });

    // Drawn just outside the box, since everything inside it is replaced.
    dotted(
      ctx,
      HERO_BOX.x * SOURCE_W - 4,
      HERO_BOX.y * SOURCE_H - 4,
      HERO_BOX.k * SOURCE_W + 8,
      HERO_BOX.k * SOURCE_H + 8,
      REC,
    );
  },
};

// ── Take one: prompting an agent ──

const PROMPT = "> record a demo of the new settings page";
const PROMPT_SHOTS: Shot[] = [
  shot(0.32, 0.25, 0.55),
  shot(0.32, 0.32, 0.5),
  shot(0.32, 0.5, 0.55),
  shot(0.3, 0.75, 0.55),
];
const JSON_LINES = [
  "{",
  '  "url": "localhost:3000/settings",',
  '  "steps": [',
  '    { "type": "#team", "text": "Northwind" },',
  '    { "click": "#summaries" }, { "click": "#save" }',
  "  ]",
  "}",
];

export const promptScene: Scene = {
  id: "prompt",
  label: "A terminal where an agent is asked to record a demo, and does.",
  steps: [
    {
      verb: "type",
      at: [0.45, 0.19],
      say: "Just ask.",
      pin: "left-[45%] top-[19%]",
    },
    {
      verb: "hover",
      at: [0.3, 0.28],
      say: "It reads the manual. Unlike some of us.",
      pin: "left-[30%] top-[28%]",
    },
    {
      verb: "hover",
      at: [0.32, 0.5],
      say: "It writes the script.",
      pin: "left-[32%] top-[50%]",
    },
    {
      verb: "click",
      at: [0.106, 0.79],
      say: "You say yes. That's the whole job.",
      pin: "left-[10.6%] top-[79%]",
    },
  ],
  period: 4,
  box: { x: 0, y: 0, k: 1 },
  still: 3.99,
  frame(t, previous) {
    return tour(this, PROMPT_SHOTS, t, previous);
  },
  draw(ctx, t) {
    const { i, f } = split(t, this.period);
    windowChrome(ctx, "~/acme / agent");
    ctx.font = `26px ${MONO}`;
    ctx.fillStyle = REC;
    const typed =
      i === 0
        ? PROMPT.slice(0, Math.round(PROMPT.length * clamp(f / 0.4, 0, 1)))
        : PROMPT;
    ctx.fillText(typed + (i === 0 && f < 0.45 ? "▌" : ""), 110, 200);

    if (reached(t, this.period, 1, 0.05)) {
      ctx.fillText("● Reading skills/bueno-screen-demo/SKILL.md", 110, 290);
      ctx.fillStyle = REC60;
      ctx.fillText("  Learned: steps, capture, render.", 110, 330);
      ctx.fillStyle = REC;
    }
    if (reached(t, this.period, 2, 0.05)) {
      ctx.fillText("● Writing demos/settings.json", 110, 410);
      ctx.fillStyle = REC60;
      JSON_LINES.forEach((line, n) => ctx.fillText(line, 140, 452 + n * 34));
      ctx.fillStyle = REC;
    }
    if (reached(t, this.period, 3, 0.05)) {
      ctx.fillText(
        "Run npx @bueno-dev/screen-demo capture demos/settings.json?",
        110,
        730,
      );
      const yes = reached(t, this.period, 3, CLICK);
      ctx.fillStyle = yes ? REC : WINDOW;
      ctx.strokeStyle = REC;
      ctx.beginPath();
      ctx.roundRect(110, 765, 120, 50, 8);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(250, 765, 120, 50, 8);
      ctx.stroke();
      ctx.fillStyle = yes ? "#000" : REC;
      ctx.fillText("Yes", 146, 799);
      ctx.fillStyle = REC;
      ctx.fillText("No", 294, 799);
      if (yes && f > 0.6) ctx.fillText("● Capturing… 1280×800 at 2x", 110, 880);
    }
  },
};

// ── Take two: the capture, a real browser driven by the script ──

const TEAM = "Northwind";
/** Settings-page targets in the capture frame, below the browser toolbar. */
const CAPTURE_TARGETS: [number, number][] = [
  [0.5, 0.441],
  [0.674, 0.536],
  [0.348, 0.625],
];
const CAPTURE_SHOTS: Shot[] = [
  shot(0.5, 0.44, 0.6),
  shot(0.62, 0.5, 0.6),
  shot(0.42, 0.58, 0.6),
  shot(0.4, 0.8, 0.65),
];

type Settings = { typed: string; switchOn: boolean; saved: boolean };

/** The bundled settings example, drawn at 1600x1000 with its card at (450, 180). */
function drawSettings(ctx: CanvasRenderingContext2D, state: Settings) {
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
  ctx.fillText(state.typed || "Acme", 516, 349);

  ctx.fillText("Email me weekly summaries", 500, 443);
  ctx.fillStyle = state.switchOn ? "#fa763d" : "#d9d5ca";
  ctx.beginPath();
  ctx.roundRect(1050, 420, 58, 32, 16);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(state.switchOn ? 1092 : 1066, 436, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1d1b16";
  ctx.beginPath();
  ctx.roundRect(500, 500, 112, 50, 12);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText("Save", 533, 532);
  if (state.saved) {
    ctx.fillStyle = "#2f8a4c";
    ctx.fillText("Saved", 630, 532);
  }
}

export const captureScene: Scene = {
  id: "capture",
  label:
    "A browser recording the settings page while the script types, clicks and saves.",
  steps: [
    {
      verb: "type",
      at: CAPTURE_TARGETS[0],
      say: "A real browser. Typing for you.",
      pin: "left-[50%] top-[44.1%]",
    },
    {
      verb: "click",
      at: CAPTURE_TARGETS[1],
      say: "Clicking things, on purpose.",
      pin: "left-[67.4%] top-[53.6%]",
    },
    {
      verb: "click",
      at: CAPTURE_TARGETS[2],
      say: "Saving. Nobody panic.",
      pin: "left-[34.8%] top-[62.5%]",
    },
    {
      verb: "wait",
      at: [0.3, 0.9],
      say: "One take. No bloopers.",
      pin: "left-[30%] top-[90%]",
    },
  ],
  period: 4,
  box: { x: 0, y: 0, k: 1 },
  still: 3.99,
  frame(t, previous) {
    return tour(this, CAPTURE_SHOTS, t, previous);
  },
  draw(ctx, t, ms) {
    const { i, f } = split(t, this.period);
    const top = windowChrome(ctx, "localhost:3000/settings");
    ctx.save();
    ctx.beginPath();
    ctx.rect(62, top, SOURCE_W - 124, SOURCE_H - 60 - top - 2);
    ctx.clip();
    ctx.translate(0, 100);
    drawSettings(ctx, {
      typed:
        i === 0
          ? TEAM.slice(
              0,
              Math.round(TEAM.length * clamp((f - 0.4) / 0.4, 0, 1)),
            )
          : TEAM,
      switchOn: reached(t, this.period, 1, CLICK),
      saved: reached(t, this.period, 2, CLICK),
    });
    ctx.restore();

    ctx.fillStyle = WINDOW;
    ctx.fillRect(62, 860, SOURCE_W - 124, 78);
    ctx.font = `24px ${MONO}`;
    ctx.fillStyle = REC;
    const done = reached(t, this.period, 3, 0.3);
    ctx.fillText(
      done
        ? "✓ Wrote out/settings.raw.webm and out/settings.events.json"
        : `● REC ${timecode(ms)}  capturing at 2x`,
      110,
      908,
    );
  },
};

// ── Take three: reviewing the files, then watching the cut ──

const FILES = [
  "settings.json",
  "settings.raw.webm",
  "settings.events.json",
  "settings.mp4",
  "settings.gif",
];
const ROW_Y = 220;
const ROW_H = 64;
const REVIEW_SHOTS: Shot[] = [
  shot(0.5, 0.35, 0.65),
  shot(0.55, 0.38, 0.65),
  shot(0.42, 0.42, 0.6),
  shot(0.5, 0.55, 0.8),
];

export const reviewScene: Scene = {
  id: "review",
  label:
    "A file window listing the script, the raw take and the finished video, which then opens and plays.",
  steps: [
    {
      verb: "hover",
      at: [0.34, 0.205],
      say: "The script, kept for next time.",
      pin: "left-[34%] top-[20.5%]",
    },
    {
      verb: "hover",
      at: [0.36, 0.269],
      say: "The raw take. Unedited, unbothered.",
      pin: "left-[36%] top-[26.9%]",
    },
    {
      verb: "click",
      at: [0.34, 0.397],
      say: "The cut. Let's watch it.",
      pin: "left-[34%] top-[39.7%]",
    },
    {
      verb: "wait",
      at: [0.5, 0.79],
      say: "Popcorn optional.",
      pin: "left-[50%] top-[79%]",
    },
  ],
  period: 4,
  box: { x: 0, y: 0, k: 1 },
  still: 2.3,
  frame(t, previous) {
    return tour(this, REVIEW_SHOTS, t, previous);
  },
  draw(ctx, t) {
    const { i, f } = split(t, this.period);
    const top = windowChrome(ctx, "acme / out");
    ctx.strokeStyle = REC30;
    ctx.beginPath();
    ctx.moveTo(360, top);
    ctx.lineTo(360, SOURCE_H - 60);
    ctx.moveTo(920, top);
    ctx.lineTo(920, SOURCE_H - 60);
    ctx.stroke();

    ctx.font = `20px ${REGULAR}`;
    ctx.fillStyle = REC60;
    ctx.fillText("FAVOURITES", 100, 180);
    ctx.fillStyle = REC;
    ["acme", "demos", "out", "Desktop"].forEach((name, n) =>
      ctx.fillText(name, 100, 230 + n * 50),
    );

    // The row under the cursor: the step's file while it's on screen.
    const hovered = [0, 1, 3, 3][i];
    ctx.font = `24px ${MONO}`;
    FILES.forEach((name, n) => {
      const y = ROW_Y + n * ROW_H - 40;
      if (n === hovered) {
        ctx.fillStyle = REC30;
        ctx.fillRect(380, y, 520, ROW_H - 8);
      }
      ctx.strokeStyle = REC;
      ctx.strokeRect(400, y + 12, 24, 32);
      ctx.fillStyle = REC;
      ctx.fillText(name, 444, y + 38);
    });

    // Preview pane.
    ctx.fillStyle = REC;
    ctx.font = `22px ${REGULAR}`;
    ctx.fillText(FILES[hovered].toUpperCase(), 960, 180);
    if (hovered === 0) {
      ctx.font = `20px ${MONO}`;
      JSON_LINES.forEach((line, n) =>
        ctx.fillText(line.slice(0, 40), 960, 230 + n * 30),
      );
    } else {
      ctx.save();
      ctx.translate(960, 210);
      ctx.scale(0.35, 0.35);
      drawSettings(ctx, { typed: TEAM, switchOn: true, saved: true });
      ctx.restore();
      ctx.fillStyle = REC60;
      ctx.font = `20px ${REGULAR}`;
      ctx.fillText(
        hovered === 1 ? "2x, no camera, no cursor" : "1920×1200, eased zoom",
        960,
        610,
      );
    }

    // The player, once the cut is opened.
    if (!reached(t, this.period, 2, CLICK)) return;
    const open = i === 2 ? ease((f - CLICK) / 0.3) : 1;
    const play = i === 3 ? f : 0;
    ctx.save();
    ctx.globalAlpha = open;
    ctx.translate(SOURCE_W / 2, SOURCE_H / 2);
    ctx.scale(lerp(0.85, 1, open), lerp(0.85, 1, open));
    ctx.translate(-SOURCE_W / 2, -SOURCE_H / 2);
    ctx.fillStyle = "#000";
    ctx.strokeStyle = REC;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(280, 150, 1040, 700, 16);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(300, 170, 1000, 580);
    ctx.clip();
    // The cut zooms toward the toggle as it plays, the way the render does.
    const z = lerp(0.625, 0.9, swell(play));
    ctx.translate(800, 460);
    ctx.scale(z, z);
    ctx.translate(-800, -420);
    drawSettings(ctx, {
      typed: TEAM,
      switchOn: play > 0.5,
      saved: false,
    });
    ctx.restore();
    ctx.fillStyle = REC30;
    ctx.fillRect(300, 780, 1000, 8);
    ctx.fillStyle = REC;
    ctx.fillRect(300, 780, 1000 * play, 8);
    ctx.font = `22px ${MONO}`;
    ctx.fillText("▶ settings.mp4", 300, 828);
    ctx.restore();
  },
};

export const takes = [promptScene, captureScene, reviewScene];

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
