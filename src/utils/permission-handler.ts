/**
 * Permission Handler
 * 카메라, 위치, 사진 라이브러리 권한 요청 및 처리
 */

import { Alert, Linking, Platform } from 'react-native';
import {
  Camera,
  CameraPermissionStatus,
} from 'expo-camera';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

export type PermissionType = 'camera' | 'location' | 'photos' | 'microphone';

export interface PermissionResult {
  granted: boolean;
  canRequest: boolean;
  status: string;
}

export interface PermissionOptions {
  onDenied?: () => void;
  onGranted?: () => void;
  onBlocked?: () => void;
  showSettingsAlert?: boolean;
}

/**
 * 권한 상태 텍스트 변환
 */
export function getPermissionStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    granted: '허용됨',
    denied: '거부됨',
    undetermined: '결정 안 함',
    limited: '제한적 허용',
    blocked: '차단됨',
  };
  return statusMap[status] || status;
}

/**
 * 카메라 권한 확인
 */
export async function checkCameraPermission(): Promise<PermissionResult> {
  try {
    const status = await Camera.getCameraPermissionAsync();
    return {
      granted: status === 'granted',
      canRequest: status !== 'denied' || Platform.OS === 'ios',
      status,
    };
  } catch (error) {
    console.error('Error checking camera permission:', error);
    return {
      granted: false,
      canRequest: true,
      status: 'undetermined',
    };
  }
}

/**
 * 위치 권한 확인
 */
export async function checkLocationPermission(): Promise<PermissionResult> {
  try {
    const status = await Location.getForegroundPermissionsAsync();
    return {
      granted: status.granted,
      canRequest: status.canAskAgain,
      status: status.granted ? 'granted' : status.canAskAgain ? 'undetermined' : 'denied',
    };
  } catch (error) {
    console.error('Error checking location permission:', error);
    return {
      granted: false,
      canRequest: true,
      status: 'undetermined',
    };
  }
}

/**
 * 사진 라이브러리 권한 확인
 */
export async function checkPhotosPermission(): Promise<PermissionResult> {
  try {
    const status = await ImagePicker.getMediaLibraryPermissionsAsync();
    return {
      granted: status.granted,
      canRequest: status.canAskAgain,
      status: status.granted ? 'granted' : status.canAskAgain ? 'undetermined' : 'denied',
    };
  } catch (error) {
    console.error('Error checking photos permission:', error);
    return {
      granted: false,
      canRequest: true,
      status: 'undetermined',
    };
  }
}

/**
 * 카메라 권한 요청
 */
export async function requestCameraPermission(
  options: PermissionOptions = {}
): Promise<boolean> {
  const { onDenied, onGranted, onBlocked, showSettingsAlert = true } = options;

  try {
    const status = await Camera.requestCameraPermissionsAsync();

    if (status.granted) {
      onGranted?.();
      return true;
    }

    // Permission denied
    if (!status.canAskAgain) {
      // Permanently denied - show settings alert
      if (showSettingsAlert) {
        showOpenSettingsAlert('카메라');
      }
      onBlocked?.();
      return false;
    }

    // Can ask again
    onDenied?.();
    return false;
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    onDenied?.();
    return false;
  }
}

/**
 * 위치 권한 요청
 */
export async function requestLocationPermission(
  options: PermissionOptions = {}
): Promise<boolean> {
  const { onDenied, onGranted, onBlocked, showSettingsAlert = true } = options;

  try {
    const status = await Location.requestForegroundPermissionsAsync();

    if (status.granted) {
      onGranted?.();
      return true;
    }

    // Permission denied
    if (!status.canAskAgain) {
      // Permanently denied - show settings alert
      if (showSettingsAlert) {
        showOpenSettingsAlert('위치');
      }
      onBlocked?.();
      return false;
    }

    // Can ask again
    onDenied?.();
    return false;
  } catch (error) {
    console.error('Error requesting location permission:', error);
    onDenied?.();
    return false;
  }
}

/**
 * 사진 라이브러리 권한 요청
 */
export async function requestPhotosPermission(
  options: PermissionOptions = {}
): Promise<boolean> {
  const { onDenied, onGranted, onBlocked, showSettingsAlert = true } = options;

  try {
    const status = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status.granted) {
      onGranted?.();
      return true;
    }

    // Permission denied
    if (!status.canAskAgain) {
      // Permanently denied - show settings alert
      if (showSettingsAlert) {
        showOpenSettingsAlert('사진');
      }
      onBlocked?.();
      return false;
    }

    // Can ask again
    onDenied?.();
    return false;
  } catch (error) {
    console.error('Error requesting photos permission:', error);
    onDenied?.();
    return false;
  }
}

/**
 * 설정 열기 알림 표시
 */
export function showOpenSettingsAlert(permissionName: string): void {
  const message = `${permissionName} 권한이 필요합니다.\n\n설정에서 ${permissionName} 권한을 허용해주세요.`;

  Alert.alert(
    '권한 필요',
    message,
    [
      {
        text: '취소',
        style: 'cancel',
      },
      {
        text: '설정으로 이동',
        onPress: openAppSettings,
      },
    ],
    { cancelable: true }
  );
}

/**
 * 앱 설정 화면 열기
 */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (error) {
    console.error('Error opening settings:', error);
    Alert.alert(
      '오류',
      '설정 화면을 열 수 없습니다. 수동으로 설정 > 가는길에 > 권한에서 변경해주세요.'
    );
  }
}

/**
 * 복합 권한 요청 (여러 권한 한번에 요청)
 */
export async function requestMultiplePermissions(
  permissions: PermissionType[],
  options: PermissionOptions = {}
): Promise<Record<PermissionType, boolean>> {
  const results: Record<PermissionType, boolean> = {} as any;

  const promises = permissions.map(async (permission) => {
    switch (permission) {
      case 'camera':
        results.camera = await requestCameraPermission(options);
        break;
      case 'location':
        results.location = await requestLocationPermission(options);
        break;
      case 'photos':
        results.photos = await requestPhotosPermission(options);
        break;
      default:
        results[permission] = false;
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * 권한이 필요한 작업 전에 체크 및 요청
 */
export async function ensurePermission(
  permissionType: PermissionType,
  options: PermissionOptions = {}
): Promise<boolean> {
  let checkResult: PermissionResult;

  switch (permissionType) {
    case 'camera':
      checkResult = await checkCameraPermission();
      if (checkResult.granted) return true;
      return requestCameraPermission(options);

    case 'location':
      checkResult = await checkLocationPermission();
      if (checkResult.granted) return true;
      return requestLocationPermission(options);

    case 'photos':
      checkResult = await checkPhotosPermission();
      if (checkResult.granted) return true;
      return requestPhotosPermission(options);

    default:
      return false;
  }
}

/**
 * 위치 정보 가져오기 (권한 포함)
 */
export async function getCurrentLocation(
  options: {
    showSettingsAlert?: boolean;
    accuracy?: Location.LocationAccuracy;
  } = {}
): Promise<Location.LocationObject | null> {
  const { showSettingsAlert = true, accuracy = Location.Accuracy.Balanced } = options;

  // Check and request permission
  const hasPermission = await ensurePermission('location', {
    showSettingsAlert,
  });

  if (!hasPermission) {
    return null;
  }

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy,
    });
    return location;
  } catch (error) {
    console.error('Error getting location:', error);

    // Show user-friendly error
    if (String(error).includes('Location services are disabled')) {
      Alert.alert(
        '위치 서비스 꺼짐',
        '위치 서비스가 꺼져 있습니다. 기기 설정에서 위치 서비스를 켜주세요.',
        [
          { text: '확인', style: 'cancel' },
          { text: '설정', onPress: openAppSettings },
        ]
      );
    }

    return null;
  }
}

/**
 * 권한 상태 모니터링 (iOS only)
 */
export function subscribeToPermissionChanges(
  permissionType: PermissionType,
  callback: (status: string) => void
): (() => void) | null {
  if (Platform.OS !== 'ios') {
    return null;
  }

  // Note: expo-location and expo-image-picker don't have built-in listeners
  // This is a placeholder for future implementation
  console.warn('Permission change monitoring is not fully supported on iOS');
  return () => {};
}

/**
 * 권한 설명 텍스트 생성
 */
export function getPermissionDescription(permissionType: PermissionType): string {
  const descriptions: Record<PermissionType, string> = {
    camera: '사진 촬영을 위해 카메라 접근 권한이 필요합니다.',
    location: '현재 위치 확인을 위해 위치 권한이 필요합니다.',
    photos: '사진 선택을 위해 사진 라이브러리 접근 권한이 필요합니다.',
    microphone: '녹음을 위해 마이크 권한이 필요합니다.',
  };

  return descriptions[permissionType] || '권한이 필요합니다.';
}
