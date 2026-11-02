"use client";

import { ART_H, ART_W } from "@/lib/grid";
import { skylineSvg, TONES } from "./skyline";

export type ArtRasters = { base: string } & Record<string, string>;

let pending: Promise<ArtRasters> | null = null;

/**
 * Rasterise the vector skyline once, then derive the six tritone variants
 * in a single pixel pass. The mosaic then paints cached bitmaps instead of
 * re-running SVG filters over thousands of vector shapes on every frame —
 * essential for smooth reveal animations on projector laptops and phones.
 */
export function rasterizeArt(): Promise<ArtRasters> {
  pending ??= (async () => {
    const dpr = window.devicePixelRatio || 1;
    const longest = Math.max(window.screen.width, window.screen.height) * dpr;
    const scale = Math.min(1, Math.max(0.5, longest / ART_W));
    const w = Math.round(ART_W * scale);
    const h = Math.round(ART_H * scale);

    const url = URL.createObjectURL(new Blob([skylineSvg(w, h)], { type: "image/svg+xml" }));
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("skyline raster failed"));
      img.src = url;
    });
    URL.revokeObjectURL(url);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    const toUrl = () =>
      new Promise<string>((res, rej) =>
        canvas.toBlob((b) => (b ? res(URL.createObjectURL(b)) : rej(new Error("encode failed"))), "image/png"),
      );

    const out: Record<string, string> = { base: await toUrl() };
    const src = ctx.getImageData(0, 0, w, h);
    for (const tone of TONES) {
      // Same maths as the SVG filter: luminance → piecewise-linear 3-stop ramp.
      const lut = new Uint8ClampedArray(256 * 3);
      for (let i = 0; i < 256; i++) {
        const l = i / 255;
        for (let c = 0; c < 3; c++) {
          const v = l < 0.5 ? tone.dark[c] + (tone.mid[c] - tone.dark[c]) * (l * 2) : tone.mid[c] + (tone.light[c] - tone.mid[c]) * ((l - 0.5) * 2);
          lut[i * 3 + c] = v * 255;
        }
      }
      const dst = new ImageData(w, h);
      const s = src.data;
      const d = dst.data;
      for (let p = 0; p < s.length; p += 4) {
        const l = (0.2126 * s[p] + 0.7152 * s[p + 1] + 0.0722 * s[p + 2]) | 0;
        d[p] = lut[l * 3];
        d[p + 1] = lut[l * 3 + 1];
        d[p + 2] = lut[l * 3 + 2];
        d[p + 3] = s[p + 3];
      }
      ctx.putImageData(dst, 0, 0);
      out[tone.id] = await toUrl();
    }
    return out as ArtRasters;
  })().catch((e) => {
    pending = null;
    throw e;
  });
  return pending;
}
