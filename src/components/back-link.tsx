import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** A header back control. The destination is a fixed page, not browser history. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} className="-ml-1 inline-grid size-10 place-items-center text-white/80">
      <ArrowLeft className="size-5" aria-hidden />
    </Link>
  );
}
