"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { firebaseWebConfig, isFirebaseMode } from "@/lib/env";

let app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseMode()) return null;
  app ??= getApps()[0] ?? initializeApp(firebaseWebConfig);
  return app;
}

export async function getClientAuth() {
  const a = getFirebaseApp();
  if (!a) return null;
  const { getAuth, connectAuthEmulator } = await import("firebase/auth");
  const auth = getAuth(a);
  const emu = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emu && !(auth as unknown as { _emu?: boolean })._emu) {
    connectAuthEmulator(auth, `http://${emu}`, { disableWarnings: true });
    (auth as unknown as { _emu?: boolean })._emu = true;
  }
  return auth;
}

export async function getClientFirestore() {
  const a = getFirebaseApp();
  if (!a) return null;
  const { getFirestore, connectFirestoreEmulator } = await import("firebase/firestore");
  const db = getFirestore(a);
  const emu = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST;
  if (emu && !(db as unknown as { _emu?: boolean })._emu) {
    const [host, port] = emu.split(":");
    connectFirestoreEmulator(db, host, Number(port));
    (db as unknown as { _emu?: boolean })._emu = true;
  }
  return db;
}

/** Anonymous participant identity. Persisted by Firebase across refreshes. */
export async function ensureAnonymousUser() {
  const auth = await getClientAuth();
  if (!auth) return null;
  const { onAuthStateChanged, signInAnonymously } = await import("firebase/auth");
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  await new Promise<void>((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        unsub();
        resolve();
      }
    });
  });
  return cred.user;
}
