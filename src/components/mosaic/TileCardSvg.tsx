import { ART_H, ART_W, COLS, ROWS, TILE, parseTileId, tileLabel } from "@/lib/grid";
import { EVENT_NAME, PROMPT, getColor, type ColorId, type Motif } from "@/lib/palette";
import { SKYLINE_ART, SKYLINE_DEFS } from "@/lib/art/skyline";
import type { PublicTile } from "@/lib/types";
import { MosaicSvg } from "./MosaicSvg";

export const CARD_W = 1080;
export const CARD_H = 1350;
/** CN Tower observation pod — showcase tile used for previews before placement. */
export const PREVIEW_TILE = "r04c06";

const FONT = `"Helvetica Neue",Helvetica,Arial,sans-serif`;

/** Greedy word wrap by character budget (SVG has no native text wrapping). */
export function wrapText(text: string, maxChars: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if ([...next].length > maxChars && line) {
      lines.push(line);
      line = w;
    } else line = next;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…";
  }
  return lines;
}

export interface TileCardProps {
  color: ColorId;
  symbol: string;
  message?: string | null;
  caption?: string | null;
  motif: Motif;
  tileId?: string | null;
  standalone?: boolean;
  shareUrl?: string;
  className?: string;
}

/** 1080×1350 shareable card: the attendee's tile in context of its neighbours. */
export function TileCardSvg({ color, symbol, message, caption, motif, tileId, standalone, shareUrl, className }: TileCardProps) {
  const c = getColor(color);
  const placed = !!tileId && !!parseTileId(tileId);
  const id = placed ? tileId! : PREVIEW_TILE;
  const p = parseTileId(id)!;
  // 3×3 tile neighbourhood, clamped to the canvas.
  const vx = Math.min(Math.max(p.col - 1, 0), COLS - 3) * TILE;
  const vy = Math.min(Math.max(p.row - 1, 0), ROWS - 3) * TILE;
  const tile: PublicTile = { tileId: id, contributionId: "card", color, symbol, message: null, caption: null, motif, seq: 0 };
  const lines = message ? wrapText(`“${message}”`, 30, 4) : [];
  const capLines = caption ? wrapText(caption, 40, 2) : [];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      className={className}
      role="img"
      aria-label={`Your Toronto Mosaic tile: ${c.name} with ${symbol}${message ? `, message: ${message}` : ""}`}
    >
      {standalone && <defs dangerouslySetInnerHTML={{ __html: SKYLINE_DEFS + SKYLINE_ART }} />}
      <defs>
        <linearGradient id="card-bg" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#0b0d2e" />
          <stop offset="1" stopColor={c.hex} stopOpacity="0.55" />
        </linearGradient>
        <clipPath id="card-clip">
          <rect x="140" y="190" width="800" height="800" rx="36" />
        </clipPath>
      </defs>
      <rect width={CARD_W} height={CARD_H} fill="#0b0d2e" />
      <rect width={CARD_W} height={CARD_H} fill="url(#card-bg)" />
      <text x="140" y="112" fill="#fff" fontFamily={FONT} fontSize="44" fontWeight="800" letterSpacing="6">
        TORONTO MOSAIC
      </text>
      <text x="140" y="156" fill="#fff" opacity="0.75" fontFamily={FONT} fontSize="26">
        {EVENT_NAME}
      </text>
      <g clipPath="url(#card-clip)">
        <MosaicSvg
          tiles={new Map([[id, tile]])}
          mode="art"
          revealed={false}
          viewBox={`${vx} ${vy} 300 300`}
          x={140}
          y={190}
          width={800}
          height={800}
          showSymbols={false}
          title="Your tile in the skyline"
        />
      </g>
      {/* The attendee's tile, emphasised */}
      {(() => {
        const s = 800 / 300;
        const tx = 140 + (p.col * TILE - vx) * s;
        const ty = 190 + (p.row * TILE - vy) * s;
        return (
          <g>
            <rect x={tx} y={ty} width={TILE * s} height={TILE * s} fill="none" stroke="#fff" strokeWidth="8" rx="10" />
            <text
              x={tx + (TILE * s) / 2}
              y={ty + (TILE * s) / 2 + 6}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="120"
              fontFamily={`"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`}
            >
              {symbol}
            </text>
          </g>
        );
      })()}
      <rect x="140" y="190" width="800" height="800" rx="36" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="2" />

      {lines.length > 0 ? (
        <text fill="#fff" fontFamily={FONT} fontSize="40" fontWeight="600">
          {lines.map((l, i) => (
            <tspan key={i} x="140" y={1060 + i * 50}>
              {l}
            </tspan>
          ))}
        </text>
      ) : (
        <text x="140" y="1060" fill="#fff" opacity="0.8" fontFamily={FONT} fontSize="34">
          {PROMPT}
        </text>
      )}
      {capLines.length > 0 && (
        <text fill="#fff" opacity="0.8" fontFamily={FONT} fontSize="28" fontStyle="italic">
          {capLines.map((l, i) => (
            <tspan key={i} x="140" y={1060 + lines.length * 50 + 14 + i * 36}>
              {l}
            </tspan>
          ))}
        </text>
      )}

      {/* Mini-map: where this tile sits among all 300 */}
      <g transform="translate(140 1250)">
        <rect width="80" height="60" rx="6" fill="#fff" opacity="0.15" />
        <rect x={p.col * 4} y={p.row * 4} width="4" height="4" fill={c.hex} stroke="#fff" strokeWidth="1" />
        <text x="100" y="26" fill="#fff" fontFamily={FONT} fontSize="26" fontWeight="700">
          {placed ? tileLabel(id) : "Preview"}
        </text>
        <text x="100" y="56" fill="#fff" opacity="0.7" fontFamily={FONT} fontSize="22">
          {placed ? `${c.name} · one of 300 tiles` : "Your tile will be placed in the skyline"}
        </text>
      </g>
      {shareUrl && (
        <text x="940" y="1306" textAnchor="end" fill="#fff" opacity="0.6" fontFamily={FONT} fontSize="20">
          {shareUrl.replace(/^https?:\/\//, "")}
        </text>
      )}
      <desc>{`${ART_W}x${ART_H} Toronto Mosaic`}</desc>
    </svg>
  );
}
