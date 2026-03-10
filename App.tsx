/**
 * App Entry Point
 */

import React from 'react';
import { ActivityIndicator, View, Platform, StyleSheet, Dimensions } from 'react-native';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
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

  // PC 웹 - NavigationContainer 전체를 iPhone 프레임 안에 넣기
  const appContent = <AppNavigator />;

  return (
    <View style={styles.desktopContainer}>
      {/* 왼쪽 소개 영역 */}
      <View style={styles.introSection}>
        <View style={styles.titleContainer}>
          가는길에
        </View>
        <View style={styles.subtitle}>
          지하철 크라우드 배송 플랫폼
        </View>

        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <View style={styles.featureEmoji}>🚇</View>
            <View style={styles.featureTexts}>
              <View style={styles.featureTitle}>지하철 출퇴근길에</View>
              <View style={styles.featureDesc}>추가 수익 창출</View>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureEmoji}>📦</View>
            <View style={styles.featureTexts}>
              <View style={styles.featureTitle}>같이 가는 길에</View>
              <View style={styles.featureDesc}>배송 의뢰</View>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureEmoji}>⚡</View>
            <View style={styles.featureTexts}>
              <View style={styles.featureTitle}>오늘 받아볼 수 있는</View>
              <View style={styles.featureDesc}>빠른 배송</View>
            </View>
          </View>
        </View>

        <View style={styles.priceBox}>
          <View style={styles.priceTitle}>💰 배송비</View>
          <View style={styles.priceValue}>5,300원부터</View>
          <View style={styles.priceDesc}>소형, 1kg, 5개역 기준</View>
        </View>
      </View>

      {/* iPhone 프레임 - 안에 AppNavigator 전체가 들어감 */}
      <View style={styles.iphoneFrame}>
        <View style={styles.notch} />
        <View style={styles.screenContent}>
          {appContent}
        </View>
        <View style={styles.homeIndicator} />
      </View>

      {/* 오른쪽 설명 영역 */}
      <View style={styles.infoSection}>
        <View style={styles.infoTitle}>서비스 특징</View>

        <View style={styles.infoCard}>
          <View style={styles.infoCardTitle}>🎯 누구나 길러가 될 수 있습니다</View>
          <View style={styles.infoCardText}>
            • 출퇴근길에 배송하며 추가 수익 창출 {'\n'}
            • 1회 왕복: 4,500원 × 20일 = 90,000원/월 {'\n'}
            • 자유로운 시간에 참여 가능
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoCardTitle}>⏰ 오늘 받아보세요</View>
          <View style={styles.infoCardText}>
            • 지하철 to 지하철 배송 (1단계) {'\n'}
            • 긴급: 1-2시간, 일반: 2-3시간 {'\n'}
            • 실시간 경매 시스템
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoCardTitle}>💸 합리적인 가격</View>
          <View style={styles.infoCardText}>
            • 기본요금: 3,500원 {'\n'}
            • 역 개수 기반 거리료 {'\n'}
            • 서비스 수수료 15% 포함
          </View>
        </View>
      </View>
    </View>
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
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
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
  iphoneFrame: {
    width: 474,
    height: 956,
    backgroundColor: '#000000',
    borderRadius: 55,
    borderWidth: 14,
    borderColor: '#2c2c2c',
    shadowColor: '#00BCD4',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 60,
    position: 'relative',
    overflow: 'hidden',
  },
  notch: {
    position: 'absolute',
    top: 14,
    left: '50%',
    marginLeft: -65,
    width: 130,
    height: 38,
    backgroundColor: '#000000',
    borderRadius: 22,
    zIndex: 10,
  },
  screenContent: {
    flex: 1,
    marginTop: 14,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden', // 화면 밖으로 나가는 컨텐츠 숨기기
    position: 'relative',
  },
  homeIndicator: {
    position: 'absolute',
    bottom: 10,
    left: '50%',
    marginLeft: -75,
    width: 150,
    height: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    zIndex: 10,
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
