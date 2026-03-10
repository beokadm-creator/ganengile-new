import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Station } from '../types/config';

interface OptimizedStationSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectStation: (station: Station) => void;
  stations?: Station[];
  title?: string;
  initialRegion?: string;
}

export const OptimizedStationSelectModal: React.FC<OptimizedStationSelectModalProps> = ({
  visible,
  onClose,
  onSelectStation,
  stations = [],
  title = '역 선택',
  initialRegion = 'all'
}) => {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>(initialRegion);
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsSearching(true);
      const timer = setTimeout(() => {
        setIsSearching(false);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsSearching(false);
    }
  }, [debouncedSearch]);

  // 역 필터링
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);

    const timer = setTimeout(() => {
      let filtered = stations.length > 0 ? stations : mockStations;

      // 지역 필터
      if (selectedRegion !== 'all') {
        filtered = filtered.filter(s => s.region === selectedRegion);
      }

      // 검색어 필터
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase();
        filtered = filtered.filter(s =>
          s.stationName.toLowerCase().includes(search) ||
          s.lines.some(l => l.lineName.toLowerCase().includes(search))
        );
      }

      setFilteredStations(filtered);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [debouncedSearch, selectedRegion, stations]);

  const loadRecentAndFavoriteStations = () => {
    // mock data for now
    setRecentStations(mockRecentStations);
    setFavoriteStations(mockFavoriteStations);
  };

  // 최근/즐겨찾기 로드
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRecentAndFavoriteStations();
  }, []);

  const renderStation = ({ item }: { item: Station }) => (
    <TouchableOpacity
      style={styles.stationItem}
      onPress={() => onSelectStation(item)}
    >
      <View style={styles.stationInfo}>
        <View style={styles.linesContainer}>
          {item.lines.slice(0, 2).map((line, idx) => (
            <View key={idx} style={[styles.lineBadge, { backgroundColor: line.lineColor || getLineColor(line.lineName) }]}>
              <Text style={styles.lineText}>{line.lineName}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.stationName}>{item.stationName || item.name || '역 이름 없음'}</Text>
      </View>
      <Text style={styles.regionText}>{getRegionName(item.region || item.regionName || 'etc')}</Text>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>

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
              key={station.stationId}
              style={styles.stationItem}
              onPress={() => onSelectStation(station)}
            >
              <Text style={styles.stationName}>{station.stationName}</Text>
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
              key={station.stationId}
              style={styles.stationItem}
              onPress={() => onSelectStation(station)}
            >
              <Text style={styles.stationName}>{station.stationName}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 전체 목록 로딩 인디케이터 */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00BCD4" />
          <Text style={styles.loadingText}>역 목록 필터링 중...</Text>
        </View>
      )}
    </View>
  );

  const modalContent = (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {renderHeader()}

      {/* 필터링된 역 목록 */}
      {!isLoading && (
        <FlatList
          data={filteredStations}
          keyExtractor={item => item.stationId}
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
  );

  // 웹에서는 Modal 대신 absolute positioning 사용
  if (Platform.OS === 'web') {
    if (!visible) return null;

    return (
      <View style={styles.webModalOverlay}>
        <View style={styles.webModalContent}>
          <View style={[styles.container, { paddingTop: insets.top }]}>
            {renderHeader()}

            {/* 필터링된 역 목록 - 웹에서는 ScrollView 사용 */}
            {!isLoading && (
              <ScrollView style={styles.webScrollContainer} contentContainerStyle={styles.webScrollContent}>
                {filteredStations.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      {searchText ? '검색 결과가 없습니다' : '역이 없습니다'}
                    </Text>
                  </View>
                ) : (
                  filteredStations.map(station => renderStation({ item: station }))
                )}
              </ScrollView>
            )}

            {/* 닫기 버튼 */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // 네이티브에서는 Modal 사용
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      {modalContent}
    </Modal>
  );
};

export default OptimizedStationSelectModal;

// 모의 데이터 (Station type 맞춤)
const mockStations: Station[] = [
  {
    stationId: '1', stationName: '서울역', stationNameEnglish: 'Seoul', region: 'seoul',
    lines: [{ lineId: '1', lineName: '1호선', lineCode: '1', lineColor: '#1935C0', lineType: 'general' }],
    location: { latitude: 37.5546, longitude: 126.9706 }, isTransferStation: true, isExpressStop: true, isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true }, isActive: true, priority: 1, createdAt: new Date(), updatedAt: new Date()
  },
  {
    stationId: '2', stationName: '강남역', stationNameEnglish: 'Gangnam', region: 'seoul',
    lines: [{ lineId: '2', lineName: '2호선', lineCode: '2', lineColor: '#009944', lineType: 'general' }],
    location: { latitude: 37.4979, longitude: 127.0276 }, isTransferStation: true, isExpressStop: false, isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true }, isActive: true, priority: 1, createdAt: new Date(), updatedAt: new Date()
  }
];

const mockRecentStations: Station[] = [mockStations[0], mockStations[1]];
const mockFavoriteStations: Station[] = [mockStations[0]];

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
  linesContainer: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 8,
  },
  lineBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lineText: {
    fontSize: 10,
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
  },
  // 웹 전용 모달 스타일
  webModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webModalContent: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  webScrollContainer: {
    flex: 1,
  },
  webScrollContent: {
    paddingBottom: 80,
  }
});
