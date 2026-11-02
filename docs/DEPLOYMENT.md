# Deploying to Firebase App Hosting

## 1. Firebase project

1. Create a project at <https://console.firebase.google.com> and upgrade it to **Blaze** (App Hosting requires it).
2. **Firestore:** create a database in Native mode, in a region close to Toronto (e.g. `northamerica-northeast2`).
3. **Authentication → Sign-in method:** enable **Anonymous** and **Google**. Under *Settings → Authorized domains*, add your custom domain.
4. **Project settings → Your apps:** add a Web app and copy its config.

## 2. Rules and indexes

```bash
npm i -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc     # set your project id
firebase deploy --only firestore:rules,firestore:indexes
```

## 3. Configure `apphosting.yaml`

Fill in the `NEXT_PUBLIC_FIREBASE_*` values, `NEXT_PUBLIC_SITE_URL` (the URL printed on the QR code) and `ORGANIZER_EMAILS`. The presence of `NEXT_PUBLIC_FIREBASE_API_KEY` switches the app into Firebase mode.

Optional Gemini captions:
```bash
firebase apphosting:secrets:set gemini-api-key
```
Then uncomment the `GEMINI_API_KEY` block. Organizers can also use a custom claim instead of the email list:
```js
admin.auth().setCustomUserClaims(uid, { organizer: true })
```

## 4. Create the backend and deploy

```bash
firebase apphosting:backends:create --project <id>   # connect the GitHub repo, branch main, root /
```
Each push to `main` then rolls out automatically. To deploy from a local checkout instead, run `firebase deploy --only apphosting`.

## 5. Initialise data

Sign in at `/admin` and press **Initialise tiles**. This creates the 300 tile documents, the config and the aggregates. From a terminal with Application Default Credentials:
```bash
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<id> npm run seed:tiles
```

## 6. Custom domain

In **App Hosting → your backend → Settings → Domains**, add `mosaic.example.com` and the DNS records it shows. Add the domain to Auth's authorized domains.

## Environment variables

See `.env.example`.

| Variable | Mode | Purpose |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID` | Firebase | Web SDK config; presence enables Firebase mode |
| `NEXT_PUBLIC_SITE_URL` | both | Canonical URL for QR codes and share links |
| `ORGANIZER_EMAILS` | Firebase | Comma-separated Google accounts allowed into `/admin` |
| `LOCAL_ADMIN_PASSCODE`, `SESSION_SECRET` | local | Admin passcode and cookie signing key (both required in production) |
| `ALLOW_DEMO_SEED`, `ALLOW_RESET` | both | Rehearsal tools; default on locally, off in Firebase mode |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | optional | AI captions |
| `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `NEXT_PUBLIC_*_EMULATOR_HOST` | dev | Emulators |

## Capacity notes

- `minInstances: 2` avoids cold starts when the QR code first appears. `concurrency: 80` × up to 10 instances easily covers bursts of 100+ submits.
- Each phone holds three realtime listeners. With 300 attendees, a full day of reads stays well within Firestore's free tier.
- Rate limiting is in memory per instance. For hostile environments, add [Firebase App Check](https://firebase.google.com/docs/app-check) to make anonymous-account farming expensive.
- After the event, set `minInstances: 0` and `submissionsEnabled: false`.
