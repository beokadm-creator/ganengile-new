/**
 * GillerPickupFromLockerScreen
 * 이용자: 길러가 보관한 사물함에서 물건을 수령하는 화면
 * 5단계 플로우: QR 스캔 → 사물함 정보 확인 → 열기 → 수령 확인 → 완료
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Typography, Colors, Spacing, BorderRadius } from '../../styles';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { getReservationByQRCode, openLocker, getLocker } from '../../services/locker-service';
import { completeDelivery } from '../../services/delivery-service';
import type { Locker, LockerReservation } from '../../types/locker';

// ==================== Types ====================

type Props = NativeStackScreenProps<any, 'GillerPickupFromLocker'>;

interface Step {
  number: number;
  title: string;
  description: string;
}

// ==================== Constants ====================

const SCREEN_WIDTH = Dimensions.get('window').width;

const STEPS: Step[] = [
  { number: 1, title: 'QR코드 스캔', description: '길러가 생성한 QR코드를 스캔하세요' },
  { number: 2, title: '사물함 정보', description: '사물함 위치와 요금을 확인하세요' },
  { number: 3, title: '사물함 열기', description: '버튼을 눌러 사물함을 여세요' },
  { number: 4, title: '수령 확인', description: '물건을 수령하고 사진을 찍으세요' },
  { number: 5, title: '완료', description: '배송이 완료되었습니다' },
];

// ==================== Component ====================

export default function GillerPickupFromLockerScreen({ route, navigation }: Props) {
  const { requestId } = route.params || {};

  // ==================== State ====================

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [locker, setLocker] = useState<Locker | null>(null);
  const [reservation, setReservation] = useState<LockerReservation | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | null>(null);

  // 사물함 열기 애니메이션
  const [isOpening, setIsOpening] = useState<boolean>(false);
  const lockerAnimation = useRef(new Animated.Value(0)).current;

  // ==================== Effects ====================

  useEffect(() => {
    checkCameraPermission();
  }, []);

  useEffect(() => {
    if (currentStep === 5) {
      // 완료 단계에서 2초 후 홈으로 이동
      const timer = setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentStep, navigation]);

  // ==================== Helpers ====================

  const checkCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setCameraPermission(status === 'granted' ? 'granted' : 'denied');

    if (status !== 'granted') {
      Alert.alert(
        '카메라 권한 필요',
        'QR코드를 스캔하려면 카메라 권한이 필요합니다.',
        [
          { text: '취소', onPress: () => navigation.goBack() },
          { text: '설정', onPress: () => { /* 설정으로 이동 */ } },
        ]
      );
    }
  };

  const handleQRCodeScanned = async (data: string) => {
    if (currentStep !== 1 || loading) return;

    setLoading(true);
    setError(null);

    try {
      // QR코드로 예약 조회
      const reservationData = await getReservationByQRCode(data);

      if (!reservationData) {
        setError('유효하지 않은 QR코드입니다.');
        setLoading(false);
        return;
      }

      // 만료 확인
      if (new Date() > reservationData.qrCodeExpiresAt) {
        setError('QR코드가 만료되었습니다. (10분 유효)');
        setLoading(false);
        return;
      }

      // 예약 상태 확인
      if (reservationData.status === 'cancelled' || reservationData.status === 'expired') {
        setError('이미 취소되거나 만료된 예약입니다.');
        setLoading(false);
        return;
      }

      // 사물함 정보 조회
      const lockerData = await getLocker(reservationData.lockerId);
      if (!lockerData) {
        setError('사물함 정보를 찾을 수 없습니다.');
        setLoading(false);
        return;
      }

      setQrCode(data);
      setReservation(reservationData);
      setLocker(lockerData);
      setCurrentStep(2);
    } catch (err) {
      console.error('Error scanning QR code:', err);
      setError('QR코드 스캔 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLocker = async () => {
    if (!qrCode || !locker) return;

    setLoading(true);
    setError(null);

    try {
      const result = await openLocker(locker.lockerId, qrCode);

      if (!result.success) {
        setError(result.message);
        setLoading(false);
        return;
      }

      // 열기 애니메이션 실행
      setIsOpening(true);
      Animated.timing(lockerAnimation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => {
        setIsOpening(false);
        setCurrentStep(4);
      });
    } catch (err) {
      console.error('Error opening locker:', err);
      setError('사물함 열기에 실패했습니다.');
      setLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 촬영을 위해 카메라 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handleConfirmPickup = async () => {
    if (!requestId || !reservation) return;

    setLoading(true);
    setError(null);

    try {
      // 사진 업로드 (있는 경우)
      let proofPhotoUri = photo || '';

      // Request 정보를 가져와서 verificationCode 추출
      const { getRequestById } = await import('../../services/request-service');
      const request = await getRequestById(requestId);

      if (!request) {
        setError('요청 정보를 찾을 수 없습니다.');
        setLoading(false);
        return;
      }

      // 배송 완료 처리
      const result = await completeDelivery({
        deliveryId: requestId,
        gillerId: reservation.userId, // 길러 ID
        verificationCode: request.verificationCode || '000000', // request에서 verificationCode 사용
        photoUri: proofPhotoUri,
        location: {
          latitude: locker?.lat || 37.5665,
          longitude: locker?.lng || 126.9780,
        },
      });

      if (!result.success) {
        setError(result.message);
        setLoading(false);
        return;
      }

      setCurrentStep(5);
    } catch (err) {
      console.error('Error confirming pickup:', err);
      setError('수령 확인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  // ==================== Render Steps ====================

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return renderQRScanStep();
      case 2:
        return renderLockerInfoStep();
      case 3:
        return renderOpenLockerStep();
      case 4:
        return renderConfirmStep();
      case 5:
        return renderCompleteStep();
      default:
        return null;
    }
  };

  const renderQRScanStep = () => {
    if (cameraPermission === null) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary.cyan} />
          <Text style={styles.loadingText}>카메라 권한 확인 중...</Text>
        </View>
      );
    }

    if (cameraPermission === 'denied') {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>카메라 권한이 없습니다.</Text>
          <Button
            title="권한 요청"
            onPress={checkCameraPermission}
            variant="primary"
          />
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          onBarcodeScanned={loading ? undefined : handleQRCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanText}>QR코드를 프레임 안에 맞춰주세요</Text>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.primary.cyan} />
              <Text style={styles.loadingText}>QR코드 확인 중...</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderLockerInfoStep = () => {
    if (!locker || !reservation) return null;

    return (
      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>사물함 정보</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>사물함</Text>
          <Text style={styles.infoValue}>{locker.name}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>위치</Text>
          <Text style={styles.infoValue}>{locker.address}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>크기</Text>
          <Text style={styles.infoValue}>
            {locker.size === 'small' ? '소형' : locker.size === 'medium' ? '중형' : '대형'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>보관료</Text>
          <Text style={styles.infoValue}>{locker.pricePer4Hours.toLocaleString()}원 / 4시간</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.infoNote}>
          • 최대 {locker.maxHours}시간 보관 가능
        </Text>
        <Text style={styles.infoNote}>
          • 운영 시간: {locker.openingTime} ~ {locker.closingTime}
        </Text>

        <Button
          title="다음"
          onPress={() => setCurrentStep(3)}
          variant="primary"
          style={styles.button}
        />
      </Card>
    );
  };

  const renderOpenLockerStep = () => {
    if (!locker) return null;

    const rotateInterpolate = lockerAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '15deg'],
    });

    return (
      <View style={styles.openLockerContainer}>
        <Animated.View
          style={[
            styles.lockerIcon,
            { transform: [{ rotate: rotateInterpolate }] },
          ]}
        >
          <Text style={styles.lockerIconText}>🚪</Text>
        </Animated.View>

        <Text style={styles.openLockerTitle}>
          {isOpening ? '여는 중...' : '사물함 열기'}
        </Text>

        {!isOpening && (
          <>
            <Text style={styles.openLockerDescription}>
              버튼을 누르면 사물함이 열립니다.
            </Text>

            <Button
              title="열기"
              onPress={handleOpenLocker}
              loading={loading}
              variant="primary"
              style={styles.button}
            />

            <TouchableOpacity
              onPress={() => setCurrentStep(2)}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>뒤로</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  const renderConfirmStep = () => {
    return (
      <View style={styles.confirmContainer}>
        <Text style={styles.confirmTitle}>수령 확인</Text>
        <Text style={styles.confirmDescription}>
          물건을 수령했나요?
        </Text>

        {photo ? (
          <Card style={styles.photoPreview}>
            <Text style={styles.photoNote}>✅ 사진 촬영 완료</Text>
            <TouchableOpacity
              onPress={() => setPhoto(null)}
              style={styles.retakeButton}
            >
              <Text style={styles.retakeButtonText}>다시 찍기</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <TouchableOpacity
            onPress={handleTakePhoto}
            style={styles.photoButton}
          >
            <Text style={styles.photoButtonText}>📷 수령 사진 찍기 (선택)</Text>
          </TouchableOpacity>
        )}

        <Button
          title="수령 완료"
          onPress={handleConfirmPickup}
          loading={loading}
          variant="primary"
          style={styles.button}
        />

        <TouchableOpacity
          onPress={() => setCurrentStep(3)}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>뒤로</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCompleteStep = () => {
    return (
      <View style={styles.completeContainer}>
        <Text style={styles.completeIcon}>✅</Text>
        <Text style={styles.completeTitle}>배송 완료!</Text>
        <Text style={styles.completeDescription}>
          물건을 안전하게 수령했습니다.
        </Text>
        <Text style={styles.completeNote}>홈 화면으로 이동합니다...</Text>
      </View>
    );
  };

  const renderProgressBar = () => {
    const progress = currentStep / 5;

    return (
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{currentStep} / 5</Text>
      </View>
    );
  };

  const renderHeader = () => {
    const stepInfo = STEPS[currentStep - 1];

    return (
      <View style={styles.header}>
        <Text style={styles.stepTitle}>{stepInfo.title}</Text>
        <Text style={styles.stepDescription}>{stepInfo.description}</Text>
      </View>
    );
  };

  const renderError = () => {
    if (!error) return null;

    return (
      <Card style={styles.errorCard}>
        <Text style={styles.errorTitle}>⚠️ 오류</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity
          onPress={() => {
            setError(null);
            if (currentStep === 1) {
              // QR 스캔 단계에서는 다시 시도
            } else if (currentStep === 4) {
              setCurrentStep(3);
            }
          }}
          style={styles.retryButton}
        >
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </TouchableOpacity>
      </Card>
    );
  };

  // ==================== Main Render ====================

  return (
    <View style={styles.container}>
      {renderProgressBar()}
      {renderHeader()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {renderError()}
        {renderStep()}
      </ScrollView>

      {currentStep === 1 && (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelButtonText}>취소</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ==================== Styles ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.light,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border.light,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary.cyan,
  },
  progressText: {
    ...Typography.body.small,
    marginLeft: Spacing.sm,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  header: {
    padding: Spacing.lg,
    backgroundColor: Colors.background.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  stepTitle: {
    ...Typography.heading.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  stepDescription: {
    ...Typography.body.medium,
    color: Colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },

  // Camera Step
  cameraContainer: {
    height: SCREEN_WIDTH * 1.2,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.text.primary,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: Colors.primary.cyan,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  scanText: {
    ...Typography.body.medium,
    color: Colors.background.white,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body.medium,
    color: Colors.background.white,
    marginTop: Spacing.sm,
  },

  // Info Step
  infoCard: {
    padding: Spacing.lg,
  },
  infoTitle: {
    ...Typography.heading.h4,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    ...Typography.body.medium,
    color: Colors.text.secondary,
  },
  infoValue: {
    ...Typography.body.medium,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginVertical: Spacing.md,
  },
  infoNote: {
    ...Typography.body.small,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },

  // Open Locker Step
  openLockerContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  lockerIcon: {
    marginBottom: Spacing.lg,
  },
  lockerIconText: {
    fontSize: 80,
  },
  openLockerTitle: {
    ...Typography.heading.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  openLockerDescription: {
    ...Typography.body.medium,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },

  // Confirm Step
  confirmContainer: {
    padding: Spacing.lg,
  },
  confirmTitle: {
    ...Typography.heading.h3,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  confirmDescription: {
    ...Typography.body.medium,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  photoPreview: {
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  photoNote: {
    ...Typography.body.medium,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  retakeButton: {
    padding: Spacing.sm,
  },
  retakeButtonText: {
    ...Typography.body.small,
    color: Colors.primary.cyan,
  },
  photoButton: {
    padding: Spacing.xl,
    backgroundColor: Colors.background.white,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.primary.cyan,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  photoButtonText: {
    ...Typography.body.large,
    color: Colors.primary.cyan,
  },

  // Complete Step
  completeContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  completeIcon: {
    fontSize: 80,
    marginBottom: Spacing.lg,
  },
  completeTitle: {
    ...Typography.heading.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  completeDescription: {
    ...Typography.body.large,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  completeNote: {
    ...Typography.body.small,
    color: Colors.text.tertiary,
  },

  // Common
  button: {
    marginBottom: Spacing.md,
  },
  backButton: {
    padding: Spacing.sm,
    alignItems: 'center',
  },
  backButtonText: {
    ...Typography.body.medium,
    color: Colors.text.secondary,
  },
  cancelButton: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...Typography.body.medium,
    color: Colors.primary.cyan,
  },

  // Error
  errorCard: {
    padding: Spacing.lg,
    backgroundColor: Colors.error.light,
    borderColor: Colors.error.main,
    marginBottom: Spacing.md,
  },
  errorTitle: {
    ...Typography.heading.h5,
    color: Colors.error.main,
    marginBottom: Spacing.xs,
  },
  errorMessage: {
    ...Typography.body.medium,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  retryButton: {
    padding: Spacing.sm,
    alignItems: 'flex-start',
  },
  retryButtonText: {
    ...Typography.body.small,
    color: Colors.primary.cyan,
    fontWeight: '600',
  },

  // Center Container
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    ...Typography.body.medium,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
});
