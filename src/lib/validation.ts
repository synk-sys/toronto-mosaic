import { z } from "zod";
import { COLOR_IDS, MESSAGE_MAX, SYMBOL_CHARS } from "./palette";

/** Collapse whitespace, strip control/zero-width/bidi characters. */
export function sanitizeMessage(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁯﻿]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Count user-perceived characters (emoji count as one). */
export function graphemeLength(s: string) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    let n = 0;
    for (const _ of new Intl.Segmenter("en", { granularity: "grapheme" }).segment(s)) n++;
    return n;
  }
  return [...s].length;
}

/**
 * Submission payload. Note what is NOT here: participant ID and tile ID.
 * Both are derived on the server and anything extra is rejected (strict).
 */
export const submissionSchema = z
  .object({
    color: z.enum(COLOR_IDS),
    symbol: z.string().refine((s) => SYMBOL_CHARS.includes(s), "Unknown symbol"),
    message: z
      .string()
      .max(MESSAGE_MAX * 4)
      .optional()
      .default("")
      .transform(sanitizeMessage)
      .refine((s) => graphemeLength(s) <= MESSAGE_MAX, `Message must be ${MESSAGE_MAX} characters or fewer`),
  })
  .strict();

export type SubmissionInput = z.input<typeof submissionSchema>;
export type Submission = z.output<typeof submissionSchema>;

export const moderationActionSchema = z
  .object({
    action: z.enum(["approve", "hide", "remove"]),
  })
  .strict();

export const configPatchSchema = z
  .object({
    submissionsEnabled: z.boolean().optional(),
    moderationEnabled: z.boolean().optional(),
    revealMode: z.enum(["collecting", "revealed"]).optional(),
    targetContributions: z.number().int().min(1).max(300).optional(),
    publicMessagesEnabled: z.boolean().optional(),
  })
  .strict();

export type ConfigPatch = z.infer<typeof configPatchSchema>;
