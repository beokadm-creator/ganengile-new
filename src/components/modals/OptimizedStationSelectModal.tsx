/**
 * Optimized Station Select Modal
 * 개선된 역 선택 모달 - 최근 사용, 인기 역, 초성 검색, 호선 필터링
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';
import type { Station } from '../../types/config';

interface StationSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onStationSelect: (station: Station) => void;
  title: string;
  stations: Station[];
  searchPlaceholder?: string;
}

// 초성 분리 함수
const disassembleHangul = (text: string): string => {
  const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  let result = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);
    
    // 한글 범위: 가(0xAC00) ~ 힣(0xD7A3)
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const choseongIndex = Math.floor((code - 0xAC00) / 588);
      result += CHOSEONG[choseongIndex] || '';
    } else {
      result += char;
    }
  }
  
  return result;
};

// 인기 역 목록 (수정 가능)
const POPULAR_STATIONS = [
  '서울역', '역삼역', '강남역', '홍대입구역', '신촌역',
  '사당역', '잠실역', '고속터미널역', '서울대입구역', '건대입구역'
];

export default function OptimizedStationSelectModal({
  visible,
  onClose,
  onStationSelect,
  title,
  stations,
  searchPlaceholder = '역 이름 또는 초성 검색...',
}: StationSelectModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLine, setSelectedLine] = useState<string | null>(null);

  // 고유 호선 목록 추출
  const uniqueLines = useMemo(() => {
    const lineSet = new Set<string>();
    stations.forEach((station) => {
      station.lines.forEach((line) => {
        lineSet.add(line.lineId);
      });
    });
    return Array.from(lineSet).sort();
  }, [stations]);

  // 검색 필터링
  const filteredStations = useMemo(() => {
    let results = stations;

    // 호선 필터링
    if (selectedLine) {
      results = results.filter((station) =>
        station.lines.some((line) => line.lineId === selectedLine)
      );
    }

    // 검색어 필터링
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter((station) => {
        const name = station.stationName.toLowerCase();
        const chosung = disassembleHangul(station.stationName).toLowerCase();

        return name.includes(query) || chosung.includes(query);
      });
    }

    return results;
  }, [stations, searchQuery, selectedLine]);

  // 최근 사용한 역 (실제로는 AsyncStorage에서 불러와야 함)
  const recentStations = useMemo((): Station[] => {
    return [];
  }, []);

  // 인기 역 필터링
  const popularStations = useMemo(() => {
    return stations.filter((station) =>
      POPULAR_STATIONS.includes(station.stationName)
    );
  }, [stations]);

  const handleSelect = (station: Station) => {
    onStationSelect(station);
    setSearchQuery('');
    setSelectedLine(null);
    onClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedLine(null);
    onClose();
  };

  const handleLinePress = (lineId: string | null) => {
    setSelectedLine(lineId);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        {/* 헤더 */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* 검색 입력 */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={20} color={Colors.gray400} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor={Colors.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={Colors.gray400} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.searchHint}>초성 검색 지원 (예: ㅎㄷㅂ → 홍대입구)</Text>
        </View>

        {/* 호선 필터 */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.lineFilterContainer}
          contentContainerStyle={styles.lineFilterContent}
        >
          <TouchableOpacity
            style={[
              styles.lineFilterButton,
              selectedLine === null && styles.lineFilterButtonActive,
            ]}
            onPress={() => handleLinePress(null)}
          >
            <Text
              style={[
                styles.lineFilterText,
                selectedLine === null && styles.lineFilterTextActive,
              ]}
            >
              전체
            </Text>
          </TouchableOpacity>

          {uniqueLines.map((lineId) => (
            <TouchableOpacity
              key={lineId}
              style={[
                styles.lineFilterButton,
                selectedLine === lineId && styles.lineFilterButtonActive,
              ]}
              onPress={() => handleLinePress(lineId)}
            >
              <Text
                style={[
                  styles.lineFilterText,
                  selectedLine === lineId && styles.lineFilterTextActive,
                ]}
              >
                {lineId}호선
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={styles.modalContent}>
          {/* 추천 섹션 (검색어 없을 때만) */}
          {searchQuery.length === 0 && selectedLine === null && (
            <>
              {/* 최근 사용한 역 */}
              {recentStations.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>최근 사용한 역</Text>
                  {recentStations.map((station) => (
                    <TouchableOpacity
                      key={station.stationId}
                      style={styles.stationItem}
                      onPress={() => handleSelect(station)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.stationItemLeft}>
                        <Text style={styles.stationItemName}>{station.stationName}</Text>
                        <Text style={styles.stationItemLine}>
                          {station.lines.map((l) => l.lineName).join(', ')}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* 인기 역 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>인기 역</Text>
                {popularStations.map((station) => (
                  <TouchableOpacity
                    key={station.stationId}
                    style={styles.stationItem}
                    onPress={() => handleSelect(station)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.stationItemLeft}>
                      <Text style={styles.stationItemName}>{station.stationName}</Text>
                      <Text style={styles.stationItemLine}>
                        {station.lines.map((l) => l.lineName).join(', ')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* 검색 결과 또는 전체 목록 */}
          {searchQuery.length > 0 || selectedLine !== null ? (
            <>
              {filteredStations.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color={Colors.gray300} />
                  <Text style={styles.emptyText}>
                    '{searchQuery}'에 대한 검색 결과가 없습니다.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.resultCount}>
                    {filteredStations.length}개의 역
                  </Text>
                  {filteredStations.map((station) => (
                    <TouchableOpacity
                      key={station.stationId}
                      style={styles.stationItem}
                      onPress={() => handleSelect(station)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.stationItemLeft}>
                        <Text style={styles.stationItemName}>{station.stationName}</Text>
                        <Text style={styles.stationItemLine}>
                          {station.lines.map((l) => l.lineName).join(', ')}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: Colors.white,
    flex: 1,
  },
  modalHeader: {
    alignItems: 'center',
    borderBottomColor: Colors.gray200,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingTop: 60,
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    flex: 1,
  },
  searchContainer: {
    borderBottomColor: Colors.gray200,
    borderBottomWidth: 1,
    padding: Spacing.md,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    backgroundColor: 'transparent',
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    paddingVertical: 0,
    flex: 1,
  },
  searchHint: {
    color: Colors.gray400,
    fontSize: Typography.fontSize.xs,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  lineFilterContainer: {
    minHeight: 32,
    backgroundColor: Colors.white,
    borderBottomColor: Colors.gray200,
    borderBottomWidth: 1,
  },
  lineFilterContent: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 0,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  lineFilterButton: {
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginRight: 4,
    minHeight: 24,
    flexShrink: 0,
  },
  lineFilterButtonActive: {
    backgroundColor: Colors.primary,
  },
  lineFilterText: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  lineFilterTextActive: {
    color: Colors.white,
  },
  modalContent: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  resultCount: {
    color: Colors.gray500,
    fontSize: Typography.fontSize.xs,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  stationItem: {
    alignItems: 'center',
    borderBottomColor: Colors.gray100,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  stationItemLeft: {
    flex: 1,
  },
  stationItemName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: Spacing.xs,
  },
  stationItemLine: {
    color: Colors.gray500,
    fontSize: Typography.fontSize.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
  },
  emptyText: {
    color: Colors.gray500,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
});
