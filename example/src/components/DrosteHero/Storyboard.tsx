"use client";

import clsx from "clsx";
import { useEffect, useRef } from "react";
import { canvas2d } from "./renderers";
import { SOURCE_H, SOURCE_W, type Scene } from "./scenes";

type StoryboardProps = {
  scene: Scene;
  active: number;
  onPick: (step: number) => void;
  testId: string;
};

/**
 * The reduced-motion hero: one still frame with a numbered pin for each step,
 * matched to the numbered script lines. Nothing moves unless you point at it.
 */
export function Storyboard({ scene, active, onPick, testId }: StoryboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const source = document.createElement("canvas");
    source.width = SOURCE_W;
    source.height = SOURCE_H;
    const ctx = source.getContext("2d")!;
    const renderer = canvas2d(canvas);
    let cancelled = false;

    const paint = () => {
      if (cancelled) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      scene.draw(ctx, scene.still, 0);
      renderer.draw(
        source,
        {
          cx: 0.5,
          cy: 0.5,
          s: 1,
          depth: scene.box.k < 1 ? 8 : 0,
          focus: 0,
          blur: 0,
        },
        scene.box,
      );
    };

    document.fonts.ready.then(paint);
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [scene]);

  return (
    <div
      data-testid={testId}
      className="relative aspect-[16/10] w-full overflow-hidden rounded-md border-1 border-primary60 bg-black"
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      />
      {scene.steps.map((step, i) => (
        <button
          key={i}
          type="button"
          data-testid={`${testId}-pin-${i}`}
          aria-label={`Step ${i + 1}: ${step.say}`}
          onMouseEnter={() => onPick(i)}
          onFocus={() => onPick(i)}
          className={clsx(
            "absolute z-10 -ml-4 -mt-4 grid h-8 w-8 place-items-center rounded-full border-2 font-mono text-caption",
            step.pin,
            i === active
              ? "border-primary bg-primary text-black"
              : "border-primary bg-black60 text-primary",
          )}
        >
          {i + 1}
        </button>
      ))}
      <div className="absolute bottom-2 left-3 right-3 z-10 flex flex-wrap justify-between gap-2">
        <span className="rounded-sm bg-black px-2 py-1 text-string text-primary">
          Storyboard / motion is reduced
        </span>
        <span className="rounded-sm bg-black px-2 py-1 text-caption text-primary">
          {active + 1}. {scene.steps[active].say}
        </span>
      </div>
    </div>
  );
}
