/**
 * Station Select Modal
 * 지하철 역 선택 Modal 컴포넌트
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  FlatList,
} from 'react-native';
import { getAllStations } from '../services/config-service';

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

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectStation: (station: Station) => void;
  title?: string;
  mode?: 'start' | 'end'; // 출발역/도착역 모드
}

export default function StationSelectModal({
  visible,
  onClose,
  onSelectStation,
  title = '역 선택',
  mode: _mode = 'start',
}: Props) {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLines, setSelectedLines] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      loadStations();
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

  // Filter stations
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
    new Set(stations.flatMap((s) => s.lines?.map((l) => l.lineId) || []))
  ).sort();

  const toggleLineFilter = (lineId: string) => {
    setSelectedLines((prev) =>
      prev.includes(lineId)
        ? prev.filter((id) => id !== lineId)
        : [...prev, lineId]
    );
  };

  const handleSelectStation = (station: Station) => {
    onSelectStation(station);
    onClose();
  };

  const renderStation = ({ item }: { item: Station }) => (
    <TouchableOpacity
      style={styles.stationCard}
      onPress={() => handleSelectStation(item)}
    >
      <View style={styles.stationHeader}>
        <Text style={styles.stationName}>{item.stationName}</Text>
        {item.isTransferStation && (
          <View style={styles.transferBadge}>
            <Text style={styles.transferBadgeText}>환승</Text>
          </View>
        )}
      </View>

      <View style={styles.stationLines}>
        {item.lines?.map((line) => (
          <View
            key={line.lineId}
            style={[
              styles.lineBadge,
              { backgroundColor: line.lineColor || '#999' },
            ]}
          >
            <Text style={styles.lineBadgeText}>{line.lineName}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.stationNameEnglish}>{item.stationNameEnglish}</Text>
    </TouchableOpacity>
  );

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

          {/* Line Filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.lineFiltersContainer}
          >
            {allLines.map((lineId) => {
              const line = stations
                .flatMap((s) => s.lines || [])
                .find((l) => l.lineId === lineId);

              const isSelected = selectedLines.includes(lineId);

              return (
                <TouchableOpacity
                  key={lineId}
                  style={[
                    styles.lineFilterButton,
                    isSelected && {
                      backgroundColor: line?.lineColor || '#999',
                      borderColor: line?.lineColor || '#999',
                    },
                  ]}
                  onPress={() => toggleLineFilter(lineId)}
                >
                  <Text
                    style={[
                      styles.lineFilterButtonText,
                      isSelected && styles.lineFilterButtonTextSelected,
                    ]}
                  >
                    {line?.lineName || lineId}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Station List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>역 정보 불러오는 중...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredStations}
            renderItem={renderStation}
            keyExtractor={(item) => item.stationId}
            contentContainerStyle={styles.stationList}
            ListEmptyComponent={
              <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery || selectedLines.length > 0
                    ? '검색 결과가 없습니다'
                    : '역 정보가 없습니다'}
                </Text>
              </View>
            }
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
  lineBadge: {
    borderRadius: 4,
    marginBottom: 4,
    marginRight: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  lineBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  lineFilterButton: {
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  lineFilterButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  lineFilterButtonTextSelected: {
    color: '#fff',
  },
  lineFiltersContainer: {
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
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
  stationLines: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  stationList: {
    padding: 16,
  },
  stationName: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
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
