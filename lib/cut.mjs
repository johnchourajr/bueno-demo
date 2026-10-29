// Cut a span out of a captured take, such as a slow load. Rewrites raw.mp4
// without it and shifts every later event in events.json back by its length,
// so the render's cursor and camera still line up. Events inside the span are
// dropped. Run it before render.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export async function run(args) {
  const [dir, fromArg, toArg] = args;
  const from = Number(fromArg);
  const to = Number(toArg);
  if (!dir || !(to > from) || from < 0) throw new Error("usage: cut <capture-dir> <from-seconds> <to-seconds>");

  const raw = path.join(dir, "raw.mp4");
  const cut = path.join(dir, "raw.cut.mp4");
  const metaPath = path.join(dir, "events.json");
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const gap = to - from;

  // prettier-ignore
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-i", raw,
    "-vf", `select='lt(t,${from})+gte(t,${to})',setpts=N/FRAME_RATE/TB`,
    "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-pix_fmt", "yuv420p",
    cut,
  ]);
  fs.renameSync(cut, raw);

  // A line said during the span moves to its start rather than going missing.
  meta.events = meta.events
    .map((e) => (e.type === "say" && e.t >= from && e.t < to ? { ...e, t: from } : e))
    .filter((e) => e.t < from || e.t >= to)
    .map((e) => (e.t >= to ? { ...e, t: e.t - gap } : e));
  meta.duration -= gap;
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  console.log(`Cut ${gap.toFixed(1)}s (${from}s to ${to}s); the take is now ${meta.duration.toFixed(1)}s`);
}
