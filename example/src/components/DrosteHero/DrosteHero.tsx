"use client";

import clsx from "clsx";
import { useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SliceWrapper } from "../SliceWrapper";
import { LiveStage } from "./LiveStage";
import { PlayButton } from "./PlayButton";
import { heroScene, heroScript, takes, type Scene } from "./scenes";
import { ScriptPanel } from "./ScriptPanel";
import { Storyboard } from "./Storyboard";

const TAKE_TITLES = ["01 / Prompt", "02 / Capture", "03 / Review"];

export function DrosteHero() {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [active, setActive] = useState(0);
  /** The take playing below, if any. The hero holds still while one does. */
  const [playing, setPlaying] = useState<number | null>(null);

  const status = reduced
    ? "Storyboard / motion is reduced"
    : paused
      ? "Paused"
      : playing !== null
        ? "Paused while a take plays"
        : "Playing";

  return (
    <>
      <section
        id="hero"
        className="col-span-full grid grid-cols-subgrid gap-y-4 pt-4"
      >
        <div className="col-span-full md:col-span-4 min-w-0">
          {reduced ? (
            <Storyboard
              scene={heroScene}
              active={active}
              onPick={setActive}
              testId="hero-storyboard"
              hud
            />
          ) : (
            <LiveStage
              scene={heroScene}
              paused={paused || playing !== null}
              onStep={setActive}
              testId="hero-stage"
              hud
            />
          )}
        </div>

        <aside className="col-span-full md:col-span-2 flex flex-col rounded-md border-1 border-dotted border-primary60 min-w-0">
          <ScriptPanel
            file="capture.json"
            script={heroScript}
            active={active}
            onPick={reduced ? setActive : undefined}
          />
          <div className="flex flex-wrap items-center gap-3 border-t-1 border-dotted border-primary25 p-4">
            {!reduced && (
              <PlayButton
                playing={!paused}
                onToggle={() => setPaused((p) => !p)}
                testId="hero-pause"
                label="the hero"
              />
            )}
            <span
              data-testid="hero-status"
              aria-live="polite"
              className="text-string text-primary"
            >
              <span
                aria-hidden="true"
                className={clsx(
                  "mr-2 inline-block h-2 w-2 rounded-full bg-primary",
                  status !== "Playing" && "opacity-30",
                )}
              />
              {status}
            </span>
          </div>
        </aside>
      </section>

      <SliceWrapper
        title={reduced ? "Three takes" : "Three takes / hover to play"}
        innerClassName="gap-4"
      >
        <div
          id="takes"
          className="col-span-full grid grid-cols-subgrid gap-y-8"
        >
          {takes.map((scene, i) => (
            <Take
              key={scene.id}
              scene={scene}
              index={i}
              reduced={reduced}
              playing={playing === i}
              onPlaying={(on) =>
                setPlaying((current) =>
                  on ? i : current === i ? null : current,
                )
              }
            />
          ))}
        </div>
      </SliceWrapper>
    </>
  );
}

type TakeProps = {
  scene: Scene;
  index: number;
  reduced: boolean;
  playing: boolean;
  onPlaying: (on: boolean) => void;
};

/** One take below the hero: plays while a mouse is over it, or from its button on touch and keyboard. */
function Take({ scene, index, reduced, playing, onPlaying }: TakeProps) {
  const [active, setActive] = useState(0);
  const title = TAKE_TITLES[index];

  return (
    <div
      className="col-span-full md:col-span-2 grid content-start gap-3 min-w-0"
      onPointerEnter={(e) => e.pointerType === "mouse" && onPlaying(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && onPlaying(false)}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-string text-primary">{title}</h3>
        {!reduced && (
          <PlayButton
            playing={playing}
            onToggle={() => onPlaying(!playing)}
            testId={`take-play-${scene.id}`}
            label={`take ${title}`}
          />
        )}
      </div>
      {reduced ? (
        <Storyboard
          scene={scene}
          active={active}
          onPick={setActive}
          testId={`take-${scene.id}-storyboard`}
        />
      ) : (
        <LiveStage
          scene={scene}
          paused={!playing}
          testId={`take-${scene.id}-stage`}
          ditherAtRest
        />
      )}
    </div>
  );
}
