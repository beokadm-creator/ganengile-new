import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as https from 'https';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { defineString } from 'firebase-functions/params';
import { db } from '../shared-admin';

// ==================== CI Verification APIs (PASS / Kakao) ====================

type CiProvider = 'pass' | 'kakao';

interface StartCiVerificationSessionData {
  provider: CiProvider;
}

interface StartCiVerificationSessionResult {
  sessionId: string;
  provider: CiProvider;
  redirectUrl: string;
  callbackUrl: string;
}

interface CompleteCiVerificationTestData {
  provider: CiProvider;
  sessionId?: string;
}

interface IdentityIntegrationProviderSettings {
  enabled?: boolean;
  startUrl?: string;
  callbackUrl?: string;
  apiKey?: string;
  clientId?: string;
  webhookSecret?: string;
  signatureParam?: string;
  signatureHeader?: string;
}

interface IdentityIntegrationSettings {
  pass?: IdentityIntegrationProviderSettings;
  kakao?: IdentityIntegrationProviderSettings;
}

type KakaoUserResponse = {
  id?: string | number;
  kakao_account?: Record<string, unknown>;
  properties?: Record<string, unknown>;
};

type KakaoLinkedUserDoc = {
  role?: 'gller' | 'giller' | 'both';
  name?: string;
  phoneNumber?: string;
  gillerApplicationStatus?: string;
  profilePhoto?: string;
  isVerified?: boolean;
  hasCompletedOnboarding?: boolean;
  agreedTerms?: Record<string, unknown>;
  stats?: Record<string, unknown>;
  badges?: Record<string, unknown>;
  badgeBenefits?: Record<string, unknown>;
  pointBalance?: number;
  walletBalances?: { charge: number; earned: number; promo: number };
};

const CI_PASS_URL_PARAM = defineString('CI_PASS_URL', { default: '' });
const CI_KAKAO_URL_PARAM = defineString('CI_KAKAO_URL', { default: '' });
const CI_FUNCTION_REGION = 'us-central1';

function readFirstQueryValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return '';
}

function readObjectString(source: unknown, key: string): string {
  if (typeof source !== 'object' || source === null) {
    return '';
  }

  const value = (source as Record<string, unknown>)[key];
  return readFirstQueryValue(value);
}

function getFunctionBaseUrl(): string {
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) {
    throw new Error('GCLOUD_PROJECT is not defined');
  }
  return `https://${CI_FUNCTION_REGION}-${projectId}.cloudfunctions.net`;
}

function assertCiProvider(provider: unknown): asserts provider is CiProvider {
  if (provider !== 'pass' && provider !== 'kakao') {
    throw new functions.https.HttpsError('invalid-argument', 'provider must be pass or kakao');
  }
}

function buildCiHash(userId: string, provider: CiProvider, seed?: string): string {
  return createHash('sha256')
    .update(`${userId}:${provider}:${seed ?? randomUUID()}`)
    .digest('hex');
}

function buildCallbackSigningPayload(
  sessionId: string,
  provider: CiProvider,
  result: string,
  ciSeed: string
): string {
  return `${sessionId}|${provider}|${result}|${ciSeed}`;
}

function verifyCallbackSignature(
  payload: string,
  providedSignature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function getIdentityIntegrationSettings(): Promise<IdentityIntegrationSettings> {
  const doc = await db.collection('admin_settings').doc('identity_verification').get();
  if (!doc.exists) {
    return {};
  }
  return doc.data() as IdentityIntegrationSettings;
}

async function markCiVerified(params: {
  userId: string;
  provider: CiProvider;
  sessionId: string;
  ciSeed?: string;
}): Promise<string> {
  const { userId, provider, sessionId, ciSeed } = params;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const ciHash = buildCiHash(userId, provider, ciSeed ?? sessionId);

  const verificationRef = db.doc(`users/${userId}/verification/${userId}`);
  const userRef = db.doc(`users/${userId}`);
  const profileRef = db.doc(`users/${userId}/profile/${userId}`);
  const sessionRef = db.collection('verification_sessions').doc(sessionId);

  await db.runTransaction((tx) => {
    tx.set(
      verificationRef,
      {
        userId,
        status: 'approved',
        verificationMethod: 'ci',
        ciHash,
        externalAuth: {
          provider,
          status: 'verified',
          verifiedAt: now,
        },
        reviewedAt: now,
        reviewedBy: 'ci-provider',
        updatedAt: now,
      },
      { merge: true }
    );

    tx.set(
      userRef,
      {
        isVerified: true,
        verificationInfo: {
          method: 'ci',
          provider,
          ciHash,
          verifiedAt: now,
        },
        updatedAt: now,
      },
      { merge: true }
    );

    tx.set(
      profileRef,
      {
        isVerified: true,
        updatedAt: now,
      },
      { merge: true }
    );

    tx.set(
      sessionRef,
      {
        status: 'completed',
        ciHash,
        completedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    return Promise.resolve();
  });

  return ciHash;
}

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (per IP + endpoint key)
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(
  ip: string,
  key: string,
  maxRequests: number,
  windowSeconds: number
): boolean {
  const now = Date.now();
  const limitKey = `${ip}:${key}`;
  const record = rateLimitMap.get(limitKey);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(limitKey, { count: 1, resetTime: now + windowSeconds * 1000 });
    return false; // under limit
  }

  if (record.count >= maxRequests) {
    return true; // over limit
  }

  record.count++;
  return false; // under limit
}

function getClientIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string {
  return req.ip || (typeof req.headers?.['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : 'unknown');
}

function fetchJson(url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: options?.method ?? 'GET',
        headers: options?.headers,
      },
      (response) => {
        const chunks: Uint8Array[] = [];
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf8');
            resolve(raw ? JSON.parse(raw) : {});
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      }
    );

    request.on('error', reject);
    if (options?.body) {
      request.write(options.body);
    }
    request.end();
  });
}

/**
 * Callable: CI ?몄쬆 ?몄뀡 ?쒖옉
 * - ?댁쁺: 諛섑솚??redirectUrl??PASS/Kakao 蹂몄씤?몄쬆 URL濡??ъ슜
 * - ?뚯뒪?? 誘몄꽕????mock ?섏씠吏濡?由щ떎?대젆??
 */
export const startCiVerificationSession = functions.https.onCall(
  async (data: StartCiVerificationSessionData, context): Promise<StartCiVerificationSessionResult> => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const provider = data?.provider;
    assertCiProvider(provider);

    const userId = context.auth.uid;
    const sessionId = randomUUID();
    const baseUrl = getFunctionBaseUrl();
    const settings = await getIdentityIntegrationSettings();
    const providerSettings = provider === 'pass' ? settings.pass : settings.kakao;
    const callbackUrl = providerSettings?.callbackUrl ?? `${baseUrl}/ciVerificationCallback`;
    const mockUrl = `${baseUrl}/ciMock?sessionId=${encodeURIComponent(sessionId)}&provider=${provider}`;
    const providerUrlConfig = providerSettings?.startUrl ?? (
      provider === 'pass'
        ? CI_PASS_URL_PARAM.value()
        : CI_KAKAO_URL_PARAM.value()
    );

    if (providerSettings?.enabled === false) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `${provider.toUpperCase()} integration is disabled by admin`
      );
    }

    let redirectUrl = mockUrl;
    if (providerUrlConfig) {
      const queryParts = [
        `sessionId=${encodeURIComponent(sessionId)}`,
        `callbackUrl=${encodeURIComponent(callbackUrl)}`,
      ];
      if (providerSettings?.clientId) {
        queryParts.push(`clientId=${encodeURIComponent(providerSettings.clientId)}`);
      }
      redirectUrl = `${providerUrlConfig}${providerUrlConfig.includes('?') ? '&' : '?'}${queryParts.join('&')}`;
    }

    await db.collection('verification_sessions').doc(sessionId).set({
      sessionId,
      userId,
      provider,
      status: 'started',
      callbackUrl,
      redirectUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.doc(`users/${userId}/verification/${userId}`).set(
      {
        userId,
        status: 'pending',
        verificationMethod: 'ci',
        externalAuth: {
          provider,
          status: 'started',
          requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      sessionId,
      provider,
      redirectUrl,
      callbackUrl,
    };
  }
);

/**
 * HTTP: ?뚯뒪?몄슜 CI mock ?붾㈃
 */
export const ciMock = functions.https.onRequest((req, res) => {
  // Rate limit: 1 request per minute per IP
  const ip = getClientIp(req);
  if (checkRateLimit(ip, 'ciMock', 1, 60)) {
    console.warn(`[rate-limit] ciMock blocked for ip=${ip}`);
    res.status(429).send('Too many requests');
    return;
  }
  const sessionId = readFirstQueryValue(req.query.sessionId);
  const provider = readFirstQueryValue(req.query.provider);

  if (!sessionId || (provider !== 'pass' && provider !== 'kakao')) {
    res.status(400).send('Invalid query');
    return;
  }

  const baseUrl = getFunctionBaseUrl();
  const successUrl = `${baseUrl}/ciVerificationCallback?sessionId=${encodeURIComponent(sessionId)}&provider=${provider}&result=success&ci=mock-ci-${Date.now()}`;
  const failUrl = `${baseUrl}/ciVerificationCallback?sessionId=${encodeURIComponent(sessionId)}&provider=${provider}&result=failed`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CI Mock Verification</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px;">
    <h2>CI ?몄쬆 ?뚯뒪??(${provider.toUpperCase()})</h2>
    <p>sessionId: ${sessionId}</p>
    <p>?꾨옒 踰꾪듉?쇰줈 ?몄쬆 寃곌낵 肄쒕갚???쒕??덉씠?섑븷 ???덉뒿?덈떎.</p>
    <a href="${successUrl}" style="display:inline-block;margin-right:12px;padding:12px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">?깃났 肄쒕갚</a>
    <a href="${failUrl}" style="display:inline-block;padding:12px 16px;background:#ef4444;color:#fff;text-decoration:none;border-radius:8px;">?ㅽ뙣 肄쒕갚</a>
  </body>
</html>`);
});

export const issueKakaoCustomToken = functions.https.onCall(
  async (
    data: {
      accessToken?: string;
      expectedKakaoId?: string;
      role?: 'gller' | 'giller' | 'both';
      name?: string;
      phoneNumber?: string;
    },
    context
  ): Promise<{ customToken: string; uid: string; isNewUser: boolean }> => {
    const accessToken = typeof data?.accessToken === 'string' ? data.accessToken.trim() : '';
    const expectedKakaoId = typeof data?.expectedKakaoId === 'string' ? data.expectedKakaoId.trim() : '';
    const role = data?.role === 'gller' || data?.role === 'giller' || data?.role === 'both' ? data.role : 'gller';
    const providedName = typeof data?.name === 'string' ? data.name.trim() : '';
    const providedPhoneNumber = typeof data?.phoneNumber === 'string' ? data.phoneNumber.trim() : '';

    if (!accessToken) {
      throw new functions.https.HttpsError('invalid-argument', 'accessToken is required');
    }

    if (!expectedKakaoId) {
      throw new functions.https.HttpsError('invalid-argument', 'expectedKakaoId is required');
    }

    const kakaoResponse = await fetchJson('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (typeof kakaoResponse !== 'object' || kakaoResponse === null || !('id' in kakaoResponse)) {
      throw new functions.https.HttpsError('unauthenticated', 'Failed to verify Kakao access token');
    }

    const kakaoUser = kakaoResponse as KakaoUserResponse;
    const rawKakaoId = kakaoUser.id;
    const kakaoId =
      typeof rawKakaoId === 'string' || typeof rawKakaoId === 'number'
        ? String(rawKakaoId)
        : '';
    if (!kakaoId) {
      throw new functions.https.HttpsError('unauthenticated', 'Kakao user id is missing');
    }

    if (expectedKakaoId && expectedKakaoId !== kakaoId) {
      throw new functions.https.HttpsError('permission-denied', 'Kakao user id mismatch');
    }

    const kakaoAccount =
      typeof kakaoUser.kakao_account === 'object' && kakaoUser.kakao_account !== null
        ? (kakaoUser.kakao_account ?? {})
        : {};
    const properties =
      typeof kakaoUser.properties === 'object' && kakaoUser.properties !== null
        ? (kakaoUser.properties ?? {})
        : {};

    const email = typeof kakaoAccount.email === 'string' ? kakaoAccount.email : '';
    const nickname = typeof properties.nickname === 'string' ? properties.nickname : '카카오 사용자';
    const profileImage =
      typeof properties.profile_image === 'string'
        ? properties.profile_image
        : typeof properties.thumbnail_image === 'string'
          ? properties.thumbnail_image
          : '';

    const uid = `kakao_${kakaoId}`;
    if (context.auth?.uid && context.auth.uid !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'Authenticated user does not match Kakao identity');
    }

    const userRef = db.collection('users').doc(uid);
    const existing = await userRef.get();
    const now = admin.firestore.FieldValue.serverTimestamp();
    await db.runTransaction(async (transaction) => {
      const userRefTx = db.collection('users').doc(uid);
      const existingTx = await transaction.get(userRefTx);
      const existingDataTx = (existingTx.data() ?? {}) as KakaoLinkedUserDoc;
      
      const userRoleTx = existingTx.exists && (existingDataTx.role === 'gller' || existingDataTx.role === 'giller' || existingDataTx.role === 'both')
        ? existingDataTx.role
        : role;
      const userNameTx = existingTx.exists && typeof existingDataTx.name === 'string' && existingDataTx.name.trim()
        ? existingDataTx.name
        : providedName || nickname;
      const userPhoneNumberTx = existingTx.exists && typeof existingDataTx.phoneNumber === 'string' && existingDataTx.phoneNumber.trim()
        ? existingDataTx.phoneNumber
        : providedPhoneNumber;

      transaction.set(
        userRefTx,
        {
          uid,
          email,
          name: userNameTx,
          phoneNumber: userPhoneNumberTx,
          role: userRoleTx,
          gillerApplicationStatus: existingDataTx.gillerApplicationStatus ?? 'none',
          authProvider: 'kakao',
          authProviderUserId: kakaoId,
          signupMethod: 'kakao',
          providerLinkedAt: now,
          profilePhoto: profileImage ?? existingDataTx.profilePhoto ?? '',
          updatedAt: now,
          isActive: true,
          isVerified: existingDataTx.isVerified ?? false,
          hasCompletedOnboarding: existingTx.exists 
            ? (existingDataTx.hasCompletedOnboarding ?? Boolean(existingDataTx.name && existingDataTx.phoneNumber)) 
            : false,
          agreedTerms: existingTx.exists
            ? existingDataTx.agreedTerms ?? { giller: false, gller: false, privacy: false, marketing: false }
            : { giller: false, gller: false, privacy: false, marketing: false },
          stats: existingTx.exists
            ? existingDataTx.stats ?? {
                completedDeliveries: 0,
                totalEarnings: 0,
                rating: 0,
                recentPenalties: 0,
                accountAgeDays: 0,
                recent30DaysDeliveries: 0,
              }
            : {
                completedDeliveries: 0,
                totalEarnings: 0,
                rating: 0,
                recentPenalties: 0,
                accountAgeDays: 0,
                recent30DaysDeliveries: 0,
              },
          badges: existingTx.exists
            ? existingDataTx.badges ?? { activity: [], quality: [], expertise: [], community: [] }
            : { activity: [], quality: [], expertise: [], community: [] },
          badgeBenefits: existingTx.exists
            ? existingDataTx.badgeBenefits ?? { profileFrame: 'none', totalBadges: 0, currentTier: 'none' }
            : { profileFrame: 'none', totalBadges: 0, currentTier: 'none' },
          pointBalance: existingDataTx.pointBalance ?? 0,
          walletBalances: existingTx.exists ? existingDataTx.walletBalances ?? {
            chargeBalance: 0,
            earnedBalance: 0,
            promoBalance: 0,
            lockedChargeBalance: 0,
            lockedEarnedBalance: 0,
            lockedPromoBalance: 0,
            pendingWithdrawalBalance: 0,
          } : {
            chargeBalance: 0,
            earnedBalance: 0,
            promoBalance: 0,
            lockedChargeBalance: 0,
            lockedEarnedBalance: 0,
            lockedPromoBalance: 0,
            pendingWithdrawalBalance: 0,
          },
          ...(existingTx.exists ? {} : { createdAt: now }),
        },
        { merge: true }
      );
    });

    const customToken = await admin.auth().createCustomToken(uid, {
      provider: 'kakao',
      authProviderUserId: kakaoId,
    });

    return {
      customToken,
      uid,
      isNewUser: !existing.exists,
    };
  }
);

/**
 * HTTP: CI ?몄쬆 肄쒕갚
 */
export const ciVerificationCallback = functions.https.onRequest(async (req, res) => {
  const ip = getClientIp(req);
  if (checkRateLimit(ip, 'ciVerificationCallback', 10, 60)) {
    console.warn(`[rate-limit] ciVerificationCallback blocked for ip=${ip}`);
    res.status(429).send('Too many requests');
    return;
  }

  try {
    const sessionId = readFirstQueryValue(req.query.sessionId) ?? readObjectString(req.body, 'sessionId');
    const provider = readFirstQueryValue(req.query.provider) ?? readObjectString(req.body, 'provider');
    const result = readFirstQueryValue(req.query.result) || readObjectString(req.body, 'result') || 'success';
    const ciSeed = readFirstQueryValue(req.query.ci) || readObjectString(req.body, 'ci') || sessionId;

    if (!sessionId || (provider !== 'pass' && provider !== 'kakao')) {
      res.status(400).json({ ok: false, message: 'invalid parameters' });
      return;
    }

    const sessionRef = db.collection('verification_sessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();
    const session = sessionSnap.data() as { userId?: string; provider?: CiProvider } | undefined;

    if (!sessionSnap.exists || !session?.userId) {
      res.status(404).json({ ok: false, message: 'session not found' });
      return;
    }

    if (session.provider !== provider) {
      res.status(400).json({ ok: false, message: 'provider mismatch' });
      return;
    }

    const settings = await getIdentityIntegrationSettings();
    const providerSettings = provider === 'pass' ? settings.pass : settings.kakao;
    const webhookSecret = providerSettings?.webhookSecret;
    const signatureParam = providerSettings?.signatureParam ?? 'signature';
    const signatureHeader = providerSettings?.signatureHeader ?? 'x-signature';

    if (webhookSecret) {
      const providedSignature =
        readFirstQueryValue(req.query?.[signatureParam]) ||
        readObjectString(req.body, signatureParam) || readFirstQueryValue(req.headers?.[signatureHeader]);
      if (!providedSignature) {
        res.status(401).json({ ok: false, message: 'missing signature' });
        return;
      }

      const payload = buildCallbackSigningPayload(sessionId, provider, result, ciSeed);
      const valid = verifyCallbackSignature(payload, providedSignature, webhookSecret);
      if (!valid) {
        res.status(401).json({ ok: false, message: 'invalid signature' });
        return;
      }
    }

    if (result !== 'success') {
      await sessionRef.set(
        {
          status: 'failed',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await db.doc(`users/${session.userId}/verification/${session.userId}`).set(
        {
          status: 'rejected',
          verificationMethod: 'ci',
          rejectionReason: '본인인증이 취소되었거나 실패했습니다.',
          externalAuth: {
            provider,
            status: 'failed',
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      res.status(200).json({ ok: false, message: 'verification failed' });
      return;
    }

    const ciHash = await markCiVerified({
      userId: session.userId,
      provider,
      sessionId,
      ciSeed,
    });

    res.status(200).json({
      ok: true,
      sessionId,
      provider,
      ciHash,
      message: 'verification completed',
    });
  } catch (error) {
    console.error('ciVerificationCallback error:', error);
    res.status(500).json({ ok: false, message: 'internal error' });
  }
});

/**
 * Callable: 테스트 환경에서 인증 완료 강제 처리
 */
export const completeCiVerificationTest = functions.https.onCall(
  async (data: CompleteCiVerificationTestData, context): Promise<{ ok: boolean; ciHash: string }> => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const provider = data?.provider;
    assertCiProvider(provider);

    const userId = context.auth.uid;
    const sessionId = data?.sessionId ?? randomUUID();

    const ciHash = await markCiVerified({
      userId,
      provider,
      sessionId,
      ciSeed: `test-${Date.now()}`,
    });

    return { ok: true, ciHash };
  }
);
