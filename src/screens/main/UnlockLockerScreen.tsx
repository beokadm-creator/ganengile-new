/**
 * Unlock Locker Screen
 * 이용자가 사물함에서 물품을 수령하는 화면
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

type Step = 'scan' | 'open' | 'collect' | 'photo' | 'complete';

export default function UnlockLockerScreen() {
  const route = useRoute();
  const navigation = useNavigation<MainStackNavigationProp>();
  const { deliveryId } = (route.params as RouteParams) || {};

  const [currentStep, setCurrentStep] = useState<Step>('scan');
  const [loading, setLoading] = useState(false);
  const [reservation, setReservation] = useState<LockerReservation | null>(null);
  const [collectPhotoUrl, setCollectPhotoUrl] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);

  const loadReservation = async () => {
    if (!deliveryId) {
      Alert.alert('오류', '배송 ID가 없습니다.');
      navigation.goBack();
      return;
    }

    try {
      setLoading(true);
      // 배송의 수령 예약 조회
      const { getDeliveryReservations } = await import('../../services/locker-service');
      const reservations = await getDeliveryReservations(deliveryId);
      const collectReservation = reservations.find((r) => r.reservationType === 'user_pickup');

      if (!collectReservation) {
        Alert.alert(
          '오류',
          '사물함 예약을 찾을 수 없습니다.\n\n길러에게 QR코드를 요청하세요.'
        );
        navigation.goBack();
        return;
      }

      setReservation(collectReservation);

      // 남은 시간 계산
      const remaining = getQRCodeRemainingTime(collectReservation.qrCode);
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

      setCurrentStep('open');
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
            setCurrentStep('collect');
          },
        },
      ]
    );
  };

  const handleCollect = () => {
    Alert.alert(
      '물품 수령',
      '사물함에서 물품을 꺼내세요.\n\n상태를 확인하고 문제가 없으면 다음으로 진행하세요.',
      [
        { text: '문제 있음', style: 'destructive' },
        {
          text: '수령 완료',
          onPress: () => setCurrentStep('photo'),
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
      const result = await uploadPhotoWithThumbnail(photoUri, userId, 'collect');
      setCollectPhotoUrl(result.url);
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

      if (reservation && collectPhotoUrl) {
        await addReservationPhotos(reservation.reservationId, undefined, collectPhotoUrl);
        await updateReservationStatus(reservation.reservationId, 'completed');
      }

      Alert.alert(
        '✅ 수령 완료',
        '사물함에서 물품을 수령했습니다.\n\n배송이 완료되었습니다.',
        [
          {
            text: '확인',
            onPress: () => {
              navigation.navigate('Rating' as never, {
                deliveryId: deliveryId!,
                gillerId: reservation!.userId,
                gllerId: reservation!.userId,
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error completing collection:', error);
      Alert.alert('오류', '수령 완료 처리에 실패했습니다.');
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
                길러가 받은 QR코드를 스캔하세요
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
                    ⚠️ QR코드 만료됨 (길러에게 재요청)
                  </Text>
                )}
              </View>
            )}

            <View style={styles.scanButtonContainer}>
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => {
                  // 수동 QR코드 입력 (테스트용)
                  if (reservation) {
                    handleQRCodeScan(reservation.qrCode);
                  }
                }}
              >
                <Ionicons name="camera" size={24} color="#fff" />
                <Text style={styles.scanButtonText}>카메라로 스캔</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.helpButton}
              onPress={() => {
                Alert.alert(
                  'QR코드가 없나요?',
                  '길러에게 연락하여 QR코드를 다시 요청하세요.\n\n길러가 사물함에 보관한 후 QR코드를 생성합니다.',
                  [{ text: '확인' }]
                );
              }}
            >
              <Text style={styles.helpButtonText}>QR코드가 없나요?</Text>
            </TouchableOpacity>
          </View>
        );

      case 'open':
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

      case 'collect':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="cube" size={48} color={Colors.success} />
              <Text style={styles.stepTitle}>물품 수령</Text>
              <Text style={styles.stepDescription}>
                사물함에서 물품을 꺼내세요
              </Text>
            </View>

            <View style={styles.instructionContainer}>
              <Text style={styles.instructionStep}>1. 사물함에서 물품을 꺼내세요</Text>
              <Text style={styles.instructionStep}>2. 내용물을 확인하세요</Text>
              <Text style={styles.instructionStep}>3. 파손/누락 여부를 확인하세요</Text>
            </View>

            <View style={styles.warningBox}>
              <Ionicons name="warning" size={20} color={Colors.accent} />
              <Text style={styles.warningText}>
                물품에 파손이나 누락이 있는 경우 '문제 있음'을 눌러주세요
              </Text>
            </View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleCollect}
            >
              <Text style={styles.actionButtonText}>수령 완료</Text>
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
                수령 증거 사진을 촬영하세요 (선택)
              </Text>
            </View>

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                사진 촬영은 선택사항입니다. 분쟁 발생 시 증거로 사용됩니다.
              </Text>
            </View>

            {collectPhotoUrl && (
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
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={handleTakePhoto}
            >
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>사진 촬영</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleComplete}
            >
              <Text style={styles.skipButtonText}>사진 없이 완료</Text>
            </TouchableOpacity>
          </View>
        );

      case 'complete':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
              <Text style={styles.stepTitle}>수령 완료</Text>
              <Text style={styles.stepDescription}>
                배송이 완료되었습니다
              </Text>
            </View>

            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
              <Text style={styles.successText}>
                물품을 안전하게 수령했습니다
              </Text>
            </View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleComplete}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>
                {loading ? '처리 중...' : '평가하러 가기'}
              </Text>
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
        <Text style={styles.title}>사물함 수령</Text>
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
    backgroundColor: Colors.primary,
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
  helpButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: Spacing.md,
  },
  helpButtonText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    textDecorationLine: 'underline',
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
  warningBox: {
    alignItems: 'center',
    backgroundColor: Colors.accentLight,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
  },
  warningText: {
    color: Colors.accent,
    fontSize: Typography.fontSize.sm,
    flex: 1,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  secondaryButton: {
    backgroundColor: Colors.secondary,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  noteBox: {
    backgroundColor: Colors.infoLight,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
  },
  noteText: {
    color: Colors.info,
    fontSize: Typography.fontSize.sm,
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
  skipButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    padding: Spacing.md,
  },
  skipButtonText: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.sm,
  },
  successBox: {
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
  },
  successText: {
    color: Colors.success,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    textAlign: 'center',
  },
  loadingText: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.md,
  },
});
