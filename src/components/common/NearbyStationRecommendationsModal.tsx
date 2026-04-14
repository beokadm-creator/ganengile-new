import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Colors, Spacing } from '../../theme';
import { Typography } from '../../theme/typography';
import type { Station } from '../../types/config';

export interface NearbyStationRecommendation {
  station: Station;
  distanceMeters: number;
}

interface NearbyStationRecommendationsModalProps {
  visible: boolean;
  title: string;
  description?: string;
  recommendations: NearbyStationRecommendation[];
  onClose: () => void;
  onSelectStation: (station: Station) => void;
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

export default function NearbyStationRecommendationsModal({
  visible,
  title,
  description,
  recommendations,
  onClose,
  onSelectStation,
}: NearbyStationRecommendationsModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>가까운 역 추천</Text>
              <Text style={styles.title}>{title}</Text>
              {description ? <Text style={styles.description}>{description}</Text> : null}
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {recommendations.map((item, index) => (
              <TouchableOpacity
                key={`${item.station.stationId}-${index}`}
                style={styles.stationItem}
                activeOpacity={0.86}
                onPress={() => onSelectStation(item.station)}
              >
                <View style={styles.stationMain}>
                  <View style={styles.lineRow}>
                    {item.station.lines.slice(0, 2).map((line, lineIndex) => (
                      <View
                        key={`${item.station.stationId}-${line.lineId}-${lineIndex}`}
                        style={[
                          styles.lineChip,
                          { backgroundColor: line.lineColor || getLineColor(lineIndex) },
                        ]}
                      >
                        <Text style={styles.lineChipText}>
                          {line.lineName || line.lineCode || line.lineId}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.stationName}>{item.station.stationName}</Text>
                  <Text style={styles.stationMeta}>{getLineLabel(item.station) || '노선 정보 없음'}</Text>
                </View>
                <View style={styles.distanceWrap}>
                  <Text style={styles.distanceText}>{Math.round(item.distanceMeters)}m</Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    maxHeight: '72%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 1,
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  description: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  stationItem: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
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
  distanceWrap: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  distanceText: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
  },
});
