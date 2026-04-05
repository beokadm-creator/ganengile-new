/**
 * 채팅 연결 상태 테스트 유틸리티
 * 개발용 연결 확인
 */

declare const require: any;

import { db } from '../services/firebase';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';

export interface ConnectionState {
  connected: boolean;
  hasSnapshots: boolean;
  error?: string;
}

/**
 * Firestore 연결 상태 확인
 */
export function testFirestoreConnection(): Promise<ConnectionState> {
  return new Promise((resolve) => {
    const state: ConnectionState = {
      connected: false,
      hasSnapshots: false,
    };

    try {
      // chatRooms 컬렉션에서 1개만 가져와서 연결 테스트
      const q = query(collection(db, 'chatRooms'), limit(1));
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          // Firestore 연결 성공
          // 스냅샷 수 logged

          state.connected = true;
          state.hasSnapshots = snapshot.docs.length > 0;
          
          unsubscribe();
          resolve(state);
        },
        (error) => {
          console.error('❌ Firestore 연결 실패:', error);
          state.connected = false;
          state.error = error.message;
          
          unsubscribe();
          resolve(state);
        }
      );

      // 5초 타임아웃
      setTimeout(() => {
        unsubscribe();
        if (!state.connected) {
          console.warn('Connection timeout');
          state.error = 'Connection timeout';
        }
        resolve(state);
      }, 5000);
    } catch (error: any) {
      state.error = error.message;
      resolve(state);
    }
  });
}

/**
 * 네트워크 상태 확인 (NetInfo가 설치된 경우)
 */
export async function testNetworkConnection(): Promise<boolean> {
  try {
    const NetInfo = require('@react-native-community/netinfo').default;
    const state = await NetInfo.fetch();

    // 네트워크 상태 logged

    return state.isConnected === true;
  } catch {
    console.warn('⚠️ NetInfo를 사용할 수 없음');
    return true; // NetInfo가 없으면 연결된 것으로 가정
  }
}
