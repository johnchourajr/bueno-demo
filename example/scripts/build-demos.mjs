// Capture and render every take on /demos into public/takes, with the CLI
// from the repo root (run `pnpm install` there first).
//
//   node scripts/build-demos.mjs          every demo
//   node scripts/build-demos.mjs zoom say only these
//
// Scripts, pages and the brand file live in demos/; flags come from
// demos/demos.json, the same list the page reads.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demosDir = path.join(site, "demos");
const cli = path.resolve(site, "../bin/bueno-screen-demo.mjs");
const cache = path.join(site, ".demos-cache");
const out = path.join(site, "public/takes");

const demos = JSON.parse(
  fs.readFileSync(path.join(demosDir, "demos.json"), "utf8"),
);
const only = process.argv.slice(2);
const unknown = only.filter((id) => !demos.some((d) => d.id === id));
if (unknown.length) throw new Error(`no demo named: ${unknown.join(", ")}`);

fs.mkdirSync(out, { recursive: true });
for (const demo of demos) {
  if (only.length && !only.includes(demo.id)) continue;
  const take = path.join(cache, demo.id);
  const base = path.join(out, demo.id);
  // A stale GIF would outlive a demo that dropped --gif.
  fs.rmSync(`${base}.gif`, { force: true });
  console.log(`\n${demo.id}`);
  // Flags resolve against demos/, so --brand brand.json finds its file.
  const run = (...args) =>
    execFileSync("node", [cli, ...args], { cwd: demosDir, stdio: "inherit" });
  run("capture", `scripts/${demo.id}.json`, take);
  run("render", take, base, ...demo.flags);
}
