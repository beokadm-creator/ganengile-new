/**
 * Locker Locator Component
 * 사물함 위치 지도 컴포넌트
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { Locker, LockerSummary } from '../../types/locker';
import { getAvailableLockers, getLockersByStation, createLockerLocation } from '../../services/locker-service';
import { getAllStations } from '../../services/config-service';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LockerLocatorProps {
  /** 선택된 역 ID (선택사항) */
  selectedStationId?: string;
  /** 사물함 선택 콜백 */
  onLockerSelect: (locker: LockerSummary) => void;
  /** 닫기 콜백 */
  onClose: () => void;
}

export default function LockerLocator({ selectedStationId, onLockerSelect, onClose }: LockerLocatorProps) {
  const [lockers, setLockers] = useState<LockerLocation[]>([]);
  const [selectedStation, setSelectedStation] = useState<string | undefined>(selectedStationId);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const loadLockers = async () => {
    try {
      setLoading(true);
      
      let lockerList: Locker[];
      if (selectedStation) {
        lockerList = await getLockersByStation(selectedStation);
      } else {
        lockerList = await getAvailableLockers();
      }

      const locations = lockerList
        .filter((locker) => locker.status === 'available' && locker.availableCount > 0)
        .map(createLockerLocation);

      setLockers(locations);
    } catch (error) {
      console.error('Error loading lockers:', error);
      Alert.alert('오류', '사물함 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadLockers();
    }, [selectedStation])
  );

  const handleLockerSelect = (locker: LockerLocation) => {
    const summary: LockerSummary = {
      lockerId: locker.lockerId,
      name: locker.name,
      type: locker.stationName.includes('공공') ? 'public' : 'private',
      status: locker.status,
      stationName: locker.stationName,
      pricePer4Hours: 0, // TODO: 가격 정보 가져오기
      availableCount: locker.isAvailable ? 1 : 0,
      totalCapacity: 0, // TODO: 전체 용량 가져오기
    };
    onLockerSelect(summary);
  };

  const renderLockerItem = ({ item }: { item: LockerLocation }) => (
    <TouchableOpacity
      style={styles.lockerItem}
      onPress={() => handleLockerSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.lockerIconContainer}>
        <Ionicons
          name={item.isAvailable ? 'cube' : 'cube-outline'}
          size={32}
          color={item.isAvailable ? Colors.primary : Colors.gray400}
        />
      </View>

      <View style={styles.lockerInfo}>
        <Text style={styles.lockerName}>{item.name}</Text>
        <View style={styles.lockerMeta}>
          <View style={styles.metaTag}>
            <Ionicons name="location" size={14} color={Colors.gray600} />
            <Text style={styles.metaText}>{item.stationName}</Text>
          </View>
          {item.isAvailable && (
            <View style={styles.availableBadge}>
              <Text style={styles.availableText}>이용 가능</Text>
            </View>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>사물함 찾는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>사물함 선택</Text>
          <View style={styles.closeButton} />
        </View>

        {/* View Mode Toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={20} color={viewMode === 'list' ? Colors.white : Colors.gray600} />
            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>
              목록
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
            onPress={() => setViewMode('map')}
          >
            <Ionicons name="map" size={20} color={viewMode === 'map' ? Colors.white : Colors.gray600} />
            <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>
              지도
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {viewMode === 'list' ? (
        <FlatList
          data={lockers}
          keyExtractor={(item) => item.lockerId}
          renderItem={renderLockerItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Ionicons name="cube-outline" size={64} color={Colors.gray300} />
              <Text style={styles.emptyTitle}>이용 가능한 사물함이 없습니다</Text>
              <Text style={styles.emptySubtitle}>
                다른 역이나 시간을 선택해주세요
              </Text>
            </View>
          }
        />
      ) : (
        <View style={styles.mapContainer}>
          {/* TODO: 지도 구현 (React Native Maps 또는 Expo Location) */}
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map-outline" size={64} color={Colors.gray300} />
            <Text style={styles.mapPlaceholderText}>지도 기능 준비 중</Text>
            <Text style={styles.mapPlaceholderSubtext}>
              목록 모드를 이용해주세요
            </Text>
          </View>
        </View>
      )}

      {/* Footer Info */}
      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <Text style={styles.footerText}>
            공공 사물함: 2,000원/4시간
          </Text>
        </View>
        <View style={styles.footerItem}>
          <Ionicons name="storefront" size={20} color={Colors.secondary} />
          <Text style={styles.footerText}>
            민간 사물함: 3,000원/6시간
          </Text>
        </View>
      </View>
    </View>
  );
}

// ==================== Types ====================

interface LockerLocation {
  lockerId: string;
  name: string;
  lat: number;
  lng: number;
  stationName: string;
  status: 'available' | 'occupied' | 'maintenance' | 'out_of_order';
  isAvailable: boolean;
}

// ==================== Styles ====================

const styles = StyleSheet.create({
  centerContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  container: {
    backgroundColor: Colors.white,
    flex: 1,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 60,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
  },
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  closeButton: {
    width: 28,
  },
  title: {
    color: Colors.white,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
  },
  toggleButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: BorderRadius.sm,
    flexDirection: 'row',
    flex: 1,
    gap: Spacing.xs,
    padding: Spacing.sm,
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  toggleText: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  toggleTextActive: {
    color: Colors.white,
  },
  listContent: {
    padding: Spacing.md,
  },
  lockerItem: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  lockerIconContainer: {
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    borderRadius: 20,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  lockerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  lockerName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  lockerMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  metaTag: {
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    borderRadius: 4,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  metaText: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.xs,
  },
  availableBadge: {
    backgroundColor: Colors.successLight,
    borderRadius: 4,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  availableText: {
    color: Colors.success,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  mapContainer: {
    flex: 1,
  },
  mapPlaceholder: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  mapPlaceholderText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    marginTop: Spacing.md,
  },
  mapPlaceholderSubtext: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  loadingText: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.md,
  },
  footer: {
    backgroundColor: Colors.gray50,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  footerItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  footerText: {
    color: Colors.gray700,
    fontSize: Typography.fontSize.xs,
    flex: 1,
  },
});
