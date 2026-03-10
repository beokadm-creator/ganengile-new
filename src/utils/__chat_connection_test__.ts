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
          console.log('✅ Firestore 연결 성공');
          console.log('📊 스냅샷 수:', snapshot.docs.length);
          
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
          console.warn('⚠️ 연결 시간 초과');
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
    
    console.log('📡 네트워크 상태:', state.isConnected ? '연결됨' : '연결 안됨');
    console.log('📡 네트워크 타입:', state.type);
    
    return state.isConnected === true;
  } catch (_error) {
    console.warn('⚠️ NetInfo를 사용할 수 없음');
    return true; // NetInfo가 없으면 연결된 것으로 가정
  }
}
