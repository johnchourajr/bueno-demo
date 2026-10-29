import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { DemoCard, type Demo } from "@/components/Demos";
import { MainLayout } from "@/components/MainLayout";
import { SliceWrapper } from "@/components/SliceWrapper";
import demos from "../../../demos/demos.json";

export const metadata: Metadata = {
  title: "Demos / Bueno Screen-Demo",
  description:
    "Ten takes recorded with @bueno-dev/screen-demo, each turning a different knob: matte, zoom, captions, branding, speed, phone width, GIF.",
};

/** A demo's capture script, read at build time. */
function script(id: string) {
  const file = path.join(process.cwd(), "demos/scripts", `${id}.json`);
  return fs.readFileSync(file, "utf8").trim();
}

export default function DemosPage() {
  return (
    <MainLayout>
      <section className="col-span-full flex min-h-[32vh] flex-col justify-end gap-4 pt-48 md:pt-40">
        <Link
          href="/"
          data-testid="demos-home"
          className="text-string text-primary60 hover:text-primary"
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
          <DemoCard
            key={demo.id}
            demo={demo}
            index={i}
            script={script(demo.id)}
          />
        ))}
      </SliceWrapper>
    </MainLayout>
  );
}
