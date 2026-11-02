import { getColor, type ColorId, type Motif } from "@/lib/palette";
import type { PublicTile } from "@/lib/types";
import { MosaicSvg } from "./MosaicSvg";
import { PREVIEW_TILE } from "./TileCardSvg";

/** Two views of the same tile: the individual piece and how it inks the skyline. */
export function TilePreview({ color, symbol, motif }: { color: ColorId; symbol: string; motif: Motif }) {
  const c = getColor(color);
  const tile: PublicTile = { tileId: PREVIEW_TILE, contributionId: "preview", color, symbol, message: null, caption: null, motif, seq: 0 };
  const tiles = new Map([[PREVIEW_TILE, tile]]);
  return (
    <div className="grid grid-cols-2 gap-3" aria-live="polite">
      <figure className="space-y-1.5">
        <div className="aspect-square overflow-hidden rounded-2xl ring-1 ring-white/15">
          <MosaicSvg tiles={tiles} mode="tiles" viewBox="600 400 100 100" className="size-full" title={`${c.name} tile with ${symbol}`} />
        </div>
        <figcaption className="text-center text-xs text-muted-foreground">Your tile</figcaption>
      </figure>
      <figure className="space-y-1.5">
        <div className="aspect-square overflow-hidden rounded-2xl ring-1 ring-white/15">
          <MosaicSvg
            tiles={tiles}
            mode="art"
            highlight={PREVIEW_TILE}
            viewBox="500 300 300 300"
            className="size-full"
            title="Preview of your tile inside the skyline"
          />
        </div>
        <figcaption className="text-center text-xs text-muted-foreground">In the skyline</figcaption>
      </figure>
    </div>
  );
}
