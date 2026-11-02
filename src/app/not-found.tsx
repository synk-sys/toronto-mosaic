import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-xl space-y-4 px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-bold">This tile isn&apos;t here</h1>
        <p className="text-muted-foreground">It may have been removed, or the link is incomplete.</p>
        <Link href="/mosaic" className="inline-block rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground">
          Explore the mosaic
        </Link>
      </main>
    </>
  );
}
