import { DrosteHero } from "@/components/DrosteHero";
import { MainLayout } from "@/components/MainLayout";
import { Agents, Anatomy, Credits, Flags } from "@/components/Sections";
import { SvgHeader } from "@/components/SvgHeader";

export default function Home() {
  return (
    <MainLayout>
      <section className="col-span-full flex min-h-[40vh] flex-col justify-end pt-48 md:pt-40">
        <SvgHeader className="w-full" />
      </section>
      <DrosteHero />
      <Anatomy />
      <Flags />
      <Agents />
      <Credits />
    </MainLayout>
  );
}
