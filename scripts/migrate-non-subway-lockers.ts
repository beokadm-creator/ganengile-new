/**
 * Migrate non-subway lockers from lockers -> non_subway_lockers.
 *
 * Usage:
 *   node scripts/migrate-non-subway-lockers.ts --apply
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? path.join(process.env.HOME || '', 'Downloads/ganengile-firebase-adminsdk-fbsvc-6178badd66.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ Service account not found: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

async function main() {
  console.log('🔧 Migrate non-subway lockers');
  console.log(`- Apply: ${apply ? 'YES' : 'NO (dry-run)'}`);

  const snap = await db.collection('lockers').where('isSubway', '==', false).get();
  const docs = snap.docs;
  console.log(`- Found: ${docs.length}`);

  let batch = db.batch();
  let count = 0;
  let migrated = 0;

  for (const doc of docs) {
    const data = doc.data();
    const targetRef = db.collection('non_subway_lockers').doc(doc.id);
    batch.set(targetRef, data, { merge: true });
    batch.delete(doc.ref);
    count++;
    migrated++;

    if (count >= 400) {
      if (apply) {
        await batch.commit();
      }
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0 && apply) {
    await batch.commit();
  }

  console.log(`- Migrated: ${migrated}`);
  console.log('✅ Done');
}

main().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
