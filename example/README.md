# Bueno /Screen-Demo site

The site for `@bueno-dev/screen-demo`. Its hero zooms into a recording of the page, which holds the hero, and each level is one step of the script that recorded it. A "Meta" switch swaps it for a plain demo of the bundled settings example.

```bash
pnpm install
pnpm dev      # http://localhost:3007
pnpm build    # static export to out/
```

The hero renders with WebGPU, then WebGL2, then Canvas 2D, whichever the browser starts first. With reduced motion on it becomes a still storyboard instead. Its source frame is drawn in a canvas for now (`src/components/DrosteHero/scenes.ts`); the plan is to swap it for a recording of the site made with the CLI.
