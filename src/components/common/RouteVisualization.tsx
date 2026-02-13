import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle, Animated } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

interface Station {
  name: string;
  line: string;
  lineColor: string;
  estimatedTime?: number; // 분 단위
}

interface RouteVisualizationProps {
  stations: Station[];
  showTransferInfo?: boolean;
  showEstimatedTime?: boolean;
  style?: ViewStyle;
}

const LINE_COLORS: { [key: string]: string } = {
  '1호선': '#1C5C2E',
  '2호선': '#009D48',
  '3호선': '#FF7F27',
  '4호선': '#00A2D1',
  '5호선': '#8B50A4',
  '6호선': '#C9503C',
  '7호선': '#6E2219',
  '8호선': '#EA545D',
  '9호선': '#AA9872',
  '신분당선': '#D4003A',
  '경의중앙선': '#769142',
  '수도권전철': '#F5A200',
};

export default function RouteVisualization({
  stations,
  showTransferInfo = true,
  showEstimatedTime = true,
  style,
}: RouteVisualizationProps) {
  // 애니메이션 값 초기화
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const getLineColor = (line: string): string => {
    return LINE_COLORS[line] || Colors.gray500;
  };

  const isTransferStation = (index: number): boolean => {
    if (index === 0 || index === stations.length - 1) return false;
    const currentStation = stations[index];
    const prevStation = stations[index - 1];
    const nextStation = stations[index + 1];
    
    return (
      currentStation.line !== prevStation.line ||
      currentStation.line !== nextStation.line
    );
  };

  // 총 예상 시간 계산 (분)
  const totalEstimatedTime = useMemo(() => {
    if (!showEstimatedTime) return 0;
    return stations.reduce((sum, station) => sum + (station.estimatedTime || 0), 0);
  }, [stations, showEstimatedTime]);

  return (
    <Animated.View style={[styles.container, style, { opacity: fadeAnim }]}>
      {/* 총 예상 시간 헤더 */}
      {showEstimatedTime && totalEstimatedTime > 0 && (
        <View style={styles.header}>
          <Ionicons name="time-outline" size={20} color={Colors.primary} />
          <Text style={styles.headerTitle}>예상 소요 시간</Text>
          <View style={styles.timeBadge}>
            <Text style={styles.timeText}>{totalEstimatedTime}분</Text>
          </View>
        </View>
      )}

      <View style={styles.routeContainer}>
        {stations.map((station, index) => {
          const isTransfer = isTransferStation(index);
          const isLast = index === stations.length - 1;
          const lineColor = getLineColor(station.line);

          return (
            <View key={index} style={styles.stationContainer}>
              <View style={styles.stationInfo}>
                <View
                  style={[
                    styles.stationDot,
                    {
                      backgroundColor: lineColor,
                      borderColor: isTransfer ? Colors.accent : lineColor,
                      borderWidth: isTransfer ? 3 : 0,
                    },
                  ]}
                />
                {isTransfer && showTransferInfo && (
                  <View style={styles.transferBadge}>
                    <Text style={styles.transferText}>환승</Text>
                  </View>
                )}
              </View>
              <View style={styles.stationDetails}>
                <Text style={styles.stationName}>{station.name}</Text>
                <View style={styles.lineInfo}>
                  <View
                    style={[
                      styles.lineBadge,
                      { backgroundColor: lineColor },
                    ]}
                  >
                    <Text style={styles.lineText}>{station.line}</Text>
                  </View>
                  {showEstimatedTime && station.estimatedTime && (
                    <View style={styles.timeTag}>
                      <Ionicons name="time" size={12} color={Colors.gray500} />
                      <Text style={styles.timeTagText}>{station.estimatedTime}분</Text>
                    </View>
                  )}
                </View>
              </View>
              {!isLast && (
                <View style={styles.connector}>
                  <View
                    style={[
                      styles.connectorLine,
                      { backgroundColor: getLineColor(stations[index + 1].line) },
                    ]}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.primary}15`, // 15% opacity
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  headerTitle: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold as any,
    flex: 1,
  },
  timeBadge: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  timeText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold as any,
  },
  connector: {
    bottom: -20,
    left: 47,
    position: 'absolute',
    top: 20,
    width: 2,
    zIndex: 1,
  },
  connectorLine: {
    backgroundColor: Colors.gray300,
    height: '100%',
    width: 2,
  },
  lineBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  lineInfo: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  lineText: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium as any,
  },
  routeContainer: {
    gap: Spacing.sm,
  },
  stationContainer: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    position: 'relative',
  },
  stationDetails: {
    backgroundColor: Colors.white,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    flex: 1,
    paddingLeft: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  stationDot: {
    backgroundColor: Colors.gray500,
    borderRadius: 8,
    height: 16,
    width: 16,
    zIndex: 2,
  },
  stationInfo: {
    alignItems: 'center',
    paddingTop: 2,
    width: 40,
  },
  stationName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold as any,
    marginBottom: 4,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.gray50,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  timeTagText: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium as any,
  },
  transferBadge: {
    alignItems: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 8,
    minWidth: 32,
    paddingHorizontal: 4,
    paddingVertical: 2,
    position: 'absolute',
    right: -8,
    top: -8,
  },
  transferText: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold as any,
  },
});
