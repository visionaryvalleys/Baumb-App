"use client";

import { useEffect } from "react";
import { useAppState, useHydrated } from "@/lib/store";
import { applyTheme } from "@/lib/themes";

/** Paints the saved palette once local settings are available. */
export function ThemeRoot() {
  const hydrated = useHydrated();
  const { settings } = useAppState();
  useEffect(() => {
    if (!hydrated) return;
    applyTheme(settings);
  }, [hydrated, settings]);
  return null;
}
