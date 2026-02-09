/**
 * Station Select Modal Component
 * 역 선택 모달 컴포넌트
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
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

export default function StationSelectModal({
  visible,
  onClose,
  onStationSelect,
  title,
  stations,
  searchPlaceholder = '역 이름 검색...',
}: StationSelectModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStations = stations.filter((station) =>
    station.stationName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (station: Station) => {
    onStationSelect(station);
    setSearchQuery('');
    onClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor={Colors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>

        {searchQuery.length > 0 && filteredStations.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              '{searchQuery}'에 대한 검색 결과가 없습니다.
            </Text>
          </View>
        )}

        <ScrollView style={styles.modalContent}>
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
              <Text style={styles.stationItemArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filteredStations.length > 0 && (
          <View style={styles.resultCountContainer}>
            <Text style={styles.resultCountText}>
              {filteredStations.length}개의 역
            </Text>
          </View>
        )}
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
    padding: Spacing.md,
    paddingTop: 60,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
  },
  modalClose: {
    color: Colors.gray600,
    fontSize: 24,
    paddingHorizontal: Spacing.sm,
  },
  searchContainer: {
    borderBottomColor: Colors.gray200,
    borderBottomWidth: 1,
    padding: Spacing.md,
  },
  searchInput: {
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.sm,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    padding: Spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    color: Colors.gray500,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
  },
  stationItem: {
    alignItems: 'center',
    borderBottomColor: Colors.gray100,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
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
  stationItemArrow: {
    color: Colors.gray400,
    fontSize: 24,
    fontWeight: '300',
  },
  resultCountContainer: {
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderTopColor: Colors.gray200,
    borderTopWidth: 1,
    padding: Spacing.sm,
  },
  resultCountText: {
    color: Colors.gray500,
    fontSize: Typography.fontSize.xs,
  },
});
