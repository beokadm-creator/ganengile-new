import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { requireUserId } from '../../services/firebase';
import { getDeliveryById } from '../../services/delivery-service';
import {
  addReservationPhotos,
  createLockerReservation,
  getLocker,
  updateReservationStatus,
} from '../../services/locker-service';
import { markAsDroppedAtLocker } from '../../services/delivery-service';
import { takePhoto, uploadPhotoWithThumbnail } from '../../services/photo-service';
import QRCodeService from '../../services/qrcode-service';
import type { LockerSummary } from '../../types/locker';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import { BorderRadius, Colors, Shadows, Spacing } from '../../theme';
import { Typography } from '../../theme/typography';
import LockerLocator from '../../components/delivery/LockerLocator';

type DropoffRoute = RouteProp<MainStackParamList, 'GillerDropoffAtLocker'>;
type Step = 'loading' | 'select' | 'reserve' | 'photo' | 'complete';

export default function GillerDropoffAtLockerScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<DropoffRoute>();
  const { deliveryId } = route.params;

  const [step, setStep] = useState<Step>('loading');
  const [working, setWorking] = useState(false);
  const [selectedLocker, setSelectedLocker] = useState<LockerSummary | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [dropoffPhotoUrl, setDropoffPhotoUrl] = useState<string | null>(null);

  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const delivery = await getDeliveryById(deliveryId);
        if (delivery) {
          setRequestId(delivery.requestId || null);
          if (delivery.lockerId) {
            // If it's a lazy allocated area, don't try to fetch a specific locker, just go to select mode
            if (delivery.lockerId.startsWith('AREA::')) {
              setStep('select');
              return;
            }

            const lockerDetail = await getLocker(delivery.lockerId);
            if (lockerDetail) {
              setSelectedLocker({
                lockerId: lockerDetail.lockerId,
                stationId: lockerDetail.location.stationId,
                stationName: lockerDetail.location.stationName,
                status: lockerDetail.status,
                size: lockerDetail.size,
                pricePerHour: lockerDetail.pricing.base,
              });
              setStep('reserve');
              return;
            }
          }
        }
      } catch (error) {
        console.error('Failed to init GillerDropoffAtLockerScreen:', error);
      }
      setStep('select');
    }
    init();
  }, [deliveryId]);

  const handleLockerSelect = async (locker: LockerSummary): Promise<void> => {
    try {
      setWorking(true);
      const lockerDetail = await getLocker(locker.lockerId);
      if (!lockerDetail || lockerDetail.availability.available <= 0) {
        Alert.alert('사물함 선택 불가', '지금은 이 사물함을 사용할 수 없어요.');
        return;
      }

      setSelectedLocker(locker);
      setStep('reserve');
    } catch (error) {
      console.error('Failed to select locker:', error);
      Alert.alert('사물함 확인 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setWorking(false);
    }
  };

  const handleReserve = async (): Promise<void> => {
    if (!selectedLocker || !requestId) {
      Alert.alert('정보 부족', '배송 요청 정보를 찾을 수 없거나 보관함을 선택하지 않았습니다.');
      return;
    }

    try {
      setWorking(true);
      const userId = requireUserId();
      const qrCode = QRCodeService.generatePickupQRCode(deliveryId, userId);
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000);

      const reservation = await createLockerReservation(
        selectedLocker.lockerId,
        requestId,
        deliveryId,
        userId,
        'giller_dropoff',
        startTime,
        endTime,
        qrCode
      );

      setReservationId(reservation.reservationId);
      setStep('photo');
    } catch (error) {
      console.error('Failed to reserve locker:', error);
      Alert.alert('사물함 예약 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setWorking(false);
    }
  };

  const handleTakePhoto = async (): Promise<void> => {
    try {
      setWorking(true);
      const photoUri = await takePhoto();
      if (!photoUri) {
        return;
      }

      const userId = requireUserId();
      const uploaded = await uploadPhotoWithThumbnail(photoUri, userId, 'locker-dropoff');
      setDropoffPhotoUrl(uploaded.url);
      setStep('complete');
    } catch (error) {
      console.error('Failed to take dropoff photo:', error);
      Alert.alert('보관 사진 촬영 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setWorking(false);
    }
  };

  const handleComplete = async (): Promise<void> => {
    if (!selectedLocker || !reservationId) {
      return;
    }

    try {
      setWorking(true);
      const userId = requireUserId();

      if (dropoffPhotoUrl) {
        await addReservationPhotos(reservationId, undefined, dropoffPhotoUrl);
      }

      await updateReservationStatus(reservationId, 'completed');
      const result = await markAsDroppedAtLocker(deliveryId, userId, selectedLocker.lockerId, reservationId);

      if (!result.success) {
        Alert.alert('보관 완료 실패', result.message);
        return;
      }

      Alert.alert('사물함 보관 완료', '보관이 기록됐고 다음 인계 단계로 이어집니다.', [
        { text: '홈으로 이동', onPress: () => navigation.navigate('Tabs', { screen: 'Home' }) },
      ]);
    } catch (error) {
      console.error('Failed to complete locker dropoff:', error);
      Alert.alert('보관 완료 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setWorking(false);
    }
  };

  if (step === 'loading') {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 16, color: Colors.textSecondary }}>사물함 정보를 불러오는 중...</Text>
      </View>
    );
  }

  if (step === 'select') {
    return (
      <LockerLocator
        mode="specific"
        onLockerSelect={(locker) => {
          void handleLockerSelect(locker);
        }}
        onClose={() => navigation.goBack()}
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>사물함 보관</Text>
        <Text style={styles.title}>선택, 예약, 사진, 완료 순서로 진행합니다.</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <SummaryChip label={step === 'reserve' ? '예약 필요' : '예약 확인'} active={step === 'reserve'} />
          <SummaryChip label={step === 'photo' ? '사진 필요' : '사진 확인'} active={step === 'photo'} />
          <SummaryChip label={step === 'complete' ? '완료 처리' : '완료 대기'} active={step === 'complete'} />
        </View>
        <Text style={styles.summaryText}>지금 필요한 단계만 진행하면 됩니다.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>선택 정보</Text>
        <Text style={styles.bodyText}>사물함: {selectedLocker?.stationName ?? '-'}</Text>
        <Text style={styles.bodyText}>상태: {selectedLocker?.status ?? '-'}</Text>
      </View>

      {step === 'reserve' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={() => { void handleReserve(); }} disabled={working}>
          {working ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.primaryButtonText}>사물함 예약 생성</Text>}
        </TouchableOpacity>
      ) : null}

      {step === 'photo' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleTakePhoto()} disabled={working}>
          {working ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.primaryButtonText}>보관 사진 촬영</Text>}
        </TouchableOpacity>
      ) : null}

      {step === 'complete' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleComplete()} disabled={working}>
          {working ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.primaryButtonText}>보관 완료 처리</Text>}
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

function SummaryChip({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.summaryChip, active ? styles.summaryChipActive : undefined]}>
      <Text style={[styles.summaryChipText, active ? styles.summaryChipTextActive : undefined]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.lg },
  hero: { backgroundColor: Colors.primaryMint, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.sm, ...Shadows.sm },
  kicker: { color: Colors.primary, fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.extrabold, textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: Colors.textPrimary, fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.extrabold, lineHeight: 32 },
  summaryCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  summaryChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.border },
  summaryChipActive: { backgroundColor: Colors.primaryMint },
  summaryChipText: { color: Colors.textSecondary, fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.extrabold },
  summaryChipTextActive: { color: Colors.primary },
  summaryText: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm, lineHeight: 20 },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.extrabold, marginBottom: 4 },
  bodyText: { color: Colors.textSecondary, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold },
  primaryButton: { minHeight: 52, borderRadius: BorderRadius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  primaryButtonText: { color: Colors.white, fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.extrabold },
});
