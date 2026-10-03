"use client";

import Image from "next/image";
import bgImage from "@/assets/baumb/baumb-bg.jpg";
import { Aurora } from "../backdrop";
import { PhoneMockup } from "./phone-mockup";
import { HeroScreen, PlanScreen, StatsScreen } from "./screens";
import { useShowcaseData } from "./use-showcase-data";

export function Showcase() {
  const data = useShowcaseData();

  return (
    <section className="relative w-full overflow-hidden font-sans">
      <Image src={bgImage} alt="" fill priority sizes="100vw" placeholder="blur" className="absolute inset-0 z-0 h-full w-full object-cover" />
      <div className="absolute inset-0 z-[1] bg-base/70" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-transparent via-transparent to-base" />
      <Aurora className="z-[1]" />

      <div className="relative z-[2] w-full md:flex md:h-screen md:items-center md:justify-center md:py-6">
        <div className="flex flex-col items-center gap-[50px] p-[20px] md:flex-row md:items-end md:justify-center md:gap-[2vw] md:p-0">
          <div className="animate-fade-slide-up anim-delay-300">
            <PhoneMockup label="Athlete overview">
              <HeroScreen data={data} />
            </PhoneMockup>
          </div>
          <div className="animate-fade-slide-up anim-delay-500 md:-mb-6">
            <PhoneMockup label="Training stats">
              <StatsScreen data={data} />
            </PhoneMockup>
          </div>
          <div className="animate-fade-slide-up anim-delay-700">
            <PhoneMockup label="Program and personal records">
              <PlanScreen data={data} />
            </PhoneMockup>
          </div>
        </div>
      </div>
    </section>
  );
}
