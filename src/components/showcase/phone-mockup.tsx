"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;

const LEFT_BUTTONS = [
  { top: "19%", height: "4.5%" },
  { top: "26%", height: "7.3%" },
  { top: "35.5%", height: "7.3%" },
];

export function PhoneMockup({ children, label }: { children: ReactNode; label: string }) {
  const screenRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: DESIGN_WIDTH, h: DESIGN_HEIGHT });

  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = size.w / DESIGN_WIDTH;
  const contentH = size.h / scale;

  return (
    <div className="flex flex-col items-center">
      <div
        className="phone-frame relative rounded-[clamp(30px,4vw,54px)] bg-black p-[clamp(6px,1vw,12px)] shadow-2xl shadow-black/60"
        role="group"
        aria-label={label}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[clamp(30px,4vw,54px)] ring-1 ring-white/15" />

        {LEFT_BUTTONS.map((b) => (
          <span key={b.top} className="absolute -left-[3px] w-[3px] rounded-l-sm bg-neutral-700" style={{ top: b.top, height: b.height }} />
        ))}
        <span className="absolute -right-[3px] w-[3px] rounded-r-sm bg-neutral-700" style={{ top: "30.8%", height: "11.4%" }} />

        <div ref={screenRef} className="relative h-full w-full overflow-hidden rounded-[clamp(24px,3.2vw,44px)] bg-[#0a0e1c]">
          <div className="absolute left-1/2 top-[3%] z-50 h-[4%] w-[30%] -translate-x-1/2 rounded-full bg-black" />
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ width: DESIGN_WIDTH, height: contentH, transform: `scale(${scale})` }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
