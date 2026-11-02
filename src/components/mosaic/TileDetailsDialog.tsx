"use client";

import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { tileLabel } from "@/lib/grid";
import { getColor, getSymbol } from "@/lib/palette";
import type { PublicTile } from "@/lib/types";

export function TileDetailsDialog({
  tile,
  emptyTileId,
  onClose,
  isMine,
}: {
  tile: PublicTile | null;
  emptyTileId?: string | null;
  onClose: () => void;
  isMine?: boolean;
}) {
  const open = !!tile || !!emptyTileId;
  const color = tile ? getColor(tile.color) : null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="bottom">
        {tile && color ? (
          <>
            <div className="flex items-center gap-4">
              <div
                className="grid size-20 shrink-0 place-items-center rounded-2xl text-5xl shadow-lg"
                style={{ background: color.hex }}
                aria-hidden="true"
              >
                {tile.symbol}
              </div>
              <div className="min-w-0">
                <DialogTitle>{isMine ? "Your tile" : "A Toronto Mosaic tile"}</DialogTitle>
                <DialogDescription>
                  {tileLabel(tile.tileId)} · {color.name} · {getSymbol(tile.symbol)?.label ?? "Symbol"}
                </DialogDescription>
              </div>
            </div>
            {tile.message ? (
              <blockquote className="rounded-2xl bg-white/5 p-4 text-lg leading-snug">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">The future they&apos;d love to see</p>
                <p className="mt-1">“{tile.message}”</p>
                {tile.caption && <p className="mt-2 text-sm italic text-muted-foreground">✦ {tile.caption}</p>}
              </blockquote>
            ) : (
              <p className="text-sm text-muted-foreground">
                This contributor chose colour and symbol only{isMine ? " — or your message is still being reviewed" : ""}.
              </p>
            )}
            <Button asChild variant="outline">
              <Link href={`/c/${tile.contributionId}`}>Open shareable tile page</Link>
            </Button>
          </>
        ) : (
          <>
            <DialogTitle>Waiting for a contributor</DialogTitle>
            <DialogDescription>
              {emptyTileId ? tileLabel(emptyTileId) : ""} is still open. Every tile added makes the skyline glow brighter.
            </DialogDescription>
            <Button asChild>
              <Link href="/">Add your tile</Link>
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
