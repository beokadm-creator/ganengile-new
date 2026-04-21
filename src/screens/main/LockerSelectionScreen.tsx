import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import { locationService } from '../../services/location-service';
import type { Locker } from '../../types/locker';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import { Colors, Spacing, BorderRadius } from '../../theme';
import { Typography } from '../../theme/typography';

type LockerSelectionRoute = RouteProp<MainStackParamList, 'LockerSelection'>;

function formatDistance(meters: number | null): string {
  if (meters == null) return '';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function computeLockerDistance(
  locker: Locker,
  lat: number | undefined,
  lng: number | undefined,
): number | null {
  if (lat == null || lng == null) return null;
  const lockerLat = locker.location.latitude;
  const lockerLng = locker.location.longitude;
  if (lockerLat == null || lockerLng == null) return null;
  return locationService.calculateDistance(lat, lng, lockerLat, lockerLng);
}

export default function LockerSelectionScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<LockerSelectionRoute>();
  const { stationId, stationName, lockerId, currentLatitude, currentLongitude } = route.params ?? {};

  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [selectedLockerId, setSelectedLockerId] = useState<string | null>(lockerId ?? null);

  const hasLocation = currentLatitude != null && currentLongitude != null;

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

  const sortedLockers = useMemo(() => {
    if (!hasLocation) return lockers;
    return [...lockers].sort((a, b) => {
      const distA = computeLockerDistance(a, currentLatitude, currentLongitude);
      const distB = computeLockerDistance(b, currentLatitude, currentLongitude);
      return (distA ?? Number.MAX_SAFE_INTEGER) - (distB ?? Number.MAX_SAFE_INTEGER);
    });
  }, [lockers, hasLocation, currentLatitude, currentLongitude]);

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
        'manual-locker-selection',
        userId,
        'manual_selection',
        startTime,
        endTime,
        qrCode
      );

      if (Platform.OS === 'web') {
        window.alert('사물함 임시 예약이 생성됐어요. QR 해제 화면에서 바로 테스트할 수 있습니다.');
        navigation.navigate('QRCodeScanner');
      } else {
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
      }
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
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>역 사물함을 불러오고 있어요.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{stationName ?? '사물함 선택'}</Text>
        <Text style={styles.subtitle}>
          {hasLocation
            ? '현재 위치에서 가까운 사물함 순으로 정렬되어 있어요.'
            : '사물함 정보를 확인하거나 예약을 진행해 보세요.'}
        </Text>
      </View>

      {sortedLockers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>이 역에는 선택 가능한 사물함이 없어요</Text>
          <Text style={styles.emptyBody}>다른 역을 선택하거나 일반 배송 흐름으로 진행해 주세요.</Text>
        </View>
      ) : (
        sortedLockers.map((locker) => {
          const active = locker.lockerId === selectedLockerId;
          const distance = computeLockerDistance(locker, currentLatitude, currentLongitude);
          const distanceLabel = formatDistance(distance);
          return (
            <TouchableOpacity
              key={locker.lockerId}
              style={[styles.card, active ? styles.cardActive : undefined]}
              onPress={() => setSelectedLockerId(locker.lockerId)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{locker.location.section || locker.lockerId}</Text>
                <View style={styles.badgeRow}>
                  {distanceLabel ? (
                    <Text style={styles.distanceBadge}>{distanceLabel}</Text>
                  ) : null}
                  <Text style={styles.badge}>{locker.status}</Text>
                </View>
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
          <ActivityIndicator size="small" color={Colors.surface} />
        ) : (
          <Text style={styles.primaryButtonText}>선택한 사물함 예약하기</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
  },
  header: {
    gap: Spacing.sm,
  },
  title: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  emptyBody: {
    fontSize: Typography.fontSize.base,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMint,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  distanceBadge: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    backgroundColor: Colors.primaryMint,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    overflow: 'hidden',
  },
  cardTitle: {
    flex: 1,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  badge: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    backgroundColor: Colors.primaryMint,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    overflow: 'hidden',
  },
  cardBody: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  cardMeta: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
  },
  primaryButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.surface,
  },
});
