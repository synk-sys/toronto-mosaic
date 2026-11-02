"use client";

import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

/** Render a React SVG element (with `standalone` defs) to a self-contained SVG string. */
export function renderSvgMarkup(element: ReactElement): string {
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(element));
  const svg = host.querySelector("svg");
  const markup = svg ? new XMLSerializer().serializeToString(svg) : "";
  root.unmount();
  return markup.startsWith("<?xml") ? markup : `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
}

/** Rasterise SVG markup into a PNG at the requested pixel size. */
export async function svgToPng(markup: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not render artwork"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const svgBlob = (markup: string) => new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
