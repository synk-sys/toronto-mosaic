"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isFirebaseMode } from "@/lib/env";
import { getClientFirestore } from "@/lib/client/firebase";
import { TOTAL_TILES } from "@/lib/grid";
import { defaultMotif, type Motif } from "@/lib/palette";
import { DEFAULT_CONFIG, type PublicMosaicState, type PublicTile } from "@/lib/types";

export type FeedStatus = "loading" | "live" | "reconnecting";

const EMPTY: PublicMosaicState = {
  config: DEFAULT_CONFIG,
  aggregates: {
    totalContributions: 0,
    approvedContributions: 0,
    pendingContributions: 0,
    remainingTiles: TOTAL_TILES,
    lastUpdated: new Date(0).toISOString(),
  },
  tiles: [],
};

/**
 * Live public mosaic state.
 * Firebase mode: Firestore realtime listeners on the public collections.
 * Local mode: polls /api/mosaic (pauses while the tab is hidden).
 */
export function useMosaicFeed(opts: { initial?: PublicMosaicState; pollMs?: number; disabled?: boolean } = {}) {
  const [state, setState] = useState<PublicMosaicState>(opts.initial ?? EMPTY);
  const [status, setStatus] = useState<FeedStatus>(opts.initial ? "live" : "loading");
  const pollMs = opts.pollMs ?? 2500;

  useEffect(() => {
    if (opts.disabled) return;
    let cancelled = false;

    if (isFirebaseMode()) {
      const unsubs: (() => void)[] = [];
      (async () => {
        const db = await getClientFirestore();
        if (!db || cancelled) return;
        const { collection, doc, onSnapshot, query, where } = await import("firebase/firestore");
        const onErr = () => setStatus("reconnecting");
        unsubs.push(
          onSnapshot(
            query(collection(db, "tiles"), where("occupied", "==", true)),
            (snap) => {
              const tiles: PublicTile[] = snap.docs
                .map((d) => {
                  const t = d.data();
                  return {
                    tileId: d.id,
                    contributionId: t.contributionId,
                    color: t.displayColor,
                    symbol: t.displaySymbol,
                    message: t.displayMessage ?? null,
                    caption: t.displayCaption ?? null,
                    motif: (t.displayMotif as Motif) ?? defaultMotif(t.displaySymbol),
                    seq: t.seq ?? 0,
                  };
                })
                .sort((a, b) => a.seq - b.seq);
              setState((s) => ({ ...s, tiles }));
              setStatus("live");
            },
            onErr,
          ),
          onSnapshot(
            doc(db, "eventConfig", "main"),
            (snap) => {
              if (!snap.exists()) return;
              const { updatedAt: _u, ...config } = snap.data();
              void _u;
              setState((s) => ({ ...s, config: { ...DEFAULT_CONFIG, ...config } }));
            },
            onErr,
          ),
          onSnapshot(
            doc(db, "aggregates", "main"),
            (snap) => {
              if (!snap.exists()) return;
              const a = snap.data();
              setState((s) => ({
                ...s,
                aggregates: {
                  totalContributions: a.totalContributions ?? 0,
                  approvedContributions: a.approvedContributions ?? 0,
                  pendingContributions: a.pendingContributions ?? 0,
                  remainingTiles: a.remainingTiles ?? TOTAL_TILES,
                  lastUpdated: a.lastUpdated?.toDate?.().toISOString?.() ?? new Date().toISOString(),
                },
              }));
            },
            onErr,
          ),
        );
      })().catch(() => setStatus("reconnecting"));
      return () => {
        cancelled = true;
        unsubs.forEach((u) => u());
      };
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        timer = setTimeout(tick, pollMs);
        return;
      }
      try {
        const res = await fetch("/api/mosaic", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as PublicMosaicState;
        if (!cancelled) {
          setState(next);
          setStatus("live");
          failures = 0;
        }
      } catch {
        failures++;
        if (!cancelled) setStatus("reconnecting");
      }
      timer = setTimeout(tick, Math.min(pollMs * 2 ** failures, 20_000));
    };
    tick();
    const onVis = () => document.visibilityState === "visible" && (clearTimeout(timer), tick());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [opts.disabled, pollMs]);

  return { state, setState, status, ...useTileIndex(state.tiles) };
}

/** Map of tiles + set of tiles that appeared since the previous update (for animations). */
export function useTileIndex(tiles: PublicTile[]) {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const map = useMemo(() => new Map(tiles.map((t) => [t.tileId, t])), [tiles]);

  useEffect(() => {
    const ids = new Set(tiles.map((t) => t.tileId));
    if (seen.current === null) {
      seen.current = ids; // first load: no "new tile" animation storm
      return;
    }
    const added = [...ids].filter((id) => !seen.current!.has(id));
    seen.current = ids;
    // Bulk arrivals (reconnects, demo fills) skip the pop so the projector never janks.
    if (added.length === 0 || added.length > 12) return;
    setFresh(new Set(added));
    const t = setTimeout(() => setFresh(new Set()), 1600);
    return () => clearTimeout(t);
  }, [tiles]);

  return { tileMap: map, fresh };
}
