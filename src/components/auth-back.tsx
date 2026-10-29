"use client";

import { usePathname } from "next/navigation";
import { BackLink } from "./back-link";

/** Pages that sit in front of sign-in. Sign-in itself is the start, so it has no back control. */
const DEST: Record<string, string> = {
  "/signup": "/signin",
  "/forgot": "/signin",
  "/reset": "/signin",
};

export function AuthBack() {
  const pathname = usePathname();
  const href = DEST[pathname];
  if (!href) return null;
  return <BackLink href={href} label="Back to sign in" />;
}
