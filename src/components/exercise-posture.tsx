"use client";

import { useState } from "react";

/** The photographed posture for this exercise. A missing file hides itself. */
export function ExercisePosture({ id }: { id: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <img
      src={`/postures/${id}.jpg`}
      alt=""
      className="mb-3 aspect-[4/3] w-full rounded-control object-cover object-center"
      onError={() => setHidden(true)}
    />
  );
}
