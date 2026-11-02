"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, LayoutGrid } from "lucide-react";
import { LiveCounter } from "@/components/LiveCounter";
import { MosaicViewer } from "@/components/mosaic/MosaicViewer";
import type { MosaicMode } from "@/components/mosaic/MosaicSvg";
import { useMosaicFeed } from "@/hooks/useMosaicFeed";
import { isValidTileId, TOTAL_TILES } from "@/lib/grid";
import { getColor } from "@/lib/palette";
import { cn } from "@/lib/utils";

export function MosaicExplorer() {
  const params = useSearchParams();
  const { state, tileMap, fresh, status } = useMosaicFeed();
  const [mode, setMode] = useState<MosaicMode>("art");
  const fromUrl = params.get("tile");
  const [stored, setStored] = useState<string | null>(null);
  useEffect(() => {
    try {
      const own = JSON.parse(localStorage.getItem("toronto-mosaic:own") ?? "null");
      // Browser-only value, applied after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (own?.tileId) setStored(own.tileId);
    } catch {}
  }, []);
  const mine = fromUrl && isValidTileId(fromUrl) ? fromUrl : stored;

  const revealed = state.config.revealMode === "revealed";
  const recent = [...state.tiles].reverse().filter((t) => t.message).slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">The Toronto Mosaic</h1>
          <p className="text-muted-foreground" aria-live="polite">
            <LiveCounter value={state.aggregates.totalContributions} className="font-semibold text-foreground" /> of {TOTAL_TILES} tiles
            lit · tap any tile to explore
            {status === "reconnecting" && <span className="ml-2 text-amber-200">· reconnecting…</span>}
          </p>
        </div>
        <div role="group" aria-label="View" className="flex rounded-full bg-white/10 p-1">
          {(
            [
              ["art", "Skyline", Building2],
              ["tiles", "Tiles", LayoutGrid],
            ] as const
          ).map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition",
                mode === m ? "bg-white text-[#1a1033]" : "text-white/80 hover:text-white",
              )}
            >
              <Icon className="size-4" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </div>

      <MosaicViewer tiles={tileMap} mode={mode} revealed={revealed} fresh={fresh} highlight={mine} className="shadow-2xl" />

      {recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="space-y-2">
          <h2 id="recent-heading" className="font-display text-lg font-semibold">
            Futures people would love to see
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {recent.map((t) => (
              <li key={t.tileId} className="flex items-start gap-3 rounded-2xl bg-white/5 p-3">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-xl text-xl"
                  style={{ background: getColor(t.color).hex }}
                  aria-hidden="true"
                >
                  {t.symbol}
                </span>
                <p className="text-sm leading-snug">“{t.message}”</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
