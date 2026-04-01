import React, { useState } from 'react';
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
import { BorderRadius, Spacing, Typography } from '../../theme';
import LockerLocator from '../../components/delivery/LockerLocator';

type DropoffRoute = RouteProp<MainStackParamList, 'GillerDropoffAtLocker'>;
type Step = 'select' | 'reserve' | 'photo' | 'complete';

export default function GillerDropoffAtLockerScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<DropoffRoute>();
  const { deliveryId } = route.params;

  const [step, setStep] = useState<Step>('select');
  const [working, setWorking] = useState(false);
  const [selectedLocker, setSelectedLocker] = useState<LockerSummary | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [dropoffPhotoUrl, setDropoffPhotoUrl] = useState<string | null>(null);

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
    if (!selectedLocker) {
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

  if (step === 'select') {
    return (
      <LockerLocator
        onLockerSelect={(locker) => {
          void handleLockerSelect(locker);
        }}
        onClose={() => navigation.goBack()}
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>사물함 보관</Text>
        <Text style={styles.subtitle}>선택한 사물함 예약, 보관 사진, 배송 상태 업데이트 순서로 진행합니다.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>선택 정보</Text>
        <Text style={styles.bodyText}>사물함: {selectedLocker?.stationName ?? '-'}</Text>
        <Text style={styles.bodyText}>상태: {selectedLocker?.status ?? '-'}</Text>
      </View>

      {step === 'reserve' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={() => { void handleReserve(); }} disabled={working}>
          {working ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>사물함 예약 생성</Text>}
        </TouchableOpacity>
      ) : null}

      {step === 'photo' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleTakePhoto()} disabled={working}>
          {working ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>보관 사진 촬영</Text>}
        </TouchableOpacity>
      ) : null}

      {step === 'complete' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleComplete()} disabled={working}>
          {working ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>보관 완료 처리</Text>}
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 16 },
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
