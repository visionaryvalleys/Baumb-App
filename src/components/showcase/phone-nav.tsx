"use client";

import Image from "next/image";
import { useState } from "react";
import bgImage from "@/assets/baumb/baumb-bg.jpg";
import { BaumbLogo, MenuButton, MenuOverlay, ProfileButton } from "../brand";

const PHONE_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/progress", label: "Progress" },
  { href: "/workouts", label: "Workouts" },
];

export function ScreenBackground() {
  return (
    <>
      <Image src={bgImage} alt="" fill sizes="430px" className="object-cover" placeholder="blur" />
      <div className="absolute inset-0 bg-black/60" />
    </>
  );
}

export function PhoneNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="absolute left-0 right-0 top-0 z-30 mt-[20px] flex h-14 items-center justify-between px-5">
        <BaumbLogo />
        <div className="flex items-center">
          <ProfileButton />
          <MenuButton expanded={open} onClick={() => setOpen(true)} />
        </div>
      </div>
      <MenuOverlay open={open} onClose={() => setOpen(false)} links={PHONE_LINKS} cta={{ href: "/workouts/new", label: "Log workout" }} />
    </>
  );
}
