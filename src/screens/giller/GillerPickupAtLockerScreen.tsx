/**
 * Giller Pickup At Locker Screen
 * 길러가 사물함에서 물품을 수거하는 화면
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { CameraView, Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { requireUserId } from '../../services/firebase';
import {
  getLockerReservation,
  updateReservationStatus,
  addReservationPhotos,
} from '../../services/locker-service';
import { verifyQRCode, getQRCodeRemainingTime } from '../../services/qrcode-service';
import { takePhoto, uploadPhotoWithThumbnail } from '../../services/photo-service';
import type { MainStackNavigationProp } from '../../types/navigation';
import type { LockerReservation } from '../../types/locker';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';

interface RouteParams {
  deliveryId: string;
}

type Step = 'scan' | 'open_locker' | 'pickup' | 'photo' | 'complete';

export default function GillerPickupAtLockerScreen() {
  const route = useRoute();
  const navigation = useNavigation<MainStackNavigationProp>();
  const { deliveryId } = (route.params as RouteParams) || {};

  const [currentStep, setCurrentStep] = useState<Step>('scan');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [reservation, setReservation] = useState<LockerReservation | null>(null);
  const [qrCode, setQrCode] = useState('');
  const [pickupPhotoUrl, setPickupPhotoUrl] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);

  const loadReservation = async () => {
    if (!deliveryId) {
      Alert.alert('오류', '배송 ID가 없습니다.');
      navigation.goBack();
      return;
    }

    try {
      setLoading(true);
      // 배송의 인수 예약 조회
      const { getDeliveryReservations } = await import('../../services/locker-service');
      const reservations = await getDeliveryReservations(deliveryId);
      const pickupReservation = reservations.find((r) => r.reservationType === 'giller_pickup');

      if (!pickupReservation) {
        Alert.alert(
          '오류',
          '사물함 예약을 찾을 수 없습니다.\n\n이용자에게 QR코드를 다시 요청하세요.'
        );
        navigation.goBack();
        return;
      }

      setReservation(pickupReservation);
      setQrCode(pickupReservation.qrCode);

      // 남은 시간 계산
      const remaining = getQRCodeRemainingTime(pickupReservation.qrCode);
      setRemainingTime(remaining);
    } catch (error) {
      console.error('Error loading reservation:', error);
      Alert.alert('오류', '예약 정보를 불러오는데 실패했습니다.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservation();
  }, [deliveryId]);

  const handleQRCodeScan = (data: string) => {
    try {
      const verification = verifyQRCode(data);

      if (!verification.isValid) {
        Alert.alert('QR코드 오류', verification.error || '유효하지 않은 QR코드입니다.');
        return;
      }

      // 예약 ID 확인
      if (reservation && verification.reservation?.reservationId !== reservation.reservationId) {
        Alert.alert(
          'QR코드 불일치',
          '이 배송의 QR코드가 아닙니다.\n\n올바른 QR코드를 스캔해주세요.'
        );
        return;
      }

      setCurrentStep('open_locker');
    } catch (error) {
      console.error('Error verifying QR code:', error);
      Alert.alert('오류', 'QR코드 검증 중 오류가 발생했습니다.');
    }
  };

  const handleOpenLocker = () => {
    Alert.alert(
      '사물함 열기',
      'QR코드를 사물함 스캐너에 대세요.\n\n열리면 다음 단계로 진행합니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '열림',
          onPress: () => {
            // 예약 상태를 'in_use'로 변경
            updateReservationStatus(reservation!.reservationId, 'in_use');
            setCurrentStep('pickup');
          },
        },
      ]
    );
  };

  const handleTakePhoto = async () => {
    try {
      const photoUri = await takePhoto();
      if (!photoUri) return;

      setLoading(true);
      const userId = await requireUserId();
      const result = await uploadPhotoWithThumbnail(photoUri, userId, 'pickup');
      setPickupPhotoUrl(result.url);
      setCurrentStep('complete');
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('오류', '사진 촬영에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    try {
      setLoading(true);

      if (reservation && pickupPhotoUrl) {
        await addReservationPhotos(reservation.reservationId, pickupPhotoUrl, undefined);
        await updateReservationStatus(reservation.reservationId, 'completed');
      }

      Alert.alert(
        '✅ 인수 완료',
        '물품을 수거했습니다.\n\n배송을 시작합니다.',
        [
          {
            text: '확인',
            onPress: () => {
              // TODO: 배송 시작 화면으로 이동
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error completing pickup:', error);
      Alert.alert('오류', '인수 완료 처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'scan':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="qr-code" size={48} color={Colors.primary} />
              <Text style={styles.stepTitle}>QR코드 스캔</Text>
              <Text style={styles.stepDescription}>
                이용자가 받은 QR코드를 스캔하세요
              </Text>
            </View>

            {reservation && (
              <View style={styles.qrInfo}>
                <Text style={styles.qrInfoText}>
                  사물함: {reservation.lockerId}
                </Text>
                {remainingTime > 0 && (
                  <Text style={styles.qrTime}>
                    남은 시간: {remainingTime}분
                  </Text>
                )}
                {remainingTime === 0 && (
                  <Text style={styles.qrExpired}>
                    ⚠️ QR코드 만료됨
                  </Text>
                )}
              </View>
            )}

            <View style={styles.scanButtonContainer}>
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => setScanning(true)}
              >
                <Ionicons name="camera" size={24} color="#fff" />
                <Text style={styles.scanButtonText}>카메라로 스캔</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.manualButton}
                onPress={() => {
                  // 수동 QR코드 입력 (테스트용)
                  if (qrCode) {
                    handleQRCodeScan(qrCode);
                  }
                }}
              >
                <Text style={styles.manualButtonText}>수동 입력 (테스트)</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'open_locker':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="lock-open" size={48} color={Colors.secondary} />
              <Text style={styles.stepTitle}>사물함 열기</Text>
              <Text style={styles.stepDescription}>
                QR코드를 사물함 스캐너에 대세요
              </Text>
            </View>

            <View style={styles.instructionContainer}>
              <Text style={styles.instructionStep}>1. 사물함 앞으로 이동</Text>
              <Text style={styles.instructionStep}>2. QR코드를 스캔너에 대세요</Text>
              <Text style={styles.instructionStep}>3. 열리면 확인을 누르세요</Text>
            </View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleOpenLocker}
            >
              <Text style={styles.actionButtonText}>열렸습니다</Text>
            </TouchableOpacity>
          </View>
        );

      case 'pickup':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="cube" size={48} color={Colors.accent} />
              <Text style={styles.stepTitle}>물품 수거</Text>
              <Text style={styles.stepDescription}>
                사물함에서 물품을 꺼내세요
              </Text>
            </View>

            <View style={styles.instructionContainer}>
              <Text style={styles.instructionStep}>1. 사물함에서 물품을 꺼내세요</Text>
              <Text style={styles.instructionStep}>2. 상태를 확인하세요</Text>
              <Text style={styles.instructionStep}>3. 파손/분실 여부를 확인하세요</Text>
            </View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleTakePhoto}
            >
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>인수 사진 촬영</Text>
            </TouchableOpacity>
          </View>
        );

      case 'photo':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="image" size={48} color={Colors.primary} />
              <Text style={styles.stepTitle}>사진 촬영</Text>
              <Text style={styles.stepDescription}>
                인수 증거 사진을 촬영하세요
              </Text>
            </View>

            {pickupPhotoUrl && (
              <View style={styles.photoPreview}>
                <Text style={styles.photoPreviewText}>사진이 촬영되었습니다</Text>
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={handleTakePhoto}
                >
                  <Text style={styles.retakeButtonText}>다시 촬영</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleComplete}
              disabled={!pickupPhotoUrl || loading}
            >
              <Text style={styles.actionButtonText}>
                {loading ? '처리 중...' : '완료'}
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 'complete':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
              <Text style={styles.stepTitle}>인수 완료</Text>
              <Text style={styles.stepDescription}>
                물품을 수거했습니다
              </Text>
            </View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.actionButtonText}>확인</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  if (loading && !reservation) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>예약 정보 로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.title}>사물함 인수</Text>
        <View style={styles.backButton} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {renderStep()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  container: {
    backgroundColor: Colors.gray100,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    width: 40,
  },
  title: {
    color: Colors.white,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  stepContainer: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  stepTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginTop: Spacing.md,
  },
  stepDescription: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  qrInfo: {
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
  },
  qrInfoText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    textAlign: 'center',
  },
  qrTime: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  qrExpired: {
    color: Colors.error,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  scanButtonContainer: {
    gap: Spacing.md,
  },
  scanButton: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  scanButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  manualButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  manualButtonText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
  },
  instructionContainer: {
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  instructionStep: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    marginBottom: Spacing.sm,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  photoPreview: {
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  photoPreviewText: {
    color: Colors.success,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  retakeButton: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  retakeButtonText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
  },
  loadingText: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.md,
  },
});
