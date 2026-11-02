/**
 * Firestore security rules tests. Requires the Firestore emulator:
 *   npm run test:rules        (wraps `firebase emulators:exec`)
 * Skipped automatically when FIRESTORE_EMULATOR_HOST is not set.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";

const hasEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
let env: RulesTestEnvironment;

describe.skipIf(!hasEmulator)("firestore.rules", () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: "demo-toronto-mosaic",
      firestore: { rules: readFileSync("firestore.rules", "utf8") },
    });
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "tiles/r00c00"), { occupied: true, displayColor: "lake", displaySymbol: "🍁" });
      await setDoc(doc(db, "eventConfig/main"), { submissionsEnabled: true });
      await setDoc(doc(db, "aggregates/main"), { totalContributions: 1 });
      await setDoc(doc(db, "contributions/c1"), { participantUid: "alice", message: "secret pending text" });
      await setDoc(doc(db, "participants/alice"), { contributionId: "c1" });
    });
  });
  afterAll(async () => env?.cleanup());

  it("anyone can read public projections", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "tiles/r00c00")));
    await assertSucceeds(getDocs(collection(db, "tiles")));
    await assertSucceeds(getDoc(doc(db, "eventConfig/main")));
    await assertSucceeds(getDoc(doc(db, "aggregates/main")));
  });

  it("nobody can read private contributions", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "contributions/c1")));
    await assertFails(getDoc(doc(env.authenticatedContext("alice").firestore(), "contributions/c1")));
    await assertFails(getDocs(collection(env.authenticatedContext("alice").firestore(), "contributions")));
  });

  it("participants can read only their own lock document", async () => {
    await assertSucceeds(getDoc(doc(env.authenticatedContext("alice").firestore(), "participants/alice")));
    await assertFails(getDoc(doc(env.authenticatedContext("bob").firestore(), "participants/alice")));
  });

  it("clients can never write (tile assignment is server-only)", async () => {
    const db = env.authenticatedContext("mallory").firestore();
    await assertFails(setDoc(doc(db, "tiles/r00c01"), { occupied: true }));
    await assertFails(setDoc(doc(db, "contributions/x"), { participantUid: "mallory" }));
    await assertFails(setDoc(doc(db, "eventConfig/main"), { revealMode: "revealed" }));
    await assertFails(setDoc(doc(db, "aggregates/main"), { totalContributions: 9999 }));
    await assertFails(setDoc(doc(db, "participants/mallory"), { contributionId: "x" }));
  });
});
