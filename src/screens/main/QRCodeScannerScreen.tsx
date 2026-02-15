/**
 * QRCode Scanner Screen
 * QR코드 스캔 화면 (P1-4)
 *
 * 기능:
 * - 카메라로 QR코드 스캔
 * - JWT 토큰 검증
 * - 사물함 잠금 해제
 * - 10분 유효
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  BackHandler,
  Platform,
  Linking,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { verifyQRCode } from '../../services/qrcode-service';
import { unlockLocker } from '../../services/locker-service';
import { requireUserId } from '../../services/firebase';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

interface QRCodeData {
  lockerId: string;
  token: string;
  timestamp: number;
}

export default function QRCodeScannerScreen({ navigation }: Props) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cameraRef = useRef<any>(null);
  const device = useCameraDevice('back');
  const { requestPermission, hasPermission: checkPermission } = useCameraPermission();

  useEffect(() => {
    requestCameraPermission();
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (verifying) {
        return true; // 차단
      }
      return false;
    });

    return () => backHandler.remove();
  }, [verifying]);

  const requestCameraPermission = async () => {
    try {
      const permission = await requestPermission();
      setHasPermission(permission === 'granted');

      if (permission !== 'granted') {
        Alert.alert(
          '카메라 권한 필요',
          'QR코드 스캔을 위해 카메라 권한이 필요합니다.',
          [
            { text: '취소', onPress: () => navigation.goBack() },
            { text: '설정', onPress: () => openAppSettings() },
          ]
        );
      }
    } catch (err) {
      console.error('Camera permission error:', err);
      Alert.alert('오류', '카메라 권한을 확인할 수 없습니다.');
    }
  };

  const openAppSettings = () => {
    // iOS: 앱 설정 화면로 직접 이동
    // Android: 앱 정보 설정 화면으로 이동
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const handleQRCodeScanned = async (data: string[]) => {
    if (scanned || verifying) return;

    try {
      setScanned(true);
      setVerifying(true);
      setError(null);

      // QR코드 데이터 파싱
      const qrData: QRCodeData = JSON.parse(data[0]);
      setQrData(qrData);

      // QR코드 검증
      const isValid = await verifyQRCode(qrData);

      if (!isValid) {
        setError('유효하지 않은 QR코드입니다.');
        setScanned(false);
        setVerifying(false);
        return;
      }

      // 사물함 잠금 해제
      await unlockLocker(qrData.lockerId);

      Alert.alert(
        '잠금 해제 성공',
        '사물함이 열렸습니다.\n물건을 넣거나 꺼내신 후 닫아주세요.',
        [
          {
            text: '확인',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err: any) {
      console.error('QR code scan error:', err);
      setError(err.message || 'QR코드를 처리할 수 없습니다.');
      setScanned(false);
      setVerifying(false);
    }
  };

  const handleRetry = () => {
    setScanned(false);
    setError(null);
    setQrData(null);
  };

  const formatExpiryTime = (timestamp: number): string => {
    const expiryDate = new Date(timestamp);
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins <= 0) {
      return '만료됨';
    }

    return `${diffMins}분 후 만료`;
  };

  if (hasPermission === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>권한 확인 중...</Text>
      </View>
    );
  }

  if (hasPermission === false || !device) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>📷</Text>
        <Text style={styles.errorTitle}>카메라 접근 불가</Text>
        <Text style={styles.errorMessage}>
          카메라 권한이 필요하거나 카메라를 사용할 수 없습니다.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={openAppSettings}>
          <Text style={styles.retryButtonText}>설정으로 이동</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 카메라 뷰 */}
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={!scanned && !verifying}
        onCodeScanned={handleQRCodeScanned}
        codeScannerOptions={{
          codeTypes: ['qr'],
          recognition: 'fast',
        }}
      />

      {/* 오버레이 안내 */}
      {!scanned && !verifying && (
        <View style={styles.scanOverlay}>
          <View style={styles.scanCornerContainer}>
            <View style={[styles.scanCorner, styles.topLeft]} />
            <View style={[styles.scanCorner, styles.topRight]} />
            <View style={[styles.scanCorner, styles.bottomLeft]} />
            <View style={[styles.scanCorner, styles.bottomRight]} />
          </View>
          <View style={styles.scanGuide}>
            <Text style={styles.scanGuideText}>QR코드를 스캔하세요</Text>
            <Text style={styles.scanGuideSubtext}>
              사물함에 부착된 QR코드를
            </Text>
            <Text style={styles.scanGuideSubtext}>카메라에 비추세요</Text>
          </View>
        </View>
      )}

      {/* 로딩/검증 상태 */}
      {(scanned || verifying) && (
        <View style={styles.statusContainer}>
          {verifying ? (
            <>
              <ActivityIndicator size="large" color={Colors.white} />
              <Text style={styles.statusText}>검증 중...</Text>
              <Text style={styles.statusSubtext}>QR코드를 확인하고 있습니다</Text>
            </>
          ) : error ? (
            <>
              <Text style={styles.errorIcon}>❌</Text>
              <Text style={styles.errorTitle}>스캔 실패</Text>
              <Text style={styles.errorMessage}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                <Text style={styles.retryButtonText}>다시 시도</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={Colors.white} />
              <Text style={styles.statusText}>처리 중...</Text>
            </>
          )}
        </View>
      )}

      {/* QR코드 정보 (디버깅용) */}
      {qrData && !error && (
        <View style={styles.qrInfoContainer}>
          <View style={styles.qrInfoHeader}>
            <Text style={styles.qrInfoTitle}>QR코드 정보</Text>
            <TouchableOpacity
              style={styles.qrInfoCloseButton}
              onPress={() => setQrData(null)}
            >
              <Text style={styles.qrInfoCloseButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.qrInfoContent}>
            <Text style={styles.qrInfoLabel}>사물함 ID</Text>
            <Text style={styles.qrInfoValue}>{qrData.lockerId}</Text>
          </View>
          <View style={styles.qrInfoContent}>
            <Text style={styles.qrInfoLabel}>유효 시간</Text>
            <Text style={styles.qrInfoValue}>{formatExpiryTime(qrData.timestamp)}</Text>
          </View>
        </View>
      )}

      {/* 하단 안내 */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          💡 QR코드는 사물함 옆에 부착되어 있습니다
        </Text>
        <Text style={styles.footerSubtext}>
          스캔 후 10분 내에 사용하세요
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  camera: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    ...Typography.body1,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  errorTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  errorMessage: {
    ...Typography.body1,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  retryButtonText: {
    ...Typography.body1,
    color: Colors.white,
    fontWeight: '600',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanCornerContainer: {
    width: 250,
    height: 250,
    position: 'absolute',
  },
  scanCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: Colors.white,
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopLeftRadius: 10,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopRightRadius: 10,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomLeftRadius: 10,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomRightRadius: 10,
  },
  scanGuide: {
    position: 'absolute',
    bottom: -100,
    alignItems: 'center',
  },
  scanGuideText: {
    ...Typography.h3,
    color: Colors.white,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  scanGuideSubtext: {
    ...Typography.body1,
    color: Colors.white,
    textAlign: 'center',
  },
  statusContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    ...Typography.h2,
    color: Colors.white,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  statusSubtext: {
    ...Typography.body1,
    color: Colors.white,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  qrInfoContainer: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  qrInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  qrInfoTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  qrInfoCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrInfoCloseButtonText: {
    fontSize: 20,
    color: Colors.textSecondary,
  },
  qrInfoContent: {
    marginBottom: Spacing.sm,
  },
  qrInfoLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  qrInfoValue: {
    ...Typography.body1,
    color: Colors.text,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  footerText: {
    ...Typography.body1,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  footerSubtext: {
    ...Typography.body2,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
