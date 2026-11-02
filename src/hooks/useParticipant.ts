"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ensureSession, withRetry } from "@/lib/client/api";
import type { OwnContribution } from "@/lib/types";

const CACHE_KEY = "toronto-mosaic:own";

function readCache(): OwnContribution | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
  } catch {
    return null;
  }
}

/**
 * Anonymous participant session + their contribution. The server is the
 * source of truth; localStorage only paints the "your tile" state instantly
 * after a refresh while the server confirms it.
 */
export function useParticipant() {
  const [ready, setReady] = useState(false);
  const [own, setOwnState] = useState<OwnContribution | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setOwn = useCallback((c: OwnContribution | null) => {
    setOwnState(c);
    try {
      if (c) localStorage.setItem(CACHE_KEY, JSON.stringify(c));
      else localStorage.removeItem(CACHE_KEY);
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    const { contribution } = await api<{ contribution: OwnContribution | null }>("/api/contributions/me");
    setOwn(contribution);
    return contribution;
  }, [setOwn]);

  useEffect(() => {
    const cached = readCache();
    // Browser-only cache, applied after hydration so server and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cached) setOwnState(cached);
    (async () => {
      try {
        await withRetry(() => ensureSession());
        await withRetry(refresh);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setReady(true);
      }
    })();
  }, [refresh]);

  return { ready, own, setOwn, refresh, error };
}
