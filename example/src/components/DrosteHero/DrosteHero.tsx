"use client";

import clsx from "clsx";
import { useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SliceWrapper } from "../SliceWrapper";
import { LiveStage } from "./LiveStage";
import { heroScene, heroScript, takes, type Scene } from "./scenes";
import { ScriptPanel } from "./ScriptPanel";
import { Storyboard } from "./Storyboard";

const TAKE_COPY = [
  {
    title: "01 / Prompt an agent",
    body: "Ask in plain words. The skill teaches the agent to write the script and run the capture.",
  },
  {
    title: "02 / Generate the capture",
    body: "A real Chromium window plays the script at 2x and logs every move and click.",
  },
  {
    title: "03 / Review the files",
    body: "The script, the raw take, the events and the finished cut, side by side.",
  },
];

/** The small outlined button used for play and pause. */
const PLAY_BUTTON =
  "h-9 rounded-sm border-0.5 border-dashed border-primary px-3 text-string text-primary hover:bg-primary10 focus-visible:outline-1 focus-visible:outline-primary";

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
            />
          ) : (
            <LiveStage
              scene={heroScene}
              paused={paused || playing !== null}
              onStep={setActive}
              testId="hero-stage"
              hints={{
                paused: "Paused / click, then scroll to drive",
                playing: "Autopilot / click, then scroll to drive",
              }}
              showTime
            />
          )}
        </div>

        <aside className="col-span-full md:col-span-2 grid content-start gap-5 rounded-md border-1 border-dotted border-primary60 p-4 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {!reduced && (
              <button
                type="button"
                data-testid="hero-pause"
                aria-pressed={paused}
                onClick={() => setPaused((p) => !p)}
                className={PLAY_BUTTON}
              >
                {paused ? "Play" : "Pause"}
              </button>
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
          <ScriptPanel
            file="demos/hero.json"
            script={heroScript}
            active={active}
            onPick={reduced ? setActive : undefined}
          />
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
  const copy = TAKE_COPY[index];

  return (
    <div
      className="col-span-full md:col-span-2 grid content-start gap-3 min-w-0"
      onPointerEnter={(e) => e.pointerType === "mouse" && onPlaying(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && onPlaying(false)}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-string text-primary">{copy.title}</h3>
        {!reduced && (
          <button
            type="button"
            data-testid={`take-play-${scene.id}`}
            aria-pressed={playing}
            onClick={() => onPlaying(!playing)}
            className={PLAY_BUTTON}
          >
            {playing ? "Pause" : "Play"}
          </button>
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
          hints={{ paused: "Hover to play", playing: "Playing" }}
        />
      )}
      <p className="text-body text-primary">{copy.body}</p>
    </div>
  );
}
