import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { createLockerReservation, getLockersByStation } from '../../services/locker-service';
import { requireUserId } from '../../services/firebase';
import { QRCodeService } from '../../services/qrcode-service';
import type { Locker } from '../../types/locker';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';

type LockerSelectionRoute = RouteProp<MainStackParamList, 'LockerSelection'>;

export default function LockerSelectionScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<LockerSelectionRoute>();
  const { stationId, stationName, lockerId } = route.params ?? {};

  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [selectedLockerId, setSelectedLockerId] = useState<string | null>(lockerId ?? null);

  const loadLockers = useCallback(async (targetStationId: string): Promise<void> => {
    try {
      setLoading(true);
      const result = await getLockersByStation(targetStationId);
      setLockers(result);
      if (!selectedLockerId && result[0]) {
        setSelectedLockerId(result[0].lockerId);
      }
    } catch (error) {
      console.error('Failed to load station lockers:', error);
      Alert.alert('사물함 목록을 불러오지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [selectedLockerId]);

  useEffect(() => {
    if (!stationId) {
      setLoading(false);
      return;
    }
    void loadLockers(stationId);
  }, [loadLockers, stationId]);

  const selectedLocker = useMemo(
    () => lockers.find((locker) => locker.lockerId === selectedLockerId) ?? null,
    [lockers, selectedLockerId]
  );

  const handleReserve = async (): Promise<void> => {
    if (!selectedLocker) {
      Alert.alert('사물함을 선택해 주세요', '예약할 사물함을 먼저 골라야 합니다.');
      return;
    }

    try {
      setReserving(true);
      const userId = requireUserId();
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000);
      const qrCode = QRCodeService.generateVerificationQRCode(userId);

      await createLockerReservation(
        selectedLocker.lockerId,
        'manual-locker-selection',
        userId,
        'manual_selection',
        startTime,
        endTime,
        qrCode
      );

      Alert.alert('사물함 예약 완료', '사물함 임시 예약이 생성됐어요. QR 해제 화면에서 바로 테스트할 수 있습니다.', [
        {
          text: 'QR 확인',
          onPress: () => navigation.navigate('QRCodeScanner'),
        },
        {
          text: '닫기',
          style: 'cancel',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Failed to create locker reservation:', error);
      Alert.alert('사물함 예약 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setReserving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>역 사물함을 불러오고 있어요.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{stationName ?? '사물함 선택'}</Text>
        <Text style={styles.subtitle}>
          픽업과 전달에 쓸 사물함을 고릅니다. 현재는 빠른 운영 연결을 위해 기본 4시간 예약 기준으로 처리합니다.
        </Text>
      </View>

      {lockers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>이 역에는 선택 가능한 사물함이 없어요</Text>
          <Text style={styles.emptyBody}>다른 역을 선택하거나 일반 배송 흐름으로 진행해 주세요.</Text>
        </View>
      ) : (
        lockers.map((locker) => {
          const active = locker.lockerId === selectedLockerId;
          return (
            <TouchableOpacity
              key={locker.lockerId}
              style={[styles.card, active ? styles.cardActive : undefined]}
              onPress={() => setSelectedLockerId(locker.lockerId)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{locker.location.section || locker.lockerId}</Text>
                <Text style={styles.badge}>{locker.status}</Text>
              </View>
              <Text style={styles.cardBody}>
                {locker.location.floor}층 · {locker.location.line || '노선 정보 없음'}
              </Text>
              <Text style={styles.cardMeta}>
                기본 {locker.pricing.base.toLocaleString()}원 / {locker.pricing.baseDuration}분
              </Text>
            </TouchableOpacity>
          );
        })
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={() => void handleReserve()} disabled={reserving}>
        {reserving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>선택한 사물함으로 예약</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  cardBody: {
    fontSize: 14,
    color: '#334155',
  },
  cardMeta: {
    fontSize: 13,
    color: '#64748B',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: '#2563EB',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
