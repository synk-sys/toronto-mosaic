/**
 * Runtime mode. When a Firebase web config is present the app uses Firebase
 * Auth + Firestore; otherwise it runs as a self-contained local prototype
 * (in-memory store, signed-cookie sessions, passcode admin).
 */
export const firebaseWebConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseMode = () => !!(firebaseWebConfig.apiKey && firebaseWebConfig.projectId);

export const publicSiteUrl = () => process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
