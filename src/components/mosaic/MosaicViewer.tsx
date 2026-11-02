"use client";

import { useCallback, useState, type KeyboardEvent, type MouseEvent } from "react";
import { COLS, ROWS, parseTileId, tileId, tileLabel } from "@/lib/grid";
import { getColor } from "@/lib/palette";
import type { PublicTile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MosaicSvg, type MosaicMode } from "./MosaicSvg";
import { TileDetailsDialog } from "./TileDetailsDialog";

/**
 * Interactive mosaic: tap/click a tile to explore it, or use the keyboard
 * (arrow keys to move, Enter to open). A live region describes the focused
 * tile for screen-reader users.
 */
export function MosaicViewer({
  tiles,
  mode,
  revealed,
  fresh,
  highlight,
  className,
  waveMs = 40,
}: {
  tiles: ReadonlyMap<string, PublicTile>;
  mode: MosaicMode;
  revealed?: boolean;
  fresh?: ReadonlySet<string>;
  highlight?: string | null;
  className?: string;
  waveMs?: number;
}) {
  const [focused, setFocused] = useState<string | null>(null);
  const [kbd, setKbd] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const onClick = useCallback((e: MouseEvent) => {
    const el = (e.target as Element).closest("[data-tile]");
    const id = el?.getAttribute("data-tile");
    if (id) {
      setFocused(id);
      setOpenId(id);
    }
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    const p = parseTileId(focused ?? tileId(0, 0))!;
    let { row, col } = p;
    switch (e.key) {
      case "ArrowRight": col = Math.min(COLS - 1, col + 1); break;
      case "ArrowLeft": col = Math.max(0, col - 1); break;
      case "ArrowDown": row = Math.min(ROWS - 1, row + 1); break;
      case "ArrowUp": row = Math.max(0, row - 1); break;
      case "Home": col = 0; break;
      case "End": col = COLS - 1; break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focused) setOpenId(focused);
        return;
      default:
        return;
    }
    e.preventDefault();
    setKbd(true);
    setFocused(tileId(row, col));
  };

  const ft = focused ? tiles.get(focused) : undefined;
  const description = focused
    ? ft
      ? `${tileLabel(focused)}: ${getColor(ft.color).name}, ${ft.symbol}${ft.message ? `, “${ft.message}”` : ""}. Press Enter for details.`
      : `${tileLabel(focused)}: open tile.`
    : "";
  const open = openId ? tiles.get(openId) ?? null : null;

  return (
    <div className={cn("relative", className)}>
      <div
        role="application"
        aria-roledescription="mosaic"
        aria-label={`Toronto skyline mosaic with ${tiles.size} of 300 tiles. Use arrow keys to explore tiles and Enter to open one.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => !focused && setFocused(tileId(0, 0))}
        onBlur={() => setKbd(false)}
        onClick={onClick}
        className="cursor-pointer touch-manipulation overflow-hidden rounded-2xl ring-1 ring-white/10 outline-none focus-visible:ring-4 focus-visible:ring-ring"
      >
        <MosaicSvg
          tiles={tiles}
          mode={mode}
          revealed={revealed}
          fresh={fresh}
          highlight={highlight}
          focused={kbd ? focused : null}
          waveMs={waveMs}
          className="block h-auto w-full"
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {kbd ? description : ""}
      </p>
      <TileDetailsDialog
        tile={open}
        emptyTileId={openId && !open ? openId : null}
        isMine={!!openId && openId === highlight}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
