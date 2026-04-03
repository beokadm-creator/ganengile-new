import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { getAuctionsByRequester, toAuctionListItem } from '../../services/auction-service';
import { requireUserId } from '../../services/firebase';
import { AuctionStatus, type AuctionListItem } from '../../types/auction';
import type { MainStackParamList } from '../../types/navigation';
import { BorderRadius, Colors, Spacing, Typography } from '../../theme';

type NavigationProp = StackNavigationProp<MainStackParamList, 'AuctionList'>;

interface Props {
  navigation: NavigationProp;
}

function getStatusColor(status: AuctionStatus): string {
  switch (status) {
    case AuctionStatus.PENDING:
      return '#FFA726';
    case AuctionStatus.ACTIVE:
      return '#42A5F5';
    case AuctionStatus.CLOSED:
      return '#4CAF50';
    case AuctionStatus.CANCELLED:
      return '#EF5350';
    case AuctionStatus.EXPIRED:
      return '#9E9E9E';
    default:
      return '#9E9E9E';
  }
}

function getStatusText(status: AuctionStatus): string {
  switch (status) {
    case AuctionStatus.PENDING:
      return '대기 중';
    case AuctionStatus.ACTIVE:
      return '진행 중';
    case AuctionStatus.CLOSED:
      return '마감';
    case AuctionStatus.CANCELLED:
      return '취소';
    case AuctionStatus.EXPIRED:
      return '만료';
    default:
      return status;
  }
}

function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) {
    return '마감';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }
  return `${minutes}분`;
}

function getPackageSizeText(size: string): string {
  switch (size) {
    case 'small':
      return '소형';
    case 'medium':
      return '중형';
    case 'large':
      return '대형';
    case 'xl':
      return '특대형';
    default:
      return size;
  }
}

export default function AuctionListScreen({ navigation }: Props) {
  const [auctions, setAuctions] = useState<AuctionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void loadAuctions();
  }, []);

  async function loadAuctions(): Promise<void> {
    try {
      const userId = requireUserId();
      const data = await getAuctionsByRequester(userId);
      setAuctions(data.map((auction) => toAuctionListItem(auction)));
    } catch (error) {
      console.error('Failed to load auctions', error);
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh(): Promise<void> {
    setRefreshing(true);
    await loadAuctions();
    setRefreshing(false);
  }

  function renderAuction({ item }: { item: AuctionListItem }) {
    return (
      <View style={styles.auctionCard}>
        <View style={styles.cardContent}>
          <View style={styles.auctionHeader}>
            <View style={styles.routeInfo}>
              <Text style={styles.stationName}>{item.pickupStationName}</Text>
              <Text style={styles.arrow}>→</Text>
              <Text style={styles.stationName}>{item.deliveryStationName}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
            </View>
          </View>

          <View style={styles.auctionBody}>
            <InfoRow label="현재 최고가" value={`${item.currentHighestBid.toLocaleString('ko-KR')}원`} />
            <InfoRow label="물품 크기" value={getPackageSizeText(item.packageSize)} />
            <InfoRow label="입찰 수" value={`${item.totalBids}건`} />
            {item.status === AuctionStatus.ACTIVE ? (
              <InfoRow label="남은 시간" value={formatRemainingTime(item.remainingSeconds)} />
            ) : null}
            <InfoRow
              label="생성일"
              value={item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString('ko-KR') : '정보 없음'}
            />
          </View>
        </View>
      </View>
    );
  }

  function renderEmptyState() {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>경매</Text>
        <Text style={styles.emptyTitle}>아직 등록한 경매가 없습니다</Text>
        <Text style={styles.emptyDesc}>가는길에 동선에 맞춰 첫 경매를 열어보세요.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>경매 목록을 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>내 경매</Text>
        <Text style={styles.subtitle}>총 {auctions.length}개의 경매</Text>
      </View>

      <FlatList
        contentContainerStyle={auctions.length === 0 ? styles.emptyList : styles.list}
        data={auctions}
        keyExtractor={(item) => item.auctionId}
        ListEmptyComponent={renderEmptyState}
        refreshControl={<RefreshControl onRefresh={() => void onRefresh()} refreshing={refreshing} />}
        renderItem={renderAuction}
      />

      <TouchableOpacity onPress={() => navigation.navigate('CreateAuction')} style={styles.createButton}>
        <Text style={styles.createButtonText}>새 경매 만들기</Text>
      </TouchableOpacity>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray100,
    flex: 1,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
  },
  title: {
    ...Typography.h1,
    color: Colors.white,
  },
  subtitle: {
    ...Typography.body1,
    color: Colors.white,
    marginTop: 4,
    opacity: 0.9,
  },
  list: {
    padding: Spacing.md,
    paddingBottom: 80,
  },
  emptyList: {
    flex: 1,
  },
  auctionCard: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  cardContent: {
    padding: Spacing.md,
  },
  auctionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  routeInfo: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  stationName: {
    ...Typography.bodyBold,
    color: Colors.textPrimary,
  },
  arrow: {
    color: Colors.textSecondary,
    marginHorizontal: 8,
  },
  statusBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '700',
  },
  auctionBody: {
    gap: 8,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    ...Typography.body1,
    color: Colors.textSecondary,
  },
  infoValue: {
    ...Typography.bodyBold,
    color: Colors.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  emptyIcon: {
    color: Colors.textSecondary,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyDesc: {
    ...Typography.body1,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    ...Typography.body1,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  createButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    bottom: 16,
    left: 16,
    paddingVertical: Spacing.lg,
    position: 'absolute',
    right: 16,
  },
  createButtonText: {
    ...Typography.bodyBold,
    color: Colors.white,
    textAlign: 'center',
  },
});
