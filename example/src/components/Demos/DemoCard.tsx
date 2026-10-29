"use client";

import clsx from "clsx";
import { motion, useMotionValue } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PlayButton } from "../DrosteHero/PlayButton";

export type Demo = {
  id: string;
  title: string;
  /** The option it shows off, as a flag or a script key. */
  option: string;
  blurb: string;
  /** Render flags, exactly as scripts/build-demos.mjs passes them. */
  flags: string[];
};

/** A file the take was made from, by name, with its text. */
export type DemoFile = { name: string; text: string };

type DemoCardProps = {
  demo: Demo;
  index: number;
  /** The capture script first, then any file a flag points to. */
  files: DemoFile[];
};

/** A flag value as you'd type it in a shell. */
const shell = (arg: string) => (/[\s#']/.test(arg) ? `'${arg}'` : arg);

/** One take: the clip, what it shows, and the commands that made it. */
export function DemoCard({ demo, index, files }: DemoCardProps) {
  const gif = demo.flags.includes("--gif");
  const number = String(index + 1).padStart(2, "0");
  const render = [
    "bueno-screen-demo render take out",
    ...demo.flags.map(shell),
  ].join(" ");

  return (
    <article
      id={demo.id}
      className="grid grid-cols-1 content-start gap-3 min-w-0 scroll-mt-24"
    >
      {gif ? <GifStage demo={demo} /> : <VideoStage demo={demo} />}
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-string text-primary">
          {number} / {demo.title}
        </h3>
        <code className="font-mono text-caption text-primary60 text-end">
          {demo.option}
        </code>
      </div>
      <p className="text-body text-primary">{demo.blurb}</p>
      <pre className="overflow-x-auto rounded-sm border-0.5 border-dashed border-primary60 p-3 font-mono text-caption text-primary">
        {`bueno-screen-demo capture ${demo.id}.json take\n${render}`}
      </pre>
      <details className="group rounded-sm border-0.5 border-dashed border-primary25">
        <summary
          data-testid={`demo-script-${demo.id}`}
          className="cursor-pointer list-none p-3 text-string text-primary60 hover:text-primary"
        >
          <span className="group-open:hidden">+ </span>
          <span className="hidden group-open:inline">− </span>
          {new Intl.ListFormat("en").format(files.map((f) => f.name))}
        </summary>
        {files.map((file) => (
          <div
            key={file.name}
            className="border-t-0.5 border-dashed border-primary25 p-3"
          >
            {files.length > 1 && (
              <p className="pb-2 text-caption text-primary60">{file.name}</p>
            )}
            <pre className="overflow-x-auto font-mono text-caption text-primary">
              {file.text}
            </pre>
          </div>
        ))}
      </details>
    </article>
  );
}

type StageProps = { demo: Demo };

/** Dimmed while paused, so it reads as stopped at a glance. */
const media = (playing: boolean) =>
  clsx(
    "motion-safe:transition-opacity motion-safe:duration-300",
    !playing && "opacity-50",
  );

const STAGE =
  "relative aspect-[16/10] overflow-hidden rounded-md border-1 border-dotted border-primary60 bg-black";

/**
 * Plays while the pointer is over it. Touch screens have no hover, so the
 * button plays and pauses there.
 */
function useHoverPlay() {
  const [hovered, setHovered] = useState(false);
  /** null until someone presses play or pause; then their choice wins. */
  const [chosen, setChosen] = useState<boolean | null>(null);
  const playing = chosen ?? hovered;
  const hover = {
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") setHovered(true);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      setHovered(false);
      setChosen(null);
    },
  };
  return { playing, hover, toggle: () => setChosen(!playing) };
}

/** The MP4, on its poster until it plays. */
function VideoStage({ demo }: StageProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const { playing, hover, toggle } = useHoverPlay();
  /** How far through the clip, 0 to 1. */
  const progress = useMotionValue(0);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (playing) video.play().catch(() => {});
    else video.pause();
  }, [playing]);

  // Every frame while it plays, so the bar glides rather than ticking.
  useEffect(() => {
    const video = ref.current;
    if (!video || !playing) return;
    let id = 0;
    const tick = () => {
      if (video.duration) progress.set(video.currentTime / video.duration);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, progress]);

  return (
    <div className={STAGE} {...hover}>
      <video
        ref={ref}
        src={`/takes/${demo.id}.mp4`}
        poster={`/takes/${demo.id}.webp`}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={`${demo.title}: ${demo.blurb}`}
        className={clsx("h-full w-full object-contain", media(playing))}
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-primary25">
        <motion.div
          className="h-full origin-left bg-primary"
          style={{ scaleX: progress }}
        />
      </div>
      <div className="absolute bottom-3 right-3 bg-black90 backdrop-blur-md rounded-sm">
        <PlayButton
          playing={playing}
          onToggle={toggle}
          testId={`demo-play-${demo.id}`}
          label={demo.title}
        />
      </div>
    </div>
  );
}

/** The GIF itself, the file a README would embed, shown while it plays. */
function GifStage({ demo }: StageProps) {
  const { playing, hover, toggle } = useHoverPlay();
  return (
    <div className={STAGE} {...hover}>
      <Image
        src={playing ? `/takes/${demo.id}.gif` : `/takes/${demo.id}.webp`}
        alt={`${demo.title}: ${demo.blurb}`}
        fill
        unoptimized
        className={clsx("object-contain", media(playing))}
      />
      <div className="absolute bottom-3 right-3 bg-black90 backdrop-blur-md rounded-sm">
        <PlayButton
          playing={playing}
          onToggle={toggle}
          testId={`demo-play-${demo.id}`}
          label={demo.title}
        />
      </div>
    </div>
  );
}
