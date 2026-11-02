import { MOTIFS, type Motif } from "@/lib/palette";

/**
 * Optional Gemini enhancement: turns an attendee's message into a short
 * artistic caption and picks a visual motif. Only the message text is sent —
 * no participant identifiers, colour choices or metadata. Submission, tile
 * placement and the reveal never depend on this succeeding.
 */
export const geminiEnabled = () => !!process.env.GEMINI_API_KEY && process.env.GEMINI_ENABLED !== "false";

export async function enhanceMessage(message: string, timeoutMs = 6000): Promise<{ caption: string; motif: Motif } | null> {
  if (!geminiEnabled() || !message.trim()) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = [
    "You are a poet writing captions for tiles in a community mosaic of the Toronto skyline.",
    "Rewrite the attendee's hope for the future as an uplifting caption of at most 8 words.",
    "Keep its meaning. No hashtags, no quotes, no names, no emoji.",
    `Also choose one visual motif from: ${MOTIFS.join(", ")}.`,
    'Reply as JSON: {"caption": string, "motif": string}.',
    "If the text is offensive or not a hope for the future, reply {\"caption\": \"\", \"motif\": \"sparkles\"}.",
    "",
    `Attendee text: ${JSON.stringify(message.slice(0, 120))}`,
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.8, maxOutputTokens: 80 },
      }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const text: string = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text) as { caption?: string; motif?: string };
    const caption = (parsed.caption ?? "").replace(/["“”#]/g, "").trim().slice(0, 80);
    const motif = (MOTIFS as readonly string[]).includes(parsed.motif ?? "") ? (parsed.motif as Motif) : "sparkles";
    if (!caption) return null;
    return { caption, motif };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
