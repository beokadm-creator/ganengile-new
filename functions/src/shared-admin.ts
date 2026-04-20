import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { defineString, defineSecret } from 'firebase-functions/params';
import { createHash } from 'crypto';

export { admin };

export const db = admin.firestore();
export const fcm = admin.messaging();
export const CI_PASS_URL_PARAM = defineString('CI_PASS_URL', { default: '' });
export const CI_KAKAO_URL_PARAM = defineString('CI_KAKAO_URL', { default: '' });
export const NAVER_MAP_CLIENT_ID_SECRET = defineSecret('NAVER_MAP_CLIENT_ID');
export const NAVER_MAP_CLIENT_SECRET_SECRET = defineSecret('NAVER_MAP_CLIENT_SECRET');
export const JUSO_API_KEY_PARAM = defineString('JUSO_API_KEY', { default: '' });
export const OTP_TEST_CODE_PARAM = defineString('OTP_TEST_CODE', { default: '123456' });
export const OTP_TEST_MODE_PARAM = defineString('OTP_TEST_MODE', { default: 'false' });

export const OTP_SESSION_COLLECTION = 'otp_verifications';
export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 1000 * 60 * 5;
export const OTP_RESEND_MS = 1000 * 45;
export const OTP_MAX_ATTEMPTS = 5;

export function requireCallableAuth(context: functions.https.CallableContext, functionName: string): string {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', `${functionName} requires authentication`);
  }
  return uid;
}

export function hashOtpCode(sessionId: string, code: string): string {
  return createHash('sha256').update(`${sessionId}:${code}`).digest('hex');
}

export function getFirstNonEmptyString(...values: Array<string | undefined>): string {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) ?? '';
}
