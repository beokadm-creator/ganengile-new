/**
 * Verification Service
 * 신원 인증 서비스 - Firestore CRUD
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import {
  UserVerification,
  VerificationSubmitData,
  VerificationProvider,
} from '../types/profile';
import { updateVerificationStatus } from './profile-service';

const VERIFICATION_COLLECTION = 'verification';

/**
 * 인증 정보 조회
 */
export async function getUserVerification(
  userId: string
): Promise<UserVerification | null> {
  try {
    if (!userId) {
      console.error('getUserVerification: userId is required');
      return null;
    }
    const verificationRef = doc(db, 'users', userId, VERIFICATION_COLLECTION, userId);
    const docSnapshot = await getDoc(verificationRef);

    if (!docSnapshot.exists) {
      return null;
    }

    const data = docSnapshot.data();
    if (!data) {
      return null;
    }

    return {
      userId: data.userId || userId,
      status: data.status || 'pending',
      idCard: data.idCard,
      name: data.name,
      birthDate: data.birthDate,
      personalId: data.personalId,
      externalAuth: data.externalAuth,
      ciHash: data.ciHash,
      verificationMethod: data.verificationMethod,
      reviewedAt: data.reviewedAt,
      reviewedBy: data.reviewedBy,
      rejectionReason: data.rejectionReason,
      submittedAt: data.submittedAt,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.error('Error fetching user verification:', error);
    throw error;
  }
}

/**
 * 신분증 이미지 업로드
 */
export async function uploadIdCardImage(
  userId: string,
  uri: string,
  type: 'front' | 'back'
): Promise<string> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();

    const storageRef = ref(
      storage,
      `verifications/${userId}/${type}-${Date.now()}.jpg`
    );
    await uploadBytes(storageRef, blob);

    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading ID card image:', error);
    throw error;
  }
}

/**
 * 인증 제출
 */
export async function submitVerification(
  userId: string,
  data: VerificationSubmitData
): Promise<UserVerification> {
  try {
    const verificationRef = doc(db, 'users', userId, VERIFICATION_COLLECTION, userId);

    const verificationData: Omit<UserVerification, 'submittedAt' | 'updatedAt'> = {
      userId,
      status: 'pending',
      idCard: {
        type: data.idCardType,
        frontImageUrl: data.frontImageUrl,
        backImageUrl: data.backImageUrl,
        uploadedAt: serverTimestamp() as Timestamp,
      },
      name: data.name,
      birthDate: data.birthDate,
      personalId: data.personalId,
    };

    const now = serverTimestamp();
    await setDoc(verificationRef, {
      ...verificationData,
      submittedAt: now,
      updatedAt: now,
    });

    return {
      ...verificationData,
      submittedAt: now as Timestamp,
      updatedAt: now as Timestamp,
    };
  } catch (error) {
    console.error('Error submitting verification:', error);
    throw error;
  }
}

/**
 * 인증 상태 업데이트 (관리자용)
 */
export async function updateVerificationRecordStatus(
  userId: string,
  status: 'pending' | 'under_review' | 'approved' | 'rejected',
  reviewedBy?: string,
  rejectionReason?: string
): Promise<void> {
  try {
    const verificationRef = doc(db, 'users', userId, VERIFICATION_COLLECTION, userId);

    const updateData: any = {
      status,
      updatedAt: serverTimestamp(),
    };

    if (status === 'under_review' || status === 'approved' || status === 'rejected') {
      updateData.reviewedAt = serverTimestamp();
      updateData.reviewedBy = reviewedBy;
    }

    if (status === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    await updateDoc(verificationRef, updateData);

    if (status === 'approved') {
      await updateVerificationStatus(userId, true);
    }
  } catch (error) {
    console.error('Error updating verification status:', error);
    throw error;
  }
}

export interface StartCiVerificationResult {
  redirectUrl?: string;
  provider: VerificationProvider;
  sessionId?: string;
  callbackUrl?: string;
}

/**
 * PASS/Kakao 본인인증 시작
 */
export async function startCiVerification(
  userId: string,
  provider: VerificationProvider
): Promise<StartCiVerificationResult> {
  const callableResult = await tryStartCiVerificationCallable(provider);
  if (callableResult) {
    return callableResult;
  }

  const verificationRef = doc(db, 'users', userId, VERIFICATION_COLLECTION, userId);
  const now = serverTimestamp();

  await setDoc(
    verificationRef,
    {
      userId,
      status: 'pending',
      verificationMethod: 'ci',
      externalAuth: {
        provider,
        status: 'started',
        requestedAt: now,
      },
      submittedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  return {
    provider,
    redirectUrl: buildProviderRedirectUrl(provider, userId),
  };
}

/**
 * CI 인증 완료 반영
 * - 실제 서비스에서는 서버에서 CI를 검증한 뒤 이 함수를 호출해야 합니다.
 */
export async function completeCiVerification(
  userId: string,
  provider: VerificationProvider,
  ciHash: string
): Promise<void> {
  const verificationRef = doc(db, 'users', userId, VERIFICATION_COLLECTION, userId);
  const now = serverTimestamp();

  await setDoc(
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
      submittedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await updateVerificationStatus(userId, true);
}

export async function completeCiVerificationByApi(
  provider: VerificationProvider,
  sessionId?: string
): Promise<{ ok: boolean; ciHash?: string }> {
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functionsInstance = getFunctions();
    const complete = httpsCallable(functionsInstance, 'completeCiVerificationTest');
    const response = await complete({ provider, sessionId });
    const data = response.data as { ok?: boolean; ciHash?: string };
    return { ok: Boolean(data?.ok), ciHash: data?.ciHash };
  } catch (error) {
    console.warn('completeCiVerificationByApi fallback:', error);
    return { ok: false };
  }
}

async function tryStartCiVerificationCallable(
  provider: VerificationProvider
): Promise<StartCiVerificationResult | null> {
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functionsInstance = getFunctions();
    const start = httpsCallable(functionsInstance, 'startCiVerificationSession');
    const response = await start({ provider });
    const data = response.data as {
      provider?: VerificationProvider;
      redirectUrl?: string;
      sessionId?: string;
      callbackUrl?: string;
    };
    return {
      provider: data.provider || provider,
      redirectUrl: data.redirectUrl,
      sessionId: data.sessionId,
      callbackUrl: data.callbackUrl,
    };
  } catch (error) {
    console.warn('startCiVerification callable fallback:', error);
    return null;
  }
}

function buildProviderRedirectUrl(provider: VerificationProvider, userId: string): string | undefined {
  const passUrl = process.env.EXPO_PUBLIC_PASS_VERIFY_URL;
  const kakaoUrl = process.env.EXPO_PUBLIC_KAKAO_VERIFY_URL;
  const baseUrl = provider === 'pass' ? passUrl : kakaoUrl;
  if (!baseUrl) return undefined;

  const hasQuery = baseUrl.includes('?');
  const separator = hasQuery ? '&' : '?';
  return `${baseUrl}${separator}userId=${encodeURIComponent(userId)}&provider=${provider}`;
}

/**
 * 인증 상태 확인 (UI 표시용)
 */
export function getVerificationStatusDisplay(
  verification: UserVerification | null
): {
  status: string;
  statusKo: string;
  icon: string;
  color: string;
  description: string;
} {
  if (!verification) {
    return {
      status: 'not_submitted',
      statusKo: '미제출',
      icon: '❓',
      color: '#9E9E9E',
      description: '신원 인증을 제출해주세요',
    };
  }

  switch (verification.status) {
    case 'pending':
      return {
        status: 'pending',
        statusKo: '대기중',
        icon: '⏳',
        color: '#FF9800',
        description: verification.verificationMethod === 'ci'
          ? '본인인증 진행 또는 결과 확인 대기 중입니다'
          : '인증 심사 대기중입니다',
      };
    case 'under_review':
      return {
        status: 'under_review',
        statusKo: '심사중',
        icon: '🔍',
        color: '#2196F3',
        description: '인증 심사 진행중입니다',
      };
    case 'approved':
      return {
        status: 'approved',
        statusKo: '인증 완료',
        icon: '✅',
        color: '#4CAF50',
        description: verification.verificationMethod === 'ci'
          ? 'PASS/Kakao 본인인증이 완료되었습니다. 다음 단계에서 길러 신청(관리자 심사)을 진행하세요.'
          : '신원 인증이 완료되었습니다. 다음 단계에서 길러 신청(관리자 심사)을 진행하세요.',
      };
    case 'rejected':
      return {
        status: 'rejected',
        statusKo: '반려',
        icon: '❌',
        color: '#F44336',
        description: verification.rejectionReason || '인증이 반려되었습니다',
      };
    default:
      return {
        status: 'unknown',
        statusKo: '알수없음',
        icon: '❓',
        color: '#9E9E9E',
        description: '',
      };
  }
}
