/**
 * Pickup Verification Screen
 * 길러가 픽업 시 QR코드/4자리 코드 + 사진으로 인증
 * 개선사항: 네트워크 에러 처리, 권한 처리, 타임아웃, 더 나은 UX
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { requireUserId } from '../../services/firebase';
import { verifyPickup, type PickupVerificationData } from '../../services/delivery-service';
import QRScanner from '../../components/delivery/QRScanner';

// Utils
import { retryWithBackoff } from '../../utils/retry-with-backoff';
import { showErrorAlert, createPermissionError } from '../../utils/error-handler';
import { getCurrentLocation, ensurePermission, requestCameraPermission } from '../../utils/permission-handler';
import { isNetworkAvailable } from '../../utils/network-detector';
import { SuccessOverlay } from '../../utils/success-animation';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
  route: {
    params: {
      deliveryId: string;
      requestId: string;
    };
  };
}

type VerificationMethod = 'qr' | 'code' | null;

export default function PickupVerificationScreen({ navigation, route }: Props) {
  const { deliveryId } = route.params;
  const [method, setMethod] = useState<VerificationMethod>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Get current location and check permissions on mount
  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    setLocationLoading(true);

    // Check camera permission first
    const hasCameraPermission = await ensurePermission('camera', {
      showSettingsAlert: true,
    });
    setCameraPermissionGranted(hasCameraPermission);

    // Get location
    const loc = await getCurrentLocation({
      showSettingsAlert: true,
      accuracy: 'high',
    });

    if (loc) {
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    }

    setLocationLoading(false);
  };

  const selectVerificationMethod = useCallback((selectedMethod: VerificationMethod) => {
    setMethod(selectedMethod);
  }, []);

  const takePhoto = async () => {
    try {
      // Check camera permission first
      const hasPermission = await requestCameraPermission({
        showSettingsAlert: true,
      });

      if (!hasPermission) {
        return;
      }

      // Import ImagePicker dynamically to avoid permission issues
      const ImagePicker = require('expo-image-picker');

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);

      if (String(error).includes('Permission')) {
        showErrorAlert(createPermissionError('camera'));
      } else {
        showErrorAlert(error, takePhoto);
      }
    }
  };

  const handleVerifyPickup = async () => {
    // Validation
    if (!location) {
      Alert.alert('위치 필요', '위치 정보를 가져올 수 없습니다. 위치 서비스를 확인해주세요.', [
        { text: '취소', style: 'cancel' },
        { text: '다시 시도', onPress: initialize },
      ]);
      return;
    }

    if (!photoUri) {
      Alert.alert('사진 필요', '픽업 사진을 촬영해주세요.');
      return;
    }

    if (method === 'code' && (verificationCode?.length !== 4)) {
      Alert.alert('코드 오류', '4자리 인증 코드를 입력해주세요.');
      return;
    }

    // Check network
    const isOnline = await isNetworkAvailable();
    if (!isOnline) {
      Alert.alert(
        '네트워크 오류',
        '인터넷 연결을 확인해주세요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '다시 시도', onPress: handleVerifyPickup },
        ]
      );
      return;
    }

    setLoading(true);
    setIsRetrying(false);

    try {
      const gillerId = requireUserId();
      const data: PickupVerificationData = {
        deliveryId,
        gillerId,
        verificationCode: method === 'code' ? verificationCode : '',
        photoUri,
        location,
      };

      const result = await retryWithBackoff(
        () => verifyPickup(data),
        {
          maxAttempts: 3,
          timeoutMs: 30000,
          onRetry: (attempt) => {
            setIsRetrying(true);
            console.log(`Retry attempt ${attempt}...`);
          },
        }
      );

      if (result.success) {
        // Show success animation
        setShowSuccess(true);

        // Navigate after animation
        setTimeout(() => {
          Alert.alert(
            '성공',
            result.message,
            [
              {
                text: '확인',
                onPress: () => {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Tabs' }],
                  });
                },
              },
            ]
          );
        }, 1500);
      } else {
        Alert.alert('실패', result.message, [
          { text: '확인' },
          { text: '다시 시도', onPress: handleVerifyPickup },
        ]);
      }
    } catch (error) {
      console.error('Error verifying pickup:', error);
      showErrorAlert(error, () => handleVerifyPickup());
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  const handleQRScan = useCallback((data: string) => {
    setShowQRScanner(false);

    // QR 데이터 형식: "GANENGILE:{verificationCode}"
    // 예: "GANENGILE:1234"
    if (data.startsWith('GANENGILE:')) {
      const code = data.split(':')[1];
      if (code?.length === 4) {
        setVerificationCode(code);
        Alert.alert('QR 스캔 성공', `인증 코드 ${code}가 입력되었습니다.`);
      } else {
        Alert.alert('QR 오류', '잘못된 QR 코드 형식입니다.');
      }
    } else {
      Alert.alert('QR 오류', '가는길에 QR 코드가 아닙니다.');
    }
  }, []);

  const handleQRError = useCallback((error: string) => {
    setShowQRScanner(false);
    Alert.alert('카메라 오류', error, [
      { text: '확인' },
      { text: '다시 시도', onPress: () => setShowQRScanner(true) },
    ]);
  }, []);

  if (locationLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>위치 정보 가져오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>픽업 인증</Text>
          <Text style={styles.subtitle}>물품 수령을 위해 인증해주세요</Text>
        </View>

        {/* Location Status */}
        {location && (
          <View style={styles.locationSection}>
            <Text style={styles.locationTitle}>📍 위치 확인됨</Text>
            <Text style={styles.locationText}>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Text>
          </View>
        )}

        {/* Permission Warning */}
        {!cameraPermissionGranted && (
          <View style={styles.warningCard}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>
              카메라 권한이 필요합니다. 사진 촬영을 위해 권한을 허용해주세요.
            </Text>
          </View>
        )}

        {/* Verification Method Selection */}
        {!method && (
          <View style={styles.methodSelection}>
            <TouchableOpacity
              style={styles.methodCard}
              onPress={() => selectVerificationMethod('code')}
              accessibilityLabel="4자리 코드로 인증"
              accessibilityHint="요청자에게 받은 4자리 코드를 입력합니다"
            >
              <Text style={styles.methodIcon}>🔢</Text>
              <Text style={styles.methodTitle}>4자리 코드</Text>
              <Text style={styles.methodDesc}>요청자에게 받은 코드 입력</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.methodCard}
              onPress={() => selectVerificationMethod('qr')}
              accessibilityLabel="QR 코드로 인증"
              accessibilityHint="요청자의 QR 코드를 스캔합니다"
            >
              <Text style={styles.methodIcon}>📷</Text>
              <Text style={styles.methodTitle}>QR 코드</Text>
              <Text style={styles.methodDesc}>요청자의 QR 코드 스캔</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Code Input Method */}
        {method === 'code' && (
          <View style={styles.verificationSection}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setMethod(null)}
              accessibilityLabel="다른 방법 선택"
            >
              <Text style={styles.backButtonText}>← 다른 방법 선택</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>4자리 인증 코드</Text>
            <Text style={styles.sectionDesc}>
              요청자에게 받은 4자리 코드를 입력하세요
            </Text>

            <View style={styles.codeInputContainer}>
              <TextInput
                style={styles.codeInput}
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="0000"
                keyboardType="number-pad"
                maxLength={4}
                textAlign="center"
                autoFocus
                accessibilityLabel="인증 코드 입력"
                accessibilityHint="4자리 숫자를 입력하세요"
              />
            </View>
          </View>
        )}

        {/* QR Code Scanner Method */}
        {method === 'qr' && (
          <View style={styles.verificationSection}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setMethod(null)}
              accessibilityLabel="다른 방법 선택"
            >
              <Text style={styles.backButtonText}>← 다른 방법 선택</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>QR 코드 스캔</Text>
            <Text style={styles.sectionDesc}>
              요청자의 QR 코드를 스캔하세요
            </Text>

            {!cameraPermissionGranted ? (
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={initialize}
              >
                <Text style={styles.permissionButtonText}>카메라 권한 허용</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.qrButton}
                onPress={() => setShowQRScanner(true)}
                accessibilityLabel="QR 코드 스캔 시작"
              >
                <Text style={styles.qrButtonText}>📷 QR 코드 스캔 시작</Text>
              </TouchableOpacity>
            )}

            {verificationCode && (
              <View style={styles.scannedCodeContainer}>
                <Text style={styles.scannedCodeLabel}>스캔된 코드:</Text>
                <Text style={styles.scannedCode}>{verificationCode}</Text>
              </View>
            )}
          </View>
        )}

        {/* Photo Section */}
        {method && (
          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>픽업 사진 촬영</Text>
            <Text style={styles.sectionDesc}>
              물품과 함께 사진을 찍어주세요
            </Text>

            {photoUri ? (
              <View style={styles.photoPreview}>
                <Image source={{ uri: photoUri }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={takePhoto}
                  accessibilityLabel="사진 다시 찍기"
                >
                  <Text style={styles.retakeButtonText}>다시 찍기</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.photoButton}
                onPress={takePhoto}
                accessibilityLabel="사진 촬영"
                accessibilityHint="카메라로 물품 사진을 찍습니다"
              >
                <Text style={styles.photoButtonIcon}>📷</Text>
                <Text style={styles.photoButtonText}>사진 촬영</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Verify Button */}
        {method && (
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (!photoUri || (method === 'code' && !verificationCode)) &&
              styles.verifyButtonDisabled
            ]}
            onPress={handleVerifyPickup}
            disabled={
              !photoUri ||
              (method === 'code' && !verificationCode) ||
              loading
            }
            accessibilityLabel="픽업 완료"
            accessibilityHint="픽업을 완료하고 인증합니다"
          >
            {loading ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.verifyButtonText}>
                  {isRetrying ? '재시도 중...' : '인증 중...'}
                </Text>
              </>
            ) : (
              <Text style={styles.verifyButtonText}>픽업 완료</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* QR Scanner Modal */}
      <Modal
        visible={showQRScanner}
        animationType="slide"
        onRequestClose={() => setShowQRScanner(false)}
      >
        <QRScanner
          onScan={handleQRScan}
          onError={handleQRError}
          onClose={() => setShowQRScanner(false)}
        />
      </Modal>

      {/* Success Overlay */}
      <SuccessOverlay
        visible={showSuccess}
        message="픽업 완료!"
        submessage="성공적으로 인증되었습니다"
        duration={2000}
        onComplete={() => setShowSuccess(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  codeInput: {
    color: '#333',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  codeInputContainer: {
    backgroundColor: '#fff',
    borderColor: '#4CAF50',
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
  },
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    paddingBottom: 24,
    paddingTop: 60,
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  locationSection: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    margin: 16,
    padding: 16,
  },
  locationText: {
    color: '#666',
    fontSize: 12,
  },
  locationTitle: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  methodCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
  },
  methodDesc: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  methodIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  methodSelection: {
    gap: 12,
    padding: 16,
  },
  methodTitle: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  photo: {
    borderRadius: 12,
    height: 250,
    marginBottom: 12,
    width: '100%',
  },
  photoButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 2,
    padding: 24,
  },
  photoButtonIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  photoButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  photoPreview: {
    alignItems: 'center',
  },
  photoSection: {
    padding: 16,
  },
  permissionButton: {
    alignItems: 'center',
    backgroundColor: '#FF9800',
    borderRadius: 12,
    padding: 24,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  qrButton: {
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 24,
  },
  qrButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scannedCode: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
    borderRadius: 8,
    borderWidth: 2,
    color: '#333',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginTop: 8,
    padding: 16,
    textAlign: 'center',
  },
  scannedCodeContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  scannedCodeLabel: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
  },
  retakeButton: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retakeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionDesc: {
    color: '#666',
    fontSize: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#333',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  verificationSection: {
    padding: 16,
  },
  verifyButton: {
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    margin: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  verifyButtonDisabled: {
    backgroundColor: '#ccc',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  warningCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    flexDirection: 'row',
    margin: 16,
    marginBottom: 0,
    padding: 16,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  warningText: {
    color: '#E65100',
    flex: 1,
    fontSize: 14,
  },
});
