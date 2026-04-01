import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useUser } from '../../contexts/UserContext';
import { useGillerAccess } from '../../hooks/useGillerAccess';
import { getUserVerification, getVerificationStatusDisplay } from '../../services/verification-service';
import { getBankIntegrationConfig, getIdentityIntegrationConfig, getPaymentIntegrationConfig } from '../../services/integration-config-service';
import { PointService } from '../../services/PointService';
import type { MainStackNavigationProp } from '../../types/navigation';
import { UserRole } from '../../types/user';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';

type ScreenState = { verificationText: string; bankText: string; walletText: string; payoutText: string };

export default function ProfileScreen({ navigation }: { navigation: MainStackNavigationProp }) {
  const { user, currentRole, switchRole, logout } = useUser();
  const { canAccessGiller, applicationStatus } = useGillerAccess();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<ScreenState>({ verificationText: '본인확인 상태를 불러오고 있습니다.', bankText: '정산 계좌 준비 상태를 확인하고 있습니다.', walletText: '지갑과 출금 가능 금액을 계산하고 있습니다.', payoutText: '보증금과 정산 준비 상태를 확인하고 있습니다.' });

  const activeRole = currentRole ?? user?.role ?? UserRole.GLER;
  const showRoleSwitch = user?.role === UserRole.BOTH;

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.uid) return;
      try {
        const [verification, identityConfig, bankConfig, paymentConfig, pointSummary] = await Promise.all([getUserVerification(user.uid), getIdentityIntegrationConfig(), getBankIntegrationConfig(), getPaymentIntegrationConfig(), PointService.getSummary(user.uid)]);
        if (!mounted) return;
        const verificationDisplay = getVerificationStatusDisplay(verification);
        const verificationText = identityConfig.testMode ? `${verificationDisplay.statusKo}. 현재는 테스트 우회 경로를 포함한 승급 단계까지 연결됩니다.` : `${verificationDisplay.statusKo}. 실서비스 CI 응답을 기준으로 다음 심사 단계로 이어집니다.`;
        const bankText = bankConfig.liveReady ? '정산 계좌 연동 준비가 되어 있습니다.' : bankConfig.statusMessage;
        const walletText = pointSummary.withdrawalEligibility?.allowed ? `출금 가능한 금액 ${pointSummary.withdrawableBalance.toLocaleString()}원이 준비되어 있습니다.` : `출금 전 체크가 더 필요합니다. 현재 출금 가능 금액은 ${pointSummary.withdrawableBalance.toLocaleString()}원입니다.`;
        const payoutText = paymentConfig.liveReady ? '보증금과 정산 결제 경로가 실서비스 준비 상태입니다.' : paymentConfig.testMode ? '결제와 정산은 테스트 모드로 이어지고 최종 확정은 운영 검토를 거칩니다.' : '결제 공급자 설정이 아직 완전히 준비되지 않았습니다.';
        setState({ verificationText, bankText, walletText, payoutText });
      } catch (error) {
        console.error('Failed to load profile hub', error);
        if (mounted) setState({ verificationText: '본인확인 상태를 불러오지 못했습니다.', bankText: '계좌 준비 상태를 불러오지 못했습니다.', walletText: '지갑 상태를 불러오지 못했습니다.', payoutText: '정산 준비 상태를 불러오지 못했습니다.' });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [user]);

  const readinessItems = useMemo(() => {
    const isIdentityReady = user?.isVerified === true;
    const isApplicationPending = applicationStatus === 'pending';
    const isApplicationApproved = applicationStatus === 'approved';
    return [
      { title: '본인확인', body: state.verificationText, ready: isIdentityReady, action: () => navigation.navigate('IdentityVerification'), actionLabel: isIdentityReady ? '상태 확인' : '본인확인 하기' },
      { title: '길러 승급', body: isApplicationApproved ? '길러 승급이 승인되어 미션 보드와 정산 흐름을 사용할 수 있습니다.' : isApplicationPending ? '현재 길러 승급 심사가 진행 중입니다.' : '본인확인과 계좌 준비가 끝나면 길러 신청으로 이어집니다.', ready: isApplicationApproved, action: () => navigation.navigate('GillerApply'), actionLabel: isApplicationPending ? '심사 상태 보기' : '길러 신청' },
      { title: '지갑과 출금', body: state.walletText, ready: false, action: () => navigation.navigate('PointHistory'), actionLabel: '지갑 보기' },
      { title: '정산 준비', body: `${state.bankText} ${state.payoutText}`, ready: false, action: () => navigation.navigate('PointWithdraw'), actionLabel: '출금 준비 보기' },
    ];
  }, [applicationStatus, navigation, state, user?.isVerified]);

  const quickLinks = useMemo(() => [
    { title: '요청 보드', subtitle: '내 요청, 견적, 배송 상태를 한 번에 확인합니다.', icon: 'inventory-2' as const, onPress: () => navigation.navigate('Tabs', { screen: 'Requests' }) },
    { title: '미션 보드', subtitle: '길러가 수락 가능한 미션과 번들 보상을 봅니다.', icon: 'two-wheeler' as const, onPress: () => canAccessGiller ? navigation.navigate('Tabs', { screen: 'GillerRequests' }) : navigation.navigate('GillerApply') },
    { title: '지갑', subtitle: '포인트 정산과 출금 체크리스트를 확인합니다.', icon: 'account-balance-wallet' as const, onPress: () => navigation.navigate('PointHistory') },
    { title: '수익 보기', subtitle: '세전 수익, 원천징수 3.3%, 실수령액을 봅니다.', icon: 'payments' as const, onPress: () => navigation.navigate('Earnings') },
    { title: '운영 정책', subtitle: '정산, 보증금, 분쟁 안내를 확인합니다.', icon: 'description' as const, onPress: () => navigation.navigate('Terms') },
  ], [canAccessGiller, navigation]);

  function handleRoleSwitch() {
    if (!showRoleSwitch) return;
    const nextRole = activeRole === UserRole.GILLER ? UserRole.GLER : UserRole.GILLER;
    if (nextRole === UserRole.GILLER && !canAccessGiller) {
      Alert.alert('길러 모드 준비 중', '본인확인과 길러 심사 이후에 길러 모드로 전환할 수 있습니다.');
      return;
    }
    switchRole(nextRole);
  }

  function handleLogout() {
    Alert.alert('로그아웃', '현재 세션을 종료할까요?', [{ text: '취소', style: 'cancel' }, { text: '로그아웃', style: 'destructive', onPress: () => { void logout(); } }]);
  }

  if (!user || loading) return <View style={styles.centerState}><ActivityIndicator size="large" color={Colors.primary} /><Text style={styles.centerText}>프로필과 준비 상태를 불러오고 있습니다.</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}><Text style={styles.kicker}>가는길에</Text><Text style={styles.name}>{user.name ?? '사용자'}</Text><Text style={styles.subtitle}>{user.phoneNumber ?? user.email}</Text><View style={styles.badgeRow}><StatusBadge label={activeRole === UserRole.GILLER ? '길러 모드' : '사용자 모드'} tone="teal" /><StatusBadge label={applicationStatus === 'approved' ? '승급 승인' : applicationStatus === 'pending' ? '승급 심사 중' : '승급 전'} tone={applicationStatus === 'approved' ? 'blue' : 'gray'} /><StatusBadge label={user.isVerified ? '본인확인 완료' : '본인확인 필요'} tone={user.isVerified ? 'green' : 'gray'} /></View>{showRoleSwitch ? <TouchableOpacity style={styles.switchButton} onPress={handleRoleSwitch} activeOpacity={0.9}><Text style={styles.switchButtonText}>{activeRole === UserRole.GILLER ? '사용자 모드로 전환' : '길러 모드로 전환'}</Text><MaterialIcons name="swap-horiz" size={20} color=Colors.textPrimary /></TouchableOpacity> : null}</View>
      <View style={styles.section}><Text style={styles.sectionTitle}>가입부터 승급까지</Text>{readinessItems.map((item) => <TouchableOpacity key={item.title} style={styles.readinessCard} onPress={item.action} activeOpacity={0.92}><View style={styles.readinessTop}><Text style={styles.readinessTitle}>{item.title}</Text><StatusPill label={item.ready ? '준비됨' : '확인 필요'} tone={item.ready ? 'green' : 'amber'} /></View><Text style={styles.readinessBody}>{item.body}</Text><Text style={styles.readinessAction}>{item.actionLabel}</Text></TouchableOpacity>)}</View>
      <View style={styles.section}><Text style={styles.sectionTitle}>빠른 이동</Text>{quickLinks.map((item) => <TouchableOpacity key={item.title} style={styles.linkCard} onPress={item.onPress} activeOpacity={0.92}><View style={styles.linkIconWrap}><MaterialIcons name={item.icon} size={20} color={Colors.primaryDark} /></View><View style={styles.linkCopy}><Text style={styles.linkTitle}>{item.title}</Text><Text style={styles.linkSubtitle}>{item.subtitle}</Text></View><MaterialIcons name="chevron-right" size={22} color={Colors.gray400} /></TouchableOpacity>)}</View>
      <View style={styles.noticeBox}><Text style={styles.noticeTitle}>운영 원칙</Text><Text style={styles.noticeBody}>환불, 보증금 차감, 패널티, 최종 정산은 AI가 단독으로 확정하지 않습니다.</Text><Text style={styles.noticeBody}>테스트 모드 인증과 결제도 운영 검토 기록과 함께 이어집니다.</Text></View>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.9}><Text style={styles.logoutText}>로그아웃</Text></TouchableOpacity>
    </ScrollView>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: 'teal' | 'green' | 'blue' | 'gray' }) {
  const palette = { teal: { bg: Colors.primaryMint, fg: Colors.primaryDark }, green: { bg: Colors.successLight, fg: Colors.successDark }, blue: { bg: Colors.infoLight, fg: Colors.infoDark }, gray: { bg: Colors.border, fg: Colors.textSecondary } } as const;
  return <View style={[styles.badge, { backgroundColor: palette[tone].bg }]}><Text style={[styles.badgeText, { color: palette[tone].fg }]}>{label}</Text></View>;
}
function StatusPill({ label, tone }: { label: string; tone: 'green' | 'amber' }) {
  const palette = tone === 'green' ? { bg: Colors.successLight, fg: Colors.successDark } : { bg: Colors.warningLight, fg: Colors.warningDark };
  return <View style={[styles.pill, { backgroundColor: palette.bg }]}><Text style={[styles.pillText, { color: palette.fg }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: Colors.background }, content: { padding: Spacing.lg, gap: Spacing.md }, centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }, centerText: { marginTop: Spacing.md, color: Colors.textSecondary, ...Typography.body }, hero: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: 10, ...Shadows.sm }, kicker: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 1 }, name: { fontSize: Typography.fontSize['2xl'], fontWeight: '800', color: Colors.textPrimary }, subtitle: { color: Colors.textSecondary, ...Typography.body }, badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, badge: { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 6 }, badgeText: { fontSize: Typography.fontSize.sm, fontWeight: '700' }, switchButton: { minHeight: 48, borderRadius: BorderRadius.xl, backgroundColor: Colors.gray50, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, switchButtonText: { color: Colors.textPrimary, fontWeight: '700' }, section: { gap: 10 }, sectionTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize.xl, fontWeight: '800' }, readinessCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: 8, ...Shadows.sm }, readinessTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, readinessTitle: { color: Colors.textPrimary, fontWeight: '800' }, readinessBody: { color: Colors.textSecondary, ...Typography.bodySmall }, readinessAction: { color: Colors.primary, fontWeight: '700' }, pill: { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 5 }, pillText: { fontSize: Typography.fontSize.sm, fontWeight: '700' }, linkCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 12, ...Shadows.sm }, linkIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryMint, alignItems: 'center', justifyContent: 'center' }, linkCopy: { flex: 1, gap: 4 }, linkTitle: { color: Colors.textPrimary, fontWeight: '800' }, linkSubtitle: { color: Colors.textTertiary, ...Typography.caption }, noticeBox: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: 6, ...Shadows.sm }, noticeTitle: { color: Colors.textPrimary, fontWeight: '800' }, noticeBody: { color: Colors.textSecondary, ...Typography.bodySmall }, logoutButton: { minHeight: 52, borderRadius: BorderRadius.xl, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', ...Shadows.sm }, logoutText: { color: Colors.error, fontWeight: '800' } });
