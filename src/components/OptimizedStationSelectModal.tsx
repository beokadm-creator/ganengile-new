/**
 * Optimized Station Select Modal
 * 성능 최적화된 지하철 역 선택 Modal
 *
 * 개선사항:
 * - Debounced search (300ms)
 * - 한글 초성 검색
 * - 즐겨찾기/최근 검색
 * - 지역 필터
 * - Virtualized optimization
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllStations } from '../services/config-service';

interface Station {
  stationId: string;
  stationName: string;
  stationNameEnglish: string;
  region: string;
  lines: Array<{
    lineId: string;
    lineName: string;
  }>;
  isTransferStation: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectStation: (station: Station) => void;
  title?: string;
  mode?: 'start' | 'end';
}

// 한글 초성 변환
const CHO_SEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

const getChosung = (text: string): string => {
  return text.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const cho = (code - 0xAC00) / 28 / 21;
      return CHO_SEONG[cho] || char;
    }
    return char;
  }).join('');
};

// Debounce hook
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function OptimizedStationSelectModal({
  visible,
  onClose,
  onSelectStation,
  title = '역 선택',
}: Props) {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentStations, setRecentStations] = useState<string[]>([]);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (visible) {
      loadStations();
      loadUserPreferences();
    }
  }, [visible]);

  const loadStations = async () => {
    try {
      setLoading(true);
      const stationData = await getAllStations();
      setStations(stationData);
    } catch (error: any) {
      console.error('Error loading stations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserPreferences = async () => {
    try {
      const [favData, recentData] = await Promise.all([
        AsyncStorage.getItem('favorite_stations'),
        AsyncStorage.getItem('recent_stations'),
      ]);
      setFavorites(favData ? JSON.parse(favData) : []);
      setRecentStations(recentData ? JSON.parse(recentData) : []);
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  const toggleFavorite = async (stationId: string) => {
    const newFavorites = favorites.includes(stationId)
      ? favorites.filter(id => id !== stationId)
      : [...favorites, stationId];

    setFavorites(newFavorites);
    await AsyncStorage.setItem('favorite_stations', JSON.stringify(newFavorites));
  };

  const addToRecent = async (station: Station) => {
    const newRecent = [station.stationId, ...recentStations.filter(id => id !== station.stationId)].slice(0, 5);
    setRecentStations(newRecent);
    await AsyncStorage.setItem('recent_stations', JSON.stringify(newRecent));
  };

  // Filter stations with performance optimization
  const filteredStations = useMemo(() => {
    return stations.filter((station) => {
      const query = debouncedSearchQuery.toLowerCase();
      const chosung = getChosung(debouncedSearchQuery);

      const matchesSearch =
        query === '' ||
        station.stationName.includes(query) ||
        station.stationNameEnglish.toLowerCase().includes(query) ||
        getChosung(station.stationName).includes(chosung);

      const matchesRegion =
        !selectedRegion || station.region === selectedRegion;

      return matchesSearch && matchesRegion;
    });
  }, [stations, debouncedSearchQuery, selectedRegion]);

  // Separate favorite and recent stations
  const favoriteStationsList = useMemo(() => {
    return filteredStations.filter(s => favorites.includes(s.stationId));
  }, [filteredStations, favorites]);

  const recentStationsList = useMemo(() => {
    return recentStations
      .map(id => filteredStations.find(s => s.stationId === id))
      .filter(Boolean) as Station[];
  }, [filteredStations, recentStations]);

  // Get all unique regions
  const regions = useMemo(() => {
    return Array.from(new Set(stations.map(s => s.region))).sort();
  }, [stations]);

  const handleSelectStation = async (station: Station) => {
    await addToRecent(station);
    onSelectStation(station);
    onClose();
  };

  const renderStation = useCallback(({ item }: { item: Station }) => (
    <TouchableOpacity
      style={styles.stationCard}
      onPress={() => handleSelectStation(item)}
    >
      <View style={styles.stationHeader}>
        <Text style={styles.stationName}>{item.stationName}</Text>
        <View style={styles.stationActions}>
          {item.isTransferStation && (
            <View style={styles.transferBadge}>
              <Text style={styles.transferBadgeText}>환승</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => toggleFavorite(item.stationId)}
          >
            <Text style={styles.favoriteButtonText}>
              {favorites.includes(item.stationId) ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.stationMeta}>
        <Text style={styles.regionText}>{getRegionLabel(item.region)}</Text>
        <Text style={styles.stationNameEnglish}>{item.stationNameEnglish}</Text>
      </View>
    </TouchableOpacity>
  ), [favorites]);

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const renderRegionFilter = (region: string) => {
    const isSelected = selectedRegion === region;
    return (
      <TouchableOpacity
        key={region}
        style={[
          styles.regionFilterButton,
          isSelected && styles.regionFilterButtonSelected,
        ]}
        onPress={() => setSelectedRegion(isSelected ? null : region)}
      >
        <Text
          style={[
            styles.regionFilterButtonText,
            isSelected && styles.regionFilterButtonTextSelected,
          ]}
        >
          {getRegionLabel(region)}
        </Text>
      </TouchableOpacity>
    );
  };

  const getRegionLabel = (region: string): string => {
    const labels: Record<string, string> = {
      'seoul': '서울',
      'gyeonggi': '경기',
      'incheon': '인천',
      'chungnam': '충남',
      'gangwon': '강원',
    };
    return labels[region] || region;
  };

  // Data source for FlatList
  const dataSource = useMemo(() => {
    const hasFavorites = favoriteStationsList.length > 0;
    const hasRecent = recentStationsList.length > 0;
    const hasOthers = filteredStations.length > 0;

    const data: Array<{ type: 'section' | 'item'; title?: string; station?: Station }> = [];

    if (hasFavorites) {
      data.push({ type: 'section', title: '⭐ 즐겨찾기' });
      favoriteStationsList.forEach(station => {
        data.push({ type: 'item', station });
      });
    }

    if (hasRecent && !hasFavorites) {
      data.push({ type: 'section', title: '🕐 최근 검색' });
      recentStationsList.forEach(station => {
        data.push({ type: 'item', station });
      });
    }

    if (hasOthers && (debouncedSearchQuery || selectedRegion)) {
      data.push({ type: 'section', title: '🔍 검색 결과' });
      filteredStations.forEach(station => {
        data.push({ type: 'item', station });
      });
    }

    return data;
  }, [favoriteStationsList, recentStationsList, filteredStations, debouncedSearchQuery, selectedRegion]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    if (item.type === 'section') {
      return renderSectionHeader(item.title || '');
    }
    return renderStation({ item: item.station });
  }, [favorites]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="역 이름 검색..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Region Filters */}
          <View style={styles.regionFiltersContainer}>
            <TouchableOpacity
              style={[
                styles.regionFilterButton,
                !selectedRegion && styles.regionFilterButtonSelected,
              ]}
              onPress={() => setSelectedRegion(null)}
            >
              <Text
                style={[
                  styles.regionFilterButtonText,
                  !selectedRegion && styles.regionFilterButtonTextSelected,
                ]}
              >
                전체
              </Text>
            </TouchableOpacity>
            {regions.map(renderRegionFilter)}
          </View>
        </View>

        {/* Station List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#00BCD4" />
            <Text style={styles.loadingText}>역 정보 불러오는 중...</Text>
          </View>
        ) : (
          <FlatList
            data={dataSource}
            renderItem={renderItem}
            keyExtractor={(item, index) => `${item.type}-${index}`}
            contentContainerStyle={styles.stationList}
            ListEmptyComponent={
              <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>
                  {debouncedSearchQuery || selectedRegion
                    ? '검색 결과가 없습니다'
                    : '역 정보가 없습니다'}
                </Text>
              </View>
            }
            maxToRenderPerBatch={10}
            windowSize={5}
            initialNumToRender={10}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#333',
    fontSize: 24,
  },
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  favoriteButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  favoriteButtonText: {
    color: '#FF9800',
    fontSize: 20,
  },
  header: {
    backgroundColor: '#fff',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
    paddingTop: 60,
  },
  headerContent: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    color: '#333',
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  regionFilterButton: {
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  regionFilterButtonSelected: {
    backgroundColor: '#00BCD4',
    borderColor: '#00BCD4',
  },
  regionFilterButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  regionFilterButtonTextSelected: {
    color: '#fff',
  },
  regionFiltersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  regionText: {
    color: '#999',
    fontSize: 12,
    marginRight: 8,
  },
  searchContainer: {
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    padding: 12,
  },
  sectionHeader: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionHeaderText: {
    color: '#666',
    fontSize: 14,
    fontWeight: 'bold',
  },
  stationActions: {
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: 'auto',
  },
  stationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  stationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  stationList: {
    padding: 16,
  },
  stationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stationName: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stationNameEnglish: {
    color: '#999',
    fontSize: 12,
  },
  transferBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  transferBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
