import type { GoalType } from "@/lib/types";

export interface RepScheme {
  compound: [number, number];
  isolation: [number, number];
  compoundRestSec: number;
  isolationRestSec: number;
}

/** Structured rules behind each goal; the UI label is never used as logic. */
export interface GoalConfig {
  type: GoalType;
  label: string;
  tagline: string;
  priorities: string[];
  /** Weekly change as % of body weight, [min, max]. null = not appropriate in that direction. */
  lossRatePct: [number, number] | null;
  gainRatePct: [number, number] | null;
  /** Direction when no target weight is set. */
  defaultDirection: "loss" | "gain" | "maintain";
  proteinGPerKg: number;
  fatPctOfCalories: number;
  repScheme: RepScheme;
  conditioning: boolean;
  steps: number;
  /** Split preference when the generator has a choice. */
  prefersSplit: "full_body" | "upper_lower" | "ppl";
}

export const GOALS: Record<GoalType, GoalConfig> = {
  athletic: {
    type: "athletic",
    label: "Athletic Physique",
    tagline: "Muscular, lean, conditioned — built to move.",
    priorities: ["Muscle gain or maintenance", "Fat reduction", "Strength progression", "Conditioning", "High protein", "Daily activity"],
    lossRatePct: [0.25, 0.5],
    gainRatePct: [0.1, 0.25],
    defaultDirection: "maintain",
    proteinGPerKg: 2.0,
    fatPctOfCalories: 0.27,
    repScheme: { compound: [5, 8], isolation: [10, 15], compoundRestSec: 120, isolationRestSec: 60 },
    conditioning: true,
    steps: 10000,
    prefersSplit: "upper_lower",
  },
  lean: {
    type: "lean",
    label: "Lean & Defined",
    tagline: "Visible definition while keeping your muscle.",
    priorities: ["Fat loss", "Muscle retention", "Visible definition", "High protein", "Daily steps"],
    lossRatePct: [0.25, 0.6],
    gainRatePct: [0.1, 0.25],
    defaultDirection: "loss",
    proteinGPerKg: 2.0,
    fatPctOfCalories: 0.27,
    repScheme: { compound: [6, 10], isolation: [10, 15], compoundRestSec: 105, isolationRestSec: 60 },
    conditioning: true,
    steps: 10000,
    prefersSplit: "upper_lower",
  },
  bodybuilding: {
    type: "bodybuilding",
    label: "Bodybuilding Physique",
    tagline: "Size, symmetry and proportion.",
    priorities: ["Hypertrophy", "Training volume", "Muscle balance", "Calorie phases", "Progressive overload"],
    lossRatePct: [0.4, 0.8],
    gainRatePct: [0.25, 0.5],
    defaultDirection: "gain",
    proteinGPerKg: 2.0,
    fatPctOfCalories: 0.25,
    repScheme: { compound: [6, 10], isolation: [10, 15], compoundRestSec: 120, isolationRestSec: 75 },
    conditioning: false,
    steps: 8000,
    prefersSplit: "ppl",
  },
  strength: {
    type: "strength",
    label: "Strength Focus",
    tagline: "Lift heavier, move better.",
    priorities: ["Compound lifts", "Strength progression", "Recovery", "Technique", "Lower rep ranges"],
    lossRatePct: [0.25, 0.5],
    gainRatePct: [0.15, 0.35],
    defaultDirection: "maintain",
    proteinGPerKg: 1.8,
    fatPctOfCalories: 0.3,
    repScheme: { compound: [3, 6], isolation: [6, 10], compoundRestSec: 180, isolationRestSec: 90 },
    conditioning: false,
    steps: 8000,
    prefersSplit: "full_body",
  },
  fat_loss: {
    type: "fat_loss",
    label: "Fat Loss",
    tagline: "Lose fat steadily, keep strength.",
    priorities: ["Calorie deficit", "Protein", "Steps", "Resistance training", "Muscle retention"],
    lossRatePct: [0.5, 1.0],
    gainRatePct: null,
    defaultDirection: "loss",
    proteinGPerKg: 2.0,
    fatPctOfCalories: 0.28,
    repScheme: { compound: [8, 12], isolation: [12, 15], compoundRestSec: 90, isolationRestSec: 60 },
    conditioning: true,
    steps: 10000,
    prefersSplit: "full_body",
  },
  muscle_gain: {
    type: "muscle_gain",
    label: "Muscle Gain",
    tagline: "Build muscle with a controlled surplus.",
    priorities: ["Controlled surplus", "Hypertrophy", "Progressive overload", "Recovery"],
    lossRatePct: null,
    gainRatePct: [0.25, 0.5],
    defaultDirection: "gain",
    proteinGPerKg: 1.8,
    fatPctOfCalories: 0.27,
    repScheme: { compound: [6, 10], isolation: [10, 15], compoundRestSec: 120, isolationRestSec: 75 },
    conditioning: false,
    steps: 8000,
    prefersSplit: "upper_lower",
  },
  general: {
    type: "general",
    label: "General Fitness",
    tagline: "Feel better, move more, build habits.",
    priorities: ["Consistency", "Health", "Activity", "Basic strength", "Sustainable habits"],
    lossRatePct: [0.25, 0.5],
    gainRatePct: [0.1, 0.25],
    defaultDirection: "maintain",
    proteinGPerKg: 1.6,
    fatPctOfCalories: 0.3,
    repScheme: { compound: [8, 12], isolation: [10, 15], compoundRestSec: 90, isolationRestSec: 60 },
    conditioning: true,
    steps: 8000,
    prefersSplit: "full_body",
  },
  recomposition: {
    type: "recomposition",
    label: "Body Recomposition",
    tagline: "Lose fat and build muscle at the same time.",
    priorities: ["Small calorie adjustment", "High protein", "Resistance training", "Body measurements"],
    lossRatePct: [0.1, 0.25],
    gainRatePct: [0, 0.1],
    defaultDirection: "maintain",
    proteinGPerKg: 2.2,
    fatPctOfCalories: 0.27,
    repScheme: { compound: [6, 10], isolation: [10, 15], compoundRestSec: 120, isolationRestSec: 60 },
    conditioning: false,
    steps: 9000,
    prefersSplit: "upper_lower",
  },
};

export const GOAL_LIST = Object.values(GOALS);

export function goalConfig(type: GoalType): GoalConfig {
  return GOALS[type];
}

export const EXPERIENCE_LABELS = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
} as const;

export const LIFESTYLE_LABELS = {
  sedentary: "Mostly sitting",
  light: "Lightly active",
  moderate: "On my feet often",
  active: "Very active job",
} as const;

export const EQUIPMENT_LABELS = {
  full_gym: "Full gym",
  dumbbells: "Dumbbells at home",
  bodyweight: "Bodyweight only",
} as const;
