/**
 * Route Management Screen (동선 관리)
 * 지하철 역 목록 및 동선 관리 화면
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { getAllStations } from '../../services/config-service';

interface Station {
  stationId: string;
  stationName: string;
  stationNameEnglish: string;
  lines: Array<{
    lineId: string;
    lineName: string;
    lineCode: string;
    lineColor: string;
  }>;
  isTransferStation: boolean;
}

export default function RouteManagementScreen({ navigation }: any) {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLines, setSelectedLines] = useState<string[]>([]);

  useEffect(() => {
    loadStations();
  }, []);

  const loadStations = async () => {
    try {
      setLoading(true);
      setError(null);

      const stationData = await getAllStations();
      console.log('🚉 Stations loaded:', stationData.length);

      setStations(stationData);
    } catch (err: any) {
      console.error('Error loading stations:', err);
      setError(err.message || '역 정보를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  // Filter stations by search query and selected lines
  const filteredStations = stations.filter((station) => {
    const matchesSearch =
      searchQuery === '' ||
      station.stationName.includes(searchQuery) ||
      station.stationNameEnglish.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLine =
      selectedLines.length === 0 ||
      station.lines?.some((line) => selectedLines.includes(line.lineId));

    return matchesSearch && matchesLine;
  });

  // Get all unique lines
  const allLines = Array.from(
    new Set(
      stations.flatMap((s) => s.lines?.map((l) => l.lineId) || [])
    )
  );

  const toggleLineFilter = (lineId: string) => {
    setSelectedLines((prev) =>
      prev.includes(lineId)
        ? prev.filter((id) => id !== lineId)
        : [...prev, lineId]
    );
  };

  const renderStation = ({ item }: { item: Station }) => (
    <TouchableOpacity
      style={styles.stationCard}
      onPress={() => {
        // TODO: Navigate to station detail or add to route
        console.log('Selected station:', item.stationName);
      }}
    >
      <View style={styles.stationHeader}>
        <Text style={styles.stationName}>{item.stationName}</Text>
        {item.isTransferStation && (
          <View style={styles.transferBadge}>
            <Text style={styles.transferText}>환승</Text>
          </View>
        )}
      </View>

      <View style={styles.linesContainer}>
        {item.lines?.map((line) => (
          <View
            key={line.lineId}
            style={[
              styles.lineBadge,
              { backgroundColor: line.lineColor || '#999' },
            ]}
          >
            <Text style={styles.lineText}>{line.lineName}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.stationNameEnglish}>
        {item.stationNameEnglish}
      </Text>
    </TouchableOpacity>
  );

  const renderLineFilter = ({ item }: { item: string }) => {
    const line = stations
      .flatMap((s) => s.lines || [])
      .find((l) => l.lineId === item);

    const isSelected = selectedLines.includes(item);

    return (
      <TouchableOpacity
        style={[
          styles.lineFilterButton,
          isSelected && styles.lineFilterButtonSelected,
          { backgroundColor: isSelected ? line?.lineColor : '#f0f0f0' },
        ]}
        onPress={() => toggleLineFilter(item)}
      >
        <Text
          style={[
            styles.lineFilterText,
            isSelected && styles.lineFilterTextSelected,
          ]}
        >
          {line?.lineName || item}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>동선 관리</Text>
        <Text style={styles.subtitle}>
          자주 타는 경로를 등록하고 매칭받으세요
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="역 이름 검색..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>

      {/* Line Filters */}
      <View style={styles.filtersContainer}>
        <Text style={styles.filterTitle}>호선별 필터</Text>
        <FlatList
          horizontal
          data={allLines}
          renderItem={renderLineFilter}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          style={styles.lineFiltersList}
          contentContainerStyle={styles.lineFiltersContent}
        />
      </View>

      {/* Station List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>역 정보 불러오는 중...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadStations}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredStations}
          renderItem={renderStation}
          keyExtractor={(item) => item.stationId}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>
                {searchQuery || selectedLines.length > 0
                  ? '검색 결과가 없습니다'
                  : '표시할 역이 없습니다'}
              </Text>
            </View>
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                총 {filteredStations.length}개 역
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  filterTitle: {
    color: '#666',
    fontSize: 14,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
  },
  header: {
    backgroundColor: '#4CAF50',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 20,
    paddingTop: 60,
  },
  lineBadge: {
    borderRadius: 4,
    marginBottom: 4,
    marginRight: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lineFilterButton: {
    borderColor: '#e0e0e0',
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  lineFilterButtonSelected: {
    borderColor: '#4CAF50',
  },
  lineFilterText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  lineFilterTextSelected: {
    color: '#fff',
  },
  lineFiltersContent: {
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  lineFiltersList: {
    marginTop: 8,
  },
  lineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  linesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  listContent: {
    padding: 16,
  },
  listHeader: {
    marginBottom: 12,
  },
  listHeaderText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchContainer: {
    backgroundColor: '#fff',
    padding: 16,
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    padding: 12,
  },
  stationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 3,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  stationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stationName: {
    color: '#333',
    fontSize: 20,
    fontWeight: 'bold',
  },
  stationNameEnglish: {
    color: '#999',
    fontSize: 14,
  },
  subtitle: {
    color: '#fff',
    fontSize: 16,
    marginTop: 4,
    opacity: 0.9,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  transferBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  transferText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
