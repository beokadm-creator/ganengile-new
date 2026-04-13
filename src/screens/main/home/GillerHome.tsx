import React, { useEffect, useRef } from 'react';
import { ScrollView, RefreshControl, View, Text, TouchableOpacity, Animated, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../../theme';
import { UserRole } from '../../../types/user';
import type { Beta1HomeSnapshot } from '../../../services/beta1-orchestration-service';
import type { MainStackNavigationProp } from '../../../types/navigation';
import {
  MetricCard,
  ActionCard,
  StatusPill,
  EmptyCard,
  WalletRow,
  sharedStyles as styles,
} from './components/SharedHomeComponents';

function CompactRoleToggle({
  isGiller,
  onToggle,
}: {
  isGiller: boolean;
  onToggle: (role: UserRole) => void;
}) {
  const slideAnim = useRef(new Animated.Value(isGiller ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isGiller ? 1 : 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 14,
    }).start();
  }, [isGiller, slideAnim]);

  const toggleWidth = 120;
  const padding = 2;
  const sliderWidth = toggleWidth / 2 - padding;

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [padding, toggleWidth / 2],
  });

  return (
    <View style={[styles.compactToggleContainer, { width: toggleWidth }]}>
      <Animated.View
        style={[
          styles.compactToggleSlider,
          {
            width: sliderWidth,
            transform: [{ translateX }],
          },
        ]}
      />
      <TouchableOpacity
        style={styles.compactToggleOption}
        activeOpacity={1}
        onPress={() => {
          if (isGiller) onToggle(UserRole.GLER);
        }}
      >
        <Text style={[styles.compactToggleText, !isGiller && styles.compactToggleTextActive]}>
          요청
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.compactToggleOption}
        activeOpacity={1}
        onPress={() => {
          if (!isGiller) onToggle(UserRole.GILLER);
        }}
      >
        <Text style={[styles.compactToggleText, isGiller && styles.compactToggleTextActive]}>
          배송
        </Text>
      </TouchableOpacity>
    </View>
  );
}

interface GillerHomeProps {
  snapshot: Beta1HomeSnapshot | null;
  navigation: MainStackNavigationProp;
  refreshing: boolean;
  onRefresh: () => void;
  showRoleSwitch: boolean;
  onSwitchRole: (role: UserRole) => void;
  canAccessGiller: boolean;
}

export function GillerHome({
  snapshot,
  navigation,
  refreshing,
  onRefresh,
  showRoleSwitch,
  onSwitchRole,
  canAccessGiller,
}: GillerHomeProps) {
  const isPreviewMode = !canAccessGiller;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {isPreviewMode && (
        <TouchableOpacity 
          style={localStyles.previewBanner}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.9}
        >
          <MaterialIcons name="visibility" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={localStyles.previewText}>길러 미리보기 모드입니다. 배송을 시작하려면 신청해 주세요.</Text>
          <MaterialIcons name="chevron-right" size={18} color="#FFFFFF" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      )}

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

        <View style={styles.metricRow}>
          <MetricCard label="진행 미션" value={`${snapshot?.activeMissionCount ?? 0}`} />
          <MetricCard
            label="예상 보상"
            value={`${(snapshot?.pendingRewardTotal ?? 0).toLocaleString()}원`}
          />
          <MetricCard
            label="출금 가능"
            value={`${(snapshot?.wallet.withdrawableBalance ?? 0).toLocaleString()}원`}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>빠른 실행</Text>
        <View style={styles.actionGrid}>
          <ActionCard
            icon="pedal-bike"
            title="미션 보드 보기"
            subtitle="지금 할 미션 확인"
            onPress={() => navigation.navigate('Tabs', { screen: 'GillerRequests' })}
          />
          <ActionCard
            icon="alt-route"
            title="경로 관리"
            subtitle="권역과 동선 설정"
            onPress={() => navigation.navigate('Tabs', { screen: 'RouteManagement' })}
          />
          <ActionCard
            icon="chat"
            title="채팅 보기"
            subtitle="대화 확인"
            onPress={() => navigation.navigate('ChatList')}
          />
          <ActionCard
            icon="account-balance-wallet"
            title="지갑 보기"
            subtitle="포인트 확인"
            onPress={() => {
              if (isPreviewMode) {
                Alert.alert('미리보기 모드', '포인트 내역은 길러 신청 후 확인할 수 있습니다.');
                return;
              }
              navigation.navigate('PointHistory');
            }}
          />
          <ActionCard
            icon="inventory-2"
            title="사물함 보기"
            subtitle="가까운 사물함 확인"
            onPress={() => navigation.navigate('LockerMap')}
          />
        </View>
      </View>

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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>내 미션</Text>
        {(snapshot?.missionCards ?? []).length ? (
          snapshot?.missionCards.slice(0, 3).map((card, index) => (
            <TouchableOpacity
              key={card.id}
              style={styles.boardCard}
              onPress={() => navigation.navigate('Tabs', { screen: 'GillerRequests' })}
            >
              <View style={styles.boardHeader}>
                <Text style={styles.boardTitle}>{card.title}</Text>
                <StatusPill label={card.status} tone="mission" />
              </View>
              <Text style={styles.boardHint}>{index === 0 ? '지금 먼저 볼 미션' : '이어서 볼 미션'}</Text>
              <Text style={styles.boardMeta}>{card.windowLabel}</Text>
              <Text style={styles.rewardText}>{card.rewardLabel}</Text>

              <View style={styles.strategyCard}>
                <Text style={styles.strategyCardTitle}>{card.strategyTitle}</Text>
                <Text style={styles.strategyCardBody}>{card.strategyBody}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <EmptyCard
            title="조건에 맞는 미션이 없습니다."
            subtitle="새로운 미션이 등록되면 여기에 표시됩니다."
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

      <View style={styles.walletCard}>
        <Text style={styles.sectionTitle}>지갑</Text>
        <WalletRow label="충전금" value={snapshot?.wallet.chargeBalance ?? 0} />
        <WalletRow label="정산금" value={snapshot?.wallet.earnedBalance ?? 0} />
        <WalletRow label="프로모션" value={snapshot?.wallet.promoBalance ?? 0} />
        <WalletRow label="출금 대기" value={snapshot?.wallet.pendingWithdrawalBalance ?? 0} />
        <View style={styles.walletDivider} />
        <WalletRow label="출금 가능" value={snapshot?.wallet.withdrawableBalance ?? 0} strong />
      </View>
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  previewBanner: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  previewText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
});