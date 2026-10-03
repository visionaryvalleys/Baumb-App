import type { Unit } from "./types";

const KG_PER_LB = 0.45359237;

export function toDisplayWeight(kg: number, unit: Unit): number {
  const value = unit === "kg" ? kg : kg / KG_PER_LB;
  return Math.round(value * 10) / 10;
}

export function fromDisplayWeight(value: number, unit: Unit): number {
  return unit === "kg" ? value : value * KG_PER_LB;
}

export function formatWeight(kg: number, unit: Unit): string {
  return `${toDisplayWeight(kg, unit).toLocaleString()} ${unit}`;
}

export function formatVolume(kg: number, unit: Unit): string {
  const v = toDisplayWeight(kg, unit);
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k ${unit}`;
  return `${Math.round(v).toLocaleString()} ${unit}`;
}
