/**
 * Identity Verification Screen
 * PASS/Kakao CI 기반 신원 인증 시작 화면
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { StackNavigationProp } from '@react-navigation/stack';
import { useUser } from '../../contexts/UserContext';
import {
  completeCiVerification,
  completeCiVerificationByApi,
  getUserVerification,
  getVerificationStatusDisplay,
  startCiVerification,
} from '../../services/verification-service';
import type { UserVerification, VerificationProvider } from '../../types/profile';
import { PASS_TEST_MODE } from '../../config/feature-flags';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

const PROVIDERS: Array<{
  key: VerificationProvider;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
}> = [
  {
    key: 'pass',
    title: 'PASS 인증',
    subtitle: '통신사 본인인증으로 CI 검증',
    icon: '🛡️',
    color: '#2563EB',
  },
  {
    key: 'kakao',
    title: '카카오 인증',
    subtitle: '카카오 본인확인으로 CI 검증',
    icon: '💬',
    color: '#F59E0B',
  },
];

export default function IdentityVerificationScreen({ navigation }: Props) {
  const { user, refreshUser } = useUser();
  const [verification, setVerification] = useState<UserVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<VerificationProvider | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const status = useMemo(() => getVerificationStatusDisplay(verification), [verification]);

  const loadVerification = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const current = await getUserVerification(user.uid);
      setVerification(current);
      if (current?.externalAuth?.provider) {
        setSelectedProvider(current.externalAuth.provider);
      }
    } catch (error) {
      console.error('Failed to load verification:', error);
    }
  }, [user?.uid]);

  useEffect(() => {
    void loadVerification();
  }, [loadVerification]);

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>로그인이 필요합니다.</Text>
      </View>
    );
  }

  const handleStart = async (provider: VerificationProvider) => {
    try {
      setLoading(true);
      setSelectedProvider(provider);

      const result = await startCiVerification(user.uid, provider);
      setSessionId(result.sessionId || null);
      await loadVerification();

      if (result.redirectUrl) {
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined') {
            window.open(result.redirectUrl, '_blank', 'noopener,noreferrer');
          }
        } else {
          await WebBrowser.openBrowserAsync(result.redirectUrl);
        }
      } else {
        Alert.alert(
          '연동 URL 미설정',
          `${provider === 'pass' ? 'PASS' : '카카오'} 인증 URL이 아직 설정되지 않았습니다.\n현재는 인증 시작 상태만 기록됩니다.`
        );
      }

      Alert.alert(
        '인증 시작됨',
        '외부 인증을 완료한 뒤 아래 "인증 완료 확인" 버튼으로 상태를 갱신해주세요.'
      );
    } catch (error) {
      console.error('Failed to start CI verification:', error);
      Alert.alert('오류', '본인인증 시작에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyVerificationResult = async () => {
    if (!selectedProvider) {
      Alert.alert('안내', '먼저 PASS 또는 카카오 인증을 시작해주세요.');
      return;
    }

    try {
      setLoading(true);
      let applied = false;

      const apiResult = await completeCiVerificationByApi(selectedProvider, sessionId || undefined);
      if (apiResult.ok && apiResult.ciHash) {
        applied = true;
      } else if (PASS_TEST_MODE) {
        const ciHash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          `${user.uid}:${selectedProvider}:${Date.now()}`
        );
        await completeCiVerification(user.uid, selectedProvider, ciHash);
        applied = true;
      }

      await Promise.all([loadVerification(), refreshUser()]);
      const latest = await getUserVerification(user.uid);

      if (applied || latest?.status === 'approved') {
        Alert.alert('인증 완료', '본인인증이 완료되었습니다. 길러 신청 페이지로 이동합니다.', [
          {
            text: '확인',
            onPress: () => navigation.navigate('GillerApply'),
          },
        ]);
        return;
      }

      Alert.alert('안내', '아직 인증 완료 처리가 확인되지 않았습니다. 인증 완료 후 다시 시도해주세요.');
    } catch (error) {
      console.error('Failed to apply verification result:', error);
      Alert.alert('오류', '인증 결과 반영에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>신원 인증</Text>
        <Text style={styles.headerSubtitle}>
          PASS인증이나 카카오 본인인증을 진행해주세요
        </Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>현재 상태</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${status.color}22` }]}> 
          <Text style={[styles.statusBadgeText, { color: status.color }]}>
            {status.icon} {status.statusKo}
          </Text>
        </View>
        <Text style={styles.statusDescription}>{status.description}</Text>
        {status.status === 'approved' && user.gillerApplicationStatus !== 'pending' && user.gillerApplicationStatus !== 'approved' && (
          <Text style={styles.nextStepText}>다음 단계: 관리자에 길러 승급 요청(신청)을 제출하세요.</Text>
        )}
        {user.gillerApplicationStatus === 'pending' && (
          <Text style={styles.nextStepText}>현재 상태: 길러 신청 심사 중입니다.</Text>
        )}
        {status.status === 'approved' && user.gillerApplicationStatus !== 'pending' && user.gillerApplicationStatus !== 'approved' && (
          <TouchableOpacity style={styles.moveButton} onPress={() => navigation.navigate('GillerApply')}>
            <Text style={styles.moveButtonText}>길러 신청 페이지로 이동</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>인증 수단 선택</Text>
        {PROVIDERS.map((provider) => {
          const isSelected = selectedProvider === provider.key;
          return (
            <TouchableOpacity
              key={provider.key}
              style={[
                styles.providerCard,
                isSelected && styles.providerCardSelected,
                { borderColor: isSelected ? provider.color : '#E5E7EB' },
              ]}
              onPress={() => handleStart(provider.key)}
              disabled={loading}
              activeOpacity={0.85}
            >
              <View style={styles.providerLeft}>
                <Text style={styles.providerIcon}>{provider.icon}</Text>
                <View>
                  <Text style={styles.providerTitle}>{provider.title}</Text>
                  <Text style={styles.providerSubtitle}>{provider.subtitle}</Text>
                </View>
              </View>
              <Text style={[styles.providerAction, { color: provider.color }]}>시작</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>보안 원칙</Text>
        <Text style={styles.noteText}>• 신분증 이미지/주민번호 원본은 저장하지 않습니다.</Text>
        <Text style={styles.noteText}>• 서비스에는 CI 해시와 인증 결과만 저장합니다.</Text>
        <Text style={styles.noteText}>• 인증 완료 후 길러 신청 심사로 진행할 수 있습니다.</Text>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleApplyVerificationResult}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>
            {PASS_TEST_MODE ? '인증 완료 확인 (테스트)' : '인증 완료 확인'}
          </Text>
        )}
      </TouchableOpacity>

      {!PASS_TEST_MODE && (
        <Text style={styles.footerGuide}>
          운영 환경에서는 인증사 콜백에서 자동으로 인증 상태가 반영됩니다.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 15,
    color: '#374151',
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#4B5563',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusDescription: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
  },
  nextStepText: {
    marginTop: 2,
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '600',
  },
  moveButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#0F766E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  moveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  providerCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  providerCardSelected: {
    backgroundColor: '#F9FAFB',
  },
  providerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  providerIcon: {
    fontSize: 24,
  },
  providerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  providerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  providerAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  noteCard: {
    backgroundColor: '#ECFEFF',
    borderColor: '#BAE6FD',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#0F172A',
  },
  submitButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#6B7280',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  footerGuide: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },
});
