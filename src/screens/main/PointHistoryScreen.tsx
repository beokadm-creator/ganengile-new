import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { PointService } from '../../services/PointService';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type NavigationProp = StackNavigationProp<any>;

interface PointSummary {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  recentTransactions: any[];
}

export default function PointHistoryScreen({ navigation }: { navigation: NavigationProp }) {
  const [summary, setSummary] = useState<PointSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPointSummary = async () => {
    try {
      setLoading(true);
      const userId = 'current-user-id';
      const data = await PointService.getSummary(userId);
      setSummary(data);
    } catch (error) {
      console.error('Failed to load point summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPointSummary();
    setRefreshing(false);
  };

  useEffect(() => {
    loadPointSummary();
  }, []);

  const formatAmount = (amount: number): string => {
    return `${amount > 0 ? '+' : ''}${amount.toLocaleString()} P`;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>현재 포인트</Text>
          <Text style={styles.balance}>
            {summary?.balance?.toLocaleString() || '0'} P
          </Text>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>총 적립</Text>
              <Text style={styles.statValue}>
                +{(summary?.totalEarned || 0).toLocaleString()} P
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>총 사용</Text>
              <Text style={styles.statValue}>
                -{(summary?.totalSpent || 0).toLocaleString()} P
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.withdrawButton}
          onPress={() => navigation.navigate('PointWithdraw')}
        >
          <Text style={styles.withdrawButtonText}>출금하기</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>최근 내역</Text>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} />
        ) : summary?.recentTransactions?.map((transaction: any) => (
          <View key={transaction.transactionId} style={styles.transactionItem}>
            <View style={styles.transactionLeft}>
              <Text style={styles.transactionDescription}>
                {transaction.description}
              </Text>
              <Text style={styles.transactionDate}>
                {new Date(transaction.createdAt?.toDate?.()).toLocaleDateString()}
              </Text>
            </View>
            <Text
              style={[
                styles.transactionAmount,
                transaction.amount > 0 ? styles.amountPositive : styles.amountNegative,
              ]}
            >
              {formatAmount(transaction.amount)}
            </Text>
          </View>
        )) || []}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  summaryTitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  balance: {
    ...Typography.h1,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.lg,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  statValue: {
    ...Typography.h4,
    fontWeight: '600',
  },
  withdrawButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  withdrawButtonText: {
    ...Typography.h3,
    color: Colors.white,
    fontWeight: 'bold',
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
    marginTop: Spacing.xl,
  },
  transactionItem: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionLeft: {
    flex: 1,
  },
  transactionDescription: {
    ...Typography.body,
    marginBottom: Spacing.xs,
  },
  transactionDate: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  transactionAmount: {
    ...Typography.h4,
    fontWeight: '600',
  },
  amountPositive: {
    color: Colors.success,
  },
  amountNegative: {
    color: Colors.error,
  },
});
