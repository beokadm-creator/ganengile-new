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
import {
  getBankIntegrationConfig,
  getIdentityIntegrationConfig,
} from '../../services/integration-config-service';
import { PointService } from '../../services/PointService';
import {
  getUserVerification,
  getVerificationStatusDisplay,
} from '../../services/verification-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp } from '../../types/navigation';
import { UserRole } from '../../types/user';

type ProfileState = {
  verificationLabel: string;
  bankLabel: string;
  withdrawableBalance: number;
};

type LinkItem = {
  key: string;
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
    verificationLabel: '본인확인 필요',
    bankLabel: '계좌 상태 확인 필요',
    withdrawableBalance: 0,
  });

  const activeRole =
    canAccessGiller && currentRole === UserRole.GILLER ? UserRole.GILLER : UserRole.GLER;
  const showRoleSwitch =
    canAccessGiller && (user?.role === UserRole.BOTH || user?.role === UserRole.GLER);

  useEffect(() => {
    let mounted = true;

    async function loadProfileState() {
      if (!user?.uid) {
        return;
      }

      try {
        const [
          verificationResult,
          identityConfigResult,
          bankConfigResult,
          pointSummaryResult,
        ] = await Promise.allSettled([
          getUserVerification(user.uid),
          getIdentityIntegrationConfig(),
          getBankIntegrationConfig(),
          PointService.getSummary(user.uid),
        ]);

        if (!mounted) {
          return;
        }

        const verification =
          verificationResult.status === 'fulfilled' ? verificationResult.value : null;
        const identityConfig =
          identityConfigResult.status === 'fulfilled'
            ? identityConfigResult.value
            : { testMode: false };
        const bankConfig =
          bankConfigResult.status === 'fulfilled'
            ? bankConfigResult.value
            : { liveReady: false, statusMessage: '계좌 상태 확인 필요' };
        const pointSummary =
          pointSummaryResult.status === 'fulfilled'
            ? pointSummaryResult.value
            : { withdrawableBalance: 0 };

        const verificationDisplay = getVerificationStatusDisplay(verification);

        setProfileState({
          verificationLabel:
            user.isVerified === true
              ? identityConfig.testMode
                ? `${verificationDisplay.statusKo} · 테스트`
                : verificationDisplay.statusKo
              : '본인확인 필요',
          bankLabel: bankConfig.liveReady
            ? '계좌 준비 완료'
            : bankConfig.statusMessage || '계좌 상태 확인 필요',
          withdrawableBalance: pointSummary.withdrawableBalance,
        });
      } catch (error) {
        console.error('Failed to load profile state', error);
        if (mounted) {
          setProfileState({
            verificationLabel: '상태 조회 실패',
            bankLabel: '상태 조회 실패',
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

  const requesterLinks = useMemo<LinkItem[]>(
    () => [
      {
        key: 'requests',
        title: '배송 요청',
        subtitle: '요청과 진행 상태를 확인합니다.',
        icon: 'inventory-2',
        onPress: () => navigation.navigate('Tabs', { screen: 'Requests' }),
      },
      {
        key: 'points',
        title: '포인트 내역',
        subtitle: '결제와 적립 내역을 확인합니다.',
        icon: 'account-balance-wallet',
        onPress: () => navigation.navigate('PointHistory'),
      },
    ],
    [navigation]
  );

  const gillerLinks = useMemo<LinkItem[]>(
    () => [
      {
        key: 'missions',
        title: '미션 보드',
        subtitle: '수행 가능한 요청을 확인합니다.',
        icon: 'two-wheeler',
        onPress: () => navigation.navigate('Tabs', { screen: 'GillerRequests' }),
      },
      {
        key: 'routes',
        title: '경로 관리',
        subtitle: '등록한 동선을 관리합니다.',
        icon: 'alt-route',
        onPress: () => navigation.navigate('Tabs', { screen: 'RouteManagement' }),
      },
      {
        key: 'earnings',
        title: '수익 확인',
        subtitle: '정산 현황을 확인합니다.',
        icon: 'payments',
        onPress: () => navigation.navigate('Earnings'),
      },
      {
        key: 'withdraw',
        title: '출금 요청',
        subtitle: '출금 가능한 금액을 정산합니다.',
        icon: 'account-balance',
        onPress: () => navigation.navigate('PointWithdraw'),
      },
    ],
    [navigation]
  );

  const commonLinks = useMemo<LinkItem[]>(
    () => [
      {
        key: 'chat',
        title: '채팅',
        subtitle: '대화와 진행 상황을 확인합니다.',
        icon: 'chat',
        onPress: () => navigation.navigate('ChatList'),
      },
      {
        key: 'terms',
        title: '약관',
        subtitle: '서비스 정책을 확인합니다.',
        icon: 'description',
        onPress: () => navigation.navigate('Terms'),
      },
      {
        key: 'address-book',
        title: '주소록',
        subtitle: '자주 쓰는 주소를 관리합니다.',
        icon: 'place',
        onPress: () => navigation.navigate('AddressBook'),
      },
    ],
    [navigation]
  );

  function handleRoleSwitch() {
    if (!showRoleSwitch) {
      return;
    }

    switchRole(activeRole === UserRole.GILLER ? UserRole.GLER : UserRole.GILLER);
  }

  function handleLogout() {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('로그아웃하시겠습니까?');
      if (!confirmed) {
        return;
      }

      void logout().catch((error) => {
        console.error('Logout failed', error);
        Alert.alert('로그아웃 실패', '잠시 후 다시 시도해 주세요.');
      });
      return;
    }

    Alert.alert('로그아웃', '로그아웃하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => {
          void logout().catch((error) => {
            console.error('Logout failed', error);
            Alert.alert('로그아웃 실패', '잠시 후 다시 시도해 주세요.');
          });
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
        <Text style={styles.kicker}>가는길에 프로필</Text>
        <Text style={styles.name}>{user.name ?? '사용자'}</Text>
        <Text style={styles.subtitle}>{user.phoneNumber ?? user.email}</Text>

        <View style={styles.badgeRow}>
          <Badge label={activeRole === UserRole.GILLER ? '길러 모드' : '이용자 모드'} />
          <Badge label={profileState.verificationLabel} />
          <Badge
            label={
              applicationStatus === 'approved'
                ? '길러 승인 완료'
                : applicationStatus === 'pending'
                  ? '길러 심사 중'
                  : '길러 미신청'
            }
          />
        </View>

        {showRoleSwitch ? (
          <TouchableOpacity style={styles.switchButton} onPress={handleRoleSwitch} activeOpacity={0.9}>
            <Text style={styles.switchButtonText}>
              {activeRole === UserRole.GILLER ? '이용자 모드로 전환' : '길러 모드로 전환'}
            </Text>
            <MaterialIcons name="swap-horiz" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.statGrid}>
        <MiniCard title="본인확인" value={profileState.verificationLabel} />
        <MiniCard title="계좌 상태" value={profileState.bankLabel} />
        <MiniCard
          title="출금 가능"
          value={`${profileState.withdrawableBalance.toLocaleString()}원`}
        />
      </View>

      {activeRole === UserRole.GILLER && canAccessGiller ? (
        <MenuSection title="길러 메뉴" items={gillerLinks} />
      ) : (
        <MenuSection title="이용자 메뉴" items={requesterLinks} />
      )}

      <MenuSection title="공통 메뉴" items={commonLinks} />

      {!canAccessGiller ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>길러 전환</Text>
          <TouchableOpacity
            style={styles.linkCard}
            onPress={() =>
              navigation.navigate(
                applicationStatus === 'pending' || user.isVerified
                  ? 'GillerApply'
                  : 'IdentityVerification'
              )
            }
            activeOpacity={0.92}
          >
            <View style={styles.linkIconWrap}>
              <MaterialIcons name="two-wheeler" size={20} color={Colors.primaryDark} />
            </View>
            <View style={styles.linkCopy}>
              <Text style={styles.linkTitle}>길러 역할로 전환해 보세요</Text>
              <Text style={styles.linkSubtitle}>
                {applicationStatus === 'pending'
                  ? '현재 심사 상태를 확인할 수 있습니다.'
                  : user.isVerified
                    ? '길러 신청 절차로 바로 이동합니다.'
                    : '본인확인 후 길러 신청 절차를 진행할 수 있습니다.'}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={Colors.gray400} />
          </TouchableOpacity>
        </View>
      ) : null}

      {!canAccessGiller && applicationStatus !== 'pending' ? (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            navigation.navigate(user.isVerified ? 'GillerApply' : 'IdentityVerification')
          }
          activeOpacity={0.9}
        >
          <Text style={styles.actionButtonText}>
            {user.isVerified ? '길러 신청 절차로 이동' : '길러 전환을 위한 본인확인'}
          </Text>
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
        <TouchableOpacity
          key={item.key}
          style={styles.linkCard}
          onPress={item.onPress}
          activeOpacity={0.92}
        >
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.primaryMint,
  },
  badgeText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  switchButton: {
    marginTop: Spacing.xs,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.gray100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchButtonText: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: Typography.fontSize.base,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  miniCard: {
    flex: 1,
    minWidth: 100,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    gap: 6,
    ...Shadows.sm,
  },
  miniTitle: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  miniValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  linkCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.sm,
  },
  linkIconWrap: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryMint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCopy: { flex: 1, gap: 4 },
  linkTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  linkSubtitle: {
    color: Colors.textTertiary,
    ...Typography.bodySmall,
  },
  actionButton: {
    minHeight: 54,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    ...Shadows.sm,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
  },
  logoutButton: {
    minHeight: 52,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gray100,
  },
  logoutText: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: Typography.fontSize.base,
  },
});
