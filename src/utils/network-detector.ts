/**
 * Network Detector
 * 네트워크 상태 감지 및 오프라인 처리
 * 기존 network.ts를 확장한 버전
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { EventEmitter } from 'events';

export type NetworkStatus = 'online' | 'offline' | 'poor';
export type ConnectionType = 'wifi' | 'cellular' | 'none' | 'unknown';

export interface NetworkState {
  isOnline: boolean;
  isConnected: boolean;
  type: ConnectionType;
  isConnectionExpensive: boolean;
  strength?: 'good' | 'poor' | 'unknown';
}

/**
 * 네트워크 상태 이벤트 emitter
 */
class NetworkDetector extends EventEmitter {
  private currentState: NetworkState = {
    isOnline: true,
    isConnected: true,
    type: 'unknown',
    isConnectionExpensive: false,
    strength: 'unknown',
  };

  private listener: (() => void) | null = null;

  constructor() {
    super();
    this.setupListener();
  }

  /**
   * 네트워크 상태 변경 리스너 설정
   */
  private setupListener() {
    this.listener = NetInfo.addEventListener((state) => {
      this.handleStateChange(state);
    });
  }

  /**
   * 네트워크 상태 변경 처리
   */
  private handleStateChange(state: NetInfoState) {
    const oldState = { ...this.currentState };

    this.currentState = this.parseNetInfoState(state);

    // Emit events for state changes
    if (oldState.isOnline !== this.currentState.isOnline) {
      if (this.currentState.isOnline) {
        this.emit('online', this.currentState);
      } else {
        this.emit('offline', this.currentState);
      }
    }

    this.emit('change', this.currentState);
  }

  /**
   * NetInfo state를 NetworkState로 변환
   */
  private parseNetInfoState(state: NetInfoState): NetworkState {
    const isConnected = state.isConnected ?? false;
    const type = this.parseConnectionType(state.type);
    const isOnline = isConnected && state.isInternetReachable !== false;

    return {
      isOnline,
      isConnected,
      type,
      isConnectionExpensive: state.details?.isConnectionExpensive ?? false,
      strength: this.estimateStrength(type, state.details),
    };
  }

  /**
   * 연결 유형 파싱
   */
  private parseConnectionType(type: NetInfoState['type']): ConnectionType {
    if (type === 'wifi') return 'wifi';
    if (type === 'cellular') return 'cellular';
    if (type === 'none') return 'none';
    return 'unknown';
  }

  /**
   * 네트워크 속도 추정 (셀룰러 타입 기반)
   */
  private estimateStrength(
    type: ConnectionType,
    details: any
  ): 'good' | 'poor' | 'unknown' {
    if (type === 'wifi') return 'good';
    if (type === 'cellular') {
      const cellularGeneration = details?.cellularGeneration;
      if (cellularGeneration === '4g' || cellularGeneration === '5g') {
        return 'good';
      }
      return 'poor';
    }
    return 'unknown';
  }

  /**
   * 현재 네트워크 상태 확인
   */
  getCurrentState(): NetworkState {
    return { ...this.currentState };
  }

  /**
   * 온라인 상태인지 확인
   */
  isOnline(): boolean {
    return this.currentState.isOnline;
  }

  /**
   * 네트워크 상태 새로고침
   */
  async refresh(): Promise<NetworkState> {
    const state = await NetInfo.fetch();
    this.handleStateChange(state);
    return this.getCurrentState();
  }

  /**
   * 이벤트 리스너 정리
   */
  cleanup() {
    if (this.listener) {
      this.listener();
      this.listener = null;
    }
    this.removeAllListeners();
  }
}

// Singleton instance
const detector = new NetworkDetector();

/**
 * 네트워크 상태 확인
 */
export async function isNetworkAvailable(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    const isConnected = state.isConnected ?? false;
    const isInternetReachable = state.isInternetReachable !== false;
    return isConnected && isInternetReachable;
  } catch (error) {
    console.error('Error checking network status:', error);
    return true; // Assume connected if error
  }
}

/**
 * 네트워크 연결 유형 확인
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
export function addNetworkListener(
  callback: (state: NetworkState) => void
): () => void {
  const handler = (state: NetworkState) => callback(state);

  detector.on('change', handler);

  // Return unsubscribe function
  return () => {
    detector.off('change', handler);
  };
}

/**
 * 온라인 상태 변경 리스너 등록
 */
export function addOnlineListener(
  callback: (state: NetworkState) => void
): () => void {
  const handler = (state: NetworkState) => callback(state);

  detector.on('online', handler);

  return () => {
    detector.off('online', handler);
  };
}

/**
 * 오프라인 상태 변경 리스너 등록
 */
export function addOfflineListener(
  callback: (state: NetworkState) => void
): () => void {
  const handler = (state: NetworkState) => callback(state);

  detector.on('offline', handler);

  return () => {
    detector.off('offline', handler);
  };
}

/**
 * 현재 네트워크 상태 가져오기
 */
export function getNetworkState(): NetworkState {
  return detector.getCurrentState();
}

/**
 * 연결이 비싼지 확인 (셀룰러 데이터 등)
 */
export async function isConnectionExpensive(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.details?.isConnectionExpensive ?? false;
  } catch (error) {
    console.error('Error checking if connection is expensive:', error);
    return false;
  }
}

/**
 * 네트워크 상태 확인 후 오프라인 알림 표시
 */
export async function checkNetworkWithAlert(
  onOnline: () => void,
  onOffline?: () => void
): Promise<void> {
  const isOnline = await isNetworkAvailable();

  if (isOnline) {
    onOnline();
  } else {
    onOffline?.();
  }
}

/**
 * 네트워크 상태 텍스트 반환
 */
export function getNetworkStatusText(state: NetworkState): string {
  if (!state.isOnline) return '오프라인';
  if (state.type === 'wifi') return 'Wi-Fi 연결됨';
  if (state.type === 'cellular') {
    if (state.strength === 'good') return '셀룰러 연결됨 (좋음)';
    return '셀룰러 연결됨 (나쁨)';
  }
  return '네트워크 연결됨';
}

/**
 * 네트워크 품질 확인
 */
export async function getNetworkQuality(): Promise<'good' | 'poor' | 'offline'> {
  const state = await getNetworkState();

  if (!state.isOnline) return 'offline';
  if (state.strength === 'good') return 'good';
  return 'poor';
}

/**
 * 디텍터 인스턴스 내보내기 (고급 사용용)
 */
export { detector as networkDetector };

// Export types
export type { NetworkState };

/**
 * React Hook 형태로 사용하기 위한 유틸리티
 * (useNetworkDetector hook으로 별도 구현 가능)
 */
export function createNetworkHook() {
  const listeners = new Set<(state: NetworkState) => void>();

  const unsubscribe = addNetworkListener((state) => {
    listeners.forEach(callback => callback(state));
  });

  return {
    getState: () => getNetworkState(),
    subscribe: (callback: (state: NetworkState) => void) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    cleanup: () => {
      listeners.clear();
      unsubscribe();
    },
  };
}
