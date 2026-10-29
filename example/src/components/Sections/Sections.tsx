"use client";

import { GlobalHeaderCopyButton } from "../GlobalHeader/GlobalHeaderCopyButton";
import { SliceWrapper } from "../SliceWrapper";
import { credits, flags, steps } from "./content";

export function Anatomy() {
  return (
    <SliceWrapper
      title="Anatomy / script steps"
      className="scroll-mt-24"
      innerClassName="gap-4"
    >
      <div id="anatomy" className="col-span-full grid grid-cols-subgrid gap-4">
        {steps.map((step) => (
          <div
            key={step.name}
            className="col-span-2 grid content-start gap-2 rounded-md border-1 border-dotted border-primary60 p-4"
          >
            <code className="font-mono text-body text-primary">
              {step.name}
            </code>
            <p className="text-body text-primary">{step.does}</p>
          </div>
        ))}
      </div>
      <p className="col-span-full md:col-span-4 text-body text-primary">
        Every step takes after, the pause that follows it in ms. click, type,
        fill and hover take at: [fx, fy] to aim at a point within the element.
      </p>
    </SliceWrapper>
  );
}

export function Flags() {
  return (
    <SliceWrapper title="Render / flags">
      <div className="col-span-full md:col-span-4 grid">
        {flags.map((row) => (
          <div
            key={row.flag}
            className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-4 border-t-1 border-dotted border-primary25 py-3"
          >
            <code className="font-mono text-caption text-primary">
              {row.flag}
            </code>
            <span className="text-body text-primary">{row.does}</span>
          </div>
        ))}
      </div>
    </SliceWrapper>
  );
}

export function Agents() {
  return (
    <SliceWrapper title="Agents / the skill">
      <div className="col-span-full md:col-span-3 grid content-start gap-4">
        <GlobalHeaderCopyButton text="npx skills add johnchourajr/bueno-screen-demo" />
        <p className="text-body text-primary">
          The skill teaches Claude Code and other agents to write the script,
          record the take and check every frame before handing it over. Then
          ask: &ldquo;record a demo of the new billing toggle&rdquo;.
        </p>
      </div>
    </SliceWrapper>
  );
}

export function Credits() {
  return (
    <SliceWrapper title="Credits / in order of appearance">
      <dl className="col-span-full md:col-span-4 grid">
        {credits.map((c) => (
          <div
            key={c.role}
            className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)] gap-4 border-t-1 border-dotted border-primary25 py-3"
          >
            <dt className="text-string text-primary">{c.role}</dt>
            <dd className="text-body text-primary">{c.who}</dd>
          </div>
        ))}
      </dl>
      <div className="col-span-full flex flex-wrap justify-between gap-4 pt-10 text-string text-primary">
        <a href="https://john.design" className="hover:text-primary">
          John.design
        </a>
        <span>© 2026 / MIT licensed</span>
        <a
          href="https://www.npmjs.com/package/@bueno-dev/screen-demo"
          className="hover:text-primary"
        >
          @bueno-dev/screen-demo / npm
        </a>
      </div>
    </SliceWrapper>
  );
}
