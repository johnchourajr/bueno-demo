#!/usr/bin/env node
// bueno-screen-demo: capture a scripted demo in a real browser, then render it into
// a polished video. See README.md.

const [command, ...args] = process.argv.slice(2);

const usage = `bueno-screen-demo <command>

  capture <script.json> <out-dir> [--base <origin>] [--storage <state.json>]
          [--cookies-from agent-browser]
      Drive the demo in Chromium and record it: <out-dir>/raw.mp4 + events.json

  cut <capture-dir> <from-seconds> <to-seconds>
      Remove a span (a slow load, say) from a capture, shifting later events

  render <capture-dir> <out-base> [--gif] [--zoom 1.6] [--speed 1] [--matte '#hex']
         [--end <s>] [--hold <s>] [--title '...'] [--kicker '...'] [--end-cap]
         [--fit] [--brand brand.json]
      Render the capture into <out-base>.mp4, a poster, and optionally a GIF`;

const commands = {
  capture: () => import("../lib/capture.mjs"),
  cut: () => import("../lib/cut.mjs"),
  render: () => import("../lib/render.mjs"),
};

if (!commands[command]) {
  console.log(usage);
  process.exit(command && command !== "help" && command !== "--help" ? 1 : 0);
}

const { run } = await commands[command]();
try {
  await run(args);
} catch (err) {
  console.error(`bueno-screen-demo ${command}: ${err.message}`);
  process.exit(1);
}
