"use client";

import { useEffect } from "react";
import { actions, useAppState, useHydrated } from "@/lib/store";
import { applyTheme, themeById } from "@/lib/themes";

/** Paints Ember and keeps that choice on the account. */
export function ThemeRoot() {
  const hydrated = useHydrated();
  const { settings } = useAppState();
  useEffect(() => {
    if (!hydrated) return;
    applyTheme(settings);
    const ember = themeById("pine");
    if (settings.theme !== "pine" || (settings.accent || "").toLowerCase() !== ember.brand.toLowerCase()) {
      actions.updateSettings({ theme: "pine", accent: ember.brand });
    }
  }, [hydrated, settings]);
  return null;
}
