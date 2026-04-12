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
import { getRequestById } from '../../services/request-service';
import {
  addReservationPhotos,
  createLockerReservation,
  getLocker,
  updateReservationStatus,
} from '../../services/locker-service';
import { takePhoto, uploadPhotoWithThumbnail } from '../../services/photo-service';
import QRCodeService from '../../services/qrcode-service';
import type { LockerSummary } from '../../types/locker';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';

type DropoffRoute = RouteProp<MainStackParamList, 'RequesterDropoffLocker'>;
type Step = 'loading' | 'reserve' | 'photo' | 'complete';

export default function RequesterDropoffLockerScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<DropoffRoute>();
  const { requestId } = route.params;

  const [step, setStep] = useState<Step>('loading');
  const [working, setWorking] = useState(false);
  const [selectedLocker, setSelectedLocker] = useState<LockerSummary | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [dropoffPhotoUrl, setDropoffPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const request = await getRequestById(requestId);
        if (request && request.lockerId) {
          const lockerDetail = await getLocker(request.lockerId);
          if (lockerDetail) {
            setSelectedLocker(lockerDetail as any);
            setStep('reserve');
            return;
          }
        }
        Alert.alert('사물함 정보 오류', '요청에 연결된 사물함을 찾을 수 없습니다.', [
          { text: '뒤로가기', onPress: () => navigation.goBack() },
        ]);
      } catch (error) {
        console.error('Failed to init RequesterDropoffLockerScreen:', error);
        Alert.alert('오류 발생', '사물함 정보를 불러오는 중 오류가 발생했습니다.', [
          { text: '뒤로가기', onPress: () => navigation.goBack() },
        ]);
      }
    }
    init();
  }, [requestId, navigation]);

  const handleReserve = async (): Promise<void> => {
    if (!selectedLocker || !requestId) {
      Alert.alert('정보 부족', '요청 정보를 찾을 수 없거나 보관함을 선택하지 않았습니다.');
      return;
    }

    try {
      setWorking(true);
      const userId = requireUserId();
      const qrCode = QRCodeService.generatePickupQRCode(requestId, userId);
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000);

      const reservation = await createLockerReservation(
        selectedLocker.lockerId,
        requestId,
        '', // deliveryId is not needed or empty at this stage
        userId,
        'requester_dropoff',
        startTime,
        endTime,
        qrCode
      );

      setReservationId(reservation.reservationId);
      // Automatically open the locker for the requester since they need to put it in
      await updateReservationStatus(reservation.reservationId, 'in_use');
      
      Alert.alert('사물함 문이 열렸습니다', '물품을 넣고 닫은 후, 사진을 촬영해 주세요.');
      setStep('photo');
    } catch (error) {
      console.error('Failed to reserve locker:', error);
      Alert.alert('사물함 열기 실패', '잠시 후 다시 시도해 주세요.');
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

      if (dropoffPhotoUrl) {
        await addReservationPhotos(reservationId, undefined, dropoffPhotoUrl);
      }

      // Mark the reservation as completed, but KEEP the locker OCCUPIED
      // completeLockerReservation makes it AVAILABLE, so we shouldn't use it here!
      // We only update the reservation status.
      await updateReservationStatus(reservationId, 'completed');

      Alert.alert('보관 완료', '물품이 사물함에 안전하게 보관되었습니다. 길러가 수거할 예정입니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Failed to complete requester dropoff:', error);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>사물함에 물품 보관</Text>
        <Text style={styles.title}>보관함 열기, 물품 넣기, 사진 촬영 후 완료합니다.</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <SummaryChip label={step === 'reserve' ? '열기 필요' : '문 열림'} active={step === 'reserve'} />
          <SummaryChip label={step === 'photo' ? '사진 필요' : '사진 확인'} active={step === 'photo'} />
          <SummaryChip label={step === 'complete' ? '완료 처리' : '완료 대기'} active={step === 'complete'} />
        </View>
        <Text style={styles.summaryText}>순서대로 진행해 주세요.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>보관할 사물함</Text>
        <Text style={styles.bodyText}>역 이름: {selectedLocker?.stationName ?? '-'}</Text>
        <Text style={styles.bodyText}>사물함 번호: {selectedLocker?.lockerId ?? '-'}</Text>
      </View>

      {step === 'reserve' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleReserve()} disabled={working}>
          {working ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.primaryButtonText}>사물함 열기</Text>}
        </TouchableOpacity>
      ) : null}

      {step === 'photo' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleTakePhoto()} disabled={working}>
          {working ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.primaryButtonText}>물품을 넣고 사진 촬영</Text>}
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