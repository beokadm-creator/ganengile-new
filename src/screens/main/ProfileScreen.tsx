import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useUser } from '../../contexts/UserContext';
import { useGillerAccess } from '../../hooks/useGillerAccess';
import { getBankIntegrationConfig, getIdentityIntegrationConfig } from '../../services/integration-config-service';
import { PointService } from '../../services/PointService';
import { getUserVerification, getVerificationStatusDisplay } from '../../services/verification-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp } from '../../types/navigation';
import { UserRole } from '../../types/user';

type ProfileState = {
  verificationLabel: string;
  bankLabel: string;
  withdrawableBalance: number;
};

type LinkItem = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
};

export default function ProfileScreen({ navigation }: { navigation: MainStackNavigationProp }) {
  const { user, currentRole, switchRole, logout } = useUser();
  const { canAccessGiller, applicationStatus } = useGillerAccess();
  const [loading, setLoading] = useState(true);
  const [profileState, setProfileState] = useState<ProfileState>({
    verificationLabel: '확인 중',
    bankLabel: '확인 중',
    withdrawableBalance: 0,
  });

  const activeRole = currentRole ?? user?.role ?? UserRole.GLER;
  const showRoleSwitch = user?.role === UserRole.BOTH;

  useEffect(() => {
    let mounted = true;

    async function loadProfileState() {
      if (!user?.uid) {
        return;
      }

      try {
        const [verification, identityConfig, bankConfig, pointSummary] = await Promise.all([
          getUserVerification(user.uid),
          getIdentityIntegrationConfig(),
          getBankIntegrationConfig(),
          PointService.getSummary(user.uid),
        ]);

        if (!mounted) {
          return;
        }

        const verificationDisplay = getVerificationStatusDisplay(verification);
        setProfileState({
          verificationLabel: identityConfig.testMode
            ? `${verificationDisplay.statusKo} · 테스트`
            : verificationDisplay.statusKo,
          bankLabel: bankConfig.liveReady ? '준비됨' : bankConfig.statusMessage,
          withdrawableBalance: pointSummary.withdrawableBalance,
        });
      } catch (error) {
        console.error('Failed to load profile state', error);
        if (mounted) {
          setProfileState({
            verificationLabel: '확인 실패',
            bankLabel: '확인 실패',
            withdrawableBalance: 0,
          });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadProfileState();
    return () => {
      mounted = false;
    };
  }, [user]);

  const userLinks = useMemo<LinkItem[]>(
    () => [
      {
        title: '내 요청',
        subtitle: '요청과 배송',
        icon: 'inventory-2',
        onPress: () => navigation.navigate('Tabs', { screen: 'Requests' }),
      },
      {
        title: '채팅',
        subtitle: '대화 확인',
        icon: 'chat',
        onPress: () => navigation.navigate('ChatList'),
      },
      {
        title: '지갑',
        subtitle: '잔액과 내역',
        icon: 'account-balance-wallet',
        onPress: () => navigation.navigate('PointHistory'),
      },
      {
        title: '약관',
        subtitle: '정책 확인',
        icon: 'description',
        onPress: () => navigation.navigate('Terms'),
      },
    ],
    [navigation],
  );

  const gillerLinks = useMemo<LinkItem[]>(
    () => [
      {
        title: canAccessGiller ? '미션 보드' : '길러 신청',
        subtitle: canAccessGiller ? '받을 미션 보기' : '승급 진행',
        icon: 'two-wheeler',
        onPress: () =>
          canAccessGiller
            ? navigation.navigate('Tabs', { screen: 'GillerRequests' })
            : navigation.navigate('GillerApply'),
      },
      {
        title: '내 동선',
        subtitle: '경로 관리',
        icon: 'alt-route',
        onPress: () => navigation.navigate('Tabs', { screen: 'RouteManagement' }),
      },
      {
        title: '수익',
        subtitle: '정산 확인',
        icon: 'payments',
        onPress: () => navigation.navigate('Earnings'),
      },
      {
        title: '출금',
        subtitle: '출금 준비',
        icon: 'account-balance',
        onPress: () => navigation.navigate('PointWithdraw'),
      },
    ],
    [canAccessGiller, navigation],
  );

  function handleRoleSwitch() {
    if (!showRoleSwitch) {
      return;
    }

    const nextRole = activeRole === UserRole.GILLER ? UserRole.GLER : UserRole.GILLER;
    if (nextRole === UserRole.GILLER && !canAccessGiller) {
      Alert.alert('길러 모드 준비 중', '본인확인과 심사 후 전환할 수 있습니다.');
      return;
    }

    switchRole(nextRole);
  }

  function handleLogout() {
    Alert.alert('로그아웃', '세션을 종료할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => {
          void logout();
        },
      },
    ]);
  }

  if (!user || loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.centerText}>프로필을 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>가는길에</Text>
        <Text style={styles.name}>{user.name ?? '사용자'}</Text>
        <Text style={styles.subtitle}>{user.phoneNumber ?? user.email}</Text>

        <View style={styles.badgeRow}>
          <Badge label={activeRole === UserRole.GILLER ? '길러 모드' : '사용자 모드'} />
          <Badge label={profileState.verificationLabel} />
          <Badge
            label={
              applicationStatus === 'approved'
                ? '승급 승인'
                : applicationStatus === 'pending'
                  ? '심사 중'
                  : '승급 전'
            }
          />
        </View>

        {showRoleSwitch ? (
          <TouchableOpacity style={styles.switchButton} onPress={handleRoleSwitch} activeOpacity={0.9}>
            <Text style={styles.switchButtonText}>
              {activeRole === UserRole.GILLER ? '사용자 모드로 전환' : '길러 모드로 전환'}
            </Text>
            <MaterialIcons name="swap-horiz" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.statGrid}>
        <MiniCard title="본인확인" value={profileState.verificationLabel} />
        <MiniCard title="계좌 준비" value={profileState.bankLabel} />
        <MiniCard title="출금 가능" value={`${profileState.withdrawableBalance.toLocaleString()}원`} />
      </View>

      <MenuSection title="사용자 메뉴" items={userLinks} />
      <MenuSection title="길러 메뉴" items={gillerLinks} />

      {!canAccessGiller ? (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('IdentityVerification')}
          activeOpacity={0.9}
        >
          <Text style={styles.actionButtonText}>본인확인 하기</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.9}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function MenuSection({ title, items }: { title: string; items: LinkItem[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item) => (
        <TouchableOpacity key={item.title} style={styles.linkCard} onPress={item.onPress} activeOpacity={0.92}>
          <View style={styles.linkIconWrap}>
            <MaterialIcons name={item.icon} size={20} color={Colors.primaryDark} />
          </View>
          <View style={styles.linkCopy}>
            <Text style={styles.linkTitle}>{item.title}</Text>
            <Text style={styles.linkSubtitle}>{item.subtitle}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={Colors.gray400} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.miniCard}>
      <Text style={styles.miniTitle}>{title}</Text>
      <Text style={styles.miniValue}>{value}</Text>
    </View>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['4xl'] },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  centerText: { marginTop: Spacing.md, color: Colors.textSecondary, ...Typography.body },
  hero: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: 10,
    ...Shadows.sm,
  },
  kicker: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  name: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: { color: Colors.textSecondary, ...Typography.body },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gray50,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  switchButton: {
    minHeight: 48,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.gray50,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchButtonText: { color: Colors.textPrimary, fontWeight: '700' },
  statGrid: { flexDirection: 'row', gap: Spacing.sm },
  miniCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  miniTitle: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    marginBottom: 6,
  },
  miniValue: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: Typography.fontSize.base,
  },
  section: { gap: 10 },
  sectionTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize.xl, fontWeight: '800' },
  linkCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Shadows.sm,
  },
  linkIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryMint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCopy: { flex: 1, gap: 4 },
  linkTitle: { color: Colors.textPrimary, fontWeight: '800' },
  linkSubtitle: { color: Colors.textTertiary, ...Typography.caption },
  actionButton: {
    minHeight: 48,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  actionButtonText: { color: Colors.primary, fontWeight: '800' },
  logoutButton: {
    minHeight: 52,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  logoutText: { color: Colors.error, fontWeight: '800' },
});
