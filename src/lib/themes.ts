import type { Settings } from "./types";

export interface OstinTheme {
  id: string;
  label: string;
  brand: string;
  ground: string;
  lift: string;
  base: string;
  card: string;
  elevated: string;
  fg: string;
  muted: string;
  subtle: string;
}

/**
 * Glacial slate and deodar pine.
 * Text is Eternal Snow and Karakoram Mist. Grounds are deep pine, never black.
 * Pine #56746D, Ridge #626D74, Mist #DFE5E8, Snow #F8F9FA.
 */
export const THEMES: OstinTheme[] = [
  {
    id: "pine",
    label: "Pine",
    brand: "#56746D",
    ground: "#1E2A27",
    lift: "#31443E",
    base: "#24312E",
    card: "#2C3B37",
    elevated: "#384842",
    fg: "#F8F9FA",
    muted: "#DFE5E8",
    subtle: "#DFE5E8",
  },
  {
    id: "ridge",
    label: "Ridge",
    brand: "#626D74",
    ground: "#242C30",
    lift: "#3A4449",
    base: "#2A3338",
    card: "#343E44",
    elevated: "#3E494F",
    fg: "#F8F9FA",
    muted: "#DFE5E8",
    subtle: "#DFE5E8",
  },
  {
    id: "mist",
    label: "Mist",
    brand: "#56746D",
    ground: "#243033",
    lift: "#3A484C",
    base: "#2A383C",
    card: "#334246",
    elevated: "#3C4C50",
    fg: "#F8F9FA",
    muted: "#DFE5E8",
    subtle: "#DFE5E8",
  },
  {
    id: "snow",
    label: "Snow",
    brand: "#56746D",
    ground: "#2A3330",
    lift: "#3E4C48",
    base: "#313C38",
    card: "#3A4743",
    elevated: "#45524E",
    fg: "#F8F9FA",
    muted: "#DFE5E8",
    subtle: "#DFE5E8",
  },
];

export function themeById(id: string | undefined): OstinTheme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

export function applyTheme(settings: Settings) {
  const theme = themeById(settings.theme);
  const root = document.documentElement;
  const brand = (settings.accent || theme.brand).toLowerCase();
  root.style.setProperty("--color-brand", brand);
  root.style.setProperty("--color-ground", theme.ground);
  root.style.setProperty("--color-base", theme.base);
  root.style.setProperty("--color-base-2", theme.card);
  root.style.setProperty("--color-card", theme.card);
  root.style.setProperty("--color-elevated", theme.elevated);
  root.style.setProperty("--color-fg", theme.fg);
  root.style.setProperty("--color-muted", theme.muted);
  root.style.setProperty("--color-subtle", theme.subtle);
  root.style.setProperty("--color-bm-night", theme.ground);
  root.style.setProperty("--color-bm-dark", theme.base);
  root.style.setProperty("--color-surface", theme.card);
  root.style.setProperty("--page-ground", `radial-gradient(ellipse 90% 80% at 50% 42%, ${theme.lift} 0%, ${theme.ground} 70%)`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.ground);
}
