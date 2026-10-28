"use client";

import clsx from "clsx";
import { useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useMeta } from "../Meta";
import { LiveStage } from "./LiveStage";
import { scenes } from "./scenes";
import { ScriptPanel } from "./ScriptPanel";
import { Storyboard } from "./Storyboard";

export function DrosteHero() {
  const { meta, setMeta } = useMeta();
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [active, setActive] = useState(0);
  const scene = meta ? scenes.meta : scenes.plain;

  const toggleMeta = () => {
    setActive(0);
    setMeta(!meta);
  };

  return (
    <section
      id="hero"
      className="col-span-full grid grid-cols-subgrid gap-y-4 pt-4"
    >
      <div className="col-span-full md:col-span-4 min-w-0">
        {reduced ? (
          <Storyboard scene={scene} active={active} onPick={setActive} />
        ) : (
          <LiveStage scene={scene} paused={paused} onStep={setActive} />
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
              className="h-9 rounded-sm border-0.5 border-dashed border-primary px-3 text-string hover:bg-primary10 focus-visible:outline-1 focus-visible:outline-primary"
            >
              {paused ? "Play" : "Pause"}
            </button>
          )}
          <button
            type="button"
            role="switch"
            data-testid="meta-toggle"
            aria-checked={meta}
            onClick={toggleMeta}
            className="flex h-9 items-center gap-2 rounded-sm px-1 text-string focus-visible:outline-1 focus-visible:outline-primary"
          >
            <span
              aria-hidden="true"
              className={clsx(
                "relative h-5 w-9 rounded-full border-1 border-primary transition-colors",
                meta ? "bg-primary25" : "bg-transparent",
              )}
            >
              <span
                className={clsx(
                  "absolute top-[2px] h-[14px] w-[14px] rounded-full bg-primary transition-[left]",
                  meta ? "left-[18px]" : "left-[2px]",
                )}
              />
            </span>
            Meta {meta ? "on" : "off"}
          </button>
        </div>

        <ScriptPanel
          scene={scene}
          active={active}
          onPick={reduced ? setActive : undefined}
        />

        <p className="text-body text-primary">
          {meta
            ? "A recording of this page, which holds this hero. The camera tours one script step at a time while the cursor stays on top. The last step dives into the hero and racks focus, and whatever sits off the focal plane falls apart into dither."
            : "The settings example that ships with the package, played the way the CLI records it: eased zoom toward each click, a spring-smoothed cursor."}
        </p>
        <p className="text-caption text-primary">
          {reduced
            ? "Your system asks for reduced motion, so this is a still storyboard. Point at a step to find it."
            : "Click the hero, then scroll (or drag sideways) to drive. Stop for a moment and autopilot picks up again."}
        </p>
      </aside>
    </section>
  );
}
