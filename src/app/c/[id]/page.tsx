import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { TileCardSvg } from "@/components/mosaic/TileCardSvg";
import { Button } from "@/components/ui/button";
import { getService } from "@/lib/server/context";
import { tileLabel } from "@/lib/grid";
import { getColor } from "@/lib/palette";
import { ShareClient } from "./ShareClient";

export const dynamic = "force-dynamic";

async function load(id: string) {
  // Server render shows the public view; the owner's own pending message is loaded client-side.
  return (await getService()).getPublicContribution(id, null);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const c = await load((await params).id);
  if (!c) return { title: "Tile not found" };
  return {
    title: `${c.symbol} A tile in the Toronto skyline`,
    description: c.message ?? "One of 300 tiles in the Toronto Mosaic at DevFest Toronto 2026.",
    robots: { index: false },
  };
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await load(id);
  if (!c) notFound();
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-xl space-y-5 px-4 pb-10">
        <h1 className="font-display text-3xl font-bold">
          A {getColor(c.color).name.toLowerCase()} tile in the Toronto skyline
        </h1>
        <p className="text-muted-foreground">{c.tileId ? tileLabel(c.tileId) : ""} · Toronto Mosaic, DevFest Toronto 2026</p>
        <ShareClient id={id} initial={c}>
          <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
            <TileCardSvg
              color={c.color}
              symbol={c.symbol}
              message={c.message}
              caption={c.caption}
              motif={c.motif}
              tileId={c.tileId}
              className="block h-auto w-full"
            />
          </div>
        </ShareClient>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild size="lg">
            <Link href="/">Add your own tile</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={`/mosaic?tile=${c.tileId}`}>See it in the mosaic</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
