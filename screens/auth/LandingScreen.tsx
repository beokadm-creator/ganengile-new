/**
 * Landing Screen
 * App introduction and entry point
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Colors } from '../../src/theme';
import type { LandingScreenProps } from '../../src/types/navigation';

export default function LandingScreen({ navigation }: LandingScreenProps) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🚇 가는길에</Text>
        <Text style={styles.subtitle}>
          출퇴근길에 배송하며 수익을 창출하세요
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>서비스 소개</Text>
          <Text style={styles.description}>
            서울 지하철 이용자가 되어 평소 출퇴근길에 배송을 수행하고
            수익을 얻을 수 있는 크라우드 배송 서비스입니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 이용 방법</Text>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>출퇴근 경로(동선)를 등록하세요</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>경로에 맞는 배송 요청을 받으세요</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepText}>배송을 완료하고 수익을 받으세요</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>현재 활동 중인 길러</Text>
          <Text style={styles.stat}>0명</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('SignUp')}
        >
          <Text style={styles.primaryButtonText}>지금 시작하기</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.secondaryButtonText}>
            이미 계정이 있으신가요? 로그인
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray100,
    flex: 1,
  },
  content: {
    padding: 20,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    padding: 40,
    paddingTop: 80,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: 8,
    marginBottom: 15,
    padding: 16,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    elevation: 3,
    marginBottom: 20,
    padding: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  stat: {
    color: Colors.secondary,
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
  },
  step: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 15,
  },
  stepNumber: {
    backgroundColor: Colors.secondary,
    borderRadius: 14,
    color: Colors.white,
    fontWeight: 'bold',
    height: 28,
    lineHeight: 28,
    marginRight: 12,
    textAlign: 'center',
    width: 28,
  },
  stepText: {
    color: '#333',
    flex: 1,
    fontSize: 15,
  },
  subtitle: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.9,
    textAlign: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});
