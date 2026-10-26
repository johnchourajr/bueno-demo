import { Easing, Img, continueRender, delayRender, interpolate, staticFile } from "remotion";
import type { Brand } from "./types";

/** The look with no brand file: near-black on off-white, system type. */
const DEFAULTS = {
  ink: "#141414",
  paper: "#fafaf7",
  accent: "rgba(59, 130, 246, 0.35)",
  display: "ui-sans-serif, system-ui, sans-serif",
  mono: "ui-monospace, SFMono-Regular, monospace",
};

/** A brand file filled out with the defaults. */
export function resolveBrand(brand: Brand | null) {
  return {
    ink: brand?.ink ?? DEFAULTS.ink,
    paper: brand?.paper ?? DEFAULTS.paper,
    accent: brand?.accent ?? DEFAULTS.accent,
    display: brand?.displayFont ? `"${brand.displayFont.family}", ${DEFAULTS.display}` : DEFAULTS.display,
    mono: brand?.monoFont ? `"${brand.monoFont.family}", ${DEFAULTS.mono}` : DEFAULTS.mono,
    logo: brand?.logo,
    footer: brand?.footer,
    kicker: brand?.kicker,
  };
}

export type ResolvedBrand = ReturnType<typeof resolveBrand>;

/** Brand fonts load before the first frame, or titles fall back mid-video. */
export function loadBrandFonts(brand: Brand | null) {
  const fonts = [brand?.displayFont, brand?.monoFont].filter((f) => f?.file);
  if (fonts.length === 0) return;
  const handle = delayRender("Loading brand fonts");
  Promise.all(
    fonts.map((f) => new FontFace(f!.family, `url(${staticFile(f!.file!)})`, { weight: f!.weight ?? "normal" }).load()),
  )
    .then((faces) => faces.forEach((face) => document.fonts.add(face)))
    .catch(() => {})
    .finally(() => continueRender(handle));
}

const ease = Easing.bezier(0.45, 0, 0.15, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Seconds the opening title stays up, including its way in and out. */
export const LOWER_THIRD = { in: 0.35, hold: 2.6, out: 0.45 };

/** The opening title: a label over the clip's name, low and to the left. */
export function LowerThird({ t, kicker, title, brand }: { t: number; kicker: string | null; title: string; brand: ResolvedBrand }) {
  const start = 0.25;
  const end = start + LOWER_THIRD.in + LOWER_THIRD.hold;
  const inAmt = interpolate(t, [start, start + LOWER_THIRD.in], [0, 1], { ...clamp, easing: ease });
  const outAmt = interpolate(t, [end, end + LOWER_THIRD.out], [0, 1], { ...clamp, easing: ease });
  const shown = inAmt * (1 - outAmt);
  if (shown <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        bottom: 72,
        padding: "24px 34px 28px",
        borderRadius: 22,
        background: brand.paper,
        boxShadow: "0 22px 60px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.08)",
        opacity: shown,
        transform: `translateY(${(1 - inAmt) * 28 + outAmt * 18}px)`,
        color: brand.ink,
      }}
    >
      {kicker && (
        <div style={{ fontFamily: brand.mono, fontSize: 19, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.62, marginBottom: 10 }}>
          {kicker}
        </div>
      )}
      <div style={{ fontFamily: brand.display, fontWeight: 700, fontSize: 50, lineHeight: 1.05 }}>{title}</div>
    </div>
  );
}

/** Seconds the end card adds after the take: its way in, then a hold. */
export const END_CAP = { in: 0.7, hold: 1.8 };

/** The closing card: the last frame eases back and softens, and the logo, the
 *  clip's name and the footer settle in. */
export function EndCap({ t, title, brand }: { t: number; title: string; brand: ResolvedBrand }) {
  const amt = interpolate(t, [0, END_CAP.in], [0, 1], { ...clamp, easing: ease });
  const content = interpolate(t, [END_CAP.in * 0.45, END_CAP.in + 0.25], [0, 1], { ...clamp, easing: ease });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: brand.paper,
        opacity: amt,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: brand.ink,
      }}
    >
      <div
        style={{
          opacity: content,
          transform: `translateY(${(1 - content) * 18}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 30,
        }}
      >
        {brand.logo && <Img src={staticFile(brand.logo)} style={{ height: 70 }} />}
        <div style={{ fontFamily: brand.display, fontWeight: 700, fontSize: 76, lineHeight: 1.05, textAlign: "center" }}>{title}</div>
        {brand.footer && (
          <div style={{ fontFamily: brand.mono, fontSize: 26, letterSpacing: "0.08em", opacity: 0.6 }}>{brand.footer}</div>
        )}
      </div>
    </div>
  );
}
