"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
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

type DemoCardProps = {
  demo: Demo;
  index: number;
  /** The capture script, pretty-printed. */
  script: string;
};

/** A flag value as you'd type it in a shell. */
const shell = (arg: string) => (/[\s#']/.test(arg) ? `'${arg}'` : arg);

/** One take: the clip, what it shows, and the commands that made it. */
export function DemoCard({ demo, index, script }: DemoCardProps) {
  const reduced = useReducedMotion();
  const gif = demo.flags.includes("--gif");
  const number = String(index + 1).padStart(2, "0");
  const render = [
    "bueno-screen-demo render take out",
    ...demo.flags.map(shell),
  ].join(" ");

  return (
    <article
      id={demo.id}
      className="col-span-full md:col-span-3 grid content-start gap-3 min-w-0 scroll-mt-24"
    >
      {gif ? (
        <GifStage demo={demo} reduced={reduced} />
      ) : (
        <VideoStage demo={demo} reduced={reduced} />
      )}
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
          {demo.id}.json
        </summary>
        <pre className="overflow-x-auto border-t-0.5 border-dashed border-primary25 p-3 font-mono text-caption text-primary">
          {script}
        </pre>
      </details>
    </article>
  );
}

type StageProps = { demo: Demo; reduced: boolean };

const STAGE =
  "relative aspect-[16/10] overflow-hidden rounded-md border-1 border-dotted border-primary60 bg-black";

/** The MP4: plays while on screen, unless motion is reduced or it's paused. */
function VideoStage({ demo, reduced }: StageProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  /** null until someone presses play or pause; then their choice wins. */
  const [chosen, setChosen] = useState<boolean | null>(null);
  const playing = chosen ?? (visible && !reduced);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.5 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (playing) video.play().catch(() => {});
    else video.pause();
  }, [playing]);

  return (
    <div className={STAGE}>
      <video
        ref={ref}
        src={`/takes/${demo.id}.mp4`}
        poster={`/takes/${demo.id}.webp`}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={`${demo.title}: ${demo.blurb}`}
        className="h-full w-full object-contain"
      />
      <div className="absolute bottom-3 right-3 bg-black60 backdrop-blur-md rounded-sm">
        <PlayButton
          playing={playing}
          onToggle={() => setChosen(!playing)}
          testId={`demo-play-${demo.id}`}
          label={demo.title}
        />
      </div>
    </div>
  );
}

/** The GIF itself, the file a README would embed. Its poster when motion is reduced. */
function GifStage({ demo, reduced }: StageProps) {
  return (
    <div className={STAGE}>
      <Image
        src={reduced ? `/takes/${demo.id}.webp` : `/takes/${demo.id}.gif`}
        alt={`${demo.title}: ${demo.blurb}`}
        fill
        unoptimized
        className="object-contain"
      />
    </div>
  );
}
