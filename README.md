# Toronto Mosaic

A collaborative digital artwork for **Google DevFest Toronto 2026**. Each of ~300 attendees adds one tile (a colour, a symbol and an optional hope for the future) to a 20 × 15 SVG mosaic of the Toronto skyline. The finished artwork is revealed on the projector at the closing ceremony.

> **Many ideas. One city. One future.**

| Route | Who | What |
|---|---|---|
| `/` | Attendees (QR code) | Create a tile: colour → symbol → message → preview → submit → share |
| `/mosaic` | Everyone | Explore the live mosaic; tap or use the keyboard to read approved contributions |
| `/c/[id]` | Everyone | Shareable page for one tile, with a downloadable image |
| `/display` | Projector | Live counter, animated tile placement, organizer-triggered reveal. `?demo=220` for rehearsals |
| `/admin` | Organizers | Moderation, event controls, QR code, exports, high-res artwork |

## Quick start (local prototype, no Firebase needed)

```bash
npm install
npm run dev            # http://localhost:3000
```

With no Firebase variables set, the app runs as a **self-contained prototype**:
- an in-memory store with real transactional semantics (data resets when the server restarts)
- anonymous participants identified by a signed, httpOnly cookie
- `/admin` protected by a passcode (`devfest` in dev; set `LOCAL_ADMIN_PASSCODE` in production)
- **Admin → Maintenance → Seed 60 synthetic tiles** to fill the mosaic quickly
- `/display?demo=220` runs a client-side rehearsal: tiles arrive one by one, **A** fills them all, **R** runs the reveal. Nothing is written to the database and the screen is labelled DEMO.

Projector shortcuts: **F** toggles fullscreen and **P** replays the reveal (after one has been triggered).

## How the artwork works

- `src/lib/art/skyline.ts` is an original, procedurally drawn dusk skyline: CN Tower, Rogers Centre, Royal Bank Plaza, First Canadian Place, Scotia Plaza, Aura, the Gooderham Flatiron, the lake and its reflections, the islands, a ferry and a sailboat.
- A claimed tile shows its **slice of the skyline re-inked in the attendee's colour** as a three-tone ramp (dark tone → colour → warm highlight), plus a motif texture (rays, waves, leaves, circuits, sparkles or hearts) and the attendee's symbol. The skyline stays legible at any fill level, so this reads as one coherent stained-glass artwork rather than 300 unrelated squares.
- **Allocation order** follows ordered-dither (Bayer) ranking, so any number of contributions is spread evenly across the composition.
- **Under-participation:** at the reveal, the veil lifts from unclaimed tiles and they show the original illustration, so the artwork always looks complete. The participant count shown is always the real one.
- **Two modes**, *Tiles* (individual pieces) and *Skyline* (the seamless artwork), with a staggered transition that radiates from the CN Tower. The reveal is: blackout → tiles → merge into skyline → beacon sweep → final message.
- **Performance:** the browser rasterizes the vector art and its six colour tones into bitmaps once. Every mosaic then paints cached images, measured at about 60 fps idle and about 43 fps mid-transition in headless Chromium at 1920×1080. Exports still use the vector source.

## Tests

```bash
npm test            # unit + API tests (Vitest): 38 tests
npm run build && npm run test:e2e   # Playwright: mobile flow, live updates, fullscreen, reveal, moderation, export
npm run test:rules  # Firestore security rules (needs Firebase CLI + Java 21 for the emulator)
npm run lint && npm run typecheck
```

| Requirement | Where it's tested |
|---|---|
| Duplicate submissions (sequential + 20 concurrent from one participant) | `tests/unit/allocation.test.ts`, `api.test.ts`, `attendee.spec.ts` |
| Concurrent tile assignment (100-way burst, no double allocation) | `allocation.test.ts` |
| Capacity limits (exactly 300; over-capacity burst; 301st is rejected gracefully) | `allocation.test.ts` |
| Moderation (pending, approve, hide, remove, public-message toggle, AI caption gating) | `moderation.test.ts`, `admin.spec.ts` |
| Public/private data access (no UIDs anywhere public; forged cookies; organizer auth; rules) | `privacy.test.ts`, `api.test.ts`, `tests/rules/` |
| Mobile responsiveness (no horizontal scroll on any step; Pixel 7) | `attendee.spec.ts` |
| Live updates (submission on another device updates the projector) | `display.spec.ts` |
| Fullscreen display | `display.spec.ts` |
| Artwork export (SVG structure, XSS-safe card, a real 6000×4500 PNG download) | `export.test.ts`, `admin.spec.ts` |

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): data model, tile allocation, security model
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Firebase App Hosting setup, env vars, rules, indexes
- [docs/OPERATIONS.md](docs/OPERATIONS.md): event-day checklist and runbook
