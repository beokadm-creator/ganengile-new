/**
 * Auto-Retry Logic for Matching Service
 * 매칭 타임아웃 시 자동 재시도 (최대 3회, 지수 백오프)
 */

import { updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { findMatchesForRequest, createMatchDocument } from './matching-service';

/**
 * 매칭 자동 재시도 함수
 * @param requestId 배송 요청 ID
 * @param maxRetries 최대 재시도 횟수 (기본값 3)
 * @param baseDelay 기본 지연 시간 (ms, 기본값 2000)
 * @returns 매칭 성공 여부
 */
export async function retryMatchingWithBackoff(
  requestId: string,
  maxRetries: number = 3,
  baseDelay: number = 2000
): Promise<{ success: boolean; attempts: number; foundMatches: number }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🔄 매칭 재시도 ${attempt + 1}/${maxRetries} (Request ID: ${requestId})`);

      // 1. 매칭 시도
      const matches = await findMatchesForRequest(requestId, 3);

      // 2. 매칭 성공 시
      if (matches.length > 0) {
        console.log(`✅ 매칭 성공! ${matches.length}개의 매칭 발견 (시도 ${attempt + 1}회)`);

        // 3. 요청 문서에 매칭 성공 표시
        await updateDoc(doc(db, 'requests', requestId), {
          'matchingStatus': 'matched',
          'matchingAttempts': attempt + 1,
          'lastMatchedAt': new Date()
        });

        return {
          success: true,
          attempts: attempt + 1,
          foundMatches: matches.length
        };
      }

      // 4. 매칭 실패 시 재시도 전 지연
      console.log(`⏳ 매칭 실패. ${baseDelay * Math.pow(2, attempt)}ms 후 재시도...`);

      // 지수 백오프: 2초, 4초, 8초...
      await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));

    } catch (error: any) {
      lastError = error;
      console.error(`❌ 매칭 재시도 ${attempt + 1} 실패:`, error.message);

      // 마지막 시도가 아니면 계속
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));
      }
    }
  }

  // 모든 재시도 실패
  console.error(`❌ 모든 매칭 재시도 실패 (${maxRetries}회 시도)`);

  // 요청 문서에 매칭 실패 표시
  try {
    await updateDoc(doc(db, 'requests', requestId), {
      'matchingStatus': 'no-match',
      'matchingAttempts': maxRetries,
      'lastMatchAttemptAt': new Date()
    });
  } catch (error) {
    console.error('Error updating request status:', error);
  }

  return {
    success: false,
    attempts: maxRetries,
    foundMatches: 0
  };
}

/**
 * 배송 요청에 자동 재시도 로직 적용
 * @param requestId 배송 요청 ID
 * @param timeoutMs 타임아웃 시간 (ms, 기본값 30000)
 * @returns 재시도 작업 ID (취소 시 사용)
 */
export function scheduleAutoRetry(
  requestId: string,
  timeoutMs: number = 30000
): NodeJS.Timeout {
  console.log(`⏰ ${timeoutMs}ms 후 자동 재시도 예약 (Request ID: ${requestId})`);

  const timeoutId = setTimeout(async () => {
    try {
      const result = await retryMatchingWithBackoff(requestId);

      if (result.success) {
        console.log(`✅ 자동 재시도 성공: ${result.foundMatches}개 매칭 발견`);
      } else {
        console.log(`❌ 자동 재시도 실패: ${result.attempts}회 시도 후 매칭 없음`);
      }
    } catch (error) {
      console.error('❌ 자동 재시도 중 오류 발생:', error);
    }
  }, timeoutMs);

  return timeoutId;
}

/**
 * 예약된 자동 재시도 취소
 * @param timeoutId 취소할 타임아웃 ID
 */
export function cancelAutoRetry(timeoutId: NodeJS.Timeout): void {
  clearTimeout(timeoutId);
  console.log('⏹️ 자동 재시도 취소됨');
}

/**
 * 매칭 상태 모니터링
 * 주기적으로 매칭되지 않은 요청 확인 후 자동 재시도
 * @param intervalMs 확인 간격 (ms, 기본값 60000 = 1분)
 */
export function startMatchingStatusMonitor(intervalMs: number = 60000): NodeJS.Timeout {
  console.log(`🔍 매칭 상태 모니터링 시작 (${intervalMs}ms 간격)`);

  const intervalId = setInterval(async () => {
    try {
      // TODO: Firestore에서 매칭되지 않은 요청 조회
      // const q = query(
      //   collection(db, 'requests'),
      //   where('matchingStatus', '==', 'pending'),
      //   where('createdAt', '>', new Date(Date.now() - 5 * 60 * 1000)) // 5분 이내
      // );

      // const snapshot = await getDocs(q);

      // snapshot.forEach((doc) => {
      //   const requestId = doc.id;
      //   const createdAt = doc.data().createdAt?.toDate();
      //   const elapsed = Date.now() - createdAt.getTime();

      //   // 30초 이상 경과했으면 자동 재시도
      //   if (elapsed > 30000) {
      //     console.log(`🔄 자동 재시도 트리거: ${requestId}`);
      //     retryMatchingWithBackoff(requestId);
      //   }
      // });

      // 임시: 모니터링 중임을 로그로 표시
      console.log('💓 매칭 상태 모니터링 중...');
    } catch (error) {
      console.error('❌ 매칭 상태 모니터링 중 오류:', error);
    }
  }, intervalMs);

  return intervalId;
}

/**
 * 매칭 상태 모니터링 중지
 * @param intervalId 중지할 인터벌 ID
 */
export function stopMatchingStatusMonitor(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  console.log('⏹️ 매칭 상태 모니터링 중지됨');
}

/**
 * 사용자가 수동으로 재시도할 때 사용하는 함수
 * @param requestId 배송 요청 ID
 * @returns 재시도 결과
 */
export async function manualRetry(requestId: string): Promise<{
  success: boolean;
  message: string;
  attempts: number;
  foundMatches: number
}> {
  console.log(`🔄 수동 재시도 시작 (Request ID: ${requestId})`);

  try {
    const result = await retryMatchingWithBackoff(requestId);

    if (result.success) {
      return {
        success: true,
        message: `${result.foundMatches}명의 길러를 찾았습니다! (재시도 ${result.attempts}회)`,
        attempts: result.attempts,
        foundMatches: result.foundMatches
      };
    } else {
      return {
        success: false,
        message: `아직 길러를 찾을 수 없습니다. ${result.attempts}회 시도했습니다. 잠시 후 다시 시도해주세요.`,
        attempts: result.attempts,
        foundMatches: 0
      };
    }
  } catch (error: any) {
    console.error('❌ 수동 재시도 중 오류:', error);
    return {
      success: false,
      message: '재시도 중 오류가 발생했습니다. 다시 시도해주세요.',
      attempts: 0,
      foundMatches: 0
    };
  }
}
