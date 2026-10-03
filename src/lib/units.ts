import type { Unit, UnitSystem } from "./types";

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;
const KM_PER_MI = 1.609344;

export function weightUnit(system: UnitSystem): Unit {
  return system === "imperial" ? "lb" : "kg";
}

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

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalIn = cm / CM_PER_IN;
  let feet = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_IN;
}

export function formatHeight(cm: number, system: UnitSystem): string {
  if (system === "metric") return `${Math.round(cm)} cm`;
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet}′${inches}″`;
}

export function toDisplayLength(cm: number, system: UnitSystem): number {
  return Math.round((system === "metric" ? cm : cm / CM_PER_IN) * 10) / 10;
}

export function fromDisplayLength(value: number, system: UnitSystem): number {
  return system === "metric" ? value : value * CM_PER_IN;
}

export function lengthUnit(system: UnitSystem): string {
  return system === "metric" ? "cm" : "in";
}

export function formatDistance(km: number, system: UnitSystem): string {
  return system === "metric" ? `${km.toFixed(1)} km` : `${(km / KM_PER_MI).toFixed(1)} mi`;
}
