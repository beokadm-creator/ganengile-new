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
  getDeliveryReservations,
  updateReservationStatus,
} from '../../services/locker-service';
import { getQRCodeRemainingTime, verifyQRCode } from '../../services/qrcode-service';
import { takePhoto, uploadPhotoWithThumbnail } from '../../services/photo-service';
import type { LockerReservation } from '../../types/locker';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import { BorderRadius, Spacing, Typography } from '../../theme';

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
      const reservations = await getDeliveryReservations(deliveryId);
      const pickupReservation = reservations.find((item) => item.type === 'giller_pickup') ?? reservations[0] ?? null;

      if (!pickupReservation) {
        Alert.alert('사물함 예약을 찾지 못했어요', '사용자에게 다시 QR을 요청한 뒤 시도해 주세요.', [
          { text: '닫기', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      setReservation(pickupReservation);
      setRemainingMinutes(getQRCodeRemainingTime(pickupReservation.qrCode));
    } catch (error) {
      console.error('Failed to load pickup reservation:', error);
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

      await updateReservationStatus(reservation.reservationId, 'completed');

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
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>사물함 픽업 예약을 확인하고 있어요.</Text>
      </View>
    );
  }

  if (!reservation) {
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>사물함 픽업</Text>
        <Text style={styles.subtitle}>QR 확인, 물품 회수, 픽업 사진, 추적 연결 순서로 진행합니다.</Text>
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
          {working ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>픽업 사진 촬영</Text>}
        </TouchableOpacity>
      ) : null}

      {step === 'complete' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleComplete()} disabled={working}>
          {working ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>픽업 완료 처리</Text>}
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748B' },
  header: { gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#64748B' },
  card: { backgroundColor: '#FFFFFF', borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: 8 },
  sectionTitle: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: '#0F172A' },
  bodyText: { fontSize: Typography.fontSize.sm, color: '#334155' },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: '#2563EB',
  },
  primaryButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
