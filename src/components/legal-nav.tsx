"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BackLink } from "./back-link";

const DEST: Record<string, string> = {
  "/signup": "Back to sign up",
  "/settings": "Back to settings",
  "/signin": "Back to sign in",
};

function useOrigin() {
  const from = useSearchParams().get("from");
  return from && from in DEST ? from : "/signin";
}

/** Returns to the page that opened the notice. A direct visit returns to sign-in. */
export function LegalBack() {
  const href = useOrigin();
  return <BackLink href={href} label={DEST[href] ?? "Back to sign in"} />;
}

/** Keeps the same return page when moving between the three notices. */
export function LegalFooter() {
  const href = useOrigin();
  const query = href === "/signin" ? "" : `?from=${encodeURIComponent(href)}`;
  return (
    <p className="mt-8 text-sm">
      <Link href={`/privacy${query}`} className="text-brand">Privacy</Link>
      {" · "}
      <Link href={`/terms${query}`} className="text-brand">Terms</Link>
      {" · "}
      <Link href={`/disclaimer${query}`} className="text-brand">Disclaimer</Link>
      {" · "}
      <Link href="/signin" className="text-brand">Sign in</Link>
    </p>
  );
}
