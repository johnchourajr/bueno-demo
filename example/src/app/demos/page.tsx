import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { DemoCard, type Demo, type DemoFile } from "@/components/Demos";
import { MainLayout } from "@/components/MainLayout";
import { SliceWrapper } from "@/components/SliceWrapper";
import demos from "../../../demos/demos.json";

export const metadata: Metadata = {
  title: "Demos / Bueno Screen-Demo",
  description:
    "Ten takes recorded with @bueno-dev/screen-demo, each turning a different knob: matte, zoom, captions, branding, speed, phone width, GIF.",
};

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), "demos", file), "utf8").trim();

/** A demo's capture script, then any file its flags name, read at build time. */
function files(demo: Demo): DemoFile[] {
  const brand = demo.flags[demo.flags.indexOf("--brand") + 1];
  return [
    { name: `${demo.id}.json`, text: read(`scripts/${demo.id}.json`) },
    ...(demo.flags.includes("--brand")
      ? [{ name: brand, text: read(brand) }]
      : []),
  ];
}

export default function DemosPage() {
  return (
    <MainLayout>
      <section className="col-span-full flex min-h-[32vh] flex-col justify-end gap-4 pt-48 md:pt-40">
        <Link
          href="/"
          data-testid="demos-home"
          // The title's tight leading lets its glyphs reach up over this link,
          // so it sits above them.
          className="relative z-10 self-start text-string text-primary60 hover:text-primary"
        >
          ← screen-demo
        </Link>
        <h1 className="font-bold uppercase text-primary text-[clamp(3rem,12vw,10rem)] leading-[0.85]">
          Demos
        </h1>
      </section>
      <SliceWrapper title="Ten takes / one knob each" innerClassName="gap-y-16">
        <p className="col-span-full md:col-span-4 text-body text-primary">
          Every clip here was recorded by the CLI from a script in the
          site&rsquo;s demos folder, against a small local page. Each one turns
          a different option, from the camera and the frame to captions,
          branding and output format.
        </p>
        {(demos as Demo[]).map((demo, i) => (
          <DemoCard key={demo.id} demo={demo} index={i} files={files(demo)} />
        ))}
      </SliceWrapper>
    </MainLayout>
  );
}
