/**
 * Network Utilities
 * 네트워크 상태 체크 유틸리티
 */

import NetInfo from '@react-native-community/netinfo';

/**
 * 네트워크 연결 상태 체크
 * @returns 연결되어 있으면 true
 */
export async function isNetworkAvailable(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  } catch (error) {
    console.error('Error checking network status:', error);
    return true; // Assume connected if error
  }
}

/**
 * 네트워크 연결 유형인지 체크 (WiFi vs Cellular)
 */
export async function getConnectionType(): Promise<'wifi' | 'cellular' | 'none' | 'unknown'> {
  try {
    const state = await NetInfo.fetch();

    if (!state.isConnected) {
      return 'none';
    }

    if (state.type === 'wifi') {
      return 'wifi';
    } else if (state.type === 'cellular') {
      return 'cellular';
    }

    return 'unknown';
  } catch (error) {
    console.error('Error getting connection type:', error);
    return 'unknown';
  }
}

/**
 * 네트워크 상태 변경 리스너 등록
 */
export function addNetworkListener(callback: (isConnected: boolean) => void): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    callback(state.isConnected ?? false);
  });
  return unsubscribe;
}
