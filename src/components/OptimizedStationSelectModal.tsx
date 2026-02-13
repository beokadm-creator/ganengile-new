/**
 * OptimizedStationSelectModal 개선
 * 로딩 인디케이터 추가
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Station {
  id: string;
  name: string;
  line: string;
  region: 'seoul' | 'gyeonggi' | 'incheon';
}

interface OptimizedStationSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectStation: (station: Station) => void;
  initialRegion?: 'seoul' | 'gyeonggi' | 'incheon' | 'all';
}

export const OptimizedStationSelectModal: React.FC<OptimizedStationSelectModalProps> = ({
  visible,
  onClose,
  onSelectStation,
  initialRegion = 'all'
}) => {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<'seoul' | 'gyeonggi' | 'incheon' | 'all'>(initialRegion);
  const [filteredStations, setFilteredStations] = useState<Station[]>([]);
  const [recentStations, setRecentStations] = useState<Station[]>([]);
  const [favoriteStations, setFavoriteStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const insets = useSafeAreaInsets();

  // Debounce 검색
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchText]);

  // 검색어 변경 시 로딩 상태 표시
  useEffect(() => {
    if (debouncedSearch) {
      setIsSearching(true);
      // 검색 실행 (모의)
      setTimeout(() => {
        setIsSearching(false);
      }, 500);
    } else {
      setIsSearching(false);
    }
  }, [debouncedSearch]);

  // 역 필터링
  useEffect(() => {
    setIsLoading(true);

    // 필터링 로직 (모의)
    setTimeout(() => {
      let filtered = mockStations;

      // 지역 필터
      if (selectedRegion !== 'all') {
        filtered = filtered.filter(s => s.region === selectedRegion);
      }

      // 검색어 필터
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase();
        filtered = filtered.filter(s =>
          s.name.toLowerCase().includes(search) ||
          s.line.toLowerCase().includes(search)
        );
      }

      setFilteredStations(filtered);
      setIsLoading(false);
    }, 300);
  }, [debouncedSearch, selectedRegion]);

  // 최근/즐겨찾기 로드
  useEffect(() => {
    loadRecentAndFavoriteStations();
  }, []);

  const loadRecentAndFavoriteStations = async () => {
    // AsyncStorage에서 로드 (모의)
    setRecentStations(mockRecentStations);
    setFavoriteStations(mockFavoriteStations);
  };

  const renderStation = ({ item }: { item: Station }) => (
    <TouchableOpacity
      style={styles.stationItem}
      onPress={() => onSelectStation(item)}
    >
      <View style={styles.stationInfo}>
        <View style={[styles.lineBadge, { backgroundColor: getLineColor(item.line) }]}>
          <Text style={styles.lineText}>{item.line}</Text>
        </View>
        <Text style={styles.stationName}>{item.name}</Text>
      </View>
      <Text style={styles.regionText}>{getRegionName(item.region)}</Text>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>역 선택</Text>

      {/* 지역 필터 */}
      <View style={styles.regionFilter}>
        {(['seoul', 'gyeonggi', 'incheon', 'all'] as const).map(region => (
          <TouchableOpacity
            key={region}
            style={[
              styles.regionButton,
              selectedRegion === region && styles.regionButtonActive
            ]}
            onPress={() => setSelectedRegion(region)}
          >
            <Text
              style={[
                styles.regionButtonText,
                selectedRegion === region && styles.regionButtonTextActive
              ]}
            >
              {getRegionName(region)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 검색 입력 */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="역 이름 검색"
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {isSearching && (
          <ActivityIndicator style={styles.searchIndicator} size="small" />
        )}
      </View>

      {/* 즐겨찾기 */}
      {favoriteStations.length > 0 && !searchText && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⭐ 즐겨찾기</Text>
          {favoriteStations.map(station => (
            <TouchableOpacity
              key={station.id}
              style={styles.stationItem}
              onPress={() => onSelectStation(station)}
            >
              <Text style={styles.stationName}>{station.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 최근 검색 */}
      {recentStations.length > 0 && !searchText && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🕐 최근 검색</Text>
          {recentStations.map(station => (
            <TouchableOpacity
              key={station.id}
              style={styles.stationItem}
              onPress={() => onSelectStation(station)}
            >
              <Text style={styles.stationName}>{station.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 전체 목록 로딩 인디케이터 */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>역 목록 로딩 중...</Text>
        </View>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {renderHeader()}

        {/* 필터링된 역 목록 */}
        {!isLoading && (
          <FlatList
            data={filteredStations}
            keyExtractor={item => item.id}
            renderItem={renderStation}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchText ? '검색 결과가 없습니다' : '역이 없습니다'}
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
            maxToRenderPerBatch={10}
            windowSize={5}
            initialNumToRender={10}
          />
        )}

        {/* 닫기 버튼 */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>닫기</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// 모의 데이터
const mockStations: Station[] = [
  { id: '1', name: '서울역', line: '1호선', region: 'seoul' },
  { id: '2', name: '강남역', line: '2호선', region: 'seoul' },
  { id: '3', name: '역삼역', line: '2호선', region: 'seoul' },
  { id: '4', name: '선릉역', line: '2호선', region: 'seoul' },
  { id: '5', name: '삼성역', line: '2호선', region: 'seoul' }
];

const mockRecentStations: Station[] = [
  { id: '1', name: '서울역', line: '1호선', region: 'seoul' },
  { id: '2', name: '강남역', line: '2호선', region: 'seoul' }
];

const mockFavoriteStations: Station[] = [
  { id: '1', name: '서울역', line: '1호선', region: 'seoul' }
];

// 헬퍼 함수
const getLineColor = (line: string): string => {
  const colors: Record<string, string> = {
    '1호선': '#1935C0',
    '2호선': '#009944',
    '3호선': '#FF6600',
    '4호선': '#00A5DE',
    '5호선': '#8B50A4',
    '6호선': '#C54E2A',
    '7호선': '#685A2A',
    '8호선': '#F5A200',
    '9호선': '#BDB092'
  };
  return colors[line] || '#999';
};

const getRegionName = (region: string): string => {
  const names: Record<string, string> = {
    'seoul': '서울',
    'gyeonggi': '경기',
    'incheon': '인천',
    'all': '전체'
  };
  return names[region] || region;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16
  },
  regionFilter: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8
  },
  regionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center'
  },
  regionButtonActive: {
    backgroundColor: '#00BCD4'
  },
  regionButtonText: {
    fontSize: 14,
    color: '#333'
  },
  regionButtonTextActive: {
    color: '#fff',
    fontWeight: '600'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  searchInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16
  },
  searchIndicator: {
    position: 'absolute',
    right: 16
  },
  section: {
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 24
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666'
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80
  },
  stationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  stationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  lineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 12
  },
  lineText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600'
  },
  stationName: {
    fontSize: 16,
    color: '#333'
  },
  regionText: {
    fontSize: 12,
    color: '#999'
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48
  },
  emptyText: {
    fontSize: 16,
    color: '#999'
  },
  closeButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    backgroundColor: '#00BCD4',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff'
  }
});
