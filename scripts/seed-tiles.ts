/**
 * Initialise eventConfig, aggregates and the 300 tile documents in Firestore.
 * Usage (ADC or emulator):
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=my-project npm run seed:tiles
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-toronto-mosaic npm run seed:tiles
 */
import { getAdminFirestore } from "../src/lib/server/firebase-admin";
import { FirestoreDb } from "../src/lib/server/firestore-db";
import { MosaicService } from "../src/lib/server/mosaic-service";

async function main() {
  const service = new MosaicService(new FirestoreDb(getAdminFirestore()));
  await service.ensureInitialized();
  const created = await service.seedTiles();
  const agg = await service.recountAggregates();
  console.log(`Created ${created} tile documents. Aggregates:`, agg);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
