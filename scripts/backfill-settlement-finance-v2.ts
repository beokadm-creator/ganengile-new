/**
 * Backfill settlement finance fields (v2)
 *
 * Usage:
 * FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json npx tsx scripts/backfill-settlement-finance-v2.ts
 * FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json npx tsx scripts/backfill-settlement-finance-v2.ts --apply
 */

import admin from 'firebase-admin';
import fs from 'fs';

const shouldApply = process.argv.includes('--apply');
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

function toNonNegativeNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }
  return null;
}

async function run() {
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let scanned = 0;
  let candidates = 0;
  let updated = 0;

  while (true) {
    let q = db.collection('settlements').orderBy(admin.firestore.FieldPath.documentId()).limit(200);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    for (const settlementDoc of snap.docs) {
      scanned += 1;
      const settlement = settlementDoc.data() as any;
      const requestId = settlement?.requestId ?? settlementDoc.id;
      if (!requestId) continue;

      const requestSnap = await db.collection('requests').doc(requestId).get();
      const requestData = requestSnap.exists ? (requestSnap.data() as any) : null;
      const fee = requestData?.feeBreakdown || requestData?.fee ?? null;

      let payment: any = null;
      if (settlement?.earningPaymentId) {
        const paymentSnap = await db.collection('payments').doc(settlement.earningPaymentId).get();
        payment = paymentSnap.exists ? paymentSnap.data() : null;
      }

      const customerPaidAmount = toNonNegativeNumber(
        settlement?.customerPaidAmount,
        fee?.totalFee,
        requestData?.initialNegotiationFee
      ) ?? 0;
      const publicFareAmount = toNonNegativeNumber(settlement?.publicFareAmount, fee?.publicFare) ?? 0;
      const vatAmount = toNonNegativeNumber(settlement?.vatAmount, fee?.vat) ?? 0;
      const feeSupplyAmount = Math.max(0, customerPaidAmount - publicFareAmount - vatAmount);
      const platformServiceFeeAmount = toNonNegativeNumber(settlement?.platformServiceFeeAmount, fee?.serviceFee) ?? 0;
      const platformFeeAmount = toNonNegativeNumber(settlement?.platformFeeAmount, fee?.breakdown?.platformFee, payment?.fee) ?? 0;
      const gillerGrossAmount = toNonNegativeNumber(settlement?.gillerGrossAmount, fee?.breakdown?.gillerFee, payment?.amount) ??
        Math.max(0, customerPaidAmount - platformFeeAmount);
      const gillerWithholdingTaxAmount = toNonNegativeNumber(settlement?.gillerWithholdingTaxAmount, payment?.tax) ??
        Math.round(gillerGrossAmount * 0.033);
      const gillerNetAmount = toNonNegativeNumber(settlement?.gillerNetAmount, payment?.netAmount) ??
        Math.max(0, gillerGrossAmount - gillerWithholdingTaxAmount);

      const needsUpdate =
        settlement?.settlementVersion !== 2 ||
        settlement?.customerPaidAmount == null ||
        settlement?.feeSupplyAmount == null ||
        settlement?.vatAmount == null ?? settlement?.gillerNetAmount == null;

      if (!needsUpdate) continue;

      candidates += 1;
      if (shouldApply) {
        await settlementDoc.ref.set(
          {
            settlementVersion: 2,
            customerPaidAmount,
            publicFareAmount,
            vatAmount,
            feeSupplyAmount,
            platformServiceFeeAmount,
            platformFeeAmount,
            gillerGrossAmount,
            gillerWithholdingTaxAmount,
            gillerNetAmount,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        updated += 1;
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
  }

  console.log(`scanned=${scanned}`);
  console.log(`candidates=${candidates}`);
  console.log(`updated=${updated}`);
  console.log(shouldApply ? 'APPLY MODE' : 'DRY RUN MODE');
}

run().catch((error) => {
  console.error('backfill failed:', error);
  process.exit(1);
});
