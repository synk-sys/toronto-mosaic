import type { CSSProperties } from "react";
import { ALL_TILE_IDS, ART_H, ART_W, COLS, ROWS, TILE, parseTileId, revealDelayRank } from "@/lib/grid";
import { getColor } from "@/lib/palette";
import type { PublicTile } from "@/lib/types";
import { SKYLINE_ART, SKYLINE_DEFS } from "@/lib/art/skyline";

export type MosaicMode = "tiles" | "art";

export interface MosaicSvgProps {
  tiles: ReadonlyMap<string, PublicTile>;
  /** "tiles" = individual mosaic pieces; "art" = seamless skyline artwork. */
  mode: MosaicMode;
  /** Lift the veil on unclaimed tiles so the finished artwork reads as complete. */
  revealed?: boolean;
  highlight?: string | null;
  focused?: string | null;
  fresh?: ReadonlySet<string>;
  showSymbols?: boolean;
  /** Embed defs + artwork so the markup renders on its own (export). */
  standalone?: boolean;
  /** Milliseconds per tile of distance from the CN Tower for wave transitions. */
  waveMs?: number;
  viewBox?: string;
  className?: string;
  title?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

const EMOJI_FONT = `"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
const GROUT = (() => {
  let d = "";
  for (let c = 1; c < COLS; c++) d += `M${c * TILE} 0V${ART_H}`;
  for (let r = 1; r < ROWS; r++) d += `M0 ${r * TILE}H${ART_W}`;
  return d;
})();

const vars = (o: Record<string, string | number>) => o as CSSProperties;

/**
 * Pure presentational mosaic (no hooks) — safe for renderToStaticMarkup.
 * All animated properties are inline styles so CSS transitions interpolate
 * between modes and the exported markup captures the exact final state.
 */
export function MosaicSvg({
  tiles,
  mode,
  revealed = false,
  highlight,
  focused,
  fresh,
  showSymbols = true,
  standalone = false,
  waveMs = 0,
  viewBox = `0 0 ${ART_W} ${ART_H}`,
  className,
  title,
  width,
  height,
  x,
  y,
}: MosaicSvgProps) {
  const art = mode === "art";
  const label = title ?? `Toronto skyline mosaic: ${tiles.size} of ${ALL_TILE_IDS.length} tiles contributed`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      className={className}
      width={width}
      height={height}
      x={x}
      y={y}
      role="img"
      aria-label={label}
      data-mode={mode}
      data-revealed={revealed ? "true" : "false"}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{label}</title>
      {standalone && <defs dangerouslySetInnerHTML={{ __html: SKYLINE_DEFS + SKYLINE_ART }} />}
      <use href="#skyline" />
      <rect className="mt-anim" width={ART_W} height={ART_H} fill="#05061a" style={{ opacity: art ? 0 : 1 }} />
      <g>
        {ALL_TILE_IDS.map((id) => {
          const p = parseTileId(id)!;
          const tx = p.col * TILE;
          const ty = p.row * TILE;
          const t = tiles.get(id);
          const delay = waveMs ? Math.round(revealDelayRank(id) * waveMs) : 0;
          const style = vars({ "--d": delay });
          if (!t) {
            return (
              <g key={id} data-tile={id} style={style}>
                <rect
                  className="mt-anim"
                  x={tx}
                  y={ty}
                  width={TILE}
                  height={TILE}
                  fill="#070820"
                  style={{ opacity: art ? (revealed ? 0 : 0.55) : 0 }}
                />
                <rect
                  className="mt-anim mt-scale"
                  x={tx + 4}
                  y={ty + 4}
                  width={TILE - 8}
                  height={TILE - 8}
                  rx={12}
                  fill="#11132e"
                  stroke="#2a2d55"
                  strokeWidth={2}
                  style={{ opacity: art ? 0 : 1 }}
                />
              </g>
            );
          }
          const color = getColor(t.color);
          const isFresh = fresh?.has(id);
          const scale = art ? undefined : "scale(0.92)";
          return (
            <g key={id} data-tile={id} data-color={t.color} className={isFresh ? "mt-fresh" : undefined} style={style}>
              <rect className="mt-anim" x={tx} y={ty} width={TILE} height={TILE} fill={`url(#art-${color.id})`} style={{ opacity: art ? 1 : 0 }} />
              <rect
                className="mt-anim mt-scale"
                x={tx}
                y={ty}
                width={TILE}
                height={TILE}
                rx={art ? 0 : 14}
                fill={color.hex}
                style={{ opacity: art ? 0 : 1, transform: scale }}
              />
              <rect
                className="mt-anim mt-scale"
                x={tx}
                y={ty}
                width={TILE}
                height={TILE}
                rx={art ? 0 : 14}
                fill={`url(#motif-${t.motif})`}
                style={{ opacity: art ? 0.13 : 0.3, transform: scale }}
              />
              <rect
                className="mt-anim mt-scale"
                x={tx}
                y={ty}
                width={TILE}
                height={TILE}
                rx={art ? 0 : 14}
                fill="url(#tile-glass)"
                style={{ opacity: art ? 0.55 : 1, transform: scale }}
              />
              {showSymbols && (
                <text
                  className="mt-anim mt-scale"
                  x={tx + TILE / 2}
                  y={ty + TILE / 2 + 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={46}
                  fontFamily={EMOJI_FONT}
                  style={{ opacity: art ? 0.92 : 1, transform: art ? "scale(0.62)" : undefined }}
                >
                  {t.symbol}
                </text>
              )}
            </g>
          );
        })}
      </g>
      <path className="mt-anim" d={GROUT} stroke="#07061c" strokeWidth={2.5} fill="none" style={{ opacity: art ? 0.45 : 0 }} pointerEvents="none" />
      {[highlight, focused].map((id, i) => {
        const p = id ? parseTileId(id) : null;
        if (!p) return null;
        return (
          <rect
            key={i}
            className={i === 0 ? "mt-highlight" : undefined}
            x={p.col * TILE + 3}
            y={p.row * TILE + 3}
            width={TILE - 6}
            height={TILE - 6}
            rx={10}
            fill="none"
            stroke={i === 0 ? "#ffffff" : "#ffd27a"}
            strokeWidth={i === 0 ? 7 : 6}
            strokeDasharray={i === 1 ? "14 8" : undefined}
            pointerEvents="none"
          />
        );
      })}
    </svg>
  );
}
