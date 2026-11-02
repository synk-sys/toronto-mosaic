import { isFirebaseMode } from "@/lib/env";
import { MemoryDb, type DocDb } from "./db";
import { MosaicService } from "./mosaic-service";

const g = globalThis as unknown as { __mosaicService?: MosaicService };

async function createDb(): Promise<DocDb> {
  if (isFirebaseMode() || process.env.MOSAIC_BACKEND === "firestore") {
    const [{ getAdminFirestore }, { FirestoreDb }] = await Promise.all([
      import("./firebase-admin"),
      import("./firestore-db"),
    ]);
    return new FirestoreDb(getAdminFirestore());
  }
  return new MemoryDb();
}

let pending: Promise<MosaicService> | null = null;

/** Process-wide service singleton (survives dev hot reloads). */
export function getService(): Promise<MosaicService> {
  if (g.__mosaicService) return Promise.resolve(g.__mosaicService);
  pending ??= createDb().then((db) => (g.__mosaicService = new MosaicService(db)));
  return pending;
}

/** Test hook: inject a service backed by a fresh database. */
export function setServiceForTests(service: MosaicService | undefined) {
  g.__mosaicService = service;
  pending = null;
}

export const demoSeedAllowed = () =>
  process.env.ALLOW_DEMO_SEED === "true" || (!isFirebaseMode() && process.env.ALLOW_DEMO_SEED !== "false");

export const resetAllowed = () =>
  process.env.ALLOW_RESET === "true" || (!isFirebaseMode() && process.env.ALLOW_RESET !== "false");
