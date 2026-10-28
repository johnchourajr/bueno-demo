"use client";

import { useEffect, useRef, useState } from "react";
import { Narrator } from "./Narrator";
import { startRenderer, type Renderer } from "./renderers";
import { project, SOURCE_H, SOURCE_W, type Scene } from "./scenes";

/** Autopilot speed: one step, which in the meta scene is one level of the zoom. */
const STEP_MS = 3600;
/** How long after the last scroll or drag autopilot waits before taking over again. */
const IDLE_MS = 2500;
/** Steps per pixel of wheel delta, and per pixel of horizontal drag. */
const WHEEL_RATE = 0.0016;
const DRAG_RATE = 0.006;

type LiveStageProps = {
  scene: Scene;
  paused: boolean;
  onStep: (step: number) => void;
};

export function LiveStage({ scene, paused, onStep }: LiveStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const narratorRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const modeRef = useRef<HTMLSpanElement>(null);

  // The frame loop reads these without restarting.
  const sceneRef = useRef(scene);
  const pausedRef = useRef(paused);
  const onStepRef = useRef(onStep);
  sceneRef.current = scene;
  pausedRef.current = paused;
  onStepRef.current = onStep;

  const [rendererName, setRendererName] = useState<Renderer["name"] | null>(
    null,
  );
  const [step, setStep] = useState(0);

  useEffect(() => {
    const stage = stageRef.current!;
    const host = hostRef.current!;
    const source = document.createElement("canvas");
    source.width = SOURCE_W;
    source.height = SOURCE_H;
    const sctx = source.getContext("2d")!;

    let renderer: Renderer | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let raf = 0;
    let stopped = false;
    let t = 0;
    let lastInput = -Infinity;
    let lastStep = -1;
    let sceneId = sceneRef.current.id;
    const started = performance.now();

    const nudge = (delta: number) => {
      t = sceneRef.current.id === "meta" ? Math.max(0, t + delta) : t + delta;
      lastInput = performance.now();
    };
    // The wheel only drives the zoom after a click on the stage, so scrolling
    // past the hero still scrolls the page.
    let engaged = false;
    const onWheel = (e: WheelEvent) => {
      if (!engaged) return;
      e.preventDefault();
      nudge(e.deltaY * WHEEL_RATE);
    };
    const onLeave = () => {
      engaged = false;
    };
    let dragX: number | null = null;
    const onDown = (e: PointerEvent) => {
      engaged = true;
      lastInput = performance.now();
      dragX = e.clientX;
      stage.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (dragX === null) return;
      nudge((e.clientX - dragX) * DRAG_RATE);
      dragX = e.clientX;
    };
    const onUp = () => {
      dragX = null;
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onUp);
    stage.addEventListener("pointerleave", onLeave);

    let previous = performance.now();
    const frame = (now: number) => {
      if (stopped || !renderer || !canvas) return;
      const dt = now - previous;
      previous = now;
      const current = sceneRef.current;
      if (current.id !== sceneId) {
        sceneId = current.id;
        t = 0;
        lastStep = -1;
      }
      const driving = now - lastInput < IDLE_MS;
      const before = t;
      if (!driving && !pausedRef.current) t += dt / STEP_MS;

      const view = current.frame(t, before);
      current.draw(sctx, t, now - started);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(stage.clientWidth * dpr);
      const h = Math.round(stage.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      renderer.draw(source, view.camera, current.box);

      const [sx, sy] = project(current, view.cursor, view.camera);
      const px = sx * stage.clientWidth;
      const py = sy * stage.clientHeight;
      narratorRef.current!.style.transform = `translate(${px}px, ${py}px)`;
      if (view.clicked) {
        const ripple = rippleRef.current!;
        ripple.style.transform = `translate(${px}px, ${py}px)`;
        ripple.classList.remove("animate-ripple");
        void ripple.offsetWidth;
        ripple.classList.add("animate-ripple");
      }
      if (view.step !== lastStep) {
        lastStep = view.step;
        setStep(view.step);
        onStepRef.current(view.step);
      }
      timeRef.current!.textContent = `T ${t.toFixed(2)}`;
      modeRef.current!.textContent = driving
        ? "You have control"
        : pausedRef.current
          ? "Paused / click, then scroll to drive"
          : "Autopilot / click, then scroll to drive";
      raf = requestAnimationFrame(frame);
    };

    document.fonts.ready
      .then(() => startRenderer(host, "absolute inset-0 h-full w-full"))
      .then((started) => {
        if (stopped) {
          started.renderer.destroy();
          return;
        }
        renderer = started.renderer;
        canvas = started.canvas;
        setRendererName(renderer.name);
        raf = requestAnimationFrame(frame);
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      renderer?.destroy();
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
      stage.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const current = scene.steps[step] ?? scene.steps[0];

  return (
    <div
      ref={stageRef}
      data-testid="hero-stage"
      aria-label={
        scene.id === "meta"
          ? "This page, zooming into a recording of itself. Click it, then scroll to control the zoom."
          : "A recorded demo of a settings page. Click it, then scroll to scrub."
      }
      className="relative aspect-[16/10] w-full touch-pan-y overflow-hidden rounded-md border-1 border-primary60 bg-black cursor-pointer select-none"
    >
      <div ref={hostRef} className="absolute inset-0" />
      <span
        ref={rippleRef}
        aria-hidden="true"
        className="absolute left-[-30px] top-[-30px] z-10 h-[60px] w-[60px] rounded-full border-2 border-primary opacity-0 pointer-events-none"
      />
      <Narrator
        ref={narratorRef}
        say={scene.id === "meta" ? current.say : null}
      />

      <div className="absolute left-3 top-2 z-30 pointer-events-none">
        <span className="rounded-sm bg-black px-2 py-1 text-caption md:text-string text-primary uppercase tracking-[0.12em]">
          Step {step + 1} / {current.verb}
        </span>
      </div>
      <div className="absolute right-3 top-2 z-30 flex gap-2 pointer-events-none">
        <span
          ref={timeRef}
          className="hidden md:inline rounded-sm bg-black px-2 py-1 font-mono text-caption text-primary tabular-nums"
        />
        <span className="rounded-sm bg-black px-2 py-1 text-caption md:text-string text-primary uppercase tracking-[0.12em]">
          {rendererName ?? "Starting"}
        </span>
      </div>
      <div className="absolute bottom-2 left-3 right-3 z-30 flex flex-wrap justify-between gap-2 pointer-events-none">
        <span
          ref={modeRef}
          className="rounded-sm bg-black px-2 py-1 text-caption md:text-string text-primary60 uppercase tracking-[0.12em]"
        />
        {scene.id === "plain" && (
          <span className="rounded-sm bg-black px-2 py-1 text-caption text-paper">
            {current.say}
          </span>
        )}
      </div>
    </div>
  );
}
