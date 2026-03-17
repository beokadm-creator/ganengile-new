/**
 * Locker Map Screen
 * 사물함 지도 화면 (P1-3)
 *
 * 기능:
 * - 지도 기반 사물함 위치 표시
 * - 역별 사물함 마커
 * - 사물함 상태 (예약 가능/불가)
 * - 필터 (공공/민간, 요금)
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
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { requireUserId } from '../../services/firebase';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

interface Locker {
  id: string;
  stationId: string;
  stationName: string;
  line: string;
  floor: string;
  section: string;
  contactPhone: string;
  location: {
    latitude: number;
    longitude: number;
  };
  type: 'public' | 'private';
  provider: '서울메트로' | 'CU' | 'GS25';
  pricePerHour: number;
  maxHours: number;
  availableFrom: string;
  availableUntil: string;
  status: 'available' | 'unavailable' | 'maintenance';
}

interface LockerFilters {
  type: 'all' | 'public' | 'private';
  maxPrice: number;
}

export default function LockerMapScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [filteredLockers, setFilteredLockers] = useState<Locker[]>([]);
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  
  // 필터
  const [filters, setFilters] = useState<LockerFilters>({
    type: 'all',
    maxPrice: 3000,
  });

  // 사물함 로드
  useEffect(() => {
    loadLockers();
  }, []);

  // 필터 적용
  useEffect(() => {
    applyFilters();
  }, [lockers, filters]);

  const loadLockers = async () => {
    try {
      setLoading(true);

      const db = getFirestore();
      const _userId = requireUserId();

      // 사물함 컬렉션 로드
      const lockersRef = collection(db, 'lockers');
      const q = query(
        lockersRef,
        where('status', '==', 'available')
      );

      const snapshot = await getDocs(q);
      const lockerData: Locker[] = [];

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        
        lockerData.push({
          id: docSnapshot.id,
          stationId: data?.stationId || data?.location?.stationId || '',
          stationName: data?.stationName || data?.location?.stationName || '',
          line: data?.line || data?.location?.line || '',
          floor: String(data?.floor || data?.location?.floor || 1),
          section: data?.section || data?.location?.section || '',
          contactPhone: data?.contactPhone || data?.location?.contactPhone || '',
          location: data?.location || { latitude: 0, longitude: 0 },
          type: data?.type || 'public',
          provider: data?.provider || '서울메트로',
          pricePerHour: data?.pricePerHour || Math.round((Number(data?.pricing?.base || 0) / Math.max(1, Number(data?.pricing?.baseDuration || 240))) * 60) || 2000,
          maxHours: data?.maxHours || Math.max(1, Math.round((Number(data?.pricing?.maxDuration || 240) / 60))) || 4,
          availableFrom: data?.availableFrom || '06:00',
          availableUntil: data?.availableUntil || '23:00',
          status: data?.status || 'available',
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

  const applyFilters = () => {
    let filtered = [...lockers];

    // 타입 필터
    if (filters.type !== 'all') {
      filtered = filtered.filter((locker) => locker.type === filters.type);
    }

    // 가격 필터
    filtered = filtered.filter((locker) => locker.pricePerHour <= filters.maxPrice);

    setFilteredLockers(filtered);
  };

  const handleFilterChange = (key: keyof LockerFilters, value: any) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleLockerSelect = (locker: Locker) => {
    setSelectedLocker(locker);

    Alert.alert(
      '사물함 선택',
      `${locker.stationName} ${locker.floor}층 ${locker.provider}\n위치: ${locker.section || '역사 내 안내 위치 확인'}\n${locker.contactPhone ? `문의: ${locker.contactPhone}\n` : ''}\n가격: ${locker.pricePerHour.toLocaleString()}원/시간`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '선택',
          onPress: () => {
            // 사물함 예약 화면으로 이동
            navigation.navigate('LockerSelection', {
              stationId: locker.stationId,
              stationName: locker.stationName,
              lockerId: locker.id,
            });
          },
        },
      ]
    );
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

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'public':
        return '공공';
      case 'private':
        return '민간';
      default:
        return '';
    }
  };

  const renderFilterBar = () => {
    return (
      <View style={styles.filterBar}>
        <Text style={styles.filterTitle}>필터</Text>

        {/* 타입 필터 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, filters.type === 'all' && styles.filterChipActive]}
            onPress={() => handleFilterChange('type', 'all')}
          >
            <Text
              style={[
                styles.filterChipText,
                filters.type === 'all' && styles.filterChipTextActive,
              ]}
            >
              전체
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filters.type === 'public' && styles.filterChipActive]}
            onPress={() => handleFilterChange('type', 'public')}
          >
            <Text
              style={[
                styles.filterChipText,
                filters.type === 'public' && styles.filterChipTextActive,
              ]}
            >
              공공
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filters.type === 'private' && styles.filterChipActive]}
            onPress={() => handleFilterChange('type', 'private')}
          >
            <Text
              style={[
                styles.filterChipText,
                filters.type === 'private' && styles.filterChipTextActive,
              ]}
            >
              민간
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* 가격 필터 슬라이더 */}
        <View style={styles.priceFilter}>
          <Text style={styles.priceLabel}>최대 가격: {filters.maxPrice.toLocaleString()}원</Text>
        </View>
      </View>
    );
  };

  const renderLockerCard = (locker: Locker) => {
    const providerColor = getProviderColor(locker.provider);

    return (
      <TouchableOpacity
        key={locker.id}
        style={[
          styles.lockerCard,
          selectedLocker?.id === locker.id && styles.lockerCardSelected,
        ]}
        onPress={() => handleLockerSelect(locker)}
        activeOpacity={0.7}
      >
        {/* 헤더: 역명 + 라인 */}
        <View style={styles.cardHeader}>
          <View style={styles.stationInfo}>
            <Text style={styles.stationName}>{locker.stationName}</Text>
            <View style={[styles.lineBadge, { backgroundColor: providerColor }]}>
              <Text style={styles.lineBadgeText}>{locker.line}</Text>
            </View>
          </View>
          <View style={[styles.typeBadge, { backgroundColor: providerColor }]}>
            <Text style={styles.typeBadgeText}>{getTypeLabel(locker.type)}</Text>
          </View>
        </View>

        {/* 위치 정보 */}
        <View style={styles.locationInfo}>
          <Text style={styles.locationLabel}>📍 {locker.floor}층</Text>
          <Text style={styles.locationLabel}>🧭 {locker.section || '역사 내 안내 위치 확인'}</Text>
          <Text style={styles.locationLabel}>🏢 {locker.provider}</Text>
          {!!locker.contactPhone && <Text style={styles.locationLabel}>☎ {locker.contactPhone}</Text>}
        </View>

        {/* 가격 정보 */}
        <View style={styles.priceInfo}>
          <Text style={styles.priceText}>
            {locker.pricePerHour.toLocaleString()}원 / 시간
          </Text>
          <Text style={styles.maxHoursText}>최대 {locker.maxHours}시간</Text>
        </View>

        {/* 이용 가능 시간 */}
        <View style={styles.availabilityInfo}>
          <Text style={styles.availabilityText}>
            ⏰ {locker.availableFrom} ~ {locker.availableUntil}
          </Text>
          <View
            style={[
              styles.statusBadge,
              locker.status === 'available' && styles.statusBadgeAvailable,
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {locker.status === 'available' ? '예약 가능' : '이용 불가'}
            </Text>
          </View>
        </View>
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
        <Text style={styles.headerTitle}>사물함 지도</Text>
        <Text style={styles.headerSubtitle}>
          비대면 배송을 위한 사물함을 선택하세요
        </Text>
      </View>

      {/* 필터 바 */}
      {renderFilterBar()}

      {/* 사물함 목록 */}
      <ScrollView
        style={styles.lockerList}
        contentContainerStyle={styles.lockerListContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredLockers.length > 0 ? (
          filteredLockers.map((locker) => renderLockerCard(locker))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>표시할 사물함이 없습니다</Text>
            <Text style={styles.emptySubtext}>
              필터를 변경하거나 다른 역을 확인해보세요
            </Text>
          </View>
        )}
      </ScrollView>

      {/* 하단 안내 */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          💡 팁: 환승역에 사물함이 많을수록 배송이 편리해요!
        </Text>
      </View>
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
  filterBar: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  filterTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  filterScroll: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    ...Typography.body2,
    color: Colors.text,
  },
  filterChipTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  priceFilter: {
    marginTop: Spacing.sm,
  },
  priceLabel: {
    ...Typography.body1,
    color: Colors.primary,
    fontWeight: '600',
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  stationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stationName: {
    ...Typography.h3,
    color: Colors.text,
    marginRight: Spacing.xs,
  },
  lineBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  lineBadgeText: {
    ...Typography.bodySmall,
    color: Colors.white,
    fontWeight: '600',
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.xs,
  },
  typeBadgeText: {
    ...Typography.bodySmall,
    color: Colors.white,
    fontWeight: '600',
  },
  locationInfo: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  locationLabel: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginRight: Spacing.md,
  },
  priceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
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
  availabilityInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availabilityText: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.border,
  },
  statusBadgeAvailable: {
    backgroundColor: '#4CAF50',
  },
  statusBadgeText: {
    ...Typography.bodySmall,
    color: Colors.white,
    fontWeight: '600',
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
});
