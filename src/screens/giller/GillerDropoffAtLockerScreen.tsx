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
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
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
      <View style={styles.hero}>
        <Text style={styles.kicker}>사물함 보관</Text>
        <Text style={styles.title}>선택한 사물함 예약, 보관 사진, 배송 상태 업데이트 순서로 진행합니다.</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.lg },
  hero: { backgroundColor: Colors.primaryMint, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.sm, ...Shadows.sm },
  kicker: { color: Colors.primary, fontSize: Typography.fontSize.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: Colors.textPrimary, fontSize: Typography.fontSize['2xl'], fontWeight: '800', lineHeight: 32 },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize.lg, fontWeight: '800', marginBottom: 4 },
  bodyText: { color: Colors.textSecondary, fontSize: Typography.fontSize.base, fontWeight: '600' },
  primaryButton: { minHeight: 52, borderRadius: BorderRadius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
});
