import { Composition } from "remotion";
import { END_CAP } from "./brand";
import { Demo } from "./Demo";
import type { DemoProps } from "./types";

export const FPS = 30;

const defaults: DemoProps = {
  video: "raw.mp4",
  viewport: { width: 1440, height: 900 },
  startAt: 0,
  duration: 5,
  events: [],
  cursorStart: null,
  matte: null,
  zoom: 1.6,
  speed: 1,
  title: null,
  kicker: null,
  endCap: false,
  fit: false,
  brand: null,
};

export function Root() {
  return (
    <Composition
      id="Demo"
      component={Demo}
      fps={FPS}
      width={1920}
      height={1200}
      durationInFrames={Math.round(defaults.duration * FPS)}
      defaultProps={defaults}
      calculateMetadata={({ props }) => ({
        // `fit`: the frame takes the page's own shape, at 2x (a phone-width
        // take renders portrait). Otherwise the usual 1920x1200.
        ...(props.fit
          ? {
              width: Math.round(props.viewport.width * 2),
              height: Math.round(props.viewport.height * 2),
            }
          : {}),
        durationInFrames: Math.max(
          1,
          Math.round(
            (props.duration / props.speed + (props.endCap ? END_CAP.in + END_CAP.hold : 0)) * FPS,
          ),
        ),
      })}
    />
  );
}
