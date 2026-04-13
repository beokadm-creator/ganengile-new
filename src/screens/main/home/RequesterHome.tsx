import React, { useEffect, useRef } from 'react';
import { ScrollView, RefreshControl, View, Text, TouchableOpacity, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../../theme';
import { UserRole } from '../../../types/user';
import type { Beta1HomeSnapshot } from '../../../services/beta1-orchestration-service';
import type { MainStackNavigationProp } from '../../../types/navigation';
import {
  MetricCard,
  ActionCard,
  ModeBadge,
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

interface RequesterHomeProps {
  snapshot: Beta1HomeSnapshot | null;
  navigation: MainStackNavigationProp;
  refreshing: boolean;
  onRefresh: () => void;
  showRoleSwitch: boolean;
  onSwitchRole: (role: UserRole) => void;
  hasRequestDraft: boolean;
  canAccessGiller: boolean;
}

export function RequesterHome({
  snapshot,
  navigation,
  refreshing,
  onRefresh,
  showRoleSwitch,
  onSwitchRole,
  hasRequestDraft,
  canAccessGiller,
}: RequesterHomeProps) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>가는길에</Text>
            <Text style={styles.heroTitle}>
              {snapshot?.headline ?? '배송 요청을 간단하게'}
            </Text>
          </View>

          {showRoleSwitch ? (
            <CompactRoleToggle
              isGiller={false}
              onToggle={(role) => onSwitchRole(role)}
            />
          ) : null}
        </View>

        <View style={styles.metricRow}>
          <MetricCard label="진행 요청" value={`${snapshot?.activeRequestCount ?? 0}`} />
          <MetricCard label="빠른 실행" value={`${snapshot?.requestCards.length ?? 0}`} />
          <MetricCard
            label="사용 가능"
            value={`${(snapshot?.wallet.withdrawableBalance ?? 0).toLocaleString()}원`}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>빠른 실행</Text>
        {hasRequestDraft ? (
          <View style={styles.resumeInline}>
            <Text style={styles.resumeInlineText}>임시 저장된 요청이 있습니다.</Text>
            <TouchableOpacity onPress={() => navigation.navigate('CreateRequest')}>
              <Text style={styles.resumeInlineAction}>이어서 작성</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.actionGrid}>
          <ActionCard
            icon="add-box"
            title="배송 요청 만들기"
            subtitle="한 화면에서 지금 또는 예약으로 보낼 수 있어요"
            onPress={() => navigation.navigate('CreateRequest')}
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
            onPress={() => navigation.navigate('PointHistory')}
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
                길러 역할 전환을 원하시면 프로필에서 본인확인과 신청 상태를 먼저 확인해 주세요.
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>내 요청</Text>
        {(snapshot?.requestCards ?? []).length ? (
          snapshot?.requestCards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={styles.boardCard}
              onPress={() => navigation.navigate('RequestDetail', { requestId: card.id })}
            >
              <View style={styles.boardHeader}>
                <Text style={styles.boardTitle}>{card.title}</Text>
                <View style={styles.boardHeaderRight}>
                  <ModeBadge label={card.modeLabel} />
                  <StatusPill label={card.status} tone="request" />
                </View>
              </View>
              <Text style={styles.boardBody}>{card.detail}</Text>
              <Text style={styles.boardMeta}>{card.etaLabel}</Text>

              <View style={styles.strategyCard}>
                <Text style={styles.strategyCardTitle}>{card.strategyTitle}</Text>
                <Text style={styles.strategyCardBody}>{card.strategyBody}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <EmptyCard
            title="진행 중인 요청이 없습니다"
            subtitle="필요한 배송이 생기면 새 요청으로 바로 시작할 수 있습니다."
          />
        )}
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