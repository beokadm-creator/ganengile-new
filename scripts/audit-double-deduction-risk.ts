/**
 * Audit potential double-deduction risk in settlements/payments
 *
 * Usage:
 * FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json npx tsx scripts/audit-double-deduction-risk.ts
 */

import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('FIREBASE_SERVICE_ACCOUNT_PATH is required');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

async function run() {
  const settlementsSnap = await db
    .collection('settlements')
    .where('status', '==', 'completed')
    .limit(500)
    .get();

  let checked = 0;
  let riskyCount = 0;
  const riskySamples: Array<{
    settlementId: string;
    requestId: string;
    requestPlatformFee: number;
    paymentFee: number;
    paymentAmount: number;
  }> = [];

  for (const doc of settlementsSnap.docs) {
    checked += 1;
    const settlement = doc.data() as any;
    const requestId = settlement?.requestId;
    if (!requestId) continue;

    const requestSnap = await db.collection('requests').doc(requestId).get();
    const request = requestSnap.exists ? (requestSnap.data() as any) : null;
    const fee = request?.feeBreakdown || request?.fee ?? null;
    const requestPlatformFee = Number(fee?.breakdown?.platformFee ?? 0);

    const earningPaymentId = settlement?.earningPaymentId;
    if (!earningPaymentId) continue;
    const paymentSnap = await db.collection('payments').doc(earningPaymentId).get();
    const payment = paymentSnap.exists ? (paymentSnap.data() as any) : null;
    const paymentFee = Number(payment?.fee ?? 0);
    const paymentAmount = Number(payment?.amount ?? 0);

    const isRisky = requestPlatformFee > 0 && paymentFee > 0;
    if (!isRisky) continue;

    riskyCount += 1;
    if (riskySamples.length < 30) {
      riskySamples.push({
        settlementId: doc.id,
        requestId,
        requestPlatformFee,
        paymentFee,
        paymentAmount,
      });
    }
  }

  console.log(`checked=${checked}`);
  console.log(`riskyCount=${riskyCount}`);
  console.log('samples=', JSON.stringify(riskySamples, null, 2));
}

run().catch((error) => {
  console.error('audit failed:', error);
  process.exit(1);
});
