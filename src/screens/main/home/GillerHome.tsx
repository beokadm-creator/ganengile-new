import React from 'react';
import {
  ScrollView,
  RefreshControl,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BorderRadius, Colors, Spacing } from '../../../theme';
import { Typography } from '../../../theme/typography';
import { UserRole } from '../../../types/user';
import type { Beta1HomeSnapshot } from '../../../services/beta1-orchestration-service';
import type { MainStackNavigationProp } from '../../../types/navigation';
import {
  CompactRoleToggle,
  StatusPill,
  EmptyCard,
  PrimaryActionButton,
  QuickLinkRow,
  QuickLinkPanel,
  QuickLinkDivider,
  WalletCompact,
  sharedStyles as styles,
} from './components/SharedHomeComponents';

interface GillerHomeProps {
  snapshot: Beta1HomeSnapshot | null;
  navigation: MainStackNavigationProp;
  refreshing: boolean;
  onRefresh: () => void;
  showRoleSwitch: boolean;
  onSwitchRole: (role: UserRole) => void;
  canAccessGiller: boolean;
}

const localStyles = StyleSheet.create({
  previewBanner: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  previewText: {
    color: Colors.textWhite,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    flex: 1,
  },
});

export function GillerHome({
  user,
  snapshot,
  navigation,
  refreshing,
  onRefresh,
  showRoleSwitch,
  onSwitchRole,
  canAccessGiller,
}: GillerHomeProps & { user: any }) {
  const isPreviewMode = !canAccessGiller;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* ── Preview banner ────────────────────────────────────── */}
      {isPreviewMode ? (
        <TouchableOpacity
          style={localStyles.previewBanner}
          onPress={() => navigation.navigate('Tabs', { screen: 'Profile' })}
          activeOpacity={0.9}
        >
          <MaterialIcons name="visibility" size={16} color={Colors.textWhite} />
          <Text style={localStyles.previewText}>
            길러 미리보기 모드입니다. 배송을 시작하려면 신청해 주세요.
          </Text>
          <MaterialIcons name="chevron-right" size={18} color={Colors.textWhite} />
        </TouchableOpacity>
      ) : null}

      {/* ── Hero ─────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>가는길에</Text>
            <Text style={styles.heroTitle}>
              {snapshot?.headline ?? '지금 받을 미션만 빠르게'}
            </Text>
          </View>
          {showRoleSwitch ? (
            <CompactRoleToggle
              isGiller={true}
              onToggle={(role) => onSwitchRole(role)}
            />
          ) : null}
        </View>
      </View>

      {/* ── Primary CTA ──────────────────────────────────────── */}
      <PrimaryActionButton
        title="미션 보드 보기"
        subtitle="지금 수락 가능한 미션 확인"
        onPress={() => navigation.navigate('Tabs', { screen: 'GillerRequests' })}
      />

      {/* ── Quick Links ──────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>바로 가기</Text>
        <QuickLinkPanel>
          <QuickLinkRow
            icon="alt-route"
            title="경로 관리"
            onPress={() => navigation.navigate('Tabs', { screen: 'RouteManagement' })}
          />
          {isPreviewMode ? (
            <>
              <QuickLinkDivider />
              <QuickLinkRow
                icon="assignment"
                title="길러 신청하기"
                onPress={() => navigation.navigate('GillerApply')}
              />
            </>
          ) : (
            <>
              <QuickLinkDivider />
              <QuickLinkRow
                icon="chat"
                title="채팅 보기"
                onPress={() => navigation.navigate('ChatList')}
              />
              <QuickLinkDivider />
              <QuickLinkRow
                icon="account-balance-wallet"
                title="지갑 보기"
                onPress={() => navigation.navigate('PointHistory')}
              />
              <QuickLinkDivider />
              <QuickLinkRow
                icon="inventory-2"
                title="사물함 보기"
                onPress={() => navigation.navigate('LockerMap')}
              />
            </>
          )}
        </QuickLinkPanel>
      </View>

      {/* ── Recommendations ──────────────────────────────────── */}
      {(snapshot?.recommendations?.length ?? 0) > 0 || !canAccessGiller ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>추천</Text>
          <View style={styles.panel}>
            {(snapshot?.recommendations ?? []).map((item) => (
              <View key={item} style={styles.recommendationRow}>
                <MaterialIcons name="auto-awesome" size={18} color={Colors.primary} />
                <Text style={styles.recommendationText}>{item}</Text>
              </View>
            ))}
            {!canAccessGiller ? (
              <View style={styles.recommendationRow}>
                <MaterialIcons name="two-wheeler" size={18} color={Colors.primary} />
                <Text style={styles.recommendationText}>
                  길러 신청 후 활동을 시작해 보세요.
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* ── My Missions ──────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>내 미션</Text>
        {(snapshot?.missionCards ?? []).length ? (
          snapshot?.missionCards.slice(0, 3).map((card) => (
            <TouchableOpacity
              key={card.id}
              style={styles.boardCard}
              onPress={() => navigation.navigate('Tabs', { screen: 'GillerRequests' })}
              activeOpacity={0.88}
            >
              <View style={styles.boardHeader}>
                <Text style={styles.boardTitle}>{card.title}</Text>
                <StatusPill label={card.status} tone="mission" />
              </View>
              <Text style={styles.boardMeta}>{card.windowLabel}</Text>
              <Text style={styles.rewardText}>{card.rewardLabel}</Text>
              <View style={styles.strategyNote}>
                <Text style={styles.strategyNoteTitle}>{card.strategyTitle}</Text>
                <Text style={styles.strategyNoteBody}>{card.strategyBody}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <EmptyCard
            title="조건에 맞는 미션이 없습니다"
            subtitle="새로운 미션이 등록되면 바로 알려드릴게요."
            actionLabel="미션 보드 보기"
            onAction={() => navigation.navigate('Tabs', { screen: 'GillerRequests' })}
          />
        )}
        {(snapshot?.missionCards ?? []).length > 3 ? (
          <TouchableOpacity
            style={styles.moreLink}
            onPress={() => navigation.navigate('Tabs', { screen: 'GillerRequests' })}
            activeOpacity={0.88}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <Text style={styles.moreLinkText}>미션 보드 전체 보기</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Wallet Compact ───────────────────────────────────── */}
      <WalletCompact
        balance={user?.pointBalance ?? snapshot?.wallet.withdrawableBalance ?? 0}
        onPress={() => {
          if (isPreviewMode) {
            Alert.alert('미리보기 모드', '포인트 내역은 길러 신청 후 확인할 수 있습니다.');
            return;
          }
          navigation.navigate('PointHistory');
        }}
      />
    </ScrollView>
  );
}
