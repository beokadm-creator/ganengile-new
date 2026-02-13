/**
 * Role Selection Screen
 * BOTH 역할 사용자가 첫 진입 시 역할을 선택하는 화면
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useUser } from '../../contexts/UserContext';

type Props = {
  navigation: any;
};

export default function RoleSelectionScreen({ navigation }: Props) {
  const { switchRole } = useUser();

  const handleRoleSelect = async (role: 'gller' | 'giller') => {
    try {
      // 역할 전환
      await switchRole(role === 'gller' ? 'gller' : 'giller');

      // 해당 역할의 온보딩으로 이동
      navigation.replace(role === 'gller' ? 'GllerOnboarding' : 'GillerOnboarding', {
        role,
      });
    } catch (error) {
      console.error('역할 선택 오류:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>어떤 역할로 시작하시겠습니까?</Text>
        <Text style={styles.subtitle}>
          나중에 프로필에서 역할을 변경할 수 있습니다
        </Text>
      </View>

      {/* 역할 카드 */}
      <View style={styles.cardContainer}>
        {/* 이용자 역할 */}
        <TouchableOpacity
          style={[styles.roleCard, styles.gllerCard]}
          onPress={() => handleRoleSelect('gller')}
        >
          <Text style={styles.roleEmoji}>📦</Text>
          <Text style={styles.roleTitle}>이용자로 시작</Text>
          <Text style={styles.roleDescription}>
            지하철을 타고 배송을 부탁하고 싶어요
          </Text>
          <View style={styles.roleFeatures}>
            <Text style={styles.feature}>• 배송 요청</Text>
            <Text style={styles.feature}>• 실시간 매칭</Text>
            <Text style={styles.feature}>• 안심 보험</Text>
          </View>
        </TouchableOpacity>

        {/* 길러 역할 */}
        <TouchableOpacity
          style={[styles.roleCard, styles.gillerCard]}
          onPress={() => handleRoleSelect('giller')}
        >
          <Text style={styles.roleEmoji}>🚴</Text>
          <Text style={styles.roleTitle}>길러로 시작</Text>
          <Text style={styles.roleDescription}>
            지하철을 타고 배송을 도와드릴게요
          </Text>
          <View style={styles.roleFeatures}>
            <Text style={styles.feature}>• 수익 창출</Text>
            <Text style={styles.feature}>• 출퇴근 활동</Text>
            <Text style={styles.feature}>• 유연한 스케줄</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 안내 문구 */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          프로필 화면에서 언제든지 역할을 전환할 수 있습니다
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#9C27B0',
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  cardContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  roleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 25,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gllerCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#00BCD4',
  },
  gillerCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  roleEmoji: {
    fontSize: 50,
    marginBottom: 15,
  },
  roleTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  roleDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  roleFeatures: {
    marginTop: 10,
  },
  feature: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
