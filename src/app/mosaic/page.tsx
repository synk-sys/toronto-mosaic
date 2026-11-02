import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { MosaicExplorer } from "./MosaicExplorer";

export const metadata: Metadata = { title: "Explore the mosaic" };

export default function MosaicPage() {
  return (
    <>
      <SiteHeader
        right={
          <Link href="/" className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground">
            Add your tile
          </Link>
        }
      />
      <main id="main">
        <Suspense>
          <MosaicExplorer />
        </Suspense>
      </main>
    </>
  );
}
