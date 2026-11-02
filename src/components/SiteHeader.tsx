import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display font-bold tracking-tight", className)}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <rect x="1" y="1" width="10" height="10" rx="2.5" fill="#E8384F" />
        <rect x="13" y="1" width="10" height="10" rx="2.5" fill="#FFC93C" />
        <rect x="1" y="13" width="10" height="10" rx="2.5" fill="#2F8FFF" />
        <rect x="13" y="13" width="10" height="10" rx="2.5" fill="#2DBE7E" />
        <path d="M17.5 2.5v19" stroke="#0b0d2e" strokeWidth="1.6" />
      </svg>
      Toronto Mosaic
    </span>
  );
}

export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
      <Link href="/" className="rounded-lg" aria-label="Toronto Mosaic home">
        <Logo />
      </Link>
      <nav className="flex items-center gap-1 text-sm">{right}</nav>
    </header>
  );
}
