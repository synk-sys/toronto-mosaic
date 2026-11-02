/**
 * Curated, Toronto-inspired palette. Every colour was chosen to stay legible
 * as a hue tint over the dusk skyline and to read well on a projector.
 */
export const COLORS = [
  { id: "maple", name: "Maple Red", hex: "#E8384F", ink: "#FFFFFF" },
  { id: "sunset", name: "Harbour Sunset", hex: "#FF8A3D", ink: "#1A1033" },
  { id: "gold", name: "Island Gold", hex: "#FFC93C", ink: "#1A1033" },
  { id: "ravine", name: "Ravine Green", hex: "#2DBE7E", ink: "#0B1A12" },
  { id: "lake", name: "Lake Blue", hex: "#2F8FFF", ink: "#FFFFFF" },
  { id: "aurora", name: "Aurora Violet", hex: "#9B5CFF", ink: "#FFFFFF" },
] as const;

export type ColorId = (typeof COLORS)[number]["id"];
export const COLOR_IDS = COLORS.map((c) => c.id) as [ColorId, ...ColorId[]];

export function getColor(id: string) {
  return COLORS.find((c) => c.id === id) ?? COLORS[4];
}

/** Visual motifs a tile can carry (pattern overlay). */
export const MOTIFS = ["rays", "waves", "leaves", "circuits", "sparkles", "hearts"] as const;
export type Motif = (typeof MOTIFS)[number];

/**
 * Curated symbols. A closed list keeps the projector family-friendly without
 * moderating symbols, and each one maps to a default motif so tiles have a
 * distinct visual texture even when AI captions are disabled.
 */
export const SYMBOLS: { char: string; label: string; motif: Motif }[] = [
  { char: "🍁", label: "Maple leaf", motif: "leaves" },
  { char: "🏙️", label: "City skyline", motif: "rays" },
  { char: "🌊", label: "Lake wave", motif: "waves" },
  { char: "🚋", label: "Streetcar", motif: "rays" },
  { char: "🦝", label: "Raccoon", motif: "sparkles" },
  { char: "🚲", label: "Bicycle", motif: "waves" },
  { char: "🌱", label: "Seedling", motif: "leaves" },
  { char: "💡", label: "Idea", motif: "rays" },
  { char: "🤝", label: "Handshake", motif: "hearts" },
  { char: "❤️", label: "Heart", motif: "hearts" },
  { char: "🌈", label: "Rainbow", motif: "rays" },
  { char: "✨", label: "Sparkles", motif: "sparkles" },
  { char: "🚀", label: "Rocket", motif: "sparkles" },
  { char: "💻", label: "Laptop", motif: "circuits" },
  { char: "🤖", label: "Robot", motif: "circuits" },
  { char: "🧠", label: "Brain", motif: "circuits" },
  { char: "🎨", label: "Palette", motif: "sparkles" },
  { char: "🎵", label: "Music", motif: "waves" },
  { char: "📚", label: "Books", motif: "leaves" },
  { char: "🌍", label: "Globe", motif: "waves" },
  { char: "☀️", label: "Sun", motif: "rays" },
  { char: "🏒", label: "Hockey", motif: "circuits" },
  { char: "⭐", label: "Star", motif: "sparkles" },
  { char: "🕊️", label: "Dove", motif: "hearts" },
];

export const SYMBOL_CHARS = SYMBOLS.map((s) => s.char);

export function getSymbol(char: string) {
  return SYMBOLS.find((s) => s.char === char);
}

export function defaultMotif(symbol: string): Motif {
  return getSymbol(symbol)?.motif ?? "sparkles";
}

export const MESSAGE_MAX = 120;
export const PROMPT = "What future would you love to see?";
export const FINAL_MESSAGE = "Many ideas. One city. One future.";
export const EVENT_NAME = "Google DevFest Toronto 2026";
