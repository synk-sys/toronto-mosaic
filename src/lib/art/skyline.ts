/**
 * Original Toronto skyline illustration, generated as static SVG markup.
 * Canvas: 2000 × 1500 (20 × 15 tiles of 100 units). Shoreline at y = 1090.
 *
 * The markup is pure data (no React), so it can be used by the live mosaic,
 * the high-resolution exporter and the attendee tile card alike.
 */
import { COLORS } from "@/lib/palette";

const SHORE = 1090;
const W = 2000;
const H = 1500;

/** Deterministic PRNG so the artwork is identical on every device. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

interface Tower {
  x: number;
  w: number;
  top: number;
  fill: string;
  windows?: "warm" | "cool" | "grid" | "stripe" | "gold" | "none";
  crown?: string; // extra markup drawn above the body
  body?: string; // custom body path (replaces rect)
}

function windowsFor(t: Tower, rand: () => number) {
  const kind = t.windows ?? "warm";
  const h = SHORE - t.top;
  if (kind === "none") return "";
  if (kind === "grid") {
    return `<rect x="${t.x + 3}" y="${t.top + 6}" width="${t.w - 6}" height="${h - 6}" fill="url(#win-grid)"/>`;
  }
  if (kind === "stripe") {
    return `<rect x="${t.x + 4}" y="${t.top + 4}" width="${t.w - 8}" height="${h - 4}" fill="url(#win-stripe)"/>`;
  }
  // Individually lit windows — deterministic, irregular, like a real evening.
  const cols = Math.max(2, Math.floor((t.w - 8) / 11));
  const rows = Math.floor((h - 14) / 16);
  const gapX = (t.w - 8) / cols;
  const lit = kind === "cool" ? "#bfe3ff" : kind === "gold" ? "#ffe2a0" : "#ffd27a";
  const parts: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = rand();
      if (v < 0.42) continue;
      const op = v > 0.9 ? 0.95 : v > 0.7 ? 0.7 : 0.35;
      parts.push(
        `<rect x="${r1(t.x + 4 + c * gapX + gapX * 0.18)}" y="${t.top + 10 + r * 16}" width="${r1(gapX * 0.64)}" height="9" fill="${lit}" opacity="${op}"/>`,
      );
    }
  }
  return parts.join("");
}

function tower(t: Tower, rand: () => number) {
  const h = SHORE - t.top;
  const body = t.body ?? `<rect x="${t.x}" y="${t.top}" width="${t.w}" height="${h}" fill="${t.fill}"/>`;
  // Sunset key-light from the right, cool shadow on the left.
  const light = `<rect x="${r1(t.x + t.w * 0.72)}" y="${t.top}" width="${r1(t.w * 0.28)}" height="${h}" fill="#ffb38a" opacity="0.13"/>`;
  const shade = `<rect x="${t.x}" y="${t.top}" width="${r1(t.w * 0.18)}" height="${h}" fill="#000" opacity="0.18"/>`;
  return `<g>${body}${windowsFor(t, rand)}${light}${shade}${t.crown ?? ""}</g>`;
}

function stars() {
  const rand = rng(7);
  const out: string[] = [];
  for (let i = 0; i < 90; i++) {
    const x = r1(rand() * W);
    const y = r1(Math.pow(rand(), 1.6) * 520);
    const r = r1(0.8 + rand() * 2.2);
    out.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${r1(0.35 + rand() * 0.6)}"/>`);
  }
  // A few twinkles
  for (const [x, y] of [[180, 120], [1180, 90], [1720, 260], [880, 210], [1460, 150]]) {
    out.push(
      `<path d="M${x} ${y - 9}L${x + 2} ${y - 2}L${x + 9} ${y}L${x + 2} ${y + 2}L${x} ${y + 9}L${x - 2} ${y + 2}L${x - 9} ${y}L${x - 2} ${y - 2}Z" fill="#fff" opacity="0.85"/>`,
    );
  }
  return out.join("");
}

function hazeSkyline() {
  // Distant city: soft layered silhouettes that make the skyline feel dense.
  const rand = rng(11);
  const layer = (base: number, amp: number, fill: string, op: number, minW: number) => {
    let x = -10;
    let d = `M-10 ${SHORE}`;
    while (x < W + 10) {
      const w = minW + rand() * 60;
      const y = base - rand() * amp;
      d += `L${r1(x)} ${r1(y)}L${r1(x + w)} ${r1(y)}`;
      x += w;
    }
    d += `L${W + 10} ${SHORE}Z`;
    return `<path d="${d}" fill="${fill}" opacity="${op}"/>`;
  };
  return layer(985, 120, "#5a3a7e", 0.55, 34) + layer(1020, 140, "#3d2a63", 0.8, 28);
}

function cnTower() {
  const cx = 620;
  return `<g id="cn-tower">
  <path d="M574 ${SHORE}L601 995L607 505L633 505L639 995L666 ${SHORE}Z" fill="url(#tower-grad)"/>
  <path d="M617 ${SHORE}L623 ${SHORE}L622 505L618 505Z" fill="#fff" opacity="0.35"/>
  <path d="M590 ${SHORE}L606 1000L604 1090Z" fill="#000" opacity="0.15"/>
  <path d="M588 505L652 505L678 470L562 470Z" fill="url(#tower-grad)"/>
  <rect x="556" y="438" width="128" height="34" rx="9" fill="#efe4f3"/>
  <rect x="560" y="448" width="120" height="13" rx="4" fill="#ffd27a"/>
  <rect x="560" y="448" width="120" height="13" rx="4" fill="#fff4cf" opacity="0.5" filter="url(#glow)"/>
  <path d="M562 438L678 438L661 416L579 416Z" fill="url(#tower-grad)"/>
  <rect x="588" y="404" width="64" height="14" rx="5" fill="#ded3ea"/>
  <path d="M606 405L634 405L630 290L610 290Z" fill="url(#tower-grad)"/>
  <rect x="598" y="266" width="44" height="26" rx="8" fill="#efe4f3"/>
  <rect x="601" y="274" width="38" height="7" rx="3" fill="#ffd27a"/>
  <path d="M610 267L630 267L622 96L618 96Z" fill="#e7def0"/>
  ${[130, 170, 210, 245].map((y) => `<rect x="${cx - 6}" y="${y}" width="12" height="4" fill="#8f82b3"/>`).join("")}
  <circle cx="${cx}" cy="92" r="26" fill="#ff5d7a" opacity="0.28" filter="url(#glow)"/>
  <circle cx="${cx}" cy="92" r="5" fill="#ff6b86"/>
</g>`;
}

function rogersCentre() {
  const ribs = [380, 420, 465, 510, 550]
    .map((x) => `<path d="M${x} 1040Q${x + (465 - x) * 0.25} ${975 + Math.abs(465 - x) * 0.32} 465 958" stroke="#7d6fa6" stroke-width="3" fill="none" opacity="0.7"/>`)
    .join("");
  return `<g id="rogers-centre">
  <path d="M328 ${SHORE}L328 1040Q465 930 602 1040L602 ${SHORE}Z" fill="url(#dome-grad)"/>
  ${ribs}
  <rect x="328" y="1040" width="274" height="50" fill="#3a2c5e"/>
  ${Array.from({ length: 12 }, (_, i) => `<rect x="${336 + i * 22}" y="1052" width="14" height="22" rx="7" fill="#ffd27a" opacity="${0.45 + (i % 3) * 0.2}"/>`).join("")}
</g>`;
}

function waterfrontTrees() {
  const rand = rng(23);
  let d = "";
  for (let x = -20; x < W + 20; x += 18 + rand() * 22) {
    const r = 12 + rand() * 16;
    d += `<circle cx="${r1(x)}" cy="${r1(SHORE - r * 0.35)}" r="${r1(r)}"/>`;
  }
  return `<g fill="#140f2c">${d}<rect x="0" y="${SHORE - 8}" width="${W}" height="14"/></g>
  <g fill="#ffd27a" opacity="0.8">${Array.from({ length: 40 }, (_, i) => `<circle cx="${25 + i * 50}" cy="${SHORE - 3}" r="2.2"/>`).join("")}</g>`;
}

function city() {
  const rand = rng(42);
  const scotia = `<path d="M1085 ${SHORE}L1085 472L1105 448L1125 472L1145 448L1165 472L1165 ${SHORE}Z" fill="#a33a4c"/>`;
  const rbc = `<path d="M768 ${SHORE}L768 792L790 792L790 812L812 812L812 832L834 832L834 852L846 852L846 ${SHORE}Z" fill="#d6a03c"/>`;
  const aura = `<path d="M1452 ${SHORE}L1452 492Q1486 455 1520 492L1520 ${SHORE}Z" fill="#3c4f86"/>`;
  const oneBloor = `<path d="M1566 ${SHORE}L1566 600Q1580 580 1592 600Q1604 580 1620 600L1620 ${SHORE}Z" fill="#4b5d93"/>`;
  const flatiron = `<path d="M1468 ${SHORE}L1468 965L1532 948L1546 960L1546 ${SHORE}Z" fill="#8a3b3b"/>`;

  const back: Tower[] = [
    { x: 0, w: 72, top: 845, fill: "#2c2150", windows: "warm" },
    { x: 58, w: 92, top: 745, fill: "#2f3f73", windows: "cool", crown: `<path d="M58 745L150 745L150 725Z" fill="#2f3f73"/>` },
    { x: 148, w: 66, top: 815, fill: "#291d4a", windows: "warm" },
    { x: 206, w: 86, top: 695, fill: "#33467c", windows: "cool" },
    { x: 282, w: 50, top: 880, fill: "#251a45", windows: "warm" },
    { x: 860, w: 72, top: 600, fill: "#15132b", windows: "grid" },
    { x: 930, w: 62, top: 560, fill: "#40375f", windows: "warm", crown: `<rect x="938" y="548" width="46" height="12" fill="#40375f"/>` },
    { x: 990, w: 96, top: 400, fill: "#d7d1e4", windows: "stripe", crown: `<rect x="1020" y="345" width="4" height="56" fill="#cfc8de"/><rect x="1052" y="330" width="4" height="70" fill="#cfc8de"/><circle cx="1054" cy="330" r="4" fill="#ff6b86"/>` },
    { x: 1085, w: 80, top: 448, fill: "#a33a4c", windows: "warm", body: scotia },
    { x: 1165, w: 62, top: 620, fill: "#15132b", windows: "grid" },
    { x: 1226, w: 76, top: 482, fill: "#2c3a68", windows: "cool", crown: `<rect x="1220" y="474" width="88" height="14" fill="#33427a"/>` },
    { x: 1300, w: 62, top: 565, fill: "#3b3466", windows: "warm", crown: `<path d="M1300 565L1331 520L1362 565Z" fill="#3b3466"/><rect x="1329" y="490" width="4" height="34" fill="#cfc8de"/>` },
    { x: 1362, w: 82, top: 640, fill: "#2d4c86", windows: "cool" },
    { x: 1452, w: 68, top: 470, fill: "#3c4f86", windows: "cool", body: aura },
    { x: 1566, w: 54, top: 585, fill: "#4b5d93", windows: "cool", body: oneBloor },
    { x: 1620, w: 82, top: 722, fill: "#2a2050", windows: "warm" },
    { x: 1700, w: 80, top: 800, fill: "#33467c", windows: "cool" },
    { x: 1778, w: 82, top: 688, fill: "#2c2150", windows: "warm", crown: `<rect x="1790" y="672" width="58" height="16" fill="#2c2150"/>` },
    { x: 1858, w: 82, top: 820, fill: "#2f3f73", windows: "cool" },
    { x: 1936, w: 70, top: 760, fill: "#291d4a", windows: "warm" },
  ];
  const front: Tower[] = [
    { x: 640, w: 120, top: 1030, fill: "#2a2050", windows: "warm" },
    { x: 768, w: 78, top: 792, fill: "#d6a03c", windows: "gold", body: rbc },
    { x: 846, w: 130, top: 1018, fill: "#4a3460", windows: "warm", crown: `<rect x="846" y="1010" width="130" height="8" fill="#5b4274"/>` },
    { x: 1468, w: 78, top: 948, fill: "#8a3b3b", windows: "warm", body: flatiron },
    { x: 1150, w: 160, top: 1000, fill: "#251a45", windows: "warm" },
    { x: 1700, w: 140, top: 1010, fill: "#251a45", windows: "warm" },
  ];

  return `<g id="city">
  ${hazeSkyline()}
  ${back.map((t) => tower(t, rand)).join("")}
  ${cnTower()}
  ${rogersCentre()}
  ${front.map((t) => tower(t, rand)).join("")}
  ${waterfrontTrees()}
</g>`;
}

function water() {
  const rand = rng(99);
  const glitter: string[] = [];
  for (let i = 0; i < 70; i++) {
    const y = SHORE + 14 + Math.pow(rand(), 1.3) * 330;
    const spread = 30 + (y - SHORE) * 0.45;
    const x = 1500 + (rand() - 0.5) * spread * 2;
    const w = 12 + rand() * 50;
    glitter.push(`<rect x="${r1(x - w / 2)}" y="${r1(y)}" width="${r1(w)}" height="3" rx="1.5" fill="#ffd59a" opacity="${r1(0.25 + rand() * 0.6)}"/>`);
  }
  const ripples: string[] = [];
  for (let i = 0; i < 46; i++) {
    const y = SHORE + 20 + rand() * 390;
    const x = rand() * W;
    ripples.push(`<rect x="${r1(x)}" y="${r1(y)}" width="${r1(40 + rand() * 120)}" height="2" fill="#fff" opacity="${r1(0.05 + rand() * 0.12)}"/>`);
  }
  return `<g id="lake">
  <rect x="0" y="${SHORE}" width="${W}" height="${H - SHORE}" fill="url(#water-grad)"/>
  <g clip-path="url(#water-clip)" opacity="0.38">
    <use href="#city" transform="translate(0 ${SHORE * 2}) scale(1 -1)"/>
  </g>
  <rect x="0" y="${SHORE}" width="${W}" height="${H - SHORE}" fill="url(#water-fade)"/>
  ${glitter.join("")}${ripples.join("")}
</g>`;
}

function foreground() {
  // Toronto Island shoreline framing the view, a ferry and a sailboat.
  const rand = rng(5);
  const trees = (x0: number, x1: number, base: number) => {
    let s = "";
    for (let x = x0; x < x1; x += 22 + rand() * 26) {
      const r = 18 + rand() * 24;
      s += `<circle cx="${r1(x)}" cy="${r1(base - r * 0.4)}" r="${r1(r)}"/>`;
    }
    return s;
  };
  return `<g id="foreground">
  <g transform="translate(1040 1305)">
    <path d="M-120 0L120 0L100 26L-104 26Z" fill="#1b1436"/>
    <rect x="-86" y="-24" width="160" height="24" rx="4" fill="#efe4f3"/>
    <rect x="-56" y="-42" width="96" height="18" rx="4" fill="#ded3ea"/>
    ${Array.from({ length: 8 }, (_, i) => `<rect x="${-78 + i * 19}" y="-17" width="11" height="9" rx="2" fill="#ffd27a"/>`).join("")}
    <rect x="-8" y="-62" width="10" height="20" fill="#e8384f"/>
    <path d="M-130 30Q0 40 130 30" stroke="#fff" stroke-width="3" opacity="0.25" fill="none"/>
  </g>
  <g transform="translate(410 1270)">
    <path d="M0 -150L0 0L-80 0Z" fill="#f4ecf7"/>
    <path d="M6 -120L6 0L60 0Z" fill="#ffd9b8"/>
    <path d="M-92 4L74 4L58 24L-76 24Z" fill="#1b1436"/>
  </g>
  <g fill="#0c0920">
    <path d="M0 ${H}L0 1430Q140 1410 300 1446Q420 1470 520 ${H}Z"/>
    ${trees(-10, 380, 1440)}
    <path d="M${W} ${H}L${W} 1410Q1880 1400 1740 1440Q1640 1466 1560 ${H}Z"/>
    ${trees(1660, W + 10, 1430)}
  </g>
  <g fill="#ffd27a">${[60, 150, 240, 1740, 1840, 1940].map((x) => `<circle cx="${x}" cy="1470" r="3" opacity="0.8"/>`).join("")}</g>
</g>`;
}

const MOTIF_DEFS = `
<pattern id="motif-rays" width="100" height="100" patternUnits="userSpaceOnUse">
  <g stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none">${[0, 15, 30, 45, 60, 75, 90].map((a) => `<line x1="0" y1="100" x2="${r1(Math.cos((a * Math.PI) / 180) * 130)}" y2="${r1(100 - Math.sin((a * Math.PI) / 180) * 130)}"/>`).join("")}</g>
</pattern>
<pattern id="motif-waves" width="100" height="100" patternUnits="userSpaceOnUse">
  <g stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round">${[22, 50, 78].map((y) => `<path d="M0 ${y}Q12.5 ${y - 9} 25 ${y}T50 ${y}T75 ${y}T100 ${y}"/>`).join("")}</g>
</pattern>
<pattern id="motif-leaves" width="100" height="100" patternUnits="userSpaceOnUse">
  <g fill="#fff">${[[24, 26, 30], [72, 40, -40], [36, 74, 70], [82, 84, 10]].map(([x, y, a]) => `<path transform="translate(${x} ${y}) rotate(${a})" d="M0 -12Q9 0 0 12Q-9 0 0 -12Z"/>`).join("")}</g>
</pattern>
<pattern id="motif-circuits" width="100" height="100" patternUnits="userSpaceOnUse">
  <g stroke="#fff" stroke-width="2.4" fill="none"><path d="M0 30H40L55 45V100M100 70H70L60 60V0M20 100V75H45"/></g>
  <g fill="#fff"><circle cx="40" cy="30" r="4"/><circle cx="60" cy="60" r="4"/><circle cx="45" cy="75" r="4"/></g>
</pattern>
<pattern id="motif-sparkles" width="100" height="100" patternUnits="userSpaceOnUse">
  <g fill="#fff">${[[22, 24, 9], [74, 34, 6], [40, 72, 7], [84, 80, 10], [12, 86, 4]].map(([x, y, s]) => `<path d="M${x} ${y - s}L${x + s * 0.25} ${y - s * 0.25}L${x + s} ${y}L${x + s * 0.25} ${y + s * 0.25}L${x} ${y + s}L${x - s * 0.25} ${y + s * 0.25}L${x - s} ${y}L${x - s * 0.25} ${y - s * 0.25}Z"/>`).join("")}</g>
</pattern>
<pattern id="motif-hearts" width="100" height="100" patternUnits="userSpaceOnUse">
  <g fill="#fff">${[[25, 28, 1], [74, 52, 0.8], [36, 80, 0.7]].map(([x, y, s]) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 6C-10 -2 -12 -10 -6 -12C-2 -13 0 -9 0 -8C0 -9 2 -13 6 -12C12 -10 10 -2 0 6Z"/>`).join("")}</g>
</pattern>`;

/** Tritone ramps per palette colour: shadow → deep tone, mid → the colour, highlight → warm white. */
function hex(h: string) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => r1(v / 255));
}

export const TONES = COLORS.map((c) => {
  const [r, g, b] = hex(c.hex);
  return {
    id: c.id,
    dark: [r * 0.16 + 0.02, g * 0.16 + 0.02, b * 0.16 + 0.05].map(r1),
    mid: [r, g, b],
    light: [Math.min(1, r * 0.25 + 0.8), Math.min(1, g * 0.25 + 0.78), Math.min(1, b * 0.25 + 0.76)].map(r1),
  };
});

const TONE_DEFS = TONES.map((t) => {
  const table = (i: number) => `${t.dark[i]} ${t.mid[i]} ${t.light[i]}`;
  return `<filter id="tone-${t.id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feColorMatrix type="saturate" values="0"/>
  <feComponentTransfer><feFuncR type="table" tableValues="${table(0)}"/><feFuncG type="table" tableValues="${table(1)}"/><feFuncB type="table" tableValues="${table(2)}"/></feComponentTransfer>
</filter>
<pattern id="art-${t.id}" width="${W}" height="${H}" patternUnits="userSpaceOnUse"><use href="#skyline" filter="url(#tone-${t.id})"/></pattern>`;
}).join("\n");

/** Defs the artwork itself needs (gradients, window patterns, clip, glow). */
export const ART_DEFS = `
<linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="${SHORE}" gradientUnits="userSpaceOnUse">
  <stop offset="0" stop-color="#0b1040"/><stop offset="0.32" stop-color="#25195c"/><stop offset="0.58" stop-color="#5e2877"/>
  <stop offset="0.78" stop-color="#c8456e"/><stop offset="0.92" stop-color="#ff8c57"/><stop offset="1" stop-color="#ffc77e"/>
</linearGradient>
<radialGradient id="sun-glow" cx="1500" cy="1030" r="560" gradientUnits="userSpaceOnUse">
  <stop offset="0" stop-color="#ffe2a8" stop-opacity="0.95"/><stop offset="0.25" stop-color="#ffb070" stop-opacity="0.55"/><stop offset="1" stop-color="#ff7a59" stop-opacity="0"/>
</radialGradient>
<linearGradient id="tower-grad" x1="0" x2="1" y1="0" y2="0">
  <stop offset="0" stop-color="#7a6ca5"/><stop offset="0.5" stop-color="#d8cde6"/><stop offset="1" stop-color="#ffd9c2"/>
</linearGradient>
<linearGradient id="dome-grad" x1="0" x2="1" y1="0" y2="0">
  <stop offset="0" stop-color="#8f84b5"/><stop offset="0.6" stop-color="#c9bfdc"/><stop offset="1" stop-color="#f3cdb8"/>
</linearGradient>
<linearGradient id="water-grad" x1="0" y1="${SHORE}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
  <stop offset="0" stop-color="#7a3a7a"/><stop offset="0.35" stop-color="#3a2268"/><stop offset="1" stop-color="#110b2d"/>
</linearGradient>
<linearGradient id="water-fade" x1="0" y1="${SHORE}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
  <stop offset="0" stop-color="#110b2d" stop-opacity="0"/><stop offset="1" stop-color="#110b2d" stop-opacity="0.7"/>
</linearGradient>
<pattern id="win-grid" width="9" height="12" patternUnits="userSpaceOnUse">
  <rect width="9" height="12" fill="none"/><path d="M0 0.5H9M0.5 0V12" stroke="#d9a441" stroke-width="1" opacity="0.55"/>
</pattern>
<pattern id="win-stripe" width="12" height="24" patternUnits="userSpaceOnUse">
  <rect x="0" y="0" width="3" height="24" fill="#8f86ad" opacity="0.6"/><rect x="5" y="6" width="5" height="9" fill="#ffe7b0" opacity="0.55"/>
</pattern>
<clipPath id="water-clip"><rect x="0" y="${SHORE}" width="${W}" height="${H - SHORE}"/></clipPath>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>`;

/** Defs used by tile overlays (glass sheen + motif patterns). */
export const TILE_DEFS = `
<linearGradient id="tile-glass" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#fff" stop-opacity="0.32"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.04"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/>
</linearGradient>
${MOTIF_DEFS}`;

/** Fully vector defs: artwork + tile overlays + tritone patterns (used for export). */
export const SKYLINE_DEFS = ART_DEFS + TILE_DEFS + TONE_DEFS;

export const SKYLINE_ART = `<g id="skyline">
<rect width="${W}" height="${SHORE}" fill="url(#sky-grad)"/>
${stars()}
<g transform="translate(300 190)"><circle r="46" fill="#fff4dc"/><circle cx="18" cy="-10" r="42" fill="#191550"/></g>
<rect width="${W}" height="${SHORE}" fill="url(#sun-glow)"/>
<circle cx="1500" cy="1040" r="78" fill="#ffe7b5" opacity="0.95"/>
<g stroke="#1b1436" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7">
  <path d="M1250 300q10 -8 20 0q10 -8 20 0"/><path d="M1310 330q8 -6 16 0q8 -6 16 0"/><path d="M1200 345q7 -5 14 0q7 -5 14 0"/>
</g>
${city()}
${water()}
${foreground()}
</g>`;

/** Standalone base artwork at a given pixel size (used for rasterising and tests). */
export function skylineSvg(width = W, height = H) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${W} ${H}"><defs>${ART_DEFS}</defs>${SKYLINE_ART}</svg>`;
}
