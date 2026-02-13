/**
 * Giller Dropoff At Locker Screen
 * 길러가 사물함에 물품을 보관하는 화면
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
  getLocker,
  createLockerReservation,
  updateReservationStatus,
  addReservationPhotos,
} from '../../services/locker-service';
import { generateQRCode } from '../../services/qrcode-service';
import { takePhoto, uploadPhotoWithThumbnail } from '../../services/photo-service';
import type { MainStackNavigationProp } from '../../types/navigation';
import type { Locker, LockerSummary } from '../../types/locker';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';
import LockerLocator from '../../components/delivery/LockerLocator';

interface RouteParams {
  deliveryId: string;
}

type Step = 'select_locker' | 'confirm' | 'deposit' | 'photo' | 'complete';

export default function GillerDropoffAtLockerScreen() {
  const route = useRoute();
  const navigation = useNavigation<MainStackNavigationProp>();
  const { deliveryId } = (route.params as RouteParams) || {};

  const [currentStep, setCurrentStep] = useState<Step>('select_locker');
  const [loading, setLoading] = useState(false);
  const [selectedLocker, setSelectedLocker] = useState<LockerSummary | null>(null);
  const [dropoffPhotoUrl, setDropoffPhotoUrl] = useState<string | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);

  const handleLockerSelect = async (locker: LockerSummary) => {
    try {
      setLoading(true);
      const lockerDetail = await getLocker(locker.lockerId);
      
      if (!lockerDetail) {
        Alert.alert('오류', '사물함 정보를 찾을 수 없습니다.');
        return;
      }

      if (lockerDetail.availableCount <= 0) {
        Alert.alert('사용 불가', '이 사물함은 사용 가능한 공간이 없습니다.');
        return;
      }

      setSelectedLocker(locker);
      setCurrentStep('confirm');
    } catch (error) {
      console.error('Error loading locker:', error);
      Alert.alert('오류', '사물함 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedLocker || !deliveryId) return;

    try {
      setLoading(true);
      const userId = await requireUserId();

      // QR코드 생성
      const qrCode = generateQRCode(
        `temp-${deliveryId}`, // 임시 예약 ID
        selectedLocker.lockerId,
        userId,
        'giller_dropoff'
      );

      // 예약 생성
      const now = new Date();
      const startTime = new Date(now.getTime() + 5 * 60 * 1000); // 5분 후
      const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000); // 4시간 후

      const reservation = await createLockerReservation(
        selectedLocker.lockerId,
        deliveryId,
        userId,
        'giller_dropoff',
        startTime,
        endTime,
        qrCode
      );

      // 예약 ID 저장
      setReservationId(reservation.reservationId);

      Alert.alert(
        '✅ 사물함 예약 완료',
        `${selectedLocker.name}\n\nQR코드가 생성되었습니다.\n\n이용자에게 QR코드를 전송하세요.`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '확인',
            onPress: () => setCurrentStep('deposit'),
          },
        ]
      );
    } catch (error) {
      console.error('Error creating reservation:', error);
      Alert.alert('오류', '사물함 예약에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = () => {
    Alert.alert(
      '사물함 보관',
      '1. 물품을 사물함에 넣으세요\n2. 문을 잠그세요\n3. 확인을 누르세요',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '보관 완료',
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
      const result = await uploadPhotoWithThumbnail(photoUri, userId, 'dropoff');
      setDropoffPhotoUrl(result.url);
      setCurrentStep('complete');
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('오류', '사진 촬영에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!reservationId || !deliveryId || !selectedLocker) {
      Alert.alert('오류', '필요한 정보가 누락되었습니다. 다시 시도해주세요.');
      return;
    }

    try {
      setLoading(true);
      const userId = await requireUserId();

      // 1. 예약에 사진 저장
      if (dropoffPhotoUrl) {
        await addReservationPhotos(reservationId, undefined, dropoffPhotoUrl);
      }

      // 2. 예약 상태 업데이트 (completed)
      await updateReservationStatus(reservationId, 'completed');

      // 3. 배송 상태 업데이트 (at_locker)
      const { markAsDroppedAtLocker } = require('../../services/delivery-service');
      const result = await markAsDroppedAtLocker(
        deliveryId,
        userId,
        selectedLocker.lockerId,
        reservationId
      );

      if (!result.success) {
        throw new Error(result.message);
      }

      Alert.alert(
        '✅ 인계 완료',
        '사물함에 물품을 보관했습니다.\n\n이용자에게 알림을 보내세요.',
        [
          {
            text: '확인',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error completing dropoff:', error);
      Alert.alert(
        '오류',
        error.message || '인계 완료 처리에 실패했습니다.'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'select_locker':
        return (
          <LockerLocator
            onLockerSelect={handleLockerSelect}
            onClose={() => navigation.goBack()}
          />
        );

      case 'confirm':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
              <Text style={styles.stepTitle}>사물함 확인</Text>
              <Text style={styles.stepDescription}>
                선택한 사물함을 확인하세요
              </Text>
            </View>

            {selectedLocker && (
              <View style={styles.lockerInfo}>
                <View style={styles.lockerInfoRow}>
                  <Text style={styles.lockerInfoLabel}>사물함:</Text>
                  <Text style={styles.lockerInfoValue}>{selectedLocker.name}</Text>
                </View>
                <View style={styles.lockerInfoRow}>
                  <Text style={styles.lockerInfoLabel}>유형:</Text>
                  <Text style={styles.lockerInfoValue}>
                    {selectedLocker.type === 'public' ? '공공' : '민간'}
                  </Text>
                </View>
                <View style={styles.lockerInfoRow}>
                  <Text style={styles.lockerInfoLabel}>요금:</Text>
                  <Text style={styles.lockerInfoValue}>
                    {selectedLocker.pricePer4Hours.toLocaleString()}원/4시간
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleConfirm}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>
                {loading ? '처리 중...' : 'QR코드 생성'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setCurrentStep('select_locker')}
            >
              <Text style={styles.backButtonText}>다른 사물함 선택</Text>
            </TouchableOpacity>
          </View>
        );

      case 'deposit':
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="cube" size={48} color={Colors.accent} />
              <Text style={styles.stepTitle}>사물함 보관</Text>
              <Text style={styles.stepDescription}>
                물품을 사물함에 넣으세요
              </Text>
            </View>

            <View style={styles.instructionContainer}>
              <Text style={styles.instructionStep}>1. 사물함을 여세요</Text>
              <Text style={styles.instructionStep}>2. 물품을 넣으세요</Text>
              <Text style={styles.instructionStep}>3. 문을 잠그세요</Text>
              <Text style={styles.instructionStep}>4. 보관 완료를 누르세요</Text>
            </View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleDeposit}
            >
              <Text style={styles.actionButtonText}>보관 완료</Text>
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
                인계 증거 사진을 촬영하세요
              </Text>
            </View>

            {dropoffPhotoUrl && (
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
              disabled={!dropoffPhotoUrl || loading}
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
              <Text style={styles.stepTitle}>인계 완료</Text>
              <Text style={styles.stepDescription}>
                사물함에 보관했습니다
              </Text>
            </View>

            {dropoffPhotoUrl && (
              <View style={styles.summaryContainer}>
                <Text style={styles.summaryText}>✅ 사진 촬영 완료</Text>
                <Text style={styles.summaryText}>✅ 사물함 보관 완료</Text>
                <Text style={styles.summaryText}>✅ 예약 완료</Text>
              </View>
            )}

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

  if (loading && currentStep === 'select_locker') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.secondary} />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.title}>사물함 인계</Text>
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
  lockerInfo: {
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  lockerInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  lockerInfoLabel: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.sm,
  },
  lockerInfoValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
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
  backButtonSecondary: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    padding: Spacing.md,
  },
  backButtonText: {
    color: Colors.primary,
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
  loadingText: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.md,
  },
  summaryContainer: {
    backgroundColor: Colors.successLight,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  summaryText: {
    color: Colors.success,
    fontSize: Typography.fontSize.base,
    marginBottom: Spacing.sm,
  },
});
