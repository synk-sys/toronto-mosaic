/**
 * Lightweight first-pass filter. It never auto-approves anything on its own —
 * it only decides whether a message can skip the queue when organizers have
 * turned moderation off, and flags suspicious messages for human review.
 */
const BLOCKLIST = [
  "fuck", "shit", "bitch", "cunt", "dick", "pussy", "asshole", "bastard", "slut", "whore",
  "nigger", "nigga", "faggot", "fag", "retard", "kike", "spic", "chink", "tranny",
  "nazi", "hitler", "kill yourself", "kys", "rape", "porn", "sex",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c);
}

const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|ca|xyz|ly|gg|app|dev)\b)/i;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const HANDLE_RE = /(^|\s)@[a-z0-9_]{2,}/i;

export interface ScreenResult {
  flagged: boolean;
  reasons: string[];
}

export function screenMessage(message: string): ScreenResult {
  const reasons: string[] = [];
  if (!message) return { flagged: false, reasons };
  const norm = normalize(message);
  const squashed = norm.replace(/[^a-z]/g, "");
  for (const word of BLOCKLIST) {
    const w = word.replace(/\s/g, "");
    const re = new RegExp(`(^|[^a-z])${word}([^a-z]|$)`);
    if (re.test(norm) || (w.length >= 5 && squashed.includes(w))) {
      reasons.push("language");
      break;
    }
  }
  if (URL_RE.test(message)) reasons.push("link");
  if (EMAIL_RE.test(message)) reasons.push("email");
  if (PHONE_RE.test(message)) reasons.push("phone");
  if (HANDLE_RE.test(message)) reasons.push("handle");
  if (/(.)\1{7,}/.test(message)) reasons.push("spam");
  return { flagged: reasons.length > 0, reasons };
}

/**
 * Initial moderation status for a new contribution:
 * - No message → approved (colour + curated symbol are always safe).
 * - Moderation on → pending until an organizer approves.
 * - Moderation off → approved, unless the filter flags it.
 */
export function initialStatus(message: string, moderationEnabled: boolean) {
  const screen = screenMessage(message);
  if (!message) return { status: "approved" as const, flagged: false };
  if (screen.flagged) return { status: "pending" as const, flagged: true };
  return { status: moderationEnabled ? ("pending" as const) : ("approved" as const), flagged: false };
}
