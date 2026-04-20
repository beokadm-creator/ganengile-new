import * as functions from 'firebase-functions';
import { admin, requireCallableAuth } from '../shared-admin';
import { encrypt } from '../utils/crypto';

interface RegisterTaxInfoData {
  residentNumber: string;
  bankName: string;
  bankAccountNumber: string;
  accountHolderName: string;
  consentAgreed: boolean;
}

export const registerTaxInfo = functions.https.onCall(
  async (data: RegisterTaxInfoData, context): Promise<{ success: boolean; message?: string }> => {
    const uid = requireCallableAuth(context, 'registerTaxInfo');

    if (!data.residentNumber || !data.bankName || !data.bankAccountNumber || !data.accountHolderName) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    if (!data.consentAgreed) {
      throw new functions.https.HttpsError('permission-denied', 'Must agree to tax information collection');
    }

    const encryptedResidentNumber = encrypt(data.residentNumber);
    const encryptedBankAccountNumber = encrypt(data.bankAccountNumber);

    try {
      const db = admin.firestore();
      const userRef = db.collection('users').doc(uid);
      const userSnap = await userRef.get();
      const userData = userSnap.data();
      
      if (!userData?.name) {
        throw new functions.https.HttpsError('failed-precondition', 'User name is not verified or missing');
      }

      const actualName = userData.name;

      if (data.accountHolderName && data.accountHolderName !== actualName) {
        throw new functions.https.HttpsError('invalid-argument', 'Account holder name must match verified user name');
      }

      await userRef.set(
        {
          taxInfo: {
            residentNumberEncrypted: encryptedResidentNumber,
            bankName: data.bankName,
            bankAccountNumberEncrypted: encryptedBankAccountNumber,
            accountHolderName: actualName,
            registeredAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const consentRef = db.collection('users').doc(uid).collection('consentHistory').doc('tax_collection');
      await consentRef.set({
        templateId: 'tax_collection',
        key: 'tax_collection',
        version: '1.0.0',
        agreedAt: admin.firestore.FieldValue.serverTimestamp(),
        title: '고유식별정보 수집 및 이용 동의 (세금 신고용)',
      });

      return { success: true };
    } catch (error) {
      console.error('Error registering tax info:', error);
      throw new functions.https.HttpsError('internal', 'Failed to save tax information');
    }
  }
);
