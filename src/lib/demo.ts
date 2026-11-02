import { ALLOCATION_ORDER, TOTAL_TILES } from "./grid";
import { COLORS, SYMBOLS } from "./palette";
import type { PublicMosaicState, PublicTile } from "./types";
import { DEFAULT_CONFIG } from "./types";

/**
 * Synthetic data for rehearsals. Demo data is generated client-side for the
 * projector (never written to the real event database) and is always
 * labelled as DEMO on screen so participant counts are never fabricated.
 */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_MESSAGES = [
  "Transit that connects every neighbourhood",
  "A city where everyone can afford to live",
  "Clean lake water we can all swim in",
  "Tech that makes people kinder",
  "More trees on every street",
  "Bike lanes from Scarborough to Etobicoke",
  "Open data for everyone",
  "AI that helps doctors save lives",
  "Every kid learning to code",
  "Green roofs on every tower",
  "A night market every weekend",
  "Communities that look after each other",
  "Zero-emission streetcars",
  "Free Wi-Fi in every library",
  "More women leading in tech",
  "Accessible design by default",
  "",
  "",
  "",
];

export function syntheticSubmission(seed: number) {
  const r = mulberry32(seed);
  return {
    color: COLORS[Math.floor(r() * COLORS.length)].id,
    symbol: SYMBOLS[Math.floor(r() * SYMBOLS.length)].char,
    message: DEMO_MESSAGES[Math.floor(r() * DEMO_MESSAGES.length)],
  };
}

/** Build the first `count` synthetic tiles in allocation order. */
export function syntheticTiles(count: number, seed = 2026): PublicTile[] {
  const n = Math.min(count, TOTAL_TILES);
  // Shuffle within small windows so demo order resembles real allocation.
  const order = [...ALLOCATION_ORDER];
  const r = mulberry32(seed);
  for (let i = 0; i < order.length; i += 12) {
    const chunk = order.slice(i, i + 12);
    for (let j = chunk.length - 1; j > 0; j--) {
      const k = Math.floor(r() * (j + 1));
      [chunk[j], chunk[k]] = [chunk[k], chunk[j]];
    }
    order.splice(i, chunk.length, ...chunk);
  }
  return order.slice(0, n).map((tileId, i) => {
    const s = syntheticSubmission(seed * 1000 + i);
    const sym = SYMBOLS.find((x) => x.char === s.symbol)!;
    return {
      tileId,
      contributionId: `demo-${i}`,
      color: s.color,
      symbol: s.symbol,
      message: s.message || null,
      caption: null,
      motif: sym.motif,
      seq: i + 1,
    };
  });
}

export function syntheticState(count: number, revealed = false): PublicMosaicState {
  const tiles = syntheticTiles(count);
  return {
    demo: true,
    config: { ...DEFAULT_CONFIG, revealMode: revealed ? "revealed" : "collecting" },
    aggregates: {
      totalContributions: tiles.length,
      approvedContributions: tiles.length,
      pendingContributions: 0,
      remainingTiles: TOTAL_TILES - tiles.length,
      lastUpdated: new Date().toISOString(),
    },
    tiles,
  };
}
