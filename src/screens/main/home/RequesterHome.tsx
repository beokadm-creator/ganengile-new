import React from 'react';
import { ScrollView, RefreshControl, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../../theme';
import { UserRole } from '../../../types/user';
import type { Beta1HomeSnapshot } from '../../../services/beta1-orchestration-service';
import type { MainStackNavigationProp } from '../../../types/navigation';
import {
  CompactRoleToggle,
  ModeBadge,
  StatusPill,
  EmptyCard,
  PrimaryActionButton,
  QuickLinkRow,
  QuickLinkPanel,
  QuickLinkDivider,
  WalletCompact,
  sharedStyles as styles,
} from './components/SharedHomeComponents';

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
      {/* ── Hero ─────────────────────────────────────────────── */}
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
      </View>

      {/* ── Primary CTA ──────────────────────────────────────── */}
      <PrimaryActionButton
        title="배송 요청 만들기"
        subtitle="지금 또는 예약으로 바로 시작"
        onPress={() => navigation.navigate('CreateRequest')}
      />

      {/* ── Draft resume ─────────────────────────────────────── */}
      {hasRequestDraft ? (
        <View style={styles.resumeInline}>
          <Text style={styles.resumeInlineText}>임시 저장된 요청이 있습니다.</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('CreateRequest')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.resumeInlineAction}>이어서 작성</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Quick Links ──────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>바로 가기</Text>
        <QuickLinkPanel>
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
                  길러 역할 전환을 원하시면 프로필에서 본인확인과 신청 상태를 먼저 확인해 주세요.
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* ── My Requests ──────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>내 요청</Text>
        {(snapshot?.requestCards ?? []).length ? (
          snapshot?.requestCards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={styles.boardCard}
              onPress={() => navigation.navigate('RequestDetail', { requestId: card.id })}
              activeOpacity={0.88}
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
              <View style={styles.strategyNote}>
                <Text style={styles.strategyNoteTitle}>{card.strategyTitle}</Text>
                <Text style={styles.strategyNoteBody}>{card.strategyBody}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <EmptyCard
            title="진행 중인 요청이 없습니다"
            subtitle="배송 요청을 만들면 근처 길러에게 연결됩니다."
            actionLabel="배송 요청하기"
            onAction={() => navigation.navigate('CreateRequest')}
          />
        )}
      </View>

      {/* ── Wallet Compact ───────────────────────────────────── */}
      <WalletCompact
        balance={snapshot?.wallet.withdrawableBalance ?? 0}
        onPress={() => navigation.navigate('PointHistory')}
      />
    </ScrollView>
  );
}
