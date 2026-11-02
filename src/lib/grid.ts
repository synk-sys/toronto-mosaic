export const COLS = 20;
export const ROWS = 15;
export const TOTAL_TILES = COLS * ROWS; // 300
export const TILE = 100; // SVG units per tile
export const ART_W = COLS * TILE; // 2000
export const ART_H = ROWS * TILE; // 1500

export type TileId = string; // "r07c12"

export function tileId(row: number, col: number): TileId {
  return `r${String(row).padStart(2, "0")}c${String(col).padStart(2, "0")}`;
}

export function parseTileId(id: string): { row: number; col: number } | null {
  const m = /^r(\d{2})c(\d{2})$/.exec(id);
  if (!m) return null;
  const row = Number(m[1]);
  const col = Number(m[2]);
  if (row >= ROWS || col >= COLS) return null;
  return { row, col };
}

export function isValidTileId(id: string) {
  return parseTileId(id) !== null;
}

export const ALL_TILE_IDS: TileId[] = Array.from({ length: TOTAL_TILES }, (_, i) =>
  tileId(Math.floor(i / COLS), i % COLS),
);

/** Human-friendly label: "Row 8 · Column 13". */
export function tileLabel(id: string) {
  const p = parseTileId(id);
  return p ? `Row ${p.row + 1} · Column ${p.col + 1}` : id;
}

/** Bayer (ordered-dither) rank of a cell inside a 32×32 matrix. */
function bayerRank(x: number, y: number, bits = 5) {
  let v = 0;
  // Least-significant bits first (bit-reversed interleave) so neighbouring
  // cells get far-apart ranks.
  for (let bit = 0; bit < bits; bit++) {
    const xb = (x >> bit) & 1;
    const yb = (y >> bit) & 1;
    // Interleave (x xor y, y) bits — classic recursive Bayer construction.
    v = (v << 2) | (((xb ^ yb) << 1) | yb);
  }
  return v;
}

/**
 * Fill order for tiles. Ordered-dither ranking means any prefix of this list
 * (e.g. the first 87 contributions) is spread evenly across the whole
 * skyline, so the artwork looks intentional at every participation level.
 */
export const ALLOCATION_ORDER: TileId[] = [...ALL_TILE_IDS].sort((a, b) => {
  const pa = parseTileId(a)!;
  const pb = parseTileId(b)!;
  return bayerRank(pa.col, pa.row) - bayerRank(pb.col, pb.row) || a.localeCompare(b);
});

/**
 * Choose a candidate tile. Picking randomly among the first `window` free
 * tiles (instead of always the first) keeps the even spread while making it
 * unlikely that concurrent submissions race for the same tile.
 */
export function pickCandidate(
  occupied: ReadonlySet<string>,
  exclude: ReadonlySet<string> = new Set(),
  window = 12,
  rand: () => number = Math.random,
): TileId | null {
  const free: TileId[] = [];
  for (const id of ALLOCATION_ORDER) {
    if (!occupied.has(id) && !exclude.has(id)) {
      free.push(id);
      if (free.length >= window) break;
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(rand() * free.length)];
}

/** Distance (in tiles) from the CN Tower pod — used to stagger reveal waves. */
export function revealDelayRank(id: string) {
  const p = parseTileId(id);
  if (!p) return 0;
  const dx = p.col - 6.2;
  const dy = p.row - 4.5;
  return Math.sqrt(dx * dx + dy * dy);
}
