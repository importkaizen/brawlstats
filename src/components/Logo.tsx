import { cn } from "@/lib/utils";
import Link from "next/link";

export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center gap-2.5 rounded-sm text-lg font-semibold tracking-[-.06em] outline-none focus-visible:ring-2 focus-visible:ring-gold",
        className,
      )}
    >
      <svg aria-hidden width="25" height="25" viewBox="0 0 25 25" fill="none">
        <path
          d="M3 20V6l6 8 4-6 9 12"
          stroke="#E8C86A"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M22 5v7" stroke="#E8C86A" strokeWidth="3" />
      </svg>
      <span>
        myre<span className="text-muted-foreground">brawl</span>
        <span className="text-gold">.</span>
      </span>
    </Link>
  );
}
