/**
 * Landing Screen
 * 랜딩 화면 - 서비스 소개 및 회원가입 유도
 *
 * 목표: 사용자에게 가치를 먼저 전달하고, 회원가입을 유도
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

export default function LandingScreen({ navigation }: any) {
  const handleNavigate = (screen: string) => {
    console.log('Navigating to:', screen);
    if (navigation?.navigate) {
      navigation.navigate(screen);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Hero Section */}
      <View style={styles.hero}>
        <Text style={styles.logo}>🚇</Text>
        <Text style={styles.title}>가는길에</Text>
        <Text style={styles.subtitle}>
          출퇴근길에 배송하며{'\n'}월 최대 50만 원 수익을{'\n'}창출해보세요
        </Text>

        {/* 강력한 CTA - 회원가입 우선 */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => handleNavigate('NewSignUp')}
          activeOpacity={0.8}
        >
          <View style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>지금 시작하고 수익 창출하기 →</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => handleNavigate('Login')}
          activeOpacity={0.8}
        >
          <View style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>이미 계정이 있나요? 로그인</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Value Proposition */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>왜 가는길에인가요?</Text>

        <View style={styles.benefitCard}>
          <Text style={styles.benefitIcon}>💰</Text>
          <Text style={styles.benefitTitle}>추가 수익 창출</Text>
          <Text style={styles.benefitDescription}>
            출퇴근길에 이미 이용하는 지하철 노선으로{'\n'}
            월 10~50만 원의 추가 수익을 만들어보세요
          </Text>
        </View>

        <View style={styles.benefitCard}>
          <Text style={styles.benefitIcon}>⏰</Text>
          <Text style={styles.benefitTitle}>시간 효율성</Text>
          <Text style={styles.benefitDescription}>
            특정 시간 고정 없이,{'\n'}
            타는 날만 선택해서 유연하게 참여하세요
          </Text>
        </View>

        <View style={styles.benefitCard}>
          <Text style={styles.benefitIcon}>🚀</Text>
          <Text style={styles.benefitTitle}>기존 동선 활용</Text>
          <Text style={styles.benefitDescription}>
            별도의 이동 없이{'\n'}
            이미 가는 길에서 배송만 수행하세요
          </Text>
        </View>
      </View>

      {/* How It Works */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>이용 방법</Text>

        <View style={styles.stepRow}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>동선 등록</Text>
            <Text style={styles.stepDescription}>자주 타는 지하철 노선을 등록하세요</Text>
          </View>
        </View>

        <View style={styles.stepRow}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>배송 요청 수락</Text>
            <Text style={styles.stepDescription}>
              내 동선과 일치하는 배송 요청을 확인하고 수락하세요
            </Text>
          </View>
        </View>

        <View style={styles.stepRow}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>픽업 & 배송 & 수익</Text>
            <Text style={styles.stepDescription}>
              출발역에서 픽업 → 도착역에서 전달 → 수익 적립
            </Text>
          </View>
        </View>
      </View>

      {/* Example Earnings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>수익 예시</Text>

        <View style={styles.earningCard}>
          <Text style={styles.earningTitle}>일 1회 왕복 배송</Text>
          <View style={styles.earningRow}>
            <Text style={styles.earningLabel}>배송 건당 평균 수익</Text>
            <Text style={styles.earningValue}>3,000원</Text>
          </View>
          <View style={styles.earningRow}>
            <Text style={styles.earningLabel}>월 20일 기준</Text>
            <Text style={styles.earningValueHighlight}>월 60,000원</Text>
          </View>
        </View>

        <View style={styles.earningCard}>
          <Text style={styles.earningTitle}>일 2회 왕복 배송</Text>
          <View style={styles.earningRow}>
            <Text style={styles.earningLabel}>배송 건당 평균 수익</Text>
            <Text style={styles.earningValue}>3,000원 × 2회</Text>
          </View>
          <View style={styles.earningRow}>
            <Text style={styles.earningLabel}>월 20일 기준</Text>
            <Text style={styles.earningValueHighlight}>월 120,000원</Text>
          </View>
        </View>
      </View>

      {/* Final CTA */}
      <View style={styles.finalCTA}>
        <Text style={styles.finalCTATitle}>
          지금 바로 시작하세요!
        </Text>
        <Text style={styles.finalCTASubtitle}>
          회원가입은 1분 만에 완료됩니다
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => handleNavigate('SignUp')}
          activeOpacity={0.8}
        >
          <View style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>무료로 회원가입하기 →</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          이미 계정이 있으신가요?
        </Text>
        <TouchableOpacity onPress={() => handleNavigate('Login')}>
          <Text style={styles.footerLink}>로그인</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Hero Section
  hero: {
    alignItems: 'center',
    backgroundColor: '#00BCD4',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingHorizontal: 30,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logo: {
    fontSize: 80,
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 42,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 32,
    marginBottom: 32,
    textAlign: 'center',
    opacity: 0.95,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#00BCD4',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    padding: 16,
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Sections
  section: {
    padding: 30,
  },
  sectionTitle: {
    color: '#333',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },

  // Benefit Cards
  benefitCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 16,
    padding: 20,
  },
  benefitIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  benefitTitle: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  benefitDescription: {
    color: '#666',
    fontSize: 15,
    lineHeight: 22,
  },

  // Steps
  stepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 20,
  },
  stepCircle: {
    alignItems: 'center',
    backgroundColor: '#00BCD4',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    marginRight: 16,
    width: 40,
  },
  stepNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  stepDescription: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
  },

  // Earnings
  earningCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
    marginBottom: 16,
    padding: 20,
  },
  earningTitle: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  earningRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  earningLabel: {
    color: '#666',
    fontSize: 14,
  },
  earningValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  earningValueHighlight: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Final CTA
  finalCTA: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  finalCTATitle: {
    color: '#333',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  finalCTASubtitle: {
    color: '#666',
    fontSize: 16,
    marginBottom: 24,
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#999',
    fontSize: 14,
    marginBottom: 8,
  },
  footerLink: {
    color: '#00BCD4',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
