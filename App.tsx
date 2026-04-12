/**
 * App Entry Point
 */

import React from 'react';
import { ActivityIndicator, View, Platform, StyleSheet, Dimensions, Text } from 'react-native';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AppNavigator from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import * as Sentry from '@sentry/react-native';

// Sentry 초기화 (DSN은 추후 환경변수 등으로 주입)
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  debug: __DEV__, // 개발 모드일 때만 디버그 활성화
  tracesSampleRate: 1.0,
});

function AppContent() {
  // 웹 환경에서는 폰트 로딩을 무시하고 바로 렌더링
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
  });

  // 웹에서는 항상 렌더링, 네이티브에서는 폰트 로딩 대기
  if (!fontsLoaded && Platform.OS !== 'web') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  // 네이티브에서는 그냥 렌더링
  if (Platform.OS !== 'web') {
    return <AppNavigator />;
  }

  // 웹에서는 화면 너비 확인
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = screenWidth >= 768;

  if (!isDesktop) {
    // 모바일 웹에서는 그냥 렌더링
    return <AppNavigator />;
  }

  // PC 웹 - 모바일 미리보기 레이아웃 (노치 없는 풀스크린 목업)
  const appContent = <AppNavigator />;

  return (
    <View style={styles.desktopContainer}>
      {/* 왼쪽 소개 영역 */}
      <View style={styles.introSection}>
        <Text style={styles.titleContainer}>
          가는길에
        </Text>
        <Text style={styles.subtitle}>
          지하철 크라우드 배송 플랫폼
        </Text>

        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <Text style={styles.featureEmoji}>🚇</Text>
            <View style={styles.featureTexts}>
              <Text style={styles.featureTitle}>지하철 출퇴근길에</Text>
              <Text style={styles.featureDesc}>추가 수익 창출</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureEmoji}>📦</Text>
            <View style={styles.featureTexts}>
              <Text style={styles.featureTitle}>같이 가는 길에</Text>
              <Text style={styles.featureDesc}>배송 의뢰</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureEmoji}>⚡</Text>
            <View style={styles.featureTexts}>
              <Text style={styles.featureTitle}>오늘 받아볼 수 있는</Text>
              <Text style={styles.featureDesc}>빠른 배송</Text>
            </View>
          </View>
        </View>

        <View style={styles.priceBox}>
          <Text style={styles.priceTitle}>💰 배송비</Text>
          <Text style={styles.priceValue}>5,300원부터</Text>
          <Text style={styles.priceDesc}>소형, 1kg, 5개역 기준</Text>
        </View>
      </View>

      {/* 모바일 미리보기 프레임 */}
      <View style={styles.previewFrame}>
        <View style={styles.screenContent}>
          {appContent}
        </View>
      </View>

      {/* 오른쪽 설명 영역 */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>서비스 특징</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>🎯 누구나 길러가 될 수 있습니다</Text>
          <Text style={styles.infoCardText}>
            • 출퇴근길에 배송하며 추가 수익 창출 {'\n'}
            • 1회 왕복: 4,500원 × 20일 = 90,000원/월 {'\n'}
            • 자유로운 시간에 참여 가능
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>⏰ 오늘 받아보세요</Text>
          <Text style={styles.infoCardText}>
            • 지하철 to 지하철 배송 (1단계) {'\n'}
            • 긴급: 1-2시간, 일반: 2-3시간 {'\n'}
            • 실시간 경매 시스템
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>💸 합리적인 가격</Text>
          <Text style={styles.infoCardText}>
            • 기본요금: 3,500원 {'\n'}
            • 역 개수 기반 거리료 {'\n'}
            • 서비스 수수료 15% 포함
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopContainer: {
    width: '100%',
    minHeight: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 40,
    gap: 60,
    backgroundColor: '#0f0f23',
  },
  introSection: {
    width: 300,
    alignItems: 'flex-start',
  },
  titleContainer: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    color: '#00BCD4',
    marginBottom: 32,
  },
  featuresContainer: {
    gap: 24,
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  featureEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  featureTexts: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 14,
    color: '#B0BEC5',
  },
  priceBox: {
    backgroundColor: 'rgba(0, 188, 212, 0.1)',
    borderWidth: 2,
    borderColor: '#00BCD4',
    borderRadius: 16,
    padding: 20,
  },
  priceTitle: {
    fontSize: 16,
    color: '#00BCD4',
    marginBottom: 8,
    fontWeight: '600',
  },
  priceValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  priceDesc: {
    fontSize: 12,
    color: '#B0BEC5',
  },
  previewFrame: {
    width: 460,
    height: 920,
    backgroundColor: '#111827',
    borderRadius: 34,
    borderWidth: 8,
    borderColor: '#1f2937',
    shadowColor: '#00BCD4',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 30,
    position: 'relative',
    overflow: 'hidden',
  },
  screenContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    paddingBottom: 10,
  },
  infoSection: {
    width: 350,
    gap: 24,
  },
  infoTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
  },
  infoCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#00BCD4',
    marginBottom: 12,
  },
  infoCardText: {
    fontSize: 14,
    color: '#E0E0E0',
    lineHeight: 22,
  },
});
