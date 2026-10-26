# bueno-demo

Polished product demo videos from a JSON script. `bueno-demo` drives a real browser through your app, records it at 2x, and renders a Screen Studio-style clip: the camera eases in toward each click, a drawn cursor glides on a spring, clicks ripple, and an optional title and end card wear your brand.

It ships with an [Agent Skill](skills/bueno-demo/SKILL.md), so Claude Code and other agents can write the script and record the demo for you.

Built at [Bueno](https://bueno.fund) for release notes and docs.

## Requirements

- Node 20+
- ffmpeg (`brew install ffmpeg`)
- Chromium for Playwright (`npx playwright install chromium`)
- Optional: ImageMagick, for WebP posters (PNG otherwise)

Capture opens a real, headed Chromium window parked off-screen, because headless Chrome only records at 1x. It needs a desktop session (it won't run in headless CI).

## Quick start

```bash
npm i -D bueno-demo
npx playwright install chromium

npx bueno-demo capture node_modules/bueno-demo/examples/settings.json out/example
npx bueno-demo render out/example out/example/example --gif
```

You get `out/example/example.mp4` (1920×1200, H.264), a poster, and a GIF.

## Install the skill

Copy the skill into your agent's skills folder, for example for Claude Code:

```bash
mkdir -p .claude/skills && cp -r node_modules/bueno-demo/skills/bueno-demo .claude/skills/
```

Then ask: "record a demo of the new billing toggle".

## Scripts

A script is the page, the viewport and a list of steps:

```json
{
  "url": "http://localhost:3000/settings",
  "viewport": [1440, 900],
  "storage": "auth.json",
  "steps": [
    { "click": "[data-testid=plan-toggle]", "after": 1200 },
    { "type": "[data-testid=team-name]", "text": "Northwind", "clear": true },
    { "hover": "[data-testid=save]", "zoom": true },
    { "wait": 800 }
  ]
}
```

| Step     | What it does                                                                           |
| -------- | -------------------------------------------------------------------------------------- |
| `click`  | Glides the cursor to the element and clicks. `zoom: false` skips the camera zoom.      |
| `type`   | Clicks, then types `text`. `delay` ms per key (55); `clear: true` replaces the value.  |
| `fill`   | Clicks, then sets `text` at once, for inputs typing can't drive.                       |
| `hover`  | Glides there. `zoom: true` points the camera too.                                      |
| `upload` | Glides to a drop zone and attaches `file` to `input`.                                  |
| `press`  | Presses a key, like `"Escape"`.                                                        |
| `scroll` | Smooth-scrolls the element into view.                                                  |
| `wait`   | Pauses, in ms.                                                                         |
| `eval`   | Runs JS in the page, on camera.                                                        |

Every step takes `after`, the pause that follows it in ms. `click`, `type`, `fill` and `hover` take `at: [fx, fy]` to aim at a point within the element.

| Option          | Default        | What it does                                                                                          |
| --------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `storage`       |                | A Playwright storage-state file to sign in with, relative to the script                               |
| `cookiesFrom`   |                | `"agent-browser"` borrows a signed-in agent-browser session                                           |
| `keep`          |                | JS run before recording and every 250ms during it, to keep private data off camera                   |
| `setup`         |                | JS run once before recording                                                                          |
| `hide`          | dev overlays   | Extra CSS selectors to hide; `false` shows the Next.js and Vercel overlays too                         |
| `travelMs`      | 700            | How long the cursor takes to reach each target                                                        |
| `settle`        | 1500           | Wait after load, in ms                                                                                |
| `waitUntil`     | `networkidle`  | When the page counts as loaded: `load` or `domcontentloaded` for pages that never go idle (streaming video, polling) |
| `tail`          | 1200           | Hold at the end, in ms                                                                                |
| `cursorStart`   | near the first | Where the cursor starts, `[x, y]`                                                                     |
| `reducedMotion` | `false`        | Record with reduced motion on                                                                         |

`--base <origin>` on capture (or `BUENO_DEMO_BASE`) records the same path against another server.

## Render

```bash
npx bueno-demo render <capture-dir> <out-base> [flags]
```

| Flag             | What it does                                                         |
| ---------------- | -------------------------------------------------------------------- |
| `--zoom 1.6`     | How far a click zooms in                                             |
| `--speed 0.9`    | Playback speed, cursor and camera included                           |
| `--end 9.8`      | Cut the take at that second                                          |
| `--hold 1.2`     | Freeze the last frame for that long                                  |
| `--matte '#hex'` | Frame the page as a rounded window on that colour                    |
| `--title`        | An opening title card, with `--kicker` above it                      |
| `--end-cap`      | A closing card: logo, title, footer                                  |
| `--brand file`   | Colours, fonts, logo and footer for the cards (below)                |
| `--fit`          | Render at the page's own shape instead of 1920×1200                  |
| `--gif`          | Also write a 960px, 15fps GIF                                        |

A brand file (paths relative to it):

```json
{
  "ink": "#1d1b16",
  "paper": "#fdfaf1",
  "accent": "rgba(250, 118, 61, 0.35)",
  "displayFont": { "family": "Inter Display", "file": "fonts/InterDisplay-Bold.woff2", "weight": "700" },
  "monoFont": { "family": "Geist Mono", "file": "fonts/GeistMono.woff2" },
  "logo": "logo.svg",
  "kicker": "Product tour",
  "footer": "example.com/docs"
}
```

`npx bueno-demo cut <capture-dir> <from> <to>` removes a span (a slow load) from a capture before rendering, shifting later clicks so the camera still lines up.

## How it works

- **Capture** drives Chromium with Playwright and a real mouse, so hover states show. Chrome's screencast sends each frame at 2x with its own timestamp, and ffmpeg rebuilds a steady 30fps video from those timestamps, so clicks line up with the picture. Every move and click is logged to `events.json`.
- **Render** is a [Remotion](https://www.remotion.dev) composition. Clicks less than 2.6s apart share one zoom and the camera pans between them; it holds 1.4s on the last, then eases out. The cursor follows a critically damped spring, so it eases out of rest and settles without overshoot. Tune the feel in `src/Demo.tsx`; `npm run studio` opens Remotion Studio.

## License

MIT for this package. Rendering uses [Remotion](https://www.remotion.dev/license), which is free for individuals and companies of up to three people; larger companies need a Remotion company license.
