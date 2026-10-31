import type { BodyRegion } from "./muscle-map";

/** A named muscle on the training map. The region is only where the body figure lights up. */
export interface AnatomyMuscle {
  id: string;
  name: string;
  region: BodyRegion;
  role: string;
}

export const MUSCLES: AnatomyMuscle[] = [
  { id: "pec-sternal", name: "Pectoralis major, sternocostal", region: "pecs", role: "Mid and lower chest. Flat pressing and flyes." },
  { id: "pec-clavicular", name: "Pectoralis major, clavicular", region: "upperPecs", role: "Upper chest. Incline pressing." },
  { id: "latissimus", name: "Latissimus dorsi", region: "lats", role: "Vertical and horizontal pulling." },
  { id: "teres-major", name: "Teres major", region: "lats", role: "Helps the lats on pulldowns and rows." },
  { id: "trapezius", name: "Trapezius", region: "traps", role: "Upper and mid back. Rows, pulls, and carries." },
  { id: "rhomboids", name: "Rhomboids", region: "traps", role: "Pull the shoulder blades together on rows." },
  { id: "erectors", name: "Erector spinae", region: "lowerBack", role: "Spinal erectors on hinges and carries." },
  { id: "deltoid-anterior", name: "Anterior deltoid", region: "delts", role: "Front of the shoulder. Pressing overhead and in front." },
  { id: "deltoid-lateral", name: "Lateral deltoid", region: "delts", role: "Side of the shoulder. Raises out to the side." },
  { id: "deltoid-posterior", name: "Posterior deltoid", region: "rearDelts", role: "Rear shoulder. Reverse flies and face pulls." },
  { id: "rotator-cuff", name: "Rotator cuff", region: "rearDelts", role: "Shoulder-health muscles. Face pulls, not a size muscle." },
  { id: "biceps", name: "Biceps brachii", region: "biceps", role: "Elbow flexion with the palm up." },
  { id: "brachialis", name: "Brachialis", region: "biceps", role: "Elbow flexion under the biceps. Neutral-grip curls." },
  { id: "brachioradialis", name: "Brachioradialis", region: "forearms", role: "Forearm muscle on hammer curls and holds." },
  { id: "triceps", name: "Triceps", region: "triceps", role: "Elbow extension. Pushdowns, dips, and presses." },
  { id: "triceps-long", name: "Triceps, long head", region: "triceps", role: "The long head, worked more when the arm is overhead." },
  { id: "forearm-flexors", name: "Forearm flexors", region: "forearms", role: "Grip and wrist flexion on pulls and curls." },
  { id: "quadriceps", name: "Quadriceps", region: "quads", role: "Front of the thigh. Squats, lunges, and leg extensions." },
  { id: "hamstrings", name: "Hamstrings", region: "hamstrings", role: "Back of the thigh. Curls and hip hinges." },
  { id: "glute-max", name: "Gluteus maximus", region: "glutes", role: "Hip extension. Squats, hinges, and hip thrusts." },
  { id: "glute-medius", name: "Gluteus medius", region: "glutes", role: "Side of the hip. Split squats and lunges." },
  { id: "gastrocnemius", name: "Gastrocnemius", region: "calves", role: "Calf with a straight knee. Standing raises." },
  { id: "soleus", name: "Soleus", region: "calves", role: "Deeper calf. More involved when the knee is bent." },
  { id: "rectus-abdominis", name: "Rectus abdominis", region: "abs", role: "Front of the trunk. Crunches and leg raises." },
  { id: "obliques", name: "Obliques", region: "obliques", role: "Sides of the trunk." },
  { id: "transverse", name: "Transverse abdominis", region: "abs", role: "Deep trunk brace. Planks and dead bugs." },
  { id: "hip-flexors", name: "Hip flexors", region: "abs", role: "Front of the hip. Hanging leg raises." },
];

const byId = new Map(MUSCLES.map((muscle) => [muscle.id, muscle]));

export function muscleById(id: string): AnatomyMuscle | null {
  return byId.get(id) ?? null;
}

/** Primary and secondary muscles an exercise is meant to train. Not a scan, and not a growth measurement. */
const WORK: Record<string, { primary: string[]; secondary: string[] }> = {
  "bench-press": { primary: ["pec-sternal"], secondary: ["pec-clavicular", "deltoid-anterior", "triceps"] },
  "db-bench-press": { primary: ["pec-sternal"], secondary: ["pec-clavicular", "deltoid-anterior", "triceps"] },
  "incline-db-press": { primary: ["pec-clavicular"], secondary: ["pec-sternal", "deltoid-anterior", "triceps"] },
  "push-up": { primary: ["pec-sternal"], secondary: ["deltoid-anterior", "triceps", "rectus-abdominis"] },
  "cable-fly": { primary: ["pec-sternal"], secondary: ["pec-clavicular"] },
  "db-fly": { primary: ["pec-sternal"], secondary: ["pec-clavicular"] },
  deadlift: { primary: ["hamstrings", "glute-max", "erectors"], secondary: ["trapezius", "quadriceps", "forearm-flexors"] },
  "pull-up": { primary: ["latissimus"], secondary: ["biceps", "teres-major", "deltoid-posterior"] },
  "barbell-row": { primary: ["latissimus", "rhomboids"], secondary: ["trapezius", "biceps"] },
  "db-row": { primary: ["latissimus"], secondary: ["rhomboids", "biceps"] },
  "inverted-row": { primary: ["latissimus"], secondary: ["rhomboids", "biceps"] },
  "lat-pulldown": { primary: ["latissimus"], secondary: ["biceps", "teres-major"] },
  "seated-cable-row": { primary: ["latissimus", "rhomboids"], secondary: ["trapezius", "biceps"] },
  "db-pullover": { primary: ["latissimus"], secondary: ["pec-sternal", "triceps"] },
  "back-squat": { primary: ["quadriceps", "glute-max"], secondary: ["hamstrings"] },
  "goblet-squat": { primary: ["quadriceps", "glute-max"], secondary: ["hamstrings"] },
  "bodyweight-squat": { primary: ["quadriceps", "glute-max"], secondary: ["hamstrings"] },
  "leg-press": { primary: ["quadriceps", "glute-max"], secondary: ["hamstrings"] },
  "romanian-deadlift": { primary: ["hamstrings", "glute-max"], secondary: ["erectors"] },
  "db-rdl": { primary: ["hamstrings", "glute-max"], secondary: ["erectors"] },
  "glute-bridge": { primary: ["glute-max"], secondary: ["hamstrings"] },
  "hip-thrust": { primary: ["glute-max"], secondary: ["hamstrings"] },
  "walking-lunge": { primary: ["quadriceps", "glute-max"], secondary: ["hamstrings", "glute-medius"] },
  "split-squat": { primary: ["quadriceps", "glute-max"], secondary: ["hamstrings", "glute-medius"] },
  "reverse-lunge": { primary: ["quadriceps", "glute-max"], secondary: ["hamstrings", "glute-medius"] },
  "leg-extension": { primary: ["quadriceps"], secondary: [] },
  "leg-curl": { primary: ["hamstrings"], secondary: [] },
  "calf-raise": { primary: ["gastrocnemius"], secondary: ["soleus"] },
  "overhead-press": { primary: ["deltoid-anterior"], secondary: ["deltoid-lateral", "triceps", "pec-clavicular"] },
  "db-shoulder-press": { primary: ["deltoid-anterior"], secondary: ["deltoid-lateral", "triceps", "pec-clavicular"] },
  "pike-push-up": { primary: ["deltoid-anterior"], secondary: ["triceps", "pec-clavicular"] },
  "lateral-raise": { primary: ["deltoid-lateral"], secondary: [] },
  "face-pull": { primary: ["deltoid-posterior", "rotator-cuff"], secondary: ["trapezius"] },
  "reverse-fly": { primary: ["deltoid-posterior"], secondary: ["rhomboids", "trapezius"] },
  "barbell-curl": { primary: ["biceps"], secondary: ["forearm-flexors"] },
  "hammer-curl": { primary: ["brachialis", "brachioradialis"], secondary: ["biceps"] },
  "tricep-pushdown": { primary: ["triceps"], secondary: [] },
  "overhead-db-extension": { primary: ["triceps-long"], secondary: ["triceps"] },
  dips: { primary: ["triceps", "pec-sternal"], secondary: ["deltoid-anterior"] },
  plank: { primary: ["rectus-abdominis", "transverse"], secondary: ["obliques"] },
  "dead-bug": { primary: ["rectus-abdominis", "transverse"], secondary: ["obliques"] },
  "hanging-leg-raise": { primary: ["rectus-abdominis", "hip-flexors"], secondary: ["obliques"] },
  "cable-crunch": { primary: ["rectus-abdominis"], secondary: ["obliques"] },
  "kettlebell-swing": { primary: ["glute-max", "hamstrings"], secondary: ["rectus-abdominis"] },
  burpee: { primary: ["quadriceps", "pec-sternal"], secondary: ["deltoid-anterior"] },
  "mountain-climber": { primary: ["rectus-abdominis", "quadriceps"], secondary: [] },
  thruster: { primary: ["quadriceps", "deltoid-anterior"], secondary: ["glute-max", "triceps"] },
  running: { primary: ["quadriceps", "gastrocnemius"], secondary: ["hamstrings"] },
  rowing: { primary: ["latissimus", "quadriceps"], secondary: ["biceps", "erectors"] },
  cycling: { primary: ["quadriceps"], secondary: ["gastrocnemius", "hamstrings"] },
  "jump-rope": { primary: ["gastrocnemius", "soleus"], secondary: ["quadriceps"] },
  "mobility-flow": { primary: [], secondary: ["glute-max", "pec-sternal", "deltoid-anterior"] },
  "chin-up": { primary: ["latissimus", "biceps"], secondary: ["teres-major"] },
  "chest-supported-row": { primary: ["latissimus", "rhomboids"], secondary: ["biceps"] },
  "t-bar-row": { primary: ["latissimus", "rhomboids"], secondary: ["trapezius", "biceps"] },
  "straight-arm-pulldown": { primary: ["latissimus"], secondary: [] },
  "back-extension": { primary: ["erectors", "glute-max"], secondary: ["hamstrings"] },
  "incline-barbell-press": { primary: ["pec-clavicular"], secondary: ["pec-sternal", "deltoid-anterior", "triceps"] },
  "machine-chest-press": { primary: ["pec-sternal"], secondary: ["deltoid-anterior", "triceps"] },
  "pec-deck": { primary: ["pec-sternal"], secondary: ["pec-clavicular"] },
  "db-curl": { primary: ["biceps"], secondary: ["forearm-flexors"] },
  "alternating-db-curl": { primary: ["biceps"], secondary: ["forearm-flexors"] },
  "preacher-curl": { primary: ["biceps"], secondary: [] },
  "incline-db-curl": { primary: ["biceps"], secondary: [] },
  "cable-curl": { primary: ["biceps"], secondary: ["forearm-flexors"] },
  "concentration-curl": { primary: ["biceps"], secondary: [] },
  "rope-pushdown": { primary: ["triceps"], secondary: [] },
  "overhead-cable-extension": { primary: ["triceps-long"], secondary: ["triceps"] },
  "skull-crusher": { primary: ["triceps"], secondary: [] },
  "close-grip-bench": { primary: ["triceps", "pec-sternal"], secondary: ["deltoid-anterior"] },
  "bench-dip": { primary: ["triceps"], secondary: ["pec-sternal", "deltoid-anterior"] },
  "diamond-push-up": { primary: ["triceps", "pec-sternal"], secondary: ["deltoid-anterior"] },
  "lying-leg-curl": { primary: ["hamstrings"], secondary: [] },
  "seated-leg-curl": { primary: ["hamstrings"], secondary: [] },
  "seated-calf-raise": { primary: ["soleus"], secondary: ["gastrocnemius"] },
  "cable-glute-kickback": { primary: ["glute-max"], secondary: ["hamstrings"] },
  "hip-abduction": { primary: ["glute-medius"], secondary: [] },
  "db-step-up": { primary: ["quadriceps", "glute-max"], secondary: ["hamstrings"] },
  "single-leg-glute-bridge": { primary: ["glute-max"], secondary: ["hamstrings"] },
  "side-plank": { primary: ["obliques"], secondary: ["rectus-abdominis", "transverse"] },
  "bird-dog": { primary: ["erectors", "rectus-abdominis"], secondary: ["glute-max"] },
  "crunch": { primary: ["rectus-abdominis"], secondary: [] },
  "reverse-crunch": { primary: ["rectus-abdominis"], secondary: ["hip-flexors"] },
  "hanging-knee-raise": { primary: ["rectus-abdominis", "hip-flexors"], secondary: [] },
  "ab-wheel": { primary: ["rectus-abdominis", "transverse"], secondary: ["obliques"] },
  "wrist-curl": { primary: ["forearm-flexors"], secondary: [] },
  "reverse-wrist-curl": { primary: ["brachioradialis"], secondary: ["forearm-flexors"] },
  "reverse-curl": { primary: ["brachioradialis"], secondary: ["biceps", "forearm-flexors"] },
  "farmers-carry": { primary: ["forearm-flexors", "trapezius"], secondary: ["rectus-abdominis"] },
  "dead-hang": { primary: ["forearm-flexors", "latissimus"], secondary: ["deltoid-posterior"] },
  "wrist-roller": { primary: ["forearm-flexors"], secondary: ["brachioradialis"] },
  "machine-shoulder-press": { primary: ["deltoid-anterior"], secondary: ["deltoid-lateral", "triceps"] },
  "cable-lateral-raise": { primary: ["deltoid-lateral"], secondary: [] },
  "front-raise": { primary: ["deltoid-anterior"], secondary: [] },
  "reverse-pec-deck": { primary: ["deltoid-posterior"], secondary: ["rhomboids", "trapezius"] },
  "db-shrug": { primary: ["trapezius"], secondary: [] },
  "treadmill-walk": { primary: ["quadriceps", "gastrocnemius"], secondary: ["hamstrings"] },
  "treadmill-jog": { primary: ["quadriceps", "gastrocnemius"], secondary: ["hamstrings"] },
  "elliptical": { primary: ["quadriceps"], secondary: ["glute-max", "hamstrings"] },
  "stair-climber": { primary: ["quadriceps", "glute-max"], secondary: ["gastrocnemius"] },
  "outdoor-cycling": { primary: ["quadriceps"], secondary: ["gastrocnemius", "hamstrings"] },
};

function named(ids: string[]): AnatomyMuscle[] {
  return ids.map((id) => byId.get(id)).filter((muscle): muscle is AnatomyMuscle => muscle != null);
}

export function musclesFor(exerciseId: string): { primary: AnatomyMuscle[]; secondary: AnatomyMuscle[] } {
  const row = WORK[exerciseId] ?? { primary: [], secondary: [] };
  return { primary: named(row.primary), secondary: named(row.secondary) };
}

export function exerciseWorks(exerciseId: string, muscleId: string): boolean {
  const row = WORK[exerciseId];
  if (!row) return false;
  return row.primary.includes(muscleId) || row.secondary.includes(muscleId);
}

export function muscleNames(exerciseId: string): { primary: string; secondary: string } {
  const { primary, secondary } = musclesFor(exerciseId);
  return {
    primary: primary.map((muscle) => muscle.name).join(", "),
    secondary: secondary.map((muscle) => muscle.name).join(", "),
  };
}
