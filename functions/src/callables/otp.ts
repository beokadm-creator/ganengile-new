import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import {
  RequestPhoneOtpData,
  RequestPhoneOtpResult,
  ConfirmPhoneOtpData,
  ConfirmPhoneOtpResult,
} from '../types';
import {
  db,
  requireCallableAuth,
  hashOtpCode,
  getFirstNonEmptyString,
  OTP_SESSION_COLLECTION,
  OTP_LENGTH,
  OTP_TTL_MS,
  OTP_RESEND_MS,
  OTP_MAX_ATTEMPTS,
  OTP_TEST_CODE_PARAM,
  OTP_TEST_MODE_PARAM,
} from '../shared-admin';

function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '');
}

function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length < 7) {
    return phoneNumber;
  }

  return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 4)}**-${phoneNumber.slice(-4)}`;
}

function isValidKoreanMobileNumber(phoneNumber: string): boolean {
  return /^010\d{8}$/.test(phoneNumber);
}

function createOtpCode(): string {
  const max = 10 ** OTP_LENGTH;
  const code = Math.floor(Math.random() * max);
  return String(code).padStart(OTP_LENGTH, '0');
}

function isOtpTestModeEnabled(): boolean {
  const raw = getFirstNonEmptyString(
    OTP_TEST_MODE_PARAM.value(),
    process.env.OTP_TEST_MODE,
    'true'
  )
    .trim()
    .toLowerCase();
  return raw !== 'false';
}

export const requestPhoneOtp = functions.https.onCall(
  async (data: RequestPhoneOtpData, context): Promise<RequestPhoneOtpResult> => {
    const userId = requireCallableAuth(context, 'requestPhoneOtp');
    const phoneNumber = normalizePhoneNumber(data?.phoneNumber ?? '');
    if (!isValidKoreanMobileNumber(phoneNumber)) {
      throw new functions.https.HttpsError('invalid-argument', 'A valid Korean mobile number is required');
    }

    const testMode = isOtpTestModeEnabled();
    const now = Date.now();
    const verifiedPhoneOwnerQuery = await db
      .collection('users')
      .where('phoneVerification.phoneNumber', '==', phoneNumber)
      .where('phoneVerification.verified', '==', true)
      .limit(1)
      .get();

    if (!verifiedPhoneOwnerQuery.empty) {
      const ownerDoc = verifiedPhoneOwnerQuery.docs[0];
      if (ownerDoc.id !== userId) {
        throw new functions.https.HttpsError(
          'already-exists',
          '이미 다른 계정에서 인증에 사용 중인 휴대폰 번호입니다.'
        );
      }

      return {
        success: true,
        sessionId: `verified-${ownerDoc.id}`,
        expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
        resendAvailableAt: new Date(now).toISOString(),
        maskedDestination: maskPhoneNumber(phoneNumber),
        alreadyVerified: true,
      };
    }

    const sessionQuery = await db
      .collection(OTP_SESSION_COLLECTION)
      .where('phoneNumber', '==', phoneNumber)
      .where('status', '==', 'pending')
      .get();

    if (!sessionQuery.empty) {
      const latestPending = sessionQuery.docs
        .sort((left, right) => {
          const leftTimestamp = left.get('createdAt') as admin.firestore.Timestamp | undefined;
          const rightTimestamp = right.get('createdAt') as admin.firestore.Timestamp | undefined;
          const leftTime = leftTimestamp?.toDate().getTime() ?? 0;
          const rightTime = rightTimestamp?.toDate().getTime() ?? 0;
          return rightTime - leftTime;
        })[0];
      const latestData = latestPending.data() as { resendAvailableAt?: admin.firestore.Timestamp };
      const resendAvailableAt = latestData.resendAvailableAt?.toDate().getTime() ?? 0;

      if (resendAvailableAt > now) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'OTP was requested too recently. Please wait before requesting another code.'
        );
      }
    }

    const sessionId = randomUUID();
    const code = testMode ? OTP_TEST_CODE_PARAM.value() ?? '123456' : createOtpCode();
    const nowDate = new Date(now);
    const expiresAt = new Date(now + OTP_TTL_MS);
    const resendAvailableAt = new Date(now + OTP_RESEND_MS);

    await db.collection(OTP_SESSION_COLLECTION).doc(sessionId).set({
      sessionId,
      userId,
      phoneNumber,
      maskedDestination: maskPhoneNumber(phoneNumber),
      codeHash: hashOtpCode(sessionId, code),
      status: 'pending',
      attemptsRemaining: OTP_MAX_ATTEMPTS,
      createdAt: admin.firestore.Timestamp.fromDate(nowDate),
      updatedAt: admin.firestore.Timestamp.fromDate(nowDate),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      resendAvailableAt: admin.firestore.Timestamp.fromDate(resendAvailableAt),
      deliveryProvider: testMode ? 'test' : 'manual',
    });

    console.warn(`[OTP] issued session=${sessionId} destination=${maskPhoneNumber(phoneNumber)} mode=${testMode ? 'test' : 'manual'} code=${code}`);

    return {
      success: true,
      sessionId,
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
      maskedDestination: maskPhoneNumber(phoneNumber),
      ...(testMode ? { testCode: code } : {}),
    };
  }
);

export const confirmPhoneOtp = functions.https.onCall(
  async (data: ConfirmPhoneOtpData, context): Promise<ConfirmPhoneOtpResult> => {
    const userId = requireCallableAuth(context, 'confirmPhoneOtp');
    const sessionId = typeof data?.sessionId === 'string' ? data.sessionId.trim() : '';
    const phoneNumber = normalizePhoneNumber(data?.phoneNumber ?? '');
    const code = typeof data?.code === 'string' ? data.code.trim() : '';

    if (!sessionId || !isValidKoreanMobileNumber(phoneNumber) || !/^\d{6}$/.test(code)) {
      throw new functions.https.HttpsError('invalid-argument', 'sessionId, phoneNumber, and a 6-digit code are required');
    }

    const sessionRef = db.collection(OTP_SESSION_COLLECTION).doc(sessionId);
    const sessionSnapshot = await sessionRef.get();
    if (!sessionSnapshot.exists) {
      throw new functions.https.HttpsError('not-found', 'OTP session was not found');
    }

    const session = sessionSnapshot.data() as {
      userId?: string;
      phoneNumber?: string;
      codeHash?: string;
      status?: string;
      expiresAt?: admin.firestore.Timestamp;
      attemptsRemaining?: number;
    };

    if (session.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'This OTP session belongs to a different user');
    }

    if (session.phoneNumber !== phoneNumber) {
      throw new functions.https.HttpsError('permission-denied', 'Phone number does not match this session');
    }

    if (session.status !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', 'This OTP session is no longer active');
    }

    const expiresAt = session.expiresAt?.toDate().getTime() ?? 0;
    if (!expiresAt || expiresAt < Date.now()) {
      await sessionRef.set(
        {
          status: 'expired',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      throw new functions.https.HttpsError('deadline-exceeded', 'OTP code has expired');
    }

    const expectedHash = hashOtpCode(sessionId, code);
    if (!session.codeHash || session.codeHash !== expectedHash) {
      const nextAttempts = Math.max((session.attemptsRemaining ?? OTP_MAX_ATTEMPTS) - 1, 0);
      await sessionRef.set(
        {
          attemptsRemaining: nextAttempts,
          status: nextAttempts === 0 ? 'locked' : 'pending',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      throw new functions.https.HttpsError(
        nextAttempts === 0 ? 'permission-denied' : 'invalid-argument',
        nextAttempts === 0 ? 'Too many invalid OTP attempts' : 'OTP code is invalid'
      );
    }

    const verifiedAt = new Date();
    const verificationToken = randomUUID();
    const verifiedPhoneOwnerQuery = await db
      .collection('users')
      .where('phoneVerification.phoneNumber', '==', phoneNumber)
      .where('phoneVerification.verified', '==', true)
      .limit(1)
      .get();

    if (!verifiedPhoneOwnerQuery.empty && verifiedPhoneOwnerQuery.docs[0].id !== userId) {
      throw new functions.https.HttpsError(
        'already-exists',
        '이미 다른 계정에서 인증에 사용 중인 휴대폰 번호입니다.'
      );
    }

    await sessionRef.set(
      {
        status: 'verified',
        verifiedAt: admin.firestore.Timestamp.fromDate(verifiedAt),
        verificationToken,
        updatedAt: admin.firestore.Timestamp.fromDate(verifiedAt),
      },
      { merge: true }
    );

    await db.collection('users').doc(userId).set(
      {
        phoneNumber,
        phoneVerification: {
          verified: true,
          phoneNumber,
          verificationToken,
          verifiedAt: admin.firestore.Timestamp.fromDate(verifiedAt),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      success: true,
      verificationToken,
      verifiedAt: verifiedAt.toISOString(),
    };
  }
);
