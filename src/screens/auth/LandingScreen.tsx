/**
 * Landing Screen
 * 랜딩 화면 - 앱 소개 및 로그인/회원가입 버튼
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function LandingScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>🚇</Text>
        <Text style={styles.title}>가는길에</Text>
        <Text style={styles.subtitle}>
          출퇴근길에 배송하며{'\n'}수익을 창출하세요
        </Text>

        <View style={styles.features}>
          <Text style={styles.featureText}>✓ 기존 동선 활용</Text>
          <Text style={styles.featureText}>✓ 유연한 참여</Text>
          <Text style={styles.featureText}>✓ 추가 수익 창출</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.loginButton]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginButtonText}>로그인</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.signupButton]}
          onPress={() => navigation.navigate('SignUp')}
        >
          <Text style={styles.signupButtonText}>회원가입</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 12,
    padding: 16,
    width: '100%',
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 30,
  },
  featureText: {
    color: '#333',
    fontSize: 16,
    marginBottom: 8,
  },
  features: {
    alignSelf: 'flex-start',
    marginBottom: 40,
    marginLeft: 20,
  },
  loginButton: {
    backgroundColor: '#4CAF50',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logo: {
    fontSize: 80,
    marginBottom: 20,
  },
  signupButton: {
    backgroundColor: '#fff',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  signupButtonText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#666',
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 40,
    textAlign: 'center',
  },
  title: {
    color: '#4CAF50',
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 12,
  },
});
