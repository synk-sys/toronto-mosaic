"use client";

import { useState } from "react";
import { Check, Download, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TileCardSvg, CARD_H, CARD_W } from "@/components/mosaic/TileCardSvg";
import { downloadBlob, renderSvgMarkup, svgToPng } from "@/lib/art/export";
import type { OwnContribution, PublicContribution } from "@/lib/types";

type Shareable = Pick<OwnContribution | PublicContribution, "id" | "color" | "symbol" | "message" | "caption" | "motif" | "tileId">;

export function shareUrlFor(id: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || window.location.origin;
  return `${base}/c/${id}`;
}

async function cardPng(c: Shareable) {
  const markup = renderSvgMarkup(
    <TileCardSvg
      standalone
      color={c.color}
      symbol={c.symbol}
      message={c.message}
      caption={c.caption}
      motif={c.motif}
      tileId={c.tileId}
      shareUrl={shareUrlFor(c.id)}
    />,
  );
  return svgToPng(markup, CARD_W, CARD_H);
}

export function ShareActions({ contribution }: { contribution: Shareable }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = typeof window === "undefined" ? "" : shareUrlFor(contribution.id);
  const filename = `toronto-mosaic-${contribution.tileId ?? "tile"}.png`;

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      downloadBlob(await cardPng(contribution), filename);
    } catch {
      setError("Couldn't create the image on this device. Try the share link instead.");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setError(null);
    try {
      const png = await cardPng(contribution).catch(() => null);
      const file = png ? new File([png], filename, { type: "image/png" }) : null;
      const data: ShareData = { title: "My Toronto Mosaic tile", text: "I added a tile to the Toronto skyline at #DevFestToronto 🍁", url };
      if (file && navigator.canShare?.({ files: [file] })) data.files = [file];
      await navigator.share(data);
    } catch (e) {
      if ((e as Error).name !== "AbortError") await copy();
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(`Copy this link: ${url}`);
    }
  };

  const canShare = typeof navigator !== "undefined" && !!navigator.share;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={download} disabled={busy} variant="secondary" data-testid="download-tile">
          <Download /> {busy ? "Preparing…" : "Download image"}
        </Button>
        {canShare ? (
          <Button onClick={share} variant="secondary">
            <Share2 /> Share
          </Button>
        ) : (
          <Button onClick={copy} variant="secondary">
            {copied ? <Check /> : <Link2 />} {copied ? "Copied!" : "Copy link"}
          </Button>
        )}
      </div>
      <p className="break-all text-center text-xs text-muted-foreground" data-testid="share-url">
        {url}
      </p>
      {error && (
        <p role="alert" className="text-center text-sm text-rose-200">
          {error}
        </p>
      )}
    </div>
  );
}
