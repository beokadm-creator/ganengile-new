import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Colors, Spacing, Typography } from '../../theme';
import type { Station } from '../../types/config';

interface StationSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onStationSelect: (station: Station) => void;
  title: string;
  stations: Station[];
  searchPlaceholder?: string;
}

function getLineColor(index: number) {
  const palette = ['#1D4ED8', '#059669', '#EA580C', '#7C3AED', '#DC2626', '#0891B2'];
  return palette[index % palette.length];
}

function getLineLabel(station: Station) {
  return station.lines
    .slice(0, 2)
    .map((line) => line.lineName || line.lineCode || line.lineId)
    .filter(Boolean)
    .join(' · ');
}

export default function StationSelectModal({
  visible,
  onClose,
  onStationSelect,
  title,
  stations,
  searchPlaceholder = '역 이름으로 검색',
}: StationSelectModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStations = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return stations;
    }

    return stations.filter((station) => {
      const name = station.stationName.toLowerCase();
      const line = getLineLabel(station).toLowerCase();
      return name.includes(keyword) || line.includes(keyword);
    });
  }, [searchQuery, stations]);

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  const handleSelect = (station: Station) => {
    onStationSelect(station);
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerEyebrow}>가는길에</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={handleClose}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Colors.gray400} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={Colors.gray400}
            autoFocus
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.gray400} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {filteredStations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>검색 결과가 없습니다</Text>
              <Text style={styles.emptyBody}>다른 역 이름으로 다시 검색해 주세요.</Text>
            </View>
          ) : (
            filteredStations.map((station) => (
              <TouchableOpacity
                key={station.stationId}
                style={styles.stationItem}
                activeOpacity={0.86}
                onPress={() => handleSelect(station)}
              >
                <View style={styles.stationMain}>
                  <View style={styles.lineRow}>
                    {station.lines.slice(0, 2).map((line, index) => (
                      <View
                        key={`${station.stationId}-${line.lineId}-${index}`}
                        style={[styles.lineChip, { backgroundColor: line.lineColor || getLineColor(index) }]}
                      >
                        <Text style={styles.lineChipText}>{line.lineName || line.lineCode || line.lineId}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.stationName}>{station.stationName}</Text>
                  <Text style={styles.stationMeta}>{getLineLabel(station) || '노선 정보 없음'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 20,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerEyebrow: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 1,
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 6,
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    ...Typography.body,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
    gap: Spacing.sm,
  },
  emptyState: {
    marginTop: Spacing['4xl'],
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  emptyBody: {
    color: Colors.textTertiary,
    ...Typography.body,
  },
  stationItem: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stationMain: {
    flex: 1,
    gap: 6,
  },
  lineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  lineChip: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lineChipText: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  stationName: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  stationMeta: {
    color: Colors.textTertiary,
    ...Typography.bodySmall,
  },
});
