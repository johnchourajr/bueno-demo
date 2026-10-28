// Reference copy, mirrored from the package README.

export const steps = [
  {
    name: "click",
    does: "Glides the cursor to the element and clicks. zoom: false skips the camera zoom.",
  },
  {
    name: "type",
    does: "Clicks, then types text. delay ms per key (55); clear: true replaces the value.",
  },
  {
    name: "fill",
    does: "Clicks, then sets text at once, for inputs typing can't drive.",
  },
  { name: "hover", does: "Glides there. zoom: true points the camera too." },
  { name: "upload", does: "Glides to a drop zone and attaches file to input." },
  { name: "press", does: 'Presses a key, like "Escape".' },
  { name: "scroll", does: "Smooth-scrolls the element into view." },
  { name: "wait", does: "Pauses, in ms." },
  { name: "eval", does: "Runs JS in the page, on camera." },
];

export const flags = [
  { flag: "--zoom 1.6", does: "How far a click zooms in" },
  { flag: "--speed 0.9", does: "Playback speed, cursor and camera included" },
  { flag: "--end 9.8", does: "Cut the take at that second" },
  { flag: "--hold 1.2", does: "Freeze the last frame for that long" },
  {
    flag: "--matte '#hex'",
    does: "Frame the page as a rounded window on that colour",
  },
  { flag: "--title", does: "An opening title card, with --kicker above it" },
  { flag: "--end-cap", does: "A closing card: logo, title, footer" },
  {
    flag: "--brand file",
    does: "Colours, fonts, logo and footer for the cards",
  },
  {
    flag: "--fit",
    does: "Render at the page's own shape instead of 1920×1200",
  },
  { flag: "--gif", does: "Also write a 960px, 15fps GIF" },
];

export const metaCredits = [
  { role: "Directed by", who: "a JSON file" },
  { role: "Talent", who: "your app" },
  { role: "Cursor", who: "a critically damped spring" },
  { role: "Camera", who: "eased zoom, 1.6×" },
  { role: "Cinematography", who: "Chromium at 2x" },
  { role: "Editing", who: "ffmpeg, by timestamp" },
  { role: "Post-production", who: "Remotion" },
  { role: "Catering", who: "none, it's a CLI" },
  { role: "Filmed on location", who: "this page" },
];

export const plainCredits = [
  { role: "Browser", who: "Playwright and Chromium" },
  { role: "Video", who: "ffmpeg" },
  { role: "Rendering", who: "Remotion" },
  { role: "Hero", who: "WebGPU, with WebGL2 and Canvas 2D fallbacks" },
];
