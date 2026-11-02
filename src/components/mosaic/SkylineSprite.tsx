"use client";

import { useEffect, useState } from "react";
import { SKYLINE_ART, SKYLINE_DEFS, TILE_DEFS } from "@/lib/art/skyline";
import { rasterizeArt, type ArtRasters } from "@/lib/art/raster";
import { ART_H, ART_W } from "@/lib/grid";
import { COLORS } from "@/lib/palette";

const hidden = { position: "absolute", width: 0, height: 0, overflow: "hidden" } as const;

/**
 * Global sprite: the artwork and its colour-tone patterns are defined once per
 * page and referenced by id. Server render ships the vector version; once the
 * browser has rasterised the art, the same ids are swapped to cached bitmaps.
 */
export function SkylineSprite() {
  const [raster, setRaster] = useState<ArtRasters | null>(null);
  useEffect(() => {
    rasterizeArt().then(setRaster).catch(() => {});
  }, []);

  if (!raster) {
    return (
      <svg aria-hidden="true" focusable="false" width="0" height="0" style={hidden}>
        <defs dangerouslySetInnerHTML={{ __html: SKYLINE_DEFS + SKYLINE_ART }} />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={hidden} data-raster="ready">
      <defs dangerouslySetInnerHTML={{ __html: TILE_DEFS }} />
      <defs>
        <g id="skyline">
          <image href={raster.base} width={ART_W} height={ART_H} preserveAspectRatio="none" />
        </g>
        {COLORS.map((c) => (
          <pattern key={c.id} id={`art-${c.id}`} width={ART_W} height={ART_H} patternUnits="userSpaceOnUse">
            <image href={raster[c.id]} width={ART_W} height={ART_H} preserveAspectRatio="none" />
          </pattern>
        ))}
      </defs>
    </svg>
  );
}

