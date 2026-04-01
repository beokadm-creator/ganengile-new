import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useUser } from '../../contexts/UserContext';
import { completeCiVerification, completeCiVerificationByApi, getUserVerification, getVerificationStatusDisplay, startCiVerification } from '../../services/verification-service';
import { getIdentityIntegrationConfig, type IdentityIntegrationConfig } from '../../services/integration-config-service';
import type { MainStackNavigationProp } from '../../types/navigation';
import type { UserVerification, VerificationProvider } from '../../types/profile';

const PROVIDERS: Array<{ key: VerificationProvider; title: string; subtitle: string; accent: string; accentDisabled: string }> = [
  { key: 'pass', title: 'PASS 본인확인', subtitle: '국내 사용자를 위한 기본 CI 본인확인 경로입니다.', accent: '#2563EB', accentDisabled: '#98A2B3' },
  { key: 'kakao', title: '카카오 본인확인', subtitle: '보조 공급자 또는 대체 경로로 함께 준비합니다.', accent: '#F59E0B', accentDisabled: '#98A2B3' },
];

export default function IdentityVerificationScreen({ navigation }: { navigation: MainStackNavigationProp }) {
  const { user, refreshUser } = useUser();
  const userId = user?.uid;
  const [loading, setLoading] = useState(false);
  const [verification, setVerification] = useState<UserVerification | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<VerificationProvider | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [identityConfig, setIdentityConfig] = useState<IdentityIntegrationConfig | null>(null);

  const verificationDisplay = useMemo(() => getVerificationStatusDisplay(verification), [verification]);
  const isTestMode = identityConfig?.testMode ?? true;

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [currentVerification, config] = await Promise.all([getUserVerification(userId), getIdentityIntegrationConfig()]);
      setVerification(currentVerification);
      setIdentityConfig(config);
      if (currentVerification?.externalAuth?.provider) setSelectedProvider(currentVerification.externalAuth.provider);
    } catch (error) {
      console.error('Failed to load identity verification screen', error);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  if (!user) return <View style={styles.centerState}><Text style={styles.centerText}>로그인이 필요합니다.</Text></View>;

  async function handleStart(provider: VerificationProvider) {
    const providerConfig = identityConfig?.providers[provider];
    if (providerConfig && !providerConfig.enabled) {
      Alert.alert('현재 비활성화됨', `${providerConfig.label} 경로는 관리자 설정에서 아직 열리지 않았습니다.`);
      return;
    }
    try {
      setLoading(true);
      setSelectedProvider(provider);
      if (!userId) {
        Alert.alert('로그인이 필요합니다', '본인확인을 시작하려면 다시 로그인해 주세요.');
        return;
      }
      const result = await startCiVerification(userId, provider);
      setSessionId(result.sessionId ?? null);
      await load();
      if (result.redirectUrl) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.open(result.redirectUrl, '_blank', 'noopener,noreferrer');
        } else {
          await WebBrowser.openBrowserAsync(result.redirectUrl);
        }
      } else {
        Alert.alert('연결 주소 준비 중', `${providerConfig?.label ?? provider} 공급자 주소가 아직 준비되지 않았습니다. 현재는 세션 시작과 테스트 반영 흐름까지 이어집니다.`);
      }
    } catch (error) {
      console.error('Failed to start identity verification', error);
      Alert.alert('시작 실패', '본인확인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyResult() {
    if (!selectedProvider) {
      Alert.alert('공급자를 선택해 주세요', '먼저 PASS 또는 카카오 본인확인을 시작해 주세요.');
      return;
    }
    try {
      setLoading(true);
      let applied = false;
      const apiResult = await completeCiVerificationByApi(selectedProvider, sessionId ?? undefined);
      if (apiResult.ok && apiResult.ciHash) {
        applied = true;
      } else if (isTestMode) {
        if (!userId) {
          Alert.alert('로그인이 필요합니다', '본인확인 결과를 반영하려면 다시 로그인해 주세요.');
          return;
        }
        const ciHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${userId}:${selectedProvider}:${Date.now()}`);
        await completeCiVerification(userId, selectedProvider, ciHash);
        applied = true;
      }
      await Promise.all([load(), refreshUser()]);
      if (applied) {
        Alert.alert('본인확인 반영 완료', '이제 길러 신청 단계로 바로 이어집니다.', [{ text: '계속', onPress: () => navigation.navigate('GillerApply') }]);
        return;
      }
      Alert.alert('아직 확인 중입니다', '공급자 응답 또는 운영 검토 반영을 조금 더 기다려 주세요.');
    } catch (error) {
      console.error('Failed to apply identity verification result', error);
      Alert.alert('반영 실패', '본인확인 결과를 반영하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const readyCount = [identityConfig?.providers.pass.liveReady, identityConfig?.providers.kakao.liveReady].filter(Boolean).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}><Text style={styles.kicker}>가는길에 본인확인</Text><Text style={styles.title}>본인확인</Text><Text style={styles.subtitle}>길러 승급 전에 필요한 CI 인증 단계입니다. 테스트 모드와 실서비스 준비 상태를 같이 봅니다.</Text></View>
      <View style={[styles.modeCard, isTestMode ? styles.modeCardTest : styles.modeCardLive]}><Text style={styles.modeTitle}>{isTestMode ? '테스트 모드 사용 중' : '실서비스 모드 준비 완료'}</Text><Text style={styles.modeBody}>{isTestMode ? '현재는 테스트 우회 또는 서버 테스트 응답을 통해 흐름을 검증합니다.' : '공급자 콜백 기준으로 본인확인 결과가 자동 반영됩니다.'}</Text><Text style={styles.modeMeta}>준비된 공급자 {readyCount}개 / 2개</Text></View>
      <View style={styles.statusCard}><Text style={styles.sectionTitle}>현재 상태</Text><View style={[styles.statusBadge, { backgroundColor: `${verificationDisplay.color}22` }]}><Text style={[styles.statusBadgeText, { color: verificationDisplay.color }]}>{verificationDisplay.statusKo}</Text></View><Text style={styles.statusDescription}>{verificationDisplay.description}</Text>{verificationDisplay.status === 'approved' ? <TouchableOpacity style={styles.inlineButton} onPress={() => navigation.navigate('GillerApply')}><Text style={styles.inlineButtonText}>길러 신청으로 이동</Text></TouchableOpacity> : null}</View>
      <View style={styles.providerSection}><Text style={styles.sectionTitle}>본인확인 공급자</Text>{PROVIDERS.map((provider) => { const providerConfig = identityConfig?.providers[provider.key]; const disabled = providerConfig ? !providerConfig.enabled : false; const selected = selectedProvider === provider.key; return <TouchableOpacity key={provider.key} style={[styles.providerCard, selected && styles.providerCardSelected, selected && { borderColor: provider.accent }, disabled && styles.providerCardDisabled]} onPress={() => void handleStart(provider.key)} disabled={loading || disabled} activeOpacity={0.92}><View style={styles.providerCopy}><Text style={styles.providerTitle}>{provider.title}</Text><Text style={styles.providerSubtitle}>{provider.subtitle}</Text><Text style={styles.providerMeta}>{providerConfig?.liveReady ? '실서비스 준비됨' : isTestMode ? '테스트 우회 가능' : '설정 준비 필요'}</Text></View><Text style={[styles.providerAction, { color: disabled ? provider.accentDisabled : provider.accent }]}>{selected ? '선택됨' : '시작'}</Text></TouchableOpacity>; })}</View>
      <View style={styles.noticeBox}><Text style={styles.noticeTitle}>운영 가드레일</Text><Text style={styles.noticeBody}>PASS, 카카오 CI 연동이 준비되면 관리자 설정만 바꿔 실서비스로 전환할 수 있습니다.</Text><Text style={styles.noticeBody}>환불, 패널티, 최종 정산은 본인확인 완료만으로 자동 확정되지 않습니다.</Text></View>
      <TouchableOpacity style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} onPress={() => void handleApplyResult()} disabled={loading}>{loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>결과 반영하기</Text>}</TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F8FAFC' }, content: { padding: 16, paddingBottom: 32, gap: 12 }, centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }, centerText: { color: '#475569' }, hero: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, gap: 6 }, kicker: { color: '#0F766E', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.1 }, title: { color: '#111827', fontSize: 26, fontWeight: '700' }, subtitle: { color: '#4B5563', fontSize: 14, lineHeight: 21 }, modeCard: { borderRadius: 18, padding: 16, gap: 6 }, modeCardTest: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' }, modeCardLive: { backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#86EFAC' }, modeTitle: { color: '#111827', fontSize: 15, fontWeight: '700' }, modeBody: { color: '#4B5563', fontSize: 13, lineHeight: 19 }, modeMeta: { color: '#64748B', fontSize: 12 }, statusCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, gap: 10 }, sectionTitle: { color: '#111827', fontSize: 17, fontWeight: '700' }, statusBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }, statusBadgeText: { fontWeight: '700' }, statusDescription: { color: '#4B5563', lineHeight: 20 }, inlineButton: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#ECFDF5' }, inlineButtonText: { color: '#115E59', fontWeight: '700' }, providerSection: { gap: 10 }, providerCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, providerCardSelected: { borderColor: '#0F766E' }, providerCardDisabled: { opacity: 0.6 }, providerCopy: { flex: 1, gap: 4 }, providerTitle: { color: '#111827', fontWeight: '700' }, providerSubtitle: { color: '#4B5563', fontSize: 13, lineHeight: 19 }, providerMeta: { color: '#64748B', fontSize: 12 }, providerAction: { fontWeight: '800' }, noticeBox: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, gap: 6 }, noticeTitle: { color: '#111827', fontWeight: '700' }, noticeBody: { color: '#4B5563', lineHeight: 20 }, primaryButton: { minHeight: 54, borderRadius: 18, backgroundColor: '#115E59', alignItems: 'center', justifyContent: 'center' }, primaryButtonDisabled: { opacity: 0.7 }, primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 } });
