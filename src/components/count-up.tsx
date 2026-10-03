"use client";

import { useCountUp } from "@/lib/use-count-up";

const format = (v: number, decimals: number, signed: boolean) => {
  const text = v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return signed && v > 0 ? `+${text}` : text;
};

/** A number that counts up to its value; screen readers get the final value only. */
export function CountUp({ value, decimals = 0, signed = false, suffix = "", delay = 0, duration = 1400 }: { value: number; decimals?: number; signed?: boolean; suffix?: string; delay?: number; duration?: number }) {
  const shown = useCountUp(value, delay, duration);
  const rounded = Math.round(shown * 10 ** decimals) / 10 ** decimals;
  return (
    <>
      <span aria-hidden>
        {format(rounded, decimals, signed)}
        {suffix}
      </span>
      <span className="sr-only">
        {format(value, decimals, signed)}
        {suffix}
      </span>
    </>
  );
}
