/**
 * SubwayLineFilter Component
 * 지하철 호선 필터 컴포넌트
 */

import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Typography } from '../../theme';

interface Props {
  selectedLines: string[];
  onLineSelect: (line: string) => void;
  onClear?: () => void;
  lines?: string[];
}

const DEFAULT_LINES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function SubwayLineFilter({
  selectedLines,
  onLineSelect,
  onClear,
  lines = DEFAULT_LINES,
}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* 전체 버튼 */}
      <TouchableOpacity
        style={[
          styles.lineButton,
          selectedLines.length === 0 && styles.lineButtonActive,
        ]}
        onPress={onClear || (() => onLineSelect(''))}
      >
        <Text
          style={[
            styles.lineButtonText,
            selectedLines.length === 0 && styles.lineButtonTextActive,
          ]}
        >
          전체
        </Text>
      </TouchableOpacity>

      {/* 호선 버튼들 */}
      {lines.map((line) => {
        const isSelected = selectedLines.includes(line);
        return (
          <TouchableOpacity
            key={line}
            style={[
              styles.lineButton,
              isSelected && styles.lineButtonActive,
            ]}
            onPress={() => onLineSelect(line)}
          >
            <Text
              style={[
                styles.lineButtonText,
                isSelected && styles.lineButtonTextActive,
              ]}
            >
              {line}호선
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomColor: '#E0E0E0',
    borderBottomWidth: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lineButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  lineButtonActive: {
    backgroundColor: '#00BCD4',
    borderColor: '#00BCD4',
  },
  lineButtonText: {
    color: '#333',
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  lineButtonTextActive: {
    color: '#fff',
  },
});
