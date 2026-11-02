import { MemoryDb } from "@/lib/server/db";
import { MosaicService } from "@/lib/server/mosaic-service";

export function makeService(opts: { jitter?: boolean } = {}) {
  const db = new MemoryDb({ jitter: opts.jitter ?? true, maxAttempts: 60 });
  // Disable caches so tests observe writes immediately.
  const service = new MosaicService(db, { publicCacheMs: 0, occupiedCacheMs: 0 });
  return { db, service };
}

export const sub = (message = "", color = "lake", symbol = "🍁") =>
  ({ color, symbol, message }) as { color: "lake"; symbol: string; message: string };
