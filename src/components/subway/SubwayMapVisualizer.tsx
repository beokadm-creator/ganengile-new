/**
 * SubwayMapVisualizer Component
 * 지하철 노선도 시각화 (사용자 동선 표시)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Svg, Line, Circle, Text as SvgText } from 'react-native-svg';
import { Colors, Typography } from '../../theme';

interface Station {
  stationId: string;
  stationName: string;
  line: string;
  x: number;
  y: number;
}

interface SubwayMapProps {
  startStation?: Station;
  endStation?: Station;
  lines?: string[]; // 표시할 노선 (1~9호선)
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 노선별 색상
const LINE_COLORS = {
  '1': '#163382',   // 1호선 (진파랑)
  '2': '#00984C',   // 2호선 (초록)
  '3': '#FF6600',   // 3호선 (주황)
  '4': '#00A2D1',   // 4호선 (하늘)
  '5': '#8B50A2',   // 5호선 (보라)
  '6': '#C95018',   // 6호선 (갈색)
  '7': '#5F6072',   // 7호선 (올리브)
  '8': '#FF1A1A',   // 8호선 (빨강)
  '9': '#BDB092',   // 9호선 (연두)
};

export default function SubwayMapVisualizer({
  startStation,
  endStation,
  lines = ['1', '2', '3', '4'],
}: SubwayMapProps) {
  // 단순화된 노선도 좌표 (서울 지하철 중심부)
  // 실제로는 정확한 좌표 데이터 필요
  const generateLineStations = (lineNumber: string) => {
    const stations: { x: number; y: number }[] = [];
    
    switch (lineNumber) {
      case '1': // 서울역~청량리 (동서)
        for (let i = 0; i <= 10; i++) {
          stations.push({ x: 50 + i * 25, y: 150 });
        }
        break;
      case '2': // 시청~왕십리 (성북수도권남북)
        for (let i = 0; i <= 8; i++) {
          stations.push({ x: 150, y: 50 + i * 20 });
        }
        break;
      case '3': // 불광~오금 (동서)
        for (let i = 0; i <= 10; i++) {
          stations.push({ x: 50 + i * 20, y: 250 });
        }
        break;
      case '4': // 당고개~남태령 (동서)
        for (let i = 0; i <= 10; i++) {
          stations.push({ x: 50 + i * 18, y: 300 });
        }
        break;
      default:
        break;
    }
    
    return stations;
  };

  const renderLine = (lineNumber: string) => {
    const stations = generateLineStations(lineNumber);
    const color = LINE_COLORS[lineNumber as keyof typeof LINE_COLORS] || '#999';
    
    return (
      <Line
        key={lineNumber}
        x1={stations[0].x}
        y1={stations[0].y}
        x2={stations[stations.length - 1].x}
        y2={stations[stations.length - 1].y}
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
      />
    );
  };

  const renderStation = (station: Station, isStart = false, isEnd = false) => {
    const color = isStart || isEnd ? Colors.primary : Colors.white;
    const radius = isStart || isEnd ? 12 : 8;
    
    return (
      <Circle
        key={station.stationId}
        cx={station.x}
        cy={station.y}
        r={radius}
        fill={color}
        stroke={isStart || isEnd ? Colors.white : LINE_COLORS[station.line as keyof typeof LINE_COLORS]}
        strokeWidth={isStart || isEnd ? 3 : 2}
      />
    );
  };

  const renderStationLabel = (station: Station) => {
    return (
      <SvgText
        key={`label-${station.stationId}`}
        x={station.x}
        y={station.y - 20}
        fontSize={12}
        fill={Colors.text.primary}
        textAnchor="middle"
        fontWeight="bold"
      >
        {station.stationName}
      </SvgText>
    );
  };

  return (
    <View style={styles.container}>
      {/* Title */}
      <View style={styles.header}>
        <Text style={styles.title}>🗺️ 지하철 노선도</Text>
        {startStation && endStation && (
          <Text style={styles.subtitle}>
            {startStation.stationName} → {endStation.stationName}
          </Text>
        )}
      </View>

      {/* SVG Map */}
      <View style={styles.mapContainer}>
        <Svg
          width={SCREEN_WIDTH - 40}
          height={400}
          viewBox="0 0 400 400"
        >
          {/* Lines */}
          {lines.map((line) => renderLine(line))}

          {/* Stations (if provided) */}
          {startStation && renderStation(startStation, true, false)}
          {endStation && renderStation(endStation, false, true)}
          
          {/* Station Labels */}
          {startStation && renderStationLabel(startStation)}
          {endStation && renderStationLabel(endStation)}
        </Svg>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
          <Text style={styles.legendText}>선택 경로</Text>
        </View>
        {lines.slice(0, 4).map((line) => (
          <View key={line} style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: LINE_COLORS[line as keyof typeof LINE_COLORS] },
              ]}
            />
            <Text style={styles.legendText}>{line}호선</Text>
          </View>
        ))}
      </View>

      {/* Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          💡 실제 지하철 노선도는 환승역, 상세 경로를 반영합니다.
        </Text>
        <Text style={styles.infoText}>
          현재는 단순화된 뷰입니다.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  mapContainer: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  infoContainer: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 8,
    padding: 12,
  },
  infoText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginBottom: 4,
    lineHeight: 18,
  },
});
