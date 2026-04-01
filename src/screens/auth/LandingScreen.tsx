import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';

import type { LandingScreenProps } from '../../types/navigation';

export default function LandingScreen({ navigation }: LandingScreenProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.badge}>가는길에</Text>
        <Text style={styles.title}>지하철 동선에 맞춰 바로 보내는 생활 배송</Text>
        <Text style={styles.subtitle}>요청, 채팅, 추적, 정산까지 한 흐름으로 이어집니다.</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('NewSignUp')} activeOpacity={0.9}>
          <Text style={styles.primaryButtonText}>시작하기</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Login')} activeOpacity={0.9}>
          <Text style={styles.secondaryButtonText}>로그인</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <StepRow number="1" title="요청 만들기" description="출발역과 도착역을 고르고 필요한 조건만 입력합니다." />
        <StepRow number="2" title="연결 확인" description="지금 보내기와 예약하기 중 상황에 맞는 흐름으로 이어집니다." />
        <StepRow number="3" title="진행 확인" description="채팅, 추적, 정산 준비 상태를 한 곳에서 확인합니다." />
      </View>
    </ScrollView>
  );
}

function StepRow({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepCircle}>
        <Text style={styles.stepNumber}>{number}</Text>
      </View>
      <View style={styles.stepCopy}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  hero: {
    backgroundColor: Colors.textPrimary,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(45, 212, 191, 0.14)',
    color: Colors.primaryMint,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  title: { color: Colors.surface, fontSize: 34, fontWeight: '800', lineHeight: 42, marginBottom: 12 },
  subtitle: { color: '#D1FAE5', fontSize: 16, lineHeight: 24, marginBottom: 24 },
  primaryButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#14B8A6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryButtonText: { color: '#042F2E', fontSize: 16, fontWeight: '800' },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: Colors.surface, fontSize: 16, fontWeight: '700' },
  section: { paddingHorizontal: 24, paddingTop: 28, gap: 18 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: { color: Colors.surface, fontSize: 17, fontWeight: '800' },
  stepCopy: { flex: 1, gap: 4 },
  stepTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  stepDescription: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21 },
});
