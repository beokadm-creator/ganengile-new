import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'ganengile' });
}

const db = admin.firestore();

async function main() {
  console.log('🗑️ Removing sample/mock lockers...');
  const snap = await db.collection('lockers').where('source', '==', 'sample_data').get();
  if (snap.size === 0) {
    console.log('No sample lockers found.');
    process.exit(0);
  }
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`Deleted ${snap.size} sample lockers.`);
}

main().catch(console.error);
