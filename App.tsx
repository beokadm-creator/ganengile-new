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
  debug: __DEV__,
  tracesSampleRate: 1.0,
});

// ── 색상 팔레트 (브랜드 다크 모드) ─────────────────────────────
const D = {
  bg:          '#0A1C1A',   // 앱 배경과 동일한 틸 계열 다크
  surface:     '#132520',   // 카드 배경
  surfaceAlt:  '#1B3330',   // 강조 배경
  border:      'rgba(15, 118, 110, 0.22)',
  accent:      '#0F766E',   // 브랜드 틸 (CTA·강조)
  accentMint:  '#D7F2EC',   // 민트 (포인트 텍스트)
  textPrimary: '#EBF7F5',   // 메인 텍스트
  textSub:     '#7DADA7',   // 보조 텍스트
  phoneBorder: '#1E3530',   // 폰 프레임 테두리
};

// ── 피처 행 ─────────────────────────────────────────────────────
interface FeatureRowProps {
  label: string;
  desc: string;
}
function FeatureRow({ label, desc }: FeatureRowProps) {
  return (
    <View style={landingStyles.featureRow}>
      <View style={landingStyles.featureDot} />
      <View style={landingStyles.featureTexts}>
        <Text style={landingStyles.featureLabel}>{label}</Text>
        <Text style={landingStyles.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

// ── AI 카드 ──────────────────────────────────────────────────────
interface AiCardProps {
  title: string;
  body: string;
  index: number;
}
function AiCard({ title, body, index }: AiCardProps) {
  return (
    <View style={landingStyles.aiCard}>
      <View style={landingStyles.aiCardAccent} />
      <View style={landingStyles.aiCardInner}>
        <Text style={landingStyles.aiCardIndex}>{String(index).padStart(2, '0')}</Text>
        <Text style={landingStyles.aiCardTitle}>{title}</Text>
        <Text style={landingStyles.aiCardBody}>{body}</Text>
      </View>
    </View>
  );
}

// ── PC 랜딩 ─────────────────────────────────────────────────────
function DesktopLanding({ appContent }: { appContent: React.ReactNode }) {
  return (
    <View style={landingStyles.container}>

      {/* ── 왼쪽: 서비스 소개 ── */}
      <View style={landingStyles.leftPanel}>

        <View style={landingStyles.brandRow}>
          <View style={landingStyles.brandDot} />
          <Text style={landingStyles.brandTag}>AI-POWERED DELIVERY</Text>
        </View>

        <Text style={landingStyles.heading}>가는길에</Text>
        <Text style={landingStyles.subheading}>
          AI가 연결하는{'\n'}도시 크라우드 배송
        </Text>

        <Text style={landingStyles.leadText}>
          출퇴근 경로를 분석해 최적 미션을 자동 배정합니다.
          AI 오케스트레이션이 요청자와 길러를 실시간으로 매칭합니다.
        </Text>

        <View style={landingStyles.featureList}>
          <FeatureRow
            label="경로 기반 자동 매칭"
            desc="내 출퇴근 동선과 소포 목적지를 AI가 분석해 최적 미션을 추천합니다."
          />
          <FeatureRow
            label="스마트 미션 번들링"
            desc="같은 방향의 소포를 묶어 한 번 이동으로 더 많은 수익을 얻을 수 있습니다."
          />
          <FeatureRow
            label="실시간 수요 예측"
            desc="지하철 혼잡도와 시간대별 수요를 분석해 적시에 미션을 제안합니다."
          />
        </View>

        <View style={landingStyles.highlightBox}>
          <Text style={landingStyles.highlightLabel}>AI 오케스트레이션 엔진</Text>
          <Text style={landingStyles.highlightBody}>
            경로 데이터 · 수요 예측 · 미션 배정을{'\n'}실시간으로 처리합니다
          </Text>
        </View>
      </View>

      {/* ── 중앙: 폰 목업 ── */}
      <View style={landingStyles.phoneWrap}>
        {/* 반사 광원 */}
        <View style={landingStyles.phoneGlow} />
        <View style={landingStyles.phoneFrame}>
          {/* 상단 상태바 구분선 */}
          <View style={landingStyles.statusBar} />
          <View style={landingStyles.phoneScreen}>
            {appContent}
          </View>
          {/* 하단 홈 바 */}
          <View style={landingStyles.homeBar}>
            <View style={landingStyles.homeBarPill} />
          </View>
        </View>
        {/* 하단 반사 */}
        <View style={landingStyles.phoneReflection} />
      </View>

      {/* ── 오른쪽: AI 오케스트레이션 ── */}
      <View style={landingStyles.rightPanel}>

        <Text style={landingStyles.rightHeading}>AI 오케스트레이션</Text>
        <Text style={landingStyles.rightSub}>
          단순 연결을 넘어, 지능형 배송 시스템이
          매 미션을 최적화합니다.
        </Text>

        <View style={landingStyles.aiCardList}>
          <AiCard
            index={1}
            title="경로 분석 & 미션 매칭"
            body="출발역·도착역·경유 경로를 분석해 가장 효율적인 미션을 자동 배정합니다."
          />
          <AiCard
            index={2}
            title="동적 보상 계산"
            body="거리·시간대·수요를 실시간으로 반영해 공정한 보상을 즉시 산출합니다."
          />
          <AiCard
            index={3}
            title="멀티 소포 최적화"
            body="복수 소포를 단일 경로로 묶어 길러의 이동 효율과 수익을 동시에 극대화합니다."
          />
        </View>

        <View style={landingStyles.footerNote}>
          <Text style={landingStyles.footerNoteText}>
            지하철 to 지하철 · 당일 배송 · 크라우드 소싱
          </Text>
        </View>
      </View>

    </View>
  );
}

// ── 앱 콘텐츠 ────────────────────────────────────────────────────
function AppContent() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
  });

  if (!fontsLoaded && Platform.OS !== 'web') {
    return (
      <View style={globalStyles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (Platform.OS !== 'web') {
    return <AppNavigator />;
  }

  const screenWidth = Dimensions.get('window').width;
  const isDesktop = screenWidth >= 768;

  if (!isDesktop) {
    return <AppNavigator />;
  }

  return <DesktopLanding appContent={<AppNavigator />} />;
}

function RootApp() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default Sentry.wrap(RootApp);

// ── 글로벌 스타일 ─────────────────────────────────────────────────
const globalStyles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── 랜딩 스타일 ──────────────────────────────────────────────────
const landingStyles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 48,
    gap: 56,
    backgroundColor: D.bg,
  },

  // ── 왼쪽 패널 ──
  leftPanel: {
    width: 280,
    alignItems: 'flex-start',
    gap: 0,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: D.accent,
  },
  brandTag: {
    fontSize: 11,
    fontWeight: '600',
    color: D.accent,
    letterSpacing: 1.5,
  },
  heading: {
    fontSize: 44,
    fontWeight: '800',
    color: D.textPrimary,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 22,
    fontWeight: '600',
    color: D.accentMint,
    lineHeight: 32,
    marginBottom: 20,
  },
  leadText: {
    fontSize: 14,
    color: D.textSub,
    lineHeight: 22,
    marginBottom: 32,
  },
  featureList: {
    gap: 20,
    marginBottom: 32,
    alignSelf: 'stretch',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureDot: {
    width: 3,
    height: '100%',
    minHeight: 40,
    backgroundColor: D.accent,
    borderRadius: 2,
    marginTop: 2,
  },
  featureTexts: {
    flex: 1,
    gap: 3,
  },
  featureLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: D.textPrimary,
  },
  featureDesc: {
    fontSize: 12,
    color: D.textSub,
    lineHeight: 18,
  },
  highlightBox: {
    alignSelf: 'stretch',
    backgroundColor: D.surfaceAlt,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  highlightLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: D.accent,
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  highlightBody: {
    fontSize: 13,
    color: D.textSub,
    lineHeight: 20,
  },

  // ── 폰 목업 ──
  phoneWrap: {
    alignItems: 'center',
    position: 'relative',
  },
  phoneGlow: {
    position: 'absolute',
    top: -20,
    width: 300,
    height: 80,
    borderRadius: 150,
    backgroundColor: D.accent,
    opacity: 0.07,
  },
  phoneFrame: {
    width: 390,
    height: 844,
    backgroundColor: D.phoneBorder,
    borderRadius: 50,
    borderWidth: 10,
    borderColor: D.phoneBorder,
    shadowColor: D.accent,
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 30,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  statusBar: {
    height: 12,
    backgroundColor: D.phoneBorder,
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  homeBar: {
    height: 20,
    backgroundColor: D.phoneBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBarPill: {
    width: 80,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  phoneReflection: {
    width: 260,
    height: 40,
    borderRadius: 100,
    backgroundColor: D.accent,
    opacity: 0.05,
    marginTop: 12,
  },

  // ── 오른쪽 패널 ──
  rightPanel: {
    width: 300,
    gap: 0,
    alignItems: 'flex-start',
  },
  rightHeading: {
    fontSize: 26,
    fontWeight: '700',
    color: D.textPrimary,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  rightSub: {
    fontSize: 13,
    color: D.textSub,
    lineHeight: 20,
    marginBottom: 28,
  },
  aiCardList: {
    alignSelf: 'stretch',
    gap: 14,
    marginBottom: 32,
  },
  aiCard: {
    flexDirection: 'row',
    backgroundColor: D.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: D.border,
    overflow: 'hidden',
  },
  aiCardAccent: {
    width: 3,
    backgroundColor: D.accent,
  },
  aiCardInner: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  aiCardIndex: {
    fontSize: 10,
    fontWeight: '700',
    color: D.accent,
    letterSpacing: 1,
    marginBottom: 2,
  },
  aiCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: D.textPrimary,
  },
  aiCardBody: {
    fontSize: 12,
    color: D.textSub,
    lineHeight: 18,
  },
  footerNote: {
    alignSelf: 'stretch',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: D.border,
  },
  footerNoteText: {
    fontSize: 11,
    color: D.textSub,
    letterSpacing: 0.3,
  },
});
