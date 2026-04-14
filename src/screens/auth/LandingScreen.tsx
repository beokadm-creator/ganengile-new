import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BorderRadius, Colors, Spacing } from '../../theme';
import { Typography } from '../../theme/typography';

import type { LandingScreenProps } from '../../types/navigation';

export default function LandingScreen({ navigation }: LandingScreenProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <Text style={styles.badge}>가는길에</Text>
        <Text style={styles.title}>지하철 동선에 맞춰{'\n'}바로 보내는 생활 배송</Text>
        <Text style={styles.subtitle}>
          계정은 빠르게 만들고, 배송 요청 직전에 필요한 정보만 확인합니다.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('NewSignUp')}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryButtonText}>계정 만들기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.9}
        >
          <Text style={styles.secondaryButtonText}>이미 계정이 있어요</Text>
        </TouchableOpacity>
      </View>

      {/* ── How it works ─────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>이렇게 시작해요</Text>

        <StepRow
          number="01"
          title="계정 만들기"
          description="이름과 로그인 정보만으로 빠르게 시작합니다."
          last={false}
        />
        <StepRow
          number="02"
          title="첫 요청 준비"
          description="배송 요청 직전에 연락처와 필요한 동의만 확인합니다."
          last={false}
        />
        <StepRow
          number="03"
          title="배송 진행 확인"
          description="채팅, 추적, 요청 상태를 한 곳에서 이어서 확인합니다."
          last={true}
        />
      </View>
    </ScrollView>
  );
}

function StepRow({
  number,
  title,
  description,
  last,
}: {
  number: string;
  title: string;
  description: string;
  last: boolean;
}) {
  return (
    <View style={styles.stepRow}>
      {/* Timeline track */}
      <View style={styles.stepTrack}>
        <View style={styles.stepDot} />
        {!last ? <View style={styles.stepConnector} /> : null}
      </View>

      {/* Content */}
      <View style={[styles.stepContent, !last && styles.stepContentSpaced]}>
        <Text style={styles.stepNum}>{number}</Text>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: Spacing['5xl'] },

  // ── Hero ───────────────────────────────────────────────────
  hero: {
    backgroundColor: Colors.textPrimary,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: 64, // deliberate hero breathing room
    paddingBottom: Spacing['4xl'],
    borderBottomLeftRadius: Spacing.xxl,  // 28 — intentional soft landing
    borderBottomRightRadius: Spacing.xxl,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 7, // between xs(4) and sm(8) — badge proportion
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(45, 212, 191, 0.14)', // teal @ 14% on dark bg
    color: Colors.primaryMint,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.extrabold,
    marginBottom: Spacing.xl,
  },
  title: {
    color: Colors.surface,
    fontSize: 34, // hero display — exceeds scale intentionally
    fontWeight: Typography.fontWeight.extrabold,
    lineHeight: 42,
    marginBottom: Spacing.md,
  },
  subtitle: {
    color: '#D1FAE5', // Tailwind green-100 on dark bg — no matching token
    fontSize: Typography.fontSize.lg,
    lineHeight: 24,
    marginBottom: Spacing.xxl,
  },
  primaryButton: {
    minHeight: 54, // consistent button height across auth screens
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10, // between sm(8) and md(16) — intentional button stack gap
  },
  primaryButtonText: {
    color: '#042F2E', // very dark teal on light button — no matching token
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)', // white @ 28% on dark bg
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Colors.surface,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },

  // ── Steps section ──────────────────────────────────────────
  section: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing['3xl'],
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
    marginBottom: Spacing['2xl'],
  },
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },

  // Timeline
  stepTrack: {
    width: 10,
    alignItems: 'center',
    paddingTop: 3, // optical alignment with stepNum text
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5, // half of 10 for perfect circle
    backgroundColor: Colors.primary,
  },
  stepConnector: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.primaryMint,
    marginTop: 6, // gap between dot and line
  },

  // Content
  stepContent: {
    flex: 1,
  },
  stepContentSpaced: {
    paddingBottom: Spacing.xxl,
  },
  stepNum: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.extrabold,
    letterSpacing: 0.8, // optical label spacing
    marginBottom: 3,    // tight gap before title
  },
  stepTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
    marginBottom: Spacing.xs,
  },
  stepDescription: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
    lineHeight: 21,
  },
});
