import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MosaicSvg } from "@/components/mosaic/MosaicSvg";
import { TileCardSvg, wrapText } from "@/components/mosaic/TileCardSvg";
import { skylineSvg } from "@/lib/art/skyline";
import { syntheticTiles } from "@/lib/demo";
import type { PublicTile } from "@/lib/types";

const tilesMap = (n: number) => new Map(syntheticTiles(n).map((t) => [t.tileId, t] as [string, PublicTile]));

describe("artwork export", () => {
  it("renders a self-contained SVG with all 300 grid cells", () => {
    const markup = renderToStaticMarkup(createElement(MosaicSvg, { tiles: tilesMap(120), mode: "art", revealed: true, standalone: true }));
    expect(markup.startsWith("<svg")).toBe(true);
    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(markup.match(/data-tile="/g)).toHaveLength(300);
    expect(markup.match(/data-color="/g)).toHaveLength(120);
    // Standalone exports embed the artwork and tone patterns they reference.
    expect(markup).toContain('id="skyline"');
    for (const c of ["maple", "sunset", "gold", "ravine", "lake", "aurora"]) expect(markup).toContain(`id="art-${c}"`);
    expect(markup).toContain('data-revealed="true"');
  });

  it("looks complete with few participants: revealed veils are fully transparent", () => {
    const markup = renderToStaticMarkup(createElement(MosaicSvg, { tiles: tilesMap(10), mode: "art", revealed: true }));
    // 290 empty tiles — every veil has opacity 0 after the reveal.
    expect(markup.match(/fill="#070820" style="opacity:0"/g)).toHaveLength(290);
  });

  it("handles a completely full mosaic", () => {
    const markup = renderToStaticMarkup(createElement(MosaicSvg, { tiles: tilesMap(300), mode: "tiles" }));
    expect(markup.match(/data-color="/g)).toHaveLength(300);
  });

  it("escapes attendee text in the shareable card (no markup injection)", () => {
    const markup = renderToStaticMarkup(
      createElement(TileCardSvg, {
        color: "lake",
        symbol: "🍁",
        message: '<script>alert(1)</script> & "quotes"',
        motif: "waves",
        tileId: "r03c04",
        standalone: true,
      }),
    );
    expect(markup).not.toContain("<script>");
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).toContain("Row 4 · Column 5");
  });

  it("base skyline is well-formed and sized", () => {
    const svg = skylineSvg(1000, 750);
    expect(svg).toContain('width="1000"');
    expect(svg).toContain('id="cn-tower"');
    expect(svg.split("<g").length).toBe(svg.split("</g>").length);
  });

  it("wraps long messages to a bounded number of lines", () => {
    const lines = wrapText("a ".repeat(200).trim(), 30, 4);
    expect(lines).toHaveLength(4);
    expect(lines[3].endsWith("…")).toBe(true);
  });
});
