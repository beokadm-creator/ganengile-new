import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme';

interface Station {
  name: string;
  line: string;
  lineColor: string;
}

interface RouteVisualizationProps {
  stations: Station[];
  showTransferInfo?: boolean;
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
  style,
}: RouteVisualizationProps) {
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

  return (
    <View style={[styles.container, style]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
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
  container: {
    paddingVertical: Spacing.md,
  },
  lineBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  lineInfo: {
    flexDirection: 'row',
    gap: Spacing.xs,
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
