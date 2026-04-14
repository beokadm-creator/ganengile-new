/**
 * Requests Screen
 * View and manage delivery requests
 * Refactored with Design System components
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import type { RequestsScreenProps } from '../../src/types/navigation';
import { db, auth } from '../../src/services/firebase';
import {
  Card,
  Button,
  Chip,
} from '../../src/components';
import { Colors, Spacing, BorderRadius } from '../../src/theme';
import { Typography } from '../../src/theme/typography';

interface Request {
  id: string;
  requesterId: string;
  pickupStation: { name: string };
  deliveryStation: { name: string };
  packageInfo: {
    size: string;
    weight: string;
    description: string;
  };
  fee: number;
  status: string;
  createdAt: any;
}

export default function RequestsScreen({
  navigation,
}: RequestsScreenProps) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const packageSizeMap: { [key: string]: string } = {
    small: '소형',
    medium: '중형',
    large: '대형',
  };

  const packageWeightMap: { [key: string]: string } = {
    light: '1kg 이하',
    medium: '1kg ~ 5kg',
    heavy: '5kg ~ 10kg',
  };

  const statusMap: { [key: string]: { label: string; variant: any } } = {
    pending: { label: '매칭 대기', variant: 'accent' as const },
    matched: { label: '매칭 완료', variant: 'primary' as const },
    in_progress: { label: '배송 중', variant: 'secondary' as const },
    completed: { label: '배송 완료', variant: 'default' as const },
    cancelled: { label: '취소됨', variant: 'outline' as const },
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'requests'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const requestsData: Request[] = [];
        snapshot.forEach((doc) => {
          requestsData.push({
            id: doc.id,
            ...doc.data(),
          } as Request);
        });
        setRequests(requestsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching requests:', error);
        Alert.alert('오류', '배송 요청 목록을 불러오는데 실패했습니다.');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const handleDeleteRequest = (requestId: string) => {
    Alert.alert(
      '요청 삭제',
      '정말 이 배송 요청을 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'requests', requestId));
              Alert.alert('성공', '배송 요청이 삭제되었습니다.');
            } catch (error) {
              console.error('Error deleting request:', error);
              Alert.alert('오류', '요청 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>배송 요청 목록을 불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.xl }]}>
          <Text style={styles.title}>배송 요청 목록</Text>
          <Text style={styles.subtitle}>배송을 받을 물건을 요청하세요</Text>
        </View>

        <View style={styles.content}>
          {requests.length === 0 ? (
            <Card variant="elevated">
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📦</Text>
                <Text style={styles.emptyTitle}>배송 요청이 없습니다</Text>
                <Text style={styles.emptyText}>
                  첫 배송을 요청해보세요
                </Text>
                <Button
                  title="배송 요청하기"
                  variant="primary"
                  onPress={() => navigation.navigate('CreateRequest')}
                  fullWidth
                />
              </View>
            </Card>
          ) : (
            requests.map((request) => {
              const statusInfo = statusMap[request.status] || statusMap.pending;

              return (
                <Card key={request.id} variant="elevated" style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={styles.routeInfo}>
                      <Text style={styles.routeText}>
                        {request.pickupStation.name} → {request.deliveryStation.name}
                      </Text>
                      <Text style={styles.packageInfo}>
                        {packageSizeMap[request.packageInfo.size]} • {packageWeightMap[request.packageInfo.weight]}
                      </Text>
                    </View>
                    <Chip
                      label={statusInfo.label}
                      variant={statusInfo.variant}
                      size="small"
                    />
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.requestDetails}>
                    <Text style={styles.detailLabel}>물건 설명</Text>
                    <Text style={styles.detailValue}>{request.packageInfo.description}</Text>
                  </View>

                  <View style={styles.requestDetails}>
                    <Text style={styles.detailLabel}>배송비</Text>
                    <Text style={styles.fee}>{request.fee.toLocaleString()}원</Text>
                  </View>

                  <View style={styles.requestActions}>
                    <Button
                      title="상세 보기"
                      variant="outline"
                      size="small"
                      onPress={() => navigation.navigate('RequestDetail', { requestId: request.id })}
                      style={styles.actionButton}
                    />
                    <Button
                      title="삭제"
                      variant="ghost"
                      size="small"
                      onPress={() => handleDeleteRequest(request.id)}
                      style={styles.actionButton}
                    />
                  </View>
                </Card>
              );
            })
          )}
        </View>

        <View style={{ height: 100 + insets.bottom }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray50,
    flex: 1,
  },
  header: {
    backgroundColor: Colors.primary,
    padding: Spacing.xl,
  },
  title: {
    color: Colors.white,
    fontSize: Typography.fontSize["4xl"],
    fontWeight: Typography.fontWeight.bold as any,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    opacity: 0.9,
  },
  content: {
    padding: Spacing.lg,
  },
  requestCard: {
    marginBottom: Spacing.md,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  routeInfo: {
    flex: 1,
  },
  routeText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold as any,
    marginBottom: Spacing.xs,
  },
  packageInfo: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.gray200,
    marginVertical: Spacing.md,
  },
  requestDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  detailLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  detailValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium as any,
  },
  fee: {
    color: Colors.accent,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold as any,
  },
  requestActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold as any,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
    marginTop: Spacing.md,
  },
});
