import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { processMatchingForRequest } from '../matching-service';
import { getRequestById, normalizeRequestDoc, type RequestDocShape } from './request-repository';
import type { Request } from '../../types/request';

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function subscribeToRequest(
  requestId: string,
  callback: (request: Request | null) => void
): () => void {
  const docRef = doc(db, 'requests', requestId);

  const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      callback(normalizeRequestDoc(docSnapshot.id, data as RequestDocShape));
    } else {
      callback(null);
    }
  }, (error) => {
    const errorCode = typeof error === 'object' && error != null && 'code' in error
      ? (error as { code?: unknown }).code
      : null;
    const code = errorCode !== null && (typeof errorCode === 'string' || typeof errorCode === 'number')
      ? String(errorCode)
      : '';

    if (code === 'permission-denied' || code === 'firestore/permission-denied') {
      console.warn('Request subscription denied by Firestore rules.');
    } else {
      console.error('Error listening to request:', error);
    }
    callback(null);
  });

  return unsubscribe;
}

export async function notifyGillers(requestId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const request = await getRequestById(requestId);
    if (!request) {
      return { success: false, error: '요청을 찾을 수 없습니다.' };
    }

    const matchCount = await processMatchingForRequest(requestId);
    if (matchCount === 0) {
      return { success: false, error: '매칭 가능한 길러가 없습니다.' };
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('Error notifying gillers:', error);
    return { success: false, error: getErrorMessage(error, '길러 알림 전송에 실패했습니다.') };
  }
}
