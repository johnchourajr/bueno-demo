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
const WINDOW = "#000";
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
/** Where the last step starts easing back out to the wide shot. */
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

/**
 * The latest-demo thumbnail in the app's corner card. It keeps the frame's
 * aspect, so the hero can recurse into it: the thumbnail is this app again.
 */
const DEMO_BOX: HeroBox = { x: 1215 / SOURCE_W, y: 0.2, k: 0.2 };

// ── Hero: the settings example, played the way the CLI records it ──
//
// The camera tours the form one step at a time while the cursor stays on the
// outer layer. The last step clicks the latest-demo thumbnail, which restarts
// the demo, and dives into it, racking focus onto the copy inside. That copy
// is the app again at full size, so the loop restarts on exactly the frame
// the dive ends on.

const HERO_SHOTS: Shot[] = [
  shot(0.4, 0.3, 0.6),
  shot(0.5, 0.36, 0.55),
  shot(0.62, 0.44, 0.55),
  shot(0.42, 0.5, 0.55),
  shot(0.78, 0.32, 0.5),
];

export const heroScript: ScriptLine[] = [
  { text: "{" },
  { text: '  "url": "localhost:3000/settings",' },
  { text: '  "viewport": [1280, 800],' },
  { text: '  "steps": [' },
  { text: '    { "hover": "h1", "zoom": true },', step: 0 },
  { text: '    { "type": "#team", "text": "Alianza Rebelde" },', step: 1 },
  { text: '    { "click": "#summaries" },', step: 2 },
  { text: '    { "click": "#save" },', step: 3 },
  { text: '    { "click": "#latest-demo", "after": 1400 }', step: 4 },
  { text: "  ]" },
  { text: "}" },
];

export const heroScene: Scene = {
  id: "hero",
  label:
    "A recorded demo of a settings page: the cursor types a team name, flips a toggle and saves. Click to play or pause; drag, or click and scroll, to scrub.",
  steps: [
    {
      verb: "hover",
      at: [0.4, 0.24],
      say: "Have you ever wanted to…",
      pin: "left-[40%] top-[24%]",
    },
    {
      verb: "type",
      at: [0.5, 0.341],
      say: "Make a demo video…",
      pin: "left-[50%] top-[34.1%]",
    },
    {
      verb: "click",
      at: [0.674, 0.436],
      say: "Where it points at things on your screen…",
      pin: "left-[67.4%] top-[43.6%]",
    },
    {
      verb: "click",
      at: [0.348, 0.525],
      say: "Just like this…",
      pin: "left-[34.8%] top-[52.5%]",
    },
    {
      verb: "click",
      at: [DEMO_BOX.x + DEMO_BOX.k / 2, DEMO_BOX.y + DEMO_BOX.k / 2],
      say: "Let's show that again…",
      pin: "left-[85.9%] top-[30%]",
    },
  ],
  period: 5,
  box: DEMO_BOX,
  still: 4.4,
  frame(t, previous) {
    // The dive ends with the thumbnail's centre in the middle of the stage,
    // which is the middle of the app one level up: where the next loop's cursor starts.
    return tour(this, HERO_SHOTS, t, previous, {
      shot: {
        c: [DEMO_BOX.x + DEMO_BOX.k / 2, DEMO_BOX.y + DEMO_BOX.k / 2],
        s: DEMO_BOX.k,
      },
      focus: 1,
      from: WIDE.c,
    });
  },
  draw(ctx, t) {
    const { i, f } = split(t, this.period);
    // Clicking the thumbnail restarts the demo, so every level shows the
    // opening state through the dive and the loop's first frame matches.
    const restarted = reached(t, this.period, 4, CLICK);
    drawSettings(ctx, {
      typed:
        i < 1 || restarted
          ? ""
          : i === 1
            ? TEAM.slice(
                0,
                Math.round(TEAM.length * clamp((f - 0.4) / 0.4, 0, 1)),
              )
            : TEAM,
      switchOn: reached(t, this.period, 2, CLICK) && !restarted,
      saved: reached(t, this.period, 3, CLICK) && !restarted,
    });
  },
};

// ── Take one: prompting an agent ──
//
// Laid out like Claude Code: the input sits at the bottom, and each message
// sent from it joins a transcript that stacks upward above it.

const PROMPT = "record a demo of the new settings page";
const APPROVE = "yes";
/** The transcript's newest line sits on this baseline, just above the input. */
const TRANSCRIPT_BOTTOM = 770;
const LINE_H = 36;
/** Extra room above the first line of each message. */
const MESSAGE_GAP = 22;
const PROMPT_SHOTS: Shot[] = [
  shot(0.35, 0.8, 0.55),
  shot(0.35, 0.72, 0.55),
  shot(0.35, 0.64, 0.6),
  shot(0.3, 0.78, 0.55),
];

type TranscriptLine = { text: string; dim?: boolean; first?: boolean };

const JSON_LINES = [
  "{",
  '  "url": "localhost:3000/settings",',
  '  "steps": [',
  '    { "type": "#team", "text": "Alianza Rebelde" },',
  '    { "click": "#summaries" }, { "click": "#save" }',
  "  ]",
  "}",
];

export const promptScene: Scene = {
  id: "prompt",
  label:
    "A terminal where you ask an agent to record a demo, it reads the skill and writes the script, and you tell it yes.",
  steps: [
    {
      verb: "type",
      at: [0.3, 0.852],
      say: "Just ask.",
      pin: "left-[30%] top-[85.2%]",
    },
    {
      verb: "hover",
      at: [0.2, 0.765],
      say: "It reads the manual.",
      pin: "left-[20%] top-[76.5%]",
    },
    {
      verb: "hover",
      at: [0.3, 0.66],
      say: "It writes the script.",
      pin: "left-[30%] top-[66%]",
    },
    {
      verb: "type",
      at: [0.16, 0.852],
      say: "You say yes.",
      pin: "left-[16%] top-[85.2%]",
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
    const top = windowChrome(ctx, "~/rebeldes / agent");
    const at = (step: number, x = 0) => reached(t, this.period, step, x);

    // What's been sent so far, oldest first.
    const lines: TranscriptLine[] = [];
    if (at(0, 0.5)) lines.push({ text: `> ${PROMPT}`, first: true });
    if (at(1, 0.05)) lines.push({ text: "● Reading the skill", first: true });
    if (at(2, 0.05)) {
      lines.push({ text: "● Writing demos/capture.json", first: true });
      JSON_LINES.forEach((line) =>
        lines.push({ text: `  ${line}`, dim: true }),
      );
    }
    if (at(3, 0.05)) lines.push({ text: "● Run the capture?", first: true });
    if (at(3, 0.5)) lines.push({ text: `> ${APPROVE}`, first: true });
    if (at(3, 0.6)) lines.push({ text: "● Capturing…", first: true });

    ctx.save();
    ctx.beginPath();
    ctx.rect(62, top, SOURCE_W - 124, TRANSCRIPT_BOTTOM + 20 - top);
    ctx.clip();
    ctx.font = `26px ${MONO}`;
    let y = TRANSCRIPT_BOTTOM;
    for (let n = lines.length - 1; n >= 0 && y > top; n--) {
      ctx.fillStyle = lines[n].dim ? REC60 : REC;
      ctx.fillText(lines[n].text, 110, y);
      y -= LINE_H + (lines[n].first ? MESSAGE_GAP : 0);
    }
    ctx.restore();

    // The input, with whatever's being typed into it.
    const typing = (text: string, from: number) =>
      text.slice(0, Math.round(text.length * clamp((f - from) / 0.3, 0, 1)));
    const draft =
      i === 0 && f < 0.5
        ? typing(PROMPT, 0.1)
        : i === 3 && f >= 0.15 && f < 0.5
          ? typing(APPROVE, 0.15)
          : "";
    ctx.strokeStyle = REC60;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(90, 812, SOURCE_W - 180, 80, 12);
    ctx.stroke();
    ctx.fillStyle = REC;
    ctx.font = `26px ${MONO}`;
    ctx.fillText(`> ${draft}▌`, 120, 862);
  },
};

/**
 * A Chromium window the way Playwright opens one: a tab, the toolbar and
 * address bar, and the bar saying automation is driving. Nobody is at the
 * controls, so there is nothing to stop. The page area starts at PAGE_TOP.
 */
function browserChrome(
  ctx: CanvasRenderingContext2D,
  tab: string,
  url: string,
) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SOURCE_W, SOURCE_H);
  ctx.fillStyle = WINDOW;
  ctx.strokeStyle = REC60;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(60, 60, SOURCE_W - 120, SOURCE_H - 120, 18);
  ctx.fill();
  ctx.stroke();
  [96, 126, 156].forEach((x) => {
    ctx.beginPath();
    ctx.arc(x, 88, 8, 0, Math.PI * 2);
    ctx.stroke();
  });

  // The one tab, joined to the toolbar below it.
  ctx.fillStyle = "#1a0605";
  ctx.beginPath();
  ctx.roundRect(200, 70, 340, 46, [12, 12, 0, 0]);
  ctx.fill();
  ctx.fillRect(62, 114, SOURCE_W - 124, 58);
  ctx.fillStyle = REC;
  ctx.fillRect(222, 85, 16, 16);
  ctx.font = `20px ${REGULAR}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(tab, 252, 100);
  ctx.fillStyle = REC60;
  ctx.fillText("×", 510, 100);
  ctx.fillText("+", 562, 100);

  // Back, forward, reload and the address bar.
  ctx.font = `24px ${REGULAR}`;
  ctx.fillText("←   →   ↻", 96, 152);
  ctx.fillStyle = APP.field;
  ctx.beginPath();
  ctx.roundRect(250, 124, SOURCE_W - 370, 38, 19);
  ctx.fill();
  ctx.fillStyle = REC;
  ctx.font = `20px ${MONO}`;
  ctx.fillText(url, 280, 150);

  // Chromium's own word that a script is at the wheel.
  ctx.fillStyle = APP.card;
  ctx.fillRect(62, 172, SOURCE_W - 124, 42);
  ctx.fillStyle = REC60;
  ctx.font = `18px ${REGULAR}`;
  ctx.fillText(
    "Chromium is being controlled by automated test software.",
    96,
    199,
  );
  ctx.fillStyle = REC30;
  ctx.fillRect(62, PAGE_TOP - 2, SOURCE_W - 124, 2);
}

// ── Take two: the capture, a real browser driven by the script ──

const TEAM = "Alianza Rebelde";
/** Where the browser's page area starts, and how the app scales into it. */
const PAGE_TOP = 214;
const PAGE_SCALE = 0.724;
const PAGE_LEFT = (SOURCE_W - SOURCE_W * PAGE_SCALE) / 2;
/** A point in the app's frame, mapped into the browser's page area. */
const inBrowser = ([u, v]: [number, number]): [number, number] => [
  (PAGE_LEFT + SOURCE_W * PAGE_SCALE * u) / SOURCE_W,
  (PAGE_TOP + SOURCE_H * PAGE_SCALE * v) / SOURCE_H,
];
const CAPTURE_TARGETS = (
  [
    [0.5, 0.341],
    [0.674, 0.436],
    [0.348, 0.525],
    [0.45, 0.533],
  ] as [number, number][]
).map(inBrowser);
const CAPTURE_SHOTS: Shot[] = [
  shot(0.5, 0.46, 0.6),
  shot(0.6, 0.52, 0.6),
  shot(0.42, 0.58, 0.6),
  shot(0.46, 0.56, 0.75),
];

type Settings = { typed: string; switchOn: boolean; saved: boolean };

/** The stand-in app's palette: REC outlines over light washes of REC. */
const APP = {
  dots: "rgba(255, 59, 47, 0.14)",
  card: "rgba(255, 59, 47, 0.06)",
  field: "rgba(255, 59, 47, 0.1)",
  fill: "rgba(255, 59, 47, 0.2)",
};

/** An outlined box with a light red wash, the stand-in app's one shape. */
function slab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = REC;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();
}

/** Where the shell's sidebar ends and its top bar ends. */
const SIDEBAR_W = 300;
const TOPBAR_H = 90;

/**
 * Everything around the form that makes it read as an app: a sidebar with
 * the workspace, nav and user, a top bar with breadcrumbs and search, tabs, a
 * plan card and the members list. The form itself stays where the scenes aim.
 */
function drawShell(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Sidebar.
  ctx.fillStyle = APP.card;
  ctx.fillRect(0, 0, SIDEBAR_W, SOURCE_H);
  ctx.fillStyle = REC30;
  ctx.fillRect(SIDEBAR_W - 2, 0, 2, SOURCE_H);
  ctx.fillStyle = REC;
  ctx.beginPath();
  ctx.roundRect(40, 30, 36, 36, 8);
  ctx.fill();
  ctx.font = `26px ${BOLD}`;
  ctx.fillText("Rebeldes", 92, 58);
  ["Overview", "Projects", "Reports", "Team", "Settings"].forEach((item, n) => {
    const y = 130 + n * 58;
    if (item === "Settings") slab(ctx, 24, y - 8, 252, 48, 8, APP.field);
    ctx.strokeStyle = item === "Settings" ? REC : REC60;
    ctx.lineWidth = 2;
    ctx.strokeRect(46, y + 6, 18, 18);
    ctx.fillStyle = item === "Settings" ? REC : REC60;
    ctx.font = `20px ${REGULAR}`;
    ctx.fillText(item, 82, y + 23);
  });
  ctx.fillStyle = APP.fill;
  ctx.beginPath();
  ctx.arc(60, SOURCE_H - 60, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = REC;
  ctx.font = `18px ${REGULAR}`;
  ctx.fillText("Leia Orgánica", 94, SOURCE_H - 54);

  // Top bar.
  ctx.fillStyle = REC30;
  ctx.fillRect(SIDEBAR_W, TOPBAR_H - 2, SOURCE_W - SIDEBAR_W, 2);
  ctx.fillStyle = REC60;
  ctx.font = `18px ${REGULAR}`;
  ctx.fillText("Rebeldes  /  Settings  /", 340, 52);
  ctx.fillStyle = REC;
  ctx.fillText("General", 552, 52);
  slab(ctx, 1080, 24, 360, 42, 21, APP.field);
  ctx.fillStyle = REC60;
  ctx.fillText("Search   ⌘K", 1110, 51);
  ctx.fillStyle = APP.fill;
  ctx.strokeStyle = REC;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(1520, 45, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Tabs over the form.
  ["General", "Members", "Billing", "API"].forEach((tab, n) => {
    const x = 450 + n * 130;
    ctx.fillStyle = n === 0 ? REC : REC60;
    ctx.font = `18px ${REGULAR}`;
    ctx.fillText(tab, x, 150);
    if (n === 0) ctx.fillRect(x, 160, 78, 3);
  });

  // The latest demo, whose thumbnail is a recording of this app. The hero
  // recurses into it; the takes, which don't, show a play button there.
  slab(ctx, 1190, 130, 370, 320, 14, APP.card);
  ctx.fillStyle = REC;
  ctx.font = `22px ${BOLD}`;
  ctx.fillText("Latest demo", 1215, 172);
  const bx = DEMO_BOX.x * SOURCE_W;
  const by = DEMO_BOX.y * SOURCE_H;
  const bw = DEMO_BOX.k * SOURCE_W;
  const bh = DEMO_BOX.k * SOURCE_H;
  ctx.fillStyle = APP.field;
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = REC;
  ctx.beginPath();
  ctx.moveTo(bx + bw / 2 - 14, by + bh / 2 - 18);
  ctx.lineTo(bx + bw / 2 + 18, by + bh / 2);
  ctx.lineTo(bx + bw / 2 - 14, by + bh / 2 + 18);
  ctx.fill();
  // Drawn just outside the box, since in the hero everything inside it is replaced.
  ctx.strokeStyle = REC;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx - 3, by - 3, bw + 6, bh + 6);
  ctx.fillStyle = REC60;
  ctx.font = `16px ${REGULAR}`;
  ctx.fillText("settings.mp4  0:14", 1215, 436);

  // Members list under the form.
  slab(ctx, 450, 640, 1110, 280, 14, APP.card);
  ctx.fillStyle = REC;
  ctx.font = `24px ${BOLD}`;
  ctx.fillText("Members", 490, 690);
  [
    ["Leia Orgánica", "Owner"],
    ["Juan Solo", "Admin"],
    ["Obi-Juan Kenobi", "Member"],
  ].forEach(([name, role], n) => {
    const y = 740 + n * 58;
    ctx.fillStyle = APP.fill;
    ctx.beginPath();
    ctx.arc(510, y + 14, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = REC;
    ctx.font = `20px ${REGULAR}`;
    ctx.fillText(name, 546, y + 21);
    ctx.fillStyle = REC60;
    ctx.fillText(role, 1400, y + 21);
    if (n < 2) {
      ctx.fillStyle = APP.field;
      ctx.fillRect(490, y + 42, 1030, 2);
    }
  });
}

/**
 * The bundled settings example, restyled as a stand-in app in the site's
 * language: REC outlines and light red washes on black. Drawn at 1600x1000
 * with its card at (450, 180), so the scenes' targets line up with it.
 */
function drawSettings(ctx: CanvasRenderingContext2D, state: Settings) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SOURCE_W, SOURCE_H);
  ctx.fillStyle = APP.dots;
  for (let x = 320; x < SOURCE_W; x += 40) {
    for (let y = 110; y < SOURCE_H; y += 40) ctx.fillRect(x, y, 3, 3);
  }
  drawShell(ctx);

  slab(ctx, 450, 180, 700, 420, 14, APP.card);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = REC;
  ctx.font = `40px ${BOLD}`;
  ctx.fillText("Team settings", 500, 252);
  ctx.font = `16px ${REGULAR}`;
  ctx.fillText("T E A M   N A M E", 500, 302);

  slab(ctx, 500, 315, 600, 52, 8, APP.field);
  ctx.fillStyle = REC;
  ctx.font = `22px ${REGULAR}`;
  ctx.fillText(state.typed || "Rebeldes", 516, 350);

  ctx.fillText("Email me weekly summaries", 500, 444);
  slab(ctx, 1050, 420, 58, 32, 16, state.switchOn ? REC : APP.field);
  ctx.fillStyle = state.switchOn ? "#000" : REC;
  ctx.beginPath();
  ctx.arc(state.switchOn ? 1092 : 1066, 436, 10, 0, Math.PI * 2);
  ctx.fill();

  slab(ctx, 500, 500, 112, 50, 8, APP.fill);
  ctx.fillStyle = REC;
  ctx.font = `20px ${BOLD}`;
  ctx.fillText("SAVE", 528, 533);
  if (state.saved) ctx.fillText("✓ SAVED", 640, 533);
}

export const captureScene: Scene = {
  id: "capture",
  label:
    "A Chromium window, driven by automation, recording the settings page while the script types, clicks and saves.",
  steps: [
    {
      verb: "type",
      at: CAPTURE_TARGETS[0],
      say: "Typing for you.",
      pin: "left-[50%] top-[46.1%]",
    },
    {
      verb: "click",
      at: CAPTURE_TARGETS[1],
      say: "Clicking, on purpose.",
      pin: "left-[62.6%] top-[53%]",
    },
    {
      verb: "click",
      at: CAPTURE_TARGETS[2],
      say: "Saving.",
      pin: "left-[39%] top-[59.4%]",
    },
    {
      verb: "wait",
      at: CAPTURE_TARGETS[3],
      say: "One take. No bloopers.",
      pin: "left-[44.6%] top-[60%]",
    },
  ],
  period: 4,
  box: { x: 0, y: 0, k: 1 },
  still: 3.99,
  frame(t, previous) {
    return tour(this, CAPTURE_SHOTS, t, previous);
  },
  draw(ctx, t) {
    const { i, f } = split(t, this.period);
    browserChrome(ctx, "Team settings", "localhost:3000/settings");
    ctx.save();
    ctx.beginPath();
    ctx.rect(62, PAGE_TOP, SOURCE_W - 124, SOURCE_H - 62 - PAGE_TOP);
    ctx.clip();
    ctx.translate(PAGE_LEFT, PAGE_TOP);
    ctx.scale(PAGE_SCALE, PAGE_SCALE);
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
  },
};

// ── Take three: reviewing the files ──

const FILES = [
  "settings.json",
  "settings.raw.webm",
  "settings.events.json",
  "settings.mp4",
  "settings.gif",
];
const ROW_Y = 220;
const ROW_H = 64;
/** Which file each step hovers. */
const REVIEW_PICKS = [0, 1, 3, 4];
const REVIEW_SHOTS: Shot[] = [
  shot(0.5, 0.35, 0.65),
  shot(0.55, 0.38, 0.65),
  shot(0.55, 0.42, 0.65),
  shot(0.55, 0.46, 0.7),
];
const rowCentre = (file: number) => (ROW_Y + file * ROW_H - 12) / SOURCE_H;

export const reviewScene: Scene = {
  id: "review",
  label:
    "A file window listing the script, the events, the raw take and the finished video and GIF, each previewed in turn.",
  steps: [
    {
      verb: "hover",
      at: [0.34, rowCentre(0)],
      say: "The script.",
      pin: "left-[34%] top-[20.8%]",
    },
    {
      verb: "hover",
      at: [0.36, rowCentre(1)],
      say: "The raw take.",
      pin: "left-[36%] top-[27.2%]",
    },
    {
      verb: "hover",
      at: [0.34, rowCentre(3)],
      say: "The cut.",
      pin: "left-[34%] top-[40%]",
    },
    {
      verb: "hover",
      at: [0.33, rowCentre(4)],
      say: "A GIF, too.",
      pin: "left-[33%] top-[46.4%]",
    },
  ],
  period: 4,
  box: { x: 0, y: 0, k: 1 },
  still: 2.3,
  frame(t, previous) {
    return tour(this, REVIEW_SHOTS, t, previous);
  },
  draw(ctx, t) {
    const { i } = split(t, this.period);
    const file = REVIEW_PICKS[i];
    const top = windowChrome(ctx, "rebeldes / out");
    ctx.strokeStyle = REC30;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(920, top);
    ctx.lineTo(920, SOURCE_H - 60);
    ctx.stroke();

    ctx.font = `24px ${MONO}`;
    FILES.forEach((name, n) => {
      const y = ROW_Y + n * ROW_H - 40;
      if (n === file) {
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
    ctx.fillText(FILES[file].toUpperCase(), 960, 180);
    if (file === 0) {
      ctx.font = `20px ${MONO}`;
      JSON_LINES.forEach((line, n) =>
        ctx.fillText(line.slice(0, 40), 960, 230 + n * 30),
      );
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(960, 210, 560, 350);
    ctx.clip();
    ctx.translate(960, 210);
    // The cut and the GIF are framed closer, the way the render zooms in.
    const zoom = file === 1 ? 0.35 : 0.5;
    ctx.scale(zoom, zoom);
    if (file !== 1) ctx.translate(-380, -200);
    drawSettings(ctx, { typed: TEAM, switchOn: true, saved: true });
    ctx.restore();
    ctx.strokeStyle = REC60;
    ctx.strokeRect(960, 210, 560, 350);
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
