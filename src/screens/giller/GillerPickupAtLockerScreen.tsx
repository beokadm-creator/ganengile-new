import React, { useCallback, useEffect, useState } from 'react';
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
import { getDeliveryById } from '../../services/delivery-service';
import { requireUserId } from '../../services/firebase';
import {
  addReservationPhotos,
  completeLockerReservation,
  createLockerReservation,
  getDeliveryReservations,
  updateReservationStatus,
} from '../../services/locker-service';
import { getQRCodeRemainingTime, verifyQRCode, QRCodeService } from '../../services/qrcode-service';
import { takePhoto, uploadPhotoWithThumbnail } from '../../services/photo-service';
import type { LockerReservation } from '../../types/locker';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';

type PickupRoute = RouteProp<MainStackParamList, 'GillerPickupAtLocker'>;
type Step = 'verify' | 'pickup' | 'photo' | 'complete';

export default function GillerPickupAtLockerScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<PickupRoute>();
  const { deliveryId } = route.params;

  const [step, setStep] = useState<Step>('verify');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [reservation, setReservation] = useState<LockerReservation | null>(null);
  const [pickupPhotoUrl, setPickupPhotoUrl] = useState<string | null>(null);
  const [remainingMinutes, setRemainingMinutes] = useState(0);

  const loadReservation = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      
      const delivery = await getDeliveryById(deliveryId);
      if (!delivery || !delivery.lockerId || !delivery.requestId) {
        Alert.alert('배송 정보 오류', '사물함 정보를 찾을 수 없습니다.', [
          { text: '닫기', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      const reservations = await getDeliveryReservations(deliveryId);
      let pickupReservation = reservations.find((item) => item.type === 'giller_pickup') ?? null;

      if (!pickupReservation) {
        // Create giller_pickup reservation if it doesn't exist
        const userId = requireUserId();
        const qrCode = QRCodeService.generatePickupQRCode(deliveryId, userId);
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000);

        pickupReservation = await createLockerReservation(
          delivery.lockerId,
          delivery.requestId,
          deliveryId,
          userId,
          'giller_pickup',
          startTime,
          endTime,
          qrCode
        );
      }

      setReservation(pickupReservation);
      setRemainingMinutes(getQRCodeRemainingTime(pickupReservation.qrCode));
    } catch (error) {
      console.error('Failed to load or create pickup reservation:', error);
      Alert.alert('사물함 예약 확인 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [deliveryId, navigation]);

  useEffect(() => {
    void loadReservation();
  }, [loadReservation]);

  const handleVerifyQr = (): void => {
    if (!reservation) {
      return;
    }

    const verification = verifyQRCode(reservation.qrCode);
    if (!verification.isValid) {
      Alert.alert('QR 확인 실패', verification.error ?? '유효하지 않은 QR이에요.');
      return;
    }

    void updateReservationStatus(reservation.reservationId, 'in_use');
    setStep('pickup');
  };

  const handleTakePhoto = async (): Promise<void> => {
    try {
      setWorking(true);
      const photoUri = await takePhoto();
      if (!photoUri) {
        return;
      }

      const userId = requireUserId();
      const uploaded = await uploadPhotoWithThumbnail(photoUri, userId, 'locker-pickup');
      setPickupPhotoUrl(uploaded.url);
      setStep('complete');
    } catch (error) {
      console.error('Failed to take pickup photo:', error);
      Alert.alert('사진 촬영 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setWorking(false);
    }
  };

  const handleComplete = async (): Promise<void> => {
    if (!reservation) {
      return;
    }

    try {
      setWorking(true);

      if (pickupPhotoUrl) {
        await addReservationPhotos(reservation.reservationId, pickupPhotoUrl, undefined);
      }

      await completeLockerReservation(reservation.reservationId);

      const delivery = await getDeliveryById(deliveryId);
      const requestId = typeof delivery?.requestId === 'string' ? delivery.requestId : '';

      Alert.alert('사물함 픽업 완료', '물품 회수가 기록됐어요. 배송 추적으로 이어집니다.', [
        {
          text: '추적으로 이동',
          onPress: () => {
            if (requestId) {
              navigation.navigate('DeliveryTracking', { requestId });
              return;
            }
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error('Failed to complete locker pickup:', error);
      Alert.alert('픽업 완료 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>사물함 픽업 예약을 확인하고 있어요.</Text>
      </View>
    );
  }

  if (!reservation) {
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>사물함 픽업</Text>
        <Text style={styles.title}>QR 확인, 회수, 사진, 완료 순서로 진행합니다.</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <SummaryChip label={step === 'verify' ? 'QR 확인' : 'QR 완료'} active={step === 'verify'} />
          <SummaryChip label={step === 'pickup' ? '회수 확인' : '회수 완료'} active={step === 'pickup'} />
          <SummaryChip label={step === 'photo' ? '사진 필요' : '사진 확인'} active={step === 'photo'} />
        </View>
        <Text style={styles.summaryText}>지금 필요한 단계만 진행하면 됩니다.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>예약 정보</Text>
        <Text style={styles.bodyText}>사물함: {reservation.lockerId}</Text>
        <Text style={styles.bodyText}>상태: {reservation.status}</Text>
        <Text style={styles.bodyText}>QR 남은 시간: {remainingMinutes > 0 ? `${remainingMinutes}분` : '만료 또는 확인 불가'}</Text>
      </View>

      {step === 'verify' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyQr}>
          <Text style={styles.primaryButtonText}>예약 QR 확인</Text>
        </TouchableOpacity>
      ) : null}

      {step === 'pickup' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('photo')}>
          <Text style={styles.primaryButtonText}>물품을 회수했어요</Text>
        </TouchableOpacity>
      ) : null}

      {step === 'photo' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleTakePhoto()} disabled={working}>
          {working ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.primaryButtonText}>픽업 사진 촬영</Text>}
        </TouchableOpacity>
      ) : null}

      {step === 'complete' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleComplete()} disabled={working}>
          {working ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.primaryButtonText}>픽업 완료 처리</Text>}
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
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  loadingText: { marginTop: Spacing.md, fontSize: Typography.fontSize.base, color: Colors.textSecondary },
  hero: { backgroundColor: Colors.primaryMint, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.sm, ...Shadows.sm },
  kicker: { color: Colors.primary, fontSize: Typography.fontSize.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: Colors.textPrimary, fontSize: Typography.fontSize['2xl'], fontWeight: '800', lineHeight: 32 },
  summaryCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  summaryChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.border },
  summaryChipActive: { backgroundColor: Colors.primaryMint },
  summaryChipText: { color: Colors.textSecondary, fontSize: Typography.fontSize.xs, fontWeight: '800' },
  summaryChipTextActive: { color: Colors.primary },
  summaryText: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm, lineHeight: 20 },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize.lg, fontWeight: '800', marginBottom: 4 },
  bodyText: { color: Colors.textSecondary, fontSize: Typography.fontSize.base, fontWeight: '600' },
  primaryButton: { minHeight: 52, borderRadius: BorderRadius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
});
