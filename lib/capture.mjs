// Drive a short demo while recording it, and log where and when each step
// happened so the render can zoom and move a cursor to it.
//
// Playwright drives a real mouse (so hover states show), and Chrome's
// screencast captures each frame at full 2x resolution with its own
// timestamp; ffmpeg rebuilds a steady 30fps video from those timestamps, so
// clicks line up with the picture. Playwright's own recorder drifts in time
// and records at 1x, which blurs the zooms.
//
// Writes <out-dir>/raw.mp4 and <out-dir>/events.json.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { flag, positional } from "./args.mjs";

/** Dev overlays hidden by default: Next.js's badge, Vercel's toolbar. */
const DEV_OVERLAYS = "nextjs-portal, vercel-live-feedback";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A signed-in session's cookies from agent-browser, never printed. */
function agentBrowserCookies() {
  const out = execFileSync("agent-browser", ["cookies", "get", "--json"], { encoding: "utf8" });
  const json = JSON.parse(out);
  const list = json.data?.cookies ?? json.cookies ?? json;
  return list.map(({ name, value, domain, path: p, expires, httpOnly, secure, sameSite }) => ({
    name,
    value,
    domain,
    path: p,
    expires: expires > 0 ? expires : -1,
    httpOnly,
    secure,
    sameSite: ["Strict", "Lax", "None"].includes(sameSite) ? sameSite : "Lax",
  }));
}

export async function run(args) {
  const [scriptPath, outDir] = positional(args);
  if (!scriptPath || !outDir) throw new Error("usage: capture <script.json> <out-dir>");

  const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
  const scriptDir = path.dirname(path.resolve(scriptPath));
  // A url without a scheme is a local file, relative to the script.
  if (!/^[a-z]+:/i.test(script.url)) script.url = pathToFileURL(path.resolve(scriptDir, script.url)).toString();
  // --base (or BUENO_SCREEN_DEMO_BASE) records the same script against another origin.
  const base = flag(args, "--base", process.env.BUENO_SCREEN_DEMO_BASE ?? null);
  if (base && script.url.startsWith("http")) {
    const url = new URL(script.url);
    script.url = new URL(url.pathname + url.search + url.hash, base).toString();
  }
  const storage = flag(args, "--storage", script.storage ?? null);
  const cookiesFrom = flag(args, "--cookies-from", script.cookiesFrom ?? null);
  const [vw, vh] = script.viewport ?? [1440, 900];
  fs.mkdirSync(outDir, { recursive: true });

  // A real (headed) Chromium window: headless Chrome only screencasts at 1x.
  // It's parked off-screen, with the throttling Chrome applies to hidden
  // windows switched off.
  const browser = await chromium.launch({
    channel: "chromium",
    headless: false,
    args: [
      "--window-position=-4000,0",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: vw, height: vh },
    deviceScaleFactor: 2,
    reducedMotion: script.reducedMotion ? "reduce" : "no-preference",
    ...(storage ? { storageState: path.resolve(scriptDir, storage) } : {}),
  });
  if (cookiesFrom === "agent-browser") await context.addCookies(agentBrowserCookies());

  // Dev overlays stay hidden in every frame, frames that reload included.
  const hideCss = script.hide === false ? null : [DEV_OVERLAYS, script.hide].filter(Boolean).join(", ");
  if (hideCss) {
    await context.addInitScript((selectors) => {
      // A framework's hydration can drop a stylesheet added this early, so it
      // puts itself back whenever it goes missing. It waits for <head> or
      // <body>: a node on <html> before them derails the HTML parser.
      const ensure = () => {
        const parent = document.head ?? document.body;
        if (!parent || document.getElementById("bueno-screen-demo-hide")) return;
        const style = document.createElement("style");
        style.id = "bueno-screen-demo-hide";
        style.textContent = `${selectors} { display: none !important; }`;
        parent.appendChild(style);
      };
      new MutationObserver(ensure).observe(document, { childList: true, subtree: true });
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensure);
      else ensure();
    }, hideCss);
  }

  try {
    await record({ script, scriptDir, outDir, context, vw, vh });
  } finally {
    await browser.close();
    fs.rmSync(path.resolve(outDir, "frames"), { recursive: true, force: true });
  }
}

async function record({ script, scriptDir, outDir, context, vw, vh }) {
  const page = await context.newPage();
  // `waitUntil`: when the page counts as loaded. A page that streams video
  // or polls never goes network-idle, so it can wait for "load" instead.
  await page.goto(script.url, { waitUntil: script.waitUntil ?? "networkidle" });
  await sleep(script.settle ?? 1500);
  // `keep`: JS that keeps the page presentable (swapping a real name for a
  // stand-in, say). Run once before recording, then every 250ms during it,
  // so a re-render or redirect never brings back what it hid.
  if (script.keep) await page.evaluate(script.keep);
  // `setup`: one-off page setup the take shouldn't show.
  if (script.setup) {
    await page.evaluate(script.setup);
    await sleep(600);
  }
  await sleep(300);

  // Frames from here on: the load, keep and setup are never recorded.
  const framesDir = path.resolve(outDir, "frames");
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const frames = [];
  const cdp = await context.newCDPSession(page);
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const file = path.join(framesDir, `${String(frames.length).padStart(5, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, ts: metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    maxWidth: vw * 2,
    maxHeight: vh * 2,
    everyNthFrame: 1,
  });
  // Event times share the screencast's clock (seconds since the epoch).
  const t0 = Date.now() / 1000;
  const now = () => Date.now() / 1000 - t0;

  let keeping = Boolean(script.keep);
  const keeper = (async () => {
    while (keeping) {
      await page.evaluate(script.keep).catch(() => {});
      await sleep(250);
    }
  })();

  const events = [];
  const travelMs = script.travelMs ?? 700;

  /** Scroll a target into view if needed, then return its center, or the
   *  point `at` gives as fractions of its box ([0.25, 0.5] is a quarter in). */
  async function target(selector, at) {
    const el = page.locator(selector).first();
    await el.scrollIntoViewIfNeeded();
    await sleep(250);
    const box = await el.boundingBox();
    if (!box) throw new Error(`no element on screen for: ${selector}`);
    const [fx, fy] = at ?? [0.5, 0.5];
    return { x: box.x + box.width * fx, y: box.y + box.height * fy };
  }

  // The cursor starts just off the first target (or at script.cursorStart).
  let cursorStart = null;
  async function startCursor(first) {
    if (cursorStart) return;
    const [sx, sy] = script.cursorStart ?? [first.x + 140, first.y + 180];
    cursorStart = { x: Math.min(Math.max(sx, 20), vw - 20), y: Math.min(Math.max(sy, 20), vh - 20) };
    await page.mouse.move(cursorStart.x, cursorStart.y);
  }

  /** Glide the real mouse to a point, logging the move for the render. */
  async function moveTo(at) {
    await startCursor(at);
    events.push({ type: "move", t: now(), x: at.x, y: at.y });
    await page.mouse.move(at.x, at.y, { steps: Math.round(travelMs / 16) });
  }

  for (const step of script.steps ?? []) {
    if (step.wait) {
      await sleep(step.wait);
    } else if (step.upload) {
      await moveTo(await target(step.upload));
      const file = path.resolve(scriptDir, step.file);
      await page.locator(step.input ?? `${step.upload} input[type=file]`).first().setInputFiles(file);
      await sleep(step.after ?? 1200);
    } else if (step.press) {
      await page.keyboard.press(step.press);
      await sleep(step.after ?? 300);
    } else if (step.click || step.type || step.fill) {
      const sel = step.click ?? step.type ?? step.fill;
      const at = await target(sel, step.at);
      await moveTo(at);
      events.push({ type: "click", t: now(), x: at.x, y: at.y, zoom: step.zoom ?? true });
      await page.mouse.down();
      await sleep(70);
      await page.mouse.up();
      if (step.type && step.clear) await page.keyboard.press("ControlOrMeta+A");
      if (step.type) await page.keyboard.type(step.text, { delay: step.delay ?? 55 });
      if (step.fill) await page.locator(sel).first().fill(step.text);
      await sleep(step.after ?? 900);
    } else if (step.hover) {
      const at = await target(step.hover, step.at);
      await moveTo(at);
      if (step.zoom) events.push({ type: "focus", t: now(), x: at.x, y: at.y });
      await sleep(step.after ?? 600);
    } else if (step.scroll) {
      events.push({ type: "scroll", t: now() });
      await page
        .locator(step.scroll)
        .first()
        .evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" }));
      await sleep(step.after ?? 900);
    } else if (step.eval) {
      await page.evaluate(step.eval);
      await sleep(step.after ?? 300);
    }
  }

  await sleep(script.tail ?? 1200);
  keeping = false;
  await keeper;
  const tEnd = Date.now() / 1000;
  await cdp.send("Page.stopScreencast");
  if (frames.length === 0) throw new Error("the screencast sent no frames");

  // Each frame lasts until the next one; the first is pinned to t0 so event
  // times line up, and the last runs to the end of the take.
  const list = frames
    .map((f, i) => {
      const from = i === 0 ? t0 : f.ts;
      const to = frames[i + 1]?.ts ?? tEnd;
      return `file '${f.file}'\nduration ${Math.max(0.001, to - from).toFixed(4)}`;
    })
    .join("\n");
  const listFile = path.join(outDir, "frames.txt");
  fs.writeFileSync(listFile, `${list}\nfile '${frames.at(-1).file}'\n`);
  // prettier-ignore
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listFile,
    // The concat demuxer counts the last frame twice; cap at the real length.
    "-t", (tEnd - t0).toFixed(3),
    "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "14", "-preset", "slow",
    path.join(outDir, "raw.mp4"),
  ]);
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.rmSync(listFile);

  const duration = tEnd - t0;
  fs.writeFileSync(
    path.join(outDir, "events.json"),
    JSON.stringify({ viewport: { width: vw, height: vh }, startAt: 0, duration, cursorStart, events }, null, 2),
  );
  console.log(
    `Captured ${events.filter((e) => e.type === "click").length} clicks in ${duration.toFixed(1)}s (${frames.length} frames) to ${outDir}`,
  );
}
