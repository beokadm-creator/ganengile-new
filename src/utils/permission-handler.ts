import { Alert, Linking, Platform } from 'react-native';
import { Camera } from 'expo-camera';
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

export function getPermissionStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    granted: '허용됨',
    denied: '거부됨',
    undetermined: '아직 결정되지 않음',
    limited: '일부만 허용됨',
    blocked: '설정에서 차단됨',
  };

  return statusMap[status] ?? status;
}

export async function checkCameraPermission(): Promise<PermissionResult> {
  try {
    const status = await Camera.getCameraPermissionsAsync();
    return {
      granted: status.granted,
      canRequest: status.status !== 'denied' ?? Platform.OS === 'ios',
      status: status.status,
    };
  } catch (error) {
    console.error('Error checking camera permission:', error);
    return { granted: false, canRequest: true, status: 'undetermined' };
  }
}

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
    return { granted: false, canRequest: true, status: 'undetermined' };
  }
}

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
    return { granted: false, canRequest: true, status: 'undetermined' };
  }
}

export async function requestCameraPermission(options: PermissionOptions = {}): Promise<boolean> {
  const { onDenied, onGranted, onBlocked, showSettingsAlert = true } = options;

  try {
    const status = await Camera.requestCameraPermissionsAsync();

    if (status.granted) {
      onGranted?.();
      return true;
    }

    if (!status.canAskAgain) {
      if (showSettingsAlert) {
        showOpenSettingsAlert('카메라');
      }
      onBlocked?.();
      return false;
    }

    onDenied?.();
    return false;
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    onDenied?.();
    return false;
  }
}

export async function requestLocationPermission(options: PermissionOptions = {}): Promise<boolean> {
  const { onDenied, onGranted, onBlocked, showSettingsAlert = true } = options;

  try {
    const status = await Location.requestForegroundPermissionsAsync();

    if (status.granted) {
      onGranted?.();
      return true;
    }

    if (!status.canAskAgain) {
      if (showSettingsAlert) {
        showOpenSettingsAlert('위치');
      }
      onBlocked?.();
      return false;
    }

    onDenied?.();
    return false;
  } catch (error) {
    console.error('Error requesting location permission:', error);
    onDenied?.();
    return false;
  }
}

export async function requestPhotosPermission(options: PermissionOptions = {}): Promise<boolean> {
  const { onDenied, onGranted, onBlocked, showSettingsAlert = true } = options;

  try {
    const status = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status.granted) {
      onGranted?.();
      return true;
    }

    if (!status.canAskAgain) {
      if (showSettingsAlert) {
        showOpenSettingsAlert('사진');
      }
      onBlocked?.();
      return false;
    }

    onDenied?.();
    return false;
  } catch (error) {
    console.error('Error requesting photos permission:', error);
    onDenied?.();
    return false;
  }
}

export function showOpenSettingsAlert(permissionName: string): void {
  Alert.alert(
    '권한이 필요합니다',
    `${permissionName} 권한이 꺼져 있어 이 기능을 사용할 수 없습니다.\n\n설정에서 ${permissionName} 권한을 허용해 주세요.`,
    [
      { text: '취소', style: 'cancel' },
      { text: '설정 열기', onPress: openAppSettings },
    ],
    { cancelable: true }
  );
}

export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (error) {
    console.error('Error opening settings:', error);
    Alert.alert('설정을 열 수 없습니다', '기기 설정에서 직접 앱 권한을 확인해 주세요.');
  }
}

export async function requestMultiplePermissions(
  permissions: PermissionType[],
  options: PermissionOptions = {}
): Promise<Record<PermissionType, boolean>> {
  const results: Record<PermissionType, boolean> = {} as Record<PermissionType, boolean>;

  await Promise.all(
    permissions.map(async (permission) => {
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
    })
  );

  return results;
}

export async function ensurePermission(
  permissionType: PermissionType,
  options: PermissionOptions = {}
): Promise<boolean> {
  switch (permissionType) {
    case 'camera': {
      const checkResult = await checkCameraPermission();
      return checkResult.granted ? true : requestCameraPermission(options);
    }
    case 'location': {
      const checkResult = await checkLocationPermission();
      return checkResult.granted ? true : requestLocationPermission(options);
    }
    case 'photos': {
      const checkResult = await checkPhotosPermission();
      return checkResult.granted ? true : requestPhotosPermission(options);
    }
    default:
      return false;
  }
}

export async function getCurrentLocation(
  options: {
    showSettingsAlert?: boolean;
    accuracy?: Location.LocationAccuracy;
  } = {}
): Promise<Location.LocationObject | null> {
  const { showSettingsAlert = true, accuracy = Location.Accuracy.Balanced } = options;

  const hasPermission = await ensurePermission('location', { showSettingsAlert });
  if (!hasPermission) {
    return null;
  }

  try {
    return await Location.getCurrentPositionAsync({ accuracy });
  } catch (error) {
    console.error('Error getting location:', error);

    if (String(error).includes('Location services are disabled')) {
      Alert.alert(
        '위치 서비스가 꺼져 있습니다',
        '기기 설정에서 위치 서비스를 켠 뒤 다시 시도해 주세요.',
        [
          { text: '닫기', style: 'cancel' },
          { text: '설정 열기', onPress: openAppSettings },
        ]
      );
    }

    return null;
  }
}

export function subscribeToPermissionChanges(
  permissionType: PermissionType,
  callback: (status: string) => void
): (() => void) | null {
  void permissionType;
  void callback;

  if (Platform.OS !== 'ios') {
    return null;
  }

  console.warn('Permission change monitoring is not fully supported on iOS');
  return () => {};
}

export function getPermissionDescription(permissionType: PermissionType): string {
  const descriptions: Record<PermissionType, string> = {
    camera: '사진 촬영과 인증을 위해 카메라 권한이 필요합니다.',
    location: '현재 위치 기반 역 추천과 배송 진행 확인을 위해 위치 권한이 필요합니다.',
    photos: '사진 선택과 업로드를 위해 사진 권한이 필요합니다.',
    microphone: '음성 기능을 위해 마이크 권한이 필요합니다.',
  };

  return descriptions[permissionType] ?? '권한이 필요합니다.';
}
