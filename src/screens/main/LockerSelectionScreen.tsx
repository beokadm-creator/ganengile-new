/**
 * Locker Selection Screen
 * 사물함 선택 화면 (P2-1)
 *
 * 기능:
 * - 역별 사물함 목록
 * - 사물함 상세 정보 (가격, 시간, 위치)
 * - 예약 가능 시간대 선택
 * - 예약 버튼
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getFirestore, doc, collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { requireUserId } from '../../services/firebase';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
  route?: {
    params?: {
      stationId?: string;
      stationName?: string;
    };
  };
}

interface Locker {
  id: string;
  lockerId: string;
  lockerNumber: string;
  type: 'public' | 'private';
  provider: string;
  location: {
    floor: string;
    section: string;
  };
  pricing: {
    pricePerHour: number;
    maxHours: number;
  };
  availability: {
    status: 'available' | 'occupied' | 'maintenance';
    availableSlots: TimeSlot[];
  };
}

interface TimeSlot {
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  date: string; // YYYY-MM-DD
}

export default function LockerSelectionScreen({ navigation, route }: Props) {
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [selectedStation, setSelectedStation] = useState<{ id: string; name: string } | null>(null);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);

  useEffect(() => {
    const stationId = route?.params?.stationId;
    const stationName = route?.params?.stationName;

    if (stationId && stationName) {
      setSelectedStation({ id: stationId, name: stationName });
      loadLockers(stationId);
    } else {
      setLoading(false);
    }
  }, [route]);

  const loadLockers = async (stationId: string) => {
    try {
      setLoading(true);

      const db = getFirestore();
      const lockersRef = collection(db, 'lockers');
      const q = query(
        lockersRef,
        where('stationId', '==', stationId)
      );

      const snapshot = await getDocs(q);
      const lockerData: Locker[] = [];

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();

        lockerData.push({
          id: docSnapshot.id,
          lockerId: data?.lockerId || '',
          lockerNumber: data?.lockerNumber || '',
          type: data?.type || 'public',
          provider: data?.provider || '서울메트로',
          location: data?.location || { floor: '', section: '' },
          pricing: data?.pricing || { pricePerHour: 2000, maxHours: 4 },
          availability: {
            status: data?.availability?.status || 'available',
            availableSlots: data?.availability?.availableSlots || [],
          },
        });
      });

      setLockers(lockerData);
    } catch (error) {
      console.error('Error loading lockers:', error);
      Alert.alert('오류', '사물함 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleLockerSelect = (locker: Locker) => {
    setSelectedLocker(locker);
    setSelectedTimeSlot(null);
  };

  const handleTimeSlotSelect = (timeSlot: TimeSlot) => {
    if (selectedLocker && timeSlot.available) {
      setSelectedTimeSlot(timeSlot);
    } else {
      Alert.alert('이용 불가', '이미 예약된 시간대입니다.');
    }
  };

  const handleReserve = () => {
    if (!selectedLocker || !selectedTimeSlot) {
      Alert.alert('선택 필요', '사물함과 예약 시간을 선택해주세요.');
      return;
    }

    Alert.alert(
      '사물함 예약',
      `${selectedStation?.name} ${selectedLocker.location.floor}층 ${selectedLocker.lockerNumber}번 사물함을\n${selectedTimeSlot.startTime} ~ ${selectedTimeSlot.endTime}\n예약하시겠습니까?\n\n가격: ${selectedLocker.pricing.pricePerHour.toLocaleString()}원`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '예약',
          onPress: submitReservation,
        },
      ]
    );
  };

  const submitReservation = async () => {
    if (!selectedLocker || !selectedTimeSlot) return;

    try {
      setReserving(true);

      const db = getFirestore();
      const userId = requireUserId();

      // 예약 데이터 생성 (reservations 컬렉션)
      await addDoc(collection(db, 'reservations'), {
        userId,
        lockerId: selectedLocker.id,
        lockerNumber: selectedLocker.lockerNumber,
        stationId: selectedStation?.id || '',
        stationName: selectedStation?.name || '',
        startTime: selectedTimeSlot.startTime,
        endTime: selectedTimeSlot.endTime,
        date: selectedTimeSlot.date,
        pricing: {
          pricePerHour: selectedLocker.pricing.pricePerHour,
          totalHours: 1,
          totalPrice: selectedLocker.pricing.pricePerHour,
        },
        status: 'pending', // pending, confirmed, completed, cancelled
        createdAt: serverTimestamp(),
      });

      // 사물함 상태 업데이트
      const lockerRef = doc(db, 'lockers', selectedLocker.id);
      const updatedSlots = selectedLocker.availability.availableSlots.filter(
        (slot) => slot.date !== selectedTimeSlot.date || slot.startTime !== selectedTimeSlot.startTime
      );

      await updateDoc(lockerRef, {
        'availability.availableSlots': updatedSlots,
        'availability.status': 'reserved',
      });

      Alert.alert(
        '예약 완료',
        '사물함 예약이 완료되었습니다.\n\n예약 정보는 마이페이지에서 확인할 수 있습니다.',
        [
          {
            text: '확인',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error reserving locker:', error);
      Alert.alert('오류', '사물함 예약을 실패했습니다.');
    } finally {
      setReserving(false);
    }
  };

  const getProviderColor = (provider: string): string => {
    switch (provider) {
      case '서울메트로':
        return '#00BCD4';
      case 'CU':
        return '#00A9E0';
      case 'GS25':
        return '#FF9800';
      default:
        return '#9E9E9E';
    }
  };

  const getAvailabilityBadge = (status: string): { color: string; text: string } => {
    switch (status) {
      case 'available':
        return { color: '#4CAF50', text: '예약 가능' };
      case 'occupied':
        return { color: '#FF5252', text: '이용 중' };
      case 'maintenance':
        return { color: '#FF9800', text: '점검 중' };
      default:
        return { color: '#9E9E9E', text: '알 수 없음' };
    }
  };

  const renderTimeSlotButton = (timeSlot: TimeSlot, index: number) => {
    const { color, text } = getAvailabilityBadge(
      timeSlot.available ? 'available' : 'occupied'
    );
    const isSelected = selectedTimeSlot?.date === timeSlot.date && selectedTimeSlot?.startTime === timeSlot.startTime;

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.timeSlotButton,
          !timeSlot.available && styles.timeSlotButtonDisabled,
          isSelected && styles.timeSlotButtonSelected,
        ]}
        onPress={() => handleTimeSlotSelect(timeSlot)}
        disabled={!timeSlot.available}
      >
        <Text style={[styles.timeSlotTime, isSelected && styles.timeSlotTimeSelected]}>
          {timeSlot.startTime}
        </Text>
        <Text style={[styles.timeSlotSeparator, isSelected && styles.timeSlotSeparatorSelected]}>
          ~
        </Text>
        <Text style={[styles.timeSlotTime, isSelected && styles.timeSlotTimeSelected]}>
          {timeSlot.endTime}
        </Text>
        <View style={[styles.timeSlotBadge, { backgroundColor: color }]}>
          <Text style={styles.timeSlotBadgeText}>{text}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLockerCard = (locker: Locker) => {
    const providerColor = getProviderColor(locker.provider);
    const isSelected = selectedLocker?.id === locker.id;
    const { color: statusColor, text: statusText } = getAvailabilityBadge(locker.availability.status);

    return (
      <TouchableOpacity
        key={locker.id}
        style={[
          styles.lockerCard,
          isSelected && styles.lockerCardSelected,
          locker.availability.status !== 'available' && styles.lockerCardDisabled,
        ]}
        onPress={() => handleLockerSelect(locker)}
        disabled={locker.availability.status !== 'available'}
        activeOpacity={0.7}
      >
        {/* 헤더 */}
        <View style={styles.cardHeader}>
          <View style={styles.lockerInfo}>
            <View style={[styles.lockerNumberBadge, { backgroundColor: providerColor }]}>
              <Text style={styles.lockerNumberText}>{locker.lockerNumber}</Text>
            </View>
            <View style={styles.locationInfo}>
              <Text style={styles.locationText}>📍 {locker.location.floor}층</Text>
              <Text style={styles.locationText}>🏢 {locker.location.section}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusBadgeText}>{statusText}</Text>
          </View>
        </View>

        <View style={[styles.providerBadge, { backgroundColor: providerColor }]}>
          <Text style={styles.providerBadgeText}>{locker.provider}</Text>
        </View>

        {/* 가격 정보 */}
        <View style={styles.pricingInfo}>
          <Text style={styles.priceText}>
            {locker.pricing.pricePerHour.toLocaleString()}원 / 시간
          </Text>
          <Text style={styles.maxHoursText}>
            최대 {locker.pricing.maxHours}시간
          </Text>
        </View>

        {/* 이용 가능 시간대 */}
        {locker.availability.availableSlots.length > 0 && (
          <View style={styles.timeSlotsContainer}>
            <Text style={styles.timeSlotsTitle}>예약 가능 시간</Text>
            <View style={styles.timeSlotsGrid}>
              {locker.availability.availableSlots.map((timeSlot, index) =>
                renderTimeSlotButton(timeSlot, index)
              )}
            </View>
          </View>
        )}

        {/* 예약 버튼 */}
        {locker.availability.status === 'available' && selectedLocker?.id === locker.id && (
          <TouchableOpacity
            style={[styles.reserveButton, !selectedTimeSlot && styles.reserveButtonDisabled]}
            onPress={handleReserve}
            disabled={!selectedTimeSlot || reserving}
          >
            <Text style={styles.reserveButtonText}>
              {reserving ? '예약 중...' : '예약하기'}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>사물함 정보를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>사물함 선택</Text>
        <Text style={styles.headerSubtitle}>
          {selectedStation ? `${selectedStation.name}` : '역'} 사물함을 선택하세요
        </Text>
      </View>

      {/* 사물함 목록 */}
      <ScrollView
        style={styles.lockerList}
        contentContainerStyle={styles.lockerListContent}
        showsVerticalScrollIndicator={false}
      >
        {lockers.map((locker) => renderLockerCard(locker))}

        {lockers.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>이용 가능한 사물함이 없습니다</Text>
            <Text style={styles.emptySubtext}>
              다른 역을 확인하거나 나중에 다시 시도해주세요
            </Text>
          </View>
        )}
      </ScrollView>

      {/* 선택 정보 */}
      {selectedLocker && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            💡 예약 시간을 선택하면 예약하기 버튼이 활성화됩니다
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body1,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  lockerList: {
    flex: 1,
  },
  lockerListContent: {
    padding: Spacing.md,
  },
  lockerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  lockerCardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  lockerCardDisabled: {
    opacity: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  lockerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lockerNumberBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
  },
  lockerNumberText: {
    ...Typography.h3,
    color: Colors.white,
    fontWeight: '700',
  },
  locationInfo: {
    marginLeft: Spacing.sm,
  },
  locationText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginRight: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusBadgeText: {
    ...Typography.bodySmall,
    color: Colors.white,
    fontWeight: '600',
  },
  providerBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  providerBadgeText: {
    ...Typography.bodySmall,
    color: Colors.white,
    fontWeight: '600',
  },
  pricingInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  priceText: {
    ...Typography.h3,
    color: Colors.primary,
    fontWeight: '700',
  },
  maxHoursText: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  timeSlotsContainer: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  timeSlotsTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  timeSlotButton: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 80,
  },
  timeSlotButtonDisabled: {
    opacity: 0.5,
    borderColor: Colors.border,
  },
  timeSlotButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  timeSlotTime: {
    ...Typography.body1,
    color: Colors.text,
    fontWeight: '600',
  },
  timeSlotTimeSelected: {
    color: Colors.primary,
  },
  timeSlotSeparator: {
    ...Typography.body1,
    color: Colors.textSecondary,
    marginHorizontal: Spacing.xs,
  },
  timeSlotSeparatorSelected: {
    color: Colors.primary,
  },
  timeSlotBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  timeSlotBadgeText: {
    ...Typography.bodySmall,
    color: Colors.white,
    fontWeight: '600',
  },
  reserveButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  reserveButtonDisabled: {
    backgroundColor: Colors.border,
  },
  reserveButtonText: {
    ...Typography.h3,
    color: Colors.white,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyText: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    ...Typography.body2,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  footerText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
