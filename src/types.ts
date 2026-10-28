/** One logged moment from capture, in seconds and CSS pixels. */
export type DemoEvent =
  | { type: "move"; t: number; x: number; y: number }
  | { type: "click"; t: number; x: number; y: number; zoom: boolean }
  /** A hover the camera zooms to, like a click without the ripple. */
  | { type: "focus"; t: number; x: number; y: number }
  | { type: "scroll"; t: number }
  /** A line the cursor says from here on; null clears it. */
  | { type: "say"; t: number; text: string | null };

/** A font file served next to the capture (see render's --brand). */
export type BrandFont = { family: string; file?: string; weight?: string };

/** Colours, type, logo and footer for the title and end card. */
export type Brand = {
  /** Text and lines. */
  ink?: string;
  /** Backgrounds: the title card, the end card, the page behind the take. */
  paper?: string;
  /** The click ripple. */
  accent?: string;
  displayFont?: BrandFont;
  monoFont?: BrandFont;
  /** An image on the end card. */
  logo?: string;
  /** A line under the end card's title, such as your docs address. */
  footer?: string;
  /** The title card's label above the title, when --kicker isn't given. */
  kicker?: string;
};

export type DemoProps = {
  /** The recording, as a file in the render's public dir. */
  video: string;
  viewport: { width: number; height: number };
  /** Seconds into the recording where the demo starts. */
  startAt: number;
  /** Seconds of recording to use, from startAt. */
  duration: number;
  events: DemoEvent[];
  /** Where the cursor rests before its first move, in CSS pixels. */
  cursorStart: { x: number; y: number } | null;
  /** A framed look: the page in a rounded window on this colour. Null (the
   *  default) is edge to edge. */
  matte: string | null;
  /** How far a click zooms in, e.g. 1.6. */
  zoom: number;
  /** Playback speed: 0.9 plays the take 10% slower, cursor and camera too. */
  speed: number;
  /** An opening title card: the clip's name, with `kicker` above it. */
  title: string | null;
  kicker: string | null;
  /** A closing card after the take: logo, title, footer. */
  endCap: boolean;
  /** Render at the page's own shape (2x its viewport), not 1920x1200. */
  fit: boolean;
  brand: Brand | null;
};
