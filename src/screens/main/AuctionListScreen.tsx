/**
 * Auction List Screen
 * 경매 목록 화면 (사용자의 경매 목록)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getAuctionsByGller, toAuctionListItem } from '../../services/auction-service';
import { requireUserId } from '../../services/firebase';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import { AuctionStatus } from '../../types/auction';
import type { AuctionListItem } from '../../types/auction';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

export default function AuctionListScreen({ navigation }: Props) {
  const [auctions, setAuctions] = useState<AuctionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAuctions();
  }, []);

  const loadAuctions = async () => {
    try {
      const userId = requireUserId();
      const data = await getAuctionsByGller(userId);
      const listItems = data.map(auction => toAuctionListItem(auction));
      setAuctions(listItems);
    } catch (error) {
      console.error('Error loading auctions:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAuctions();
    setRefreshing(false);
  };

  const getStatusColor = (status: AuctionStatus): string => {
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
  };

  const getStatusText = (status: AuctionStatus): string => {
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
  };

  const formatRemainingTime = (seconds: number): string => {
    if (seconds <= 0) return '마감';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  };

  const getPackageSizeText = (size: string): string => {
    switch (size) {
      case 'small':
        return '소형';
      case 'medium':
        return '중형';
      case 'large':
        return '대형';
      case 'xl':
        return '특대';
      default:
        return size;
    }
  };

  const renderAuction = ({ item }: { item: AuctionListItem }) => (
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
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>💵 현재가</Text>
            <Text style={styles.infoValue}>{item.currentHighestBid.toLocaleString()}원</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📦 크기</Text>
            <Text style={styles.infoValue}>{getPackageSizeText(item.packageSize)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>👥 입찰 수</Text>
            <Text style={styles.infoValue}>{item.totalBids}개</Text>
          </View>

          {item.status === AuctionStatus.ACTIVE && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>⏰ 남은 시간</Text>
              <Text style={styles.infoValue}>{formatRemainingTime(item.remainingSeconds)}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📅 생성일</Text>
            <Text style={styles.infoValue}>
              {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString() : '알 수 없음'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🔨</Text>
      <Text style={styles.emptyTitle}>경매가 없습니다</Text>
      <Text style={styles.emptyDesc}>
        첫 번째 경매를 만들어보세요!
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>로딩 중...</Text>
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
        data={auctions}
        keyExtractor={(item) => item.auctionId}
        renderItem={renderAuction}
        contentContainerStyle={auctions.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      <TouchableOpacity
        style={styles.createButton}
        onPress={() => navigation.navigate('CreateAuction')}
      >
        <Text style={styles.createButtonText}>새 경매 만들기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  header: {
    backgroundColor: Colors.primary,
    padding: Spacing.large,
    paddingBottom: Spacing.medium,
    paddingTop: 60,
  },
  title: {
    ...Typography.headerLarge,
    color: Colors.white,
  },
  subtitle: {
    ...Typography.bodyRegular,
    color: Colors.white,
    marginTop: 4,
    opacity: 0.9,
  },
  list: {
    padding: Spacing.medium,
    paddingBottom: 80,
  },
  emptyList: {
    flex: 1,
  },
  auctionCard: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    marginBottom: Spacing.small,
    overflow: 'hidden',
  },
  cardContent: {
    padding: Spacing.medium,
  },
  auctionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.small,
  },
  routeInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  stationName: {
    ...Typography.bodySemibold,
    color: Colors.textPrimary,
  },
  arrow: {
    color: Colors.textSecondary,
    fontSize: 16,
    marginHorizontal: 8,
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusText: {
    ...Typography.captionSemibold,
    color: Colors.white,
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
    ...Typography.bodyRegular,
    color: Colors.textSecondary,
  },
  infoValue: {
    ...Typography.bodySemibold,
    color: Colors.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xlarge,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    ...Typography.headerMedium,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyDesc: {
    ...Typography.bodyRegular,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    ...Typography.bodyRegular,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  createButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.medium,
    bottom: 16,
    left: 16,
    paddingVertical: Spacing.medium,
    position: 'absolute',
    right: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  createButtonText: {
    ...Typography.bodySemibold,
    color: Colors.white,
    textAlign: 'center',
  },
});
