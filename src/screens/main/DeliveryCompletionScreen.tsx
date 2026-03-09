/**
 * Delivery Completion Screen
 * 길러가 배송 완료 시 수신자 인증 (6자리 코드)
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
import {
  completeDelivery,
  markAsArrived,
  type DeliveryCompletionData,
} from '../../services/delivery-service';
import { getDeliveryById } from '../../services/delivery-service';
import QRScanner from '../../components/delivery/QRScanner';

// Utils
import { retryWithBackoff, retryFirebaseQuery } from '../../utils/retry-with-backoff';
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
    };
  };
}

export default function DeliveryCompletionScreen({ navigation, route }: Props) {
  const { deliveryId } = route.params;
  const [delivery, setDelivery] = useState<any>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDelivery, setLoadingDelivery] = useState(true);
  const [locationLoading, setLocationLoading] = useState(true);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    initialize();
  }, [deliveryId]);

  const initialize = async () => {
    setLocationLoading(true);
    setLoadingDelivery(true);

    // Load data in parallel
    try {
      const [deliveryData, loc] = await Promise.all([
        loadDelivery(),
        initializeLocation(),
      ]);

      setDelivery(deliveryData);
      setLocation(loc);
    } catch (error) {
      console.error('Error initializing:', error);
    } finally {
      setLoadingDelivery(false);
      setLocationLoading(false);
    }
  };

  const loadDelivery = async () => {
    try {
      const data = await retryFirebaseQuery(() => getDeliveryById(deliveryId));
      return data;
    } catch (error) {
      console.error('Error loading delivery:', error);
      showErrorAlert(error, loadDelivery);
      return null;
    }
  };

  const initializeLocation = async () => {
    // Check camera permission
    const hasCameraPermission = await ensurePermission('camera', {
      showSettingsAlert: false, // Don't show alert on init
    });
    setCameraPermissionGranted(hasCameraPermission);

    // Get location
    const loc = await getCurrentLocation({
      showSettingsAlert: true,
      accuracy: 'high',
    });

    if (loc) {
      return {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
    }
    return null;
  };

  const takePhoto = async () => {
    try {
      // Check camera permission first
      const hasPermission = await requestCameraPermission({
        showSettingsAlert: true,
      });

      if (!hasPermission) {
        return;
      }

      // Import ImagePicker dynamically
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

  const handleMarkArrived = async () => {
    // Check network
    const isOnline = await isNetworkAvailable();
    if (!isOnline) {
      Alert.alert(
        '네트워크 오류',
        '인터넷 연결을 확인해주세요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '다시 시도', onPress: handleMarkArrived },
        ]
      );
      return;
    }

    setLoading(true);

    try {
      const result = await retryWithBackoff(
        () => markAsArrived(deliveryId),
        {
          maxAttempts: 3,
          timeoutMs: 20000,
          onRetry: () => setIsRetrying(true),
        }
      );

      if (result.success) {
        Alert.alert('알림', result.message, [
          {
            text: '확인',
            onPress: async () => {
              const updated = await loadDelivery();
              setDelivery(updated);
            },
          },
        ]);
      } else {
        Alert.alert('오류', result.message, [
          { text: '확인' },
          { text: '다시 시도', onPress: handleMarkArrived },
        ]);
      }
    } catch (error) {
      console.error('Error marking as arrived:', error);
      showErrorAlert(error, handleMarkArrived);
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  const handleCompleteDelivery = async () => {
    // Validation
    if (!location) {
      Alert.alert('위치 필요', '위치 정보를 가져올 수 없습니다. 위치 서비스를 확인해주세요.', [
        { text: '취소', style: 'cancel' },
        { text: '다시 시도', onPress: initializeLocation },
      ]);
      return;
    }

    if (verificationCode?.length !== 6) {
      Alert.alert('코드 오류', '6자리 인증 코드를 입력해주세요.');
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
          { text: '다시 시도', onPress: handleCompleteDelivery },
        ]
      );
      return;
    }

    setLoading(true);
    setIsRetrying(false);

    try {
      const gillerId = requireUserId();
      const data: DeliveryCompletionData = {
        deliveryId,
        gillerId,
        verificationCode,
        photoUri: photoUri || '',
        location,
        notes,
      };

      const result = await retryWithBackoff(
        () => completeDelivery(data),
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

        setTimeout(() => {
          Alert.alert(
            '성공',
            result.message,
            [
              {
                text: '확인',
                onPress: () => {
                  navigation.navigate('Rating', {
                    deliveryId,
                    gillerId,
                    gllerId: delivery?.gllerId,
                  });
                },
              },
            ]
          );
        }, 1500);
      } else {
        Alert.alert('실패', result.message, [
          { text: '확인' },
          { text: '다시 시도', onPress: handleCompleteDelivery },
        ]);
      }
    } catch (error) {
      console.error('Error completing delivery:', error);
      showErrorAlert(error, handleCompleteDelivery);
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  const handleQRScan = useCallback((data: string) => {
    setShowQRScanner(false);

    // QR 데이터 형식: "GANENGILE:{verificationCode}"
    // 예: "GANENGILE:123456"
    if (data.startsWith('GANENGILE:')) {
      const code = data.split(':')[1];
      if (code?.length === 6) {
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

  if (loadingDelivery) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>❌</Text>
        <Text style={styles.errorTitle}>정보를 찾을 수 없음</Text>
        <Text style={styles.errorText}>배송 정보를 불러올 수 없습니다.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={initialize}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isArrived = delivery.status === 'arrived';
  const canComplete = delivery.status === 'arrived' || delivery.status === 'in_transit';

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>배송 완료</Text>
          <Text style={styles.subtitle}>
            {isArrived ? '수신자 인증 후 완료하세요' : '목적지에 도착했나요?'}
          </Text>
        </View>

        {/* Location Status */}
        {locationLoading ? (
          <View style={styles.locationSection}>
            <ActivityIndicator size="small" color="#4CAF50" />
            <Text style={styles.locationText}>위치 확인 중...</Text>
          </View>
        ) : location ? (
          <View style={styles.locationSection}>
            <Text style={styles.locationTitle}>📍 현재 위치</Text>
            <Text style={styles.locationText}>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Text>
          </View>
        ) : (
          <View style={styles.warningCard}>
            <TouchableOpacity onPress={initializeLocation}>
              <Text style={styles.warningText}>위치를 가져오려면 tap하세요</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delivery Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📦 배송 정보</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>수신자</Text>
            <Text style={styles.infoValue}>{delivery.recipientInfo?.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>연락처</Text>
            <Text style={styles.infoValue}>{delivery.recipientInfo?.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>배송지</Text>
            <Text style={styles.infoValue}>
              {delivery.deliveryStation?.stationName}
            </Text>
          </View>
        </View>

        {/* Mark Arrived Button */}
        {!isArrived && canComplete && (
          <TouchableOpacity
            style={styles.arrivedButton}
            onPress={handleMarkArrived}
            disabled={loading}
            accessibilityLabel="목적지 도착 완료"
          >
            {loading ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.arrivedButtonText}>
                  {isRetrying ? '재시도 중...' : '처리 중...'}
                </Text>
              </>
            ) : (
              <Text style={styles.arrivedButtonText}>목적지 도착 완료</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Verification Section */}
        {isArrived && (
          <View style={styles.verificationSection}>
            <Text style={styles.sectionTitle}>수신자 인증</Text>
            <Text style={styles.sectionDesc}>
              수신자에게 6자리 코드를 받아 입력하세요
            </Text>

            {!cameraPermissionGranted ? (
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={async () => {
                  const hasPermission = await ensurePermission('camera', {
                    showSettingsAlert: true,
                  });
                  setCameraPermissionGranted(hasPermission);
                }}
              >
                <Text style={styles.permissionButtonText}>카메라 권한 허용</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.qrButton}
                onPress={() => setShowQRScanner(true)}
                accessibilityLabel="QR 코드 스캔"
              >
                <Text style={styles.qrButtonText}>📷 QR 코드 스캔</Text>
              </TouchableOpacity>
            )}

            {verificationCode && (
              <View style={styles.scannedCodeContainer}>
                <Text style={styles.scannedCodeLabel}>스캔된 코드:</Text>
                <Text style={styles.scannedCode}>{verificationCode}</Text>
              </View>
            )}

            <View style={styles.codeInputContainer}>
              <TextInput
                style={styles.codeInput}
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
                accessibilityLabel="인증 코드 입력"
                accessibilityHint="6자리 숫자를 입력하세요"
              />
            </View>

            {/* Photo (Optional) */}
            <View style={styles.photoSection}>
              <Text style={styles.photoTitle}>배송 사진 (선택)</Text>
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
                >
                  <Text style={styles.photoButtonIcon}>📷</Text>
                  <Text style={styles.photoButtonText}>사진 촬영</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Notes (Optional) */}
            <View style={styles.notesSection}>
              <Text style={styles.notesTitle}>특이사항 (선택)</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="배송 관련 특이사항을 입력하세요"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                maxLength={200}
                accessibilityLabel="특이사항 입력"
              />
              <Text style={styles.charCount}>{notes.length}/200</Text>
            </View>
          </View>
        )}

        {/* Complete Button */}
        {isArrived && (
          <TouchableOpacity
            style={[styles.completeButton, !verificationCode && styles.completeButtonDisabled]}
            onPress={handleCompleteDelivery}
            disabled={!verificationCode || loading}
            accessibilityLabel="배송 완료"
          >
            {loading ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.completeButtonText}>
                  {isRetrying ? '재시도 중...' : '완료 중...'}
                </Text>
              </>
            ) : (
              <Text style={styles.completeButtonText}>배송 완료</Text>
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
        message="배송 완료!"
        submessage="성공적으로 인증되었습니다"
        duration={2000}
        onComplete={() => setShowSuccess(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  arrivedButton: {
    alignItems: 'center',
    backgroundColor: '#FF9800',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  arrivedButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
    borderRadius: 12,
    borderWidth: 1,
    margin: 16,
    padding: 16,
  },
  cardTitle: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  charCount: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
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
    marginBottom: 16,
    padding: 16,
  },
  completeButton: {
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    margin: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  completeButtonDisabled: {
    backgroundColor: '#ccc',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
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
  infoLabel: {
    color: '#666',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
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
  notesInput: {
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
    borderRadius: 12,
    borderWidth: 1,
    color: '#333',
    fontSize: 14,
    minHeight: 80,
    padding: 12,
  },
  notesSection: {
    marginBottom: 16,
  },
  notesTitle: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  photo: {
    borderRadius: 12,
    height: 200,
    marginBottom: 8,
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
    marginBottom: 16,
  },
  photoTitle: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  permissionButton: {
    alignItems: 'center',
    backgroundColor: '#FF9800',
    borderRadius: 12,
    marginBottom: 16,
    padding: 20,
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
    marginBottom: 16,
    padding: 20,
  },
  qrButtonText: {
    color: '#fff',
    fontSize: 16,
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
    marginBottom: 16,
    padding: 16,
    textAlign: 'center',
  },
  scannedCodeContainer: {
    alignItems: 'center',
  },
  scannedCodeLabel: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
  },
  retakeButton: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
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
  warningCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    margin: 16,
    padding: 16,
  },
  warningText: {
    color: '#E65100',
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  errorTitle: {
    color: '#333',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorText: {
    color: '#666',
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
