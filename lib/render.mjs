// Render a capture into a polished video with Remotion: the camera eases in
// toward each click, a drawn cursor chases each target on a spring, and an
// optional title and end card wear your brand.
//
// Writes <out-base>.mp4 and a poster (<out-base>.webp with ImageMagick,
// otherwise .png), plus <out-base>.gif with --gif.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flag, positional } from "./args.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const BOOLEANS = ["--gif", "--end-cap", "--fit"];

const has = (cmd) => {
  try {
    execFileSync("which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

/**
 * A brand file's colours, fonts, logo and footer, its files copied next to
 * the capture so the render can serve them. Paths are relative to the file.
 */
function loadBrand(file, captureDir) {
  if (!file) return null;
  const brandPath = path.resolve(file);
  const brand = JSON.parse(fs.readFileSync(brandPath, "utf8"));
  const dir = path.join(captureDir, "_brand");
  fs.mkdirSync(dir, { recursive: true });
  const serve = (rel) => {
    if (!rel) return undefined;
    const src = path.resolve(path.dirname(brandPath), rel);
    fs.copyFileSync(src, path.join(dir, path.basename(src)));
    return `_brand/${path.basename(src)}`;
  };
  return {
    ...brand,
    logo: serve(brand.logo),
    displayFont: brand.displayFont && { ...brand.displayFont, file: serve(brand.displayFont.file) },
    monoFont: brand.monoFont && { ...brand.monoFont, file: serve(brand.monoFont.file) },
  };
}

export async function run(args) {
  const [captureDir, outBase] = positional(args, BOOLEANS);
  if (!captureDir || !outBase) throw new Error("usage: render <capture-dir> <out-base> [flags]");
  const meta = JSON.parse(fs.readFileSync(path.join(captureDir, "events.json"), "utf8"));

  const inputProps = {
    video: "raw.mp4",
    viewport: meta.viewport,
    startAt: meta.startAt,
    // --end cuts the take at that second, before something you don't want.
    duration: Math.min(meta.duration, Number(flag(args, "--end", meta.duration))),
    events: meta.events,
    cursorStart: meta.cursorStart ?? null,
    // Edge to edge unless --matte names a colour for a framed window.
    matte: flag(args, "--matte"),
    zoom: Number(flag(args, "--zoom", "1.6")),
    speed: Number(flag(args, "--speed", "1")),
    title: flag(args, "--title"),
    kicker: flag(args, "--kicker"),
    endCap: args.includes("--end-cap"),
    // The frame takes the page's own shape (a phone-width take renders portrait).
    fit: args.includes("--fit"),
    brand: loadBrand(flag(args, "--brand"), path.resolve(captureDir)),
  };

  console.log("Bundling…");
  const serveUrl = await bundle({
    entryPoint: path.join(here, "../src/index.ts"),
    publicDir: path.resolve(captureDir),
  });
  const composition = await selectComposition({ serveUrl, id: "Demo", inputProps });

  const mp4 = `${outBase}.mp4`;
  fs.mkdirSync(path.dirname(path.resolve(mp4)), { recursive: true });
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 20,
    pixelFormat: "yuv420p",
    outputLocation: mp4,
    inputProps,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== last) console.log(`Rendering ${pct}%`);
      last = pct;
    },
  });

  const ffmpeg = (...a) => execFileSync("ffmpeg", ["-v", "error", "-y", ...a]);
  // --hold freezes the last frame, so a take cut early still rests on its end.
  const hold = Number(flag(args, "--hold", "0"));
  if (hold > 0) {
    const held = `${outBase}.held.mp4`;
    ffmpeg("-i", mp4, "-vf", `tpad=stop_mode=clone:stop_duration=${hold}`, "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", held);
    fs.renameSync(held, mp4);
  }

  // The poster: the first frame. WebP via ImageMagick when it's installed
  // (many ffmpeg builds have no WebP encoder), PNG otherwise.
  const still = path.join(path.resolve(captureDir), "poster.png");
  ffmpeg("-i", mp4, "-frames:v", "1", still);
  let poster = `${outBase}.png`;
  if (has("magick")) {
    poster = `${outBase}.webp`;
    execFileSync("magick", [still, "-strip", "-quality", "88", poster]);
  } else {
    fs.copyFileSync(still, poster);
  }

  if (args.includes("--gif")) {
    // Two passes: a palette from the whole clip, then the GIF, 960px at 15fps.
    const palette = path.join(path.resolve(captureDir), "palette.png");
    const filters = "fps=15,scale=960:-1:flags=lanczos";
    ffmpeg("-i", mp4, "-vf", `${filters},palettegen=stats_mode=diff`, palette);
    ffmpeg("-i", mp4, "-i", palette, "-lavfi", `${filters}[x];[x][1:v]paletteuse=dither=sierra2_4a`, `${outBase}.gif`);
  }

  const size = (f) => `${(fs.statSync(f).size / 1024).toFixed(0)}KB`;
  const gifNote = args.includes("--gif") ? `, ${outBase}.gif (${size(`${outBase}.gif`)})` : "";
  console.log(`Rendered ${mp4} (${size(mp4)}), ${poster}${gifNote}`);
}
