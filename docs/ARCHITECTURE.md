# Architecture

**Stack:** Next.js 16 App Router · TypeScript · Tailwind CSS v4 · shadcn/ui (Radix) · Motion · Firebase Auth (anonymous + Google) · Firestore · Firebase App Hosting · optional Gemini.

```
Phone ──(anon ID token)──▶ Next.js route handlers ──Admin SDK──▶ Firestore
  ▲                         validation · rate limits ·             │
  │                         atomic allocation · moderation         │
  └──────── realtime onSnapshot (public collections only) ◀────────┘
Projector / explorer read tiles, eventConfig and aggregates directly (public, privacy-safe).
```

All writes go through the server. Firestore rules deny every client write. The server uses the Admin SDK.

## Data model

| Doc | Visibility | Fields |
|---|---|---|
| `contributions/{id}` | **server only** | participantUid, tileId, color, symbol, message, moderationStatus (`pending`/`approved`/`hidden`/`removed`), createdAt, updatedAt, aiCaption, motif, flagged |
| `tiles/{tileId}` (`r07c12`) | public read | occupied, contributionId, displayColor, displaySymbol, displayMessage\*, displayCaption\*, displayMotif, seq, updatedAt |
| `eventConfig/main` | public read | submissionsEnabled, moderationEnabled, revealMode (`collecting`/`revealed`), targetContributions, publicMessagesEnabled |
| `aggregates/main` | public read | totalContributions, approvedContributions, pendingContributions, remainingTiles, lastUpdated |
| `participants/{uid}` | owner read | contributionId, createdAt (the one-per-participant lock) |

\* `displayMessage` and `displayCaption` are only written when the contribution is **approved** and public messages are **enabled**. Turning public messages off rewrites every tile, so unmoderated or hidden text never exists in a publicly readable document.

`contributionId` is a 96-bit random ID, used as the unguessable share link. Participant UIDs never leave the server, and admin views and exports omit them too.

## Atomic, idempotent tile allocation (`MosaicService.submit`)

1. The UID comes from a verified credential: a Firebase anonymous ID token, or a signed cookie in local mode. Client-supplied UIDs and tile IDs are rejected because the zod schema is `.strict()`.
2. Pick a candidate from the first 12 free tiles in allocation order, at random. This keeps the even spread and makes collisions between concurrent requests unlikely.
3. In a Firestore transaction:
   - read `participants/{uid}`; if it exists, return the existing contribution (idempotent)
   - read `eventConfig/main` (paused → `423`)
   - read `tiles/{candidate}`; if it's occupied, abort and retry with another candidate
   - write the contribution, the tile and the participant lock
4. Concurrent claims on the same tile conflict at commit. Firestore retries, the retry sees the tile occupied, and the request moves on. Full mosaic → `409 MOSAIC_FULL`, with a friendly message in the UI.
5. Aggregates are updated with `FieldValue.increment` after commit, which avoids a hot document inside the transaction. **Admin → Recount totals** reconciles them from source documents.

The same code runs against `MemoryDb` (`src/lib/server/db.ts`), which implements optimistic-concurrency transactions: reads are versioned, validated at commit and retried. The unit tests therefore exercise the real allocation path under 100-way concurrency.

## Moderation

- No message → approved immediately. Colour and symbol come from curated lists, so they are always safe to show.
- With a message: `pending` while moderation is on. If moderation is off it is auto-approved, **unless** the filter flags it (profanity, links, emails, phone numbers, handles or spam). Flagged messages always wait for a human.
- **Hide** keeps the tile but hides the message. **Remove** frees the tile. Pending tiles show colour and symbol only.

## Security & privacy

- Firestore rules: public read on `tiles`, `eventConfig/main` and `aggregates/main`; owner-only read on `participants`; no access to `contributions`; no client writes anywhere.
- Organizer access is enforced on the server for every `/api/admin/*` call. In Firebase mode that means a Google ID token whose verified email is in `ORGANIZER_EMAILS`, or whose custom claim is `organizer: true`. In local mode it means an HMAC-signed, expiring cookie.
- Rate limits are per instance: 6 submits/min per participant, 150/min per IP (conference Wi-Fi shares one NAT address), plus a login throttle. They're backed by transactional one-tile-per-UID enforcement.
- Same-origin checks on state-changing requests, a 4 KB body cap, sanitised messages (control and bidi characters stripped), escaping for CSV formula injection, security headers.
- Gemini (optional) receives **only the message text**, with a 6 s timeout, after the response has been sent (`after()`). Its caption is shown only once the message is approved.
