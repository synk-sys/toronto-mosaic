# Event-day operations

## The week before

- [ ] Deploy to production. Check `/`, `/mosaic`, `/display` and `/admin` on the real domain.
- [ ] Every organizer signs in to `/admin` once with Google (this confirms `ORGANIZER_EMAILS`).
- [ ] Run **Initialise tiles**. Stats should show 0 contributions and 300 tiles remaining.
- [ ] Print the QR code (**Admin → Event QR code → PNG 2048px**). Scan it from both iOS and Android.
- [ ] Rehearse on the **actual projector**: open `/display?demo=220`, press **F**, then **A**, then **R**. Check that the colours, legibility from the back row and the final message all work.
- [ ] Test the venue Wi-Fi. A phone on venue Wi-Fi submits, and the tile appears on the projector within about 3 s.
- [ ] Brief the moderators (at least 2): approve kind messages; **Hide** the message if only the text is a problem; **Remove** only for abuse.

## Morning of the event

- [ ] `minInstances` ≥ 2 is deployed. Submissions are **open**, moderation is **on** and public messages are **on**.
- [ ] Projector laptop: Chrome, power plugged in, sleep and screen saver off, notifications muted. Open `/display`, press **F**.
- [ ] If you used rehearsal data in production, reset or remove it. The projector count must show only real participants.
- [ ] Moderators keep `/admin` open on the **Pending** tab (it auto-refreshes every 6 s).

## During the day

- Watch **Pending review**: aim to keep the queue under 20. Flagged messages carry an "auto-flagged" badge.
- If the counters ever look wrong, use **Maintenance → Recount totals**.
- If a problem appears on the projector, **Show messages publicly → off** removes all message text from public surfaces immediately.
- If attendees report errors, the app already retries automatically and keeps their draft. Check App Hosting logs for `[mosaic]` entries.

## Closing ceremony

1. About 10 minutes before: clear the pending queue, then switch **Submissions open → off**. The QR panel disappears from the projector.
2. The projector shows `/display` in fullscreen, in collecting mode.
3. On the MC's cue: **Admin → 🎆 Trigger the reveal → OK**. Every open projector runs blackout → tiles → skyline → beacon sweep → *"Many ideas. One city. One future."* together with the real participant count, in about 11 s. Press **P** on the projector to replay it.
4. Afterwards: **High-res PNG (6000×4500)**, **Vector SVG** and **CSV/JSON export** for the recap, social posts and prints.

## Troubleshooting

| Symptom | Action |
|---|---|
| Projector shows "Reconnecting…" | Check the network; it recovers automatically. Reload the page if needed. A reveal that has already happened re-renders as the final artwork. |
| "Submissions are paused" on phones | **Submissions open** is off. Turn it on. |
| Organizer can't access `/admin` | Their email isn't in `ORGANIZER_EMAILS`, or they used a different Google account. |
| Mosaic full (300) | Expected. Attendees see a celebration message and can still explore. Remove abusive tiles to free space. |
| Gemini errors | They're harmless: captions are optional. Remove `GEMINI_API_KEY` to disable them. |

## After the event

- Set `submissionsEnabled: false` and `minInstances: 0`, then redeploy.
- Export approved contributions. Decide on a retention period, then delete `contributions` and `participants` (they're the only collections holding UIDs).
