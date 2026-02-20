/**
 * Dispute Resolution Screen
 * 분쟁 해결 화면 (P2-2)
 *
 * 기능:
 * - 분쟁 내역 표시
 * - 증거 수집 현황
 * - 자동 판정 결과 표시
 * - 보상 지급 현황
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { requireUserId } from '../../services/firebase';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
  route?: {
    params?: {
      disputeId: string;
    };
  };
}

interface DisputeDetail {
  id: string;
  type: 'damage' | 'loss' | 'delay' | 'other';
  description: string;
  photos: string[];
  urgency: 'normal' | 'urgent' | 'critical';
  deliveryId?: string;
  matchId?: string;
  reporterId: string;
  status: 'pending' | 'investigating' | 'resolved';
  resolution?: {
    decision: 'accepted' | 'rejected' | 'partial';
    reason: string;
    compensationAmount?: number;
    responsibleParty?: 'giller' | 'requester' | 'platform';
    determinedAt: any;
  };
  createdAt: any;
}

export default function DisputeResolutionScreen({ navigation, route }: Props) {
  const [loading, setLoading] = useState(true);
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const disputeId = route?.params?.disputeId;

    if (disputeId) {
      loadDispute(disputeId);
    } else {
      setLoading(false);
    }
  }, [route]);

  const loadDispute = async (disputeId: string) => {
    try {
      setLoading(true);

      const db = getFirestore();
      const disputeRef = doc(db, 'disputes', disputeId);
      const disputeDoc = await getDoc(disputeRef);

      if (disputeDoc.exists()) {
        const data = disputeDoc.data();
        setDispute({
          id: disputeDoc.id,
          type: data.type,
          description: data.description,
          photos: data.photos || [],
          urgency: data.urgency,
          deliveryId: data.deliveryId,
          matchId: data.matchId,
          reporterId: data.reporterId,
          status: data.status,
          resolution: data.resolution,
          createdAt: data.createdAt,
        });

        // 분쟁 처리 이력 로드
        await loadDisputeHistory(disputeId);
      }
    } catch (error) {
      console.error('Error loading dispute:', error);
      Alert.alert('오류', '분쟁 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadDisputeHistory = async (disputeId: string) => {
    try {
      setLoadingHistory(true);

      const db = getFirestore();
      const historyRef = collection(db, 'dispute_history');
      const q = query(
        historyRef,
        where('disputeId', '==', disputeId)
      );

      const snapshot = await getDocs(q);
      const historyData: any[] = [];

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        historyData.push({
          id: docSnapshot.id,
          ...data,
        });
      });

      setHistory(historyData);
    } catch (error) {
      console.error('Error loading dispute history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'damage':
        return '파손';
      case 'loss':
        return '분실';
      case 'delay':
        return '지연';
      case 'other':
        return '기타';
      default:
        return '';
    }
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'damage':
        return '💥';
      case 'loss':
        return '📦';
      case 'delay':
        return '⏰';
      case 'other':
        return '❓';
      default:
        return '';
    }
  };

  const getStatusLabel = (status: string): { label: string; color: string } => {
    switch (status) {
      case 'pending':
        return { label: '접수 대기', color: '#FF9800' }; // Orange
      case 'investigating':
        return { label: '조사 중', color: '#2196F3' }; // Blue
      case 'resolved':
        return { label: '해결 완료', color: '#4CAF50' }; // Green
      default:
        return { label: '알 수 없음', color: '#9E9E9E' };
    }
  };

  const getResolutionDecisionLabel = (decision: string): string => {
    switch (decision) {
      case 'accepted':
        return '승인';
      case 'rejected':
        return '기각';
      case 'partial':
        return '일부 승인';
      default:
        return '';
    }
  };

  const getResponsiblePartyLabel = (party: string): string => {
    switch (party) {
      case 'giller':
        return '길러';
      case 'requester':
        return '의뢰인';
      case 'platform':
        return '플랫폼';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>분쟁 정보를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>분쟁 해결</Text>
        <Text style={styles.headerSubtitle}>
          분쟁 처리 결과를 확인하세요
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {dispute && (
          <>
            {/* 분쟁 기본 정보 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>분쟁 정보</Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>분쟁 유형</Text>
                <View style={styles.infoValue}>
                  <Text style={styles.typeIcon}>{getTypeIcon(dispute.type)}</Text>
                  <Text style={styles.typeText}>{getTypeLabel(dispute.type)}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>긴급도</Text>
                <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(dispute.urgency) }]}>
                  <Text style={styles.urgencyBadgeText}>{dispute.urgency.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>접수 일자</Text>
                <Text style={styles.infoValue}>
                  {dispute.createdAt ? new Date(dispute.createdAt.toDate()).toLocaleDateString('ko-KR') : '-'}
                </Text>
              </View>
            </View>

            {/* 처리 상태 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>처리 상태</Text>

              <View style={styles.statusCard}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusLabel(dispute.status).color }]}>
                  <Text style={styles.statusBadgeText}>{getStatusLabel(dispute.status).label}</Text>
                </View>
              </View>
            </View>

            {/* 해결 결과 */}
            {dispute.resolution && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>해결 결과</Text>

                <View style={styles.resolutionCard}>
                  {/* 판정 결과 */}
                  <View style={styles.resolutionItem}>
                    <Text style={styles.resolutionLabel}>판정 결과</Text>
                    <View style={[styles.resolutionBadge, { backgroundColor: getResolutionColor(dispute.resolution.decision) }]}>
                      <Text style={styles.resolutionBadgeText}>
                        {getResolutionDecisionLabel(dispute.resolution.decision)}
                      </Text>
                    </View>
                  </View>
                  </View>

                  {/* 사유 */}
                  <View style={styles.resolutionItem}>
                    <Text style={styles.resolutionLabel}>사유</Text>
                    <Text style={styles.resolutionValue}>{dispute.resolution.reason}</Text>
                  </View>

                  {/* 책임 당사자 */}
                  {dispute.resolution.responsibleParty && (
                    <View style={styles.resolutionItem}>
                      <Text style={styles.resolutionLabel}>책임 당사자</Text>
                      <Text style={styles.resolutionValue}>
                        {getResponsiblePartyLabel(dispute.resolution.responsibleParty)}
                      </Text>
                    </View>
                  )}

                  {/* 보상 금액 */}
                  {dispute.resolution.compensationAmount && (
                    <View style={styles.resolutionItem}>
                      <Text style={styles.resolutionLabel}>보상 금액</Text>
                      <Text style={styles.resolutionValue}>
                        {dispute.resolution.compensationAmount.toLocaleString()}원
                      </Text>
                    </View>
                  )}

                  {/* 판정 일자 */}
                  <View style={styles.resolutionItem}>
                    <Text style={styles.resolutionLabel}>판정 일자</Text>
                    <Text style={styles.resolutionValue}>
                      {dispute.resolution.determinedAt ? new Date(dispute.resolution.determinedAt.toDate()).toLocaleDateString('ko-KR') : '-'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* 상세 설명 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>상세 설명</Text>

              <View style={styles.descriptionCard}>
                <Text style={styles.descriptionText}>{dispute.description}</Text>
              </View>

              {/* 사진 증거 */}
              {dispute.photos.length > 0 && (
                <>
                  <Text style={styles.photosTitle}>증거 사진</Text>
                  <ScrollView horizontal style={styles.photosScroll} showsHorizontalScrollIndicator={false}>
                    {dispute.photos.map((photo, index) => (
                      <Image key={index} source={{ uri: photo }} style={styles.photoImage} />
                    ))}
                  </ScrollView>
                </>
              )}
            </View>

            {/* 처리 이력 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>처리 이력</Text>

              {loadingHistory ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : history.length > 0 ? (
                history.map((item, index) => (
                  <View key={index} style={styles.historyItem}>
                    <Text style={styles.historyTime}>
                      {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleString('ko-KR') : '-'}
                    </Text>
                    <Text style={styles.historyAction}>{item.action}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>처리 이력이 없습니다</Text>
              )}
            </View>
          </>
        )}

        {dispute && dispute.status === 'resolved' && (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeIcon}>✅</Text>
            <Text style={styles.noticeText}>
              분쟁이 해결되었습니다. 만족하시는 결과인지 체크해주세요.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* 하단 버튼 */}
      {dispute && dispute.status === 'resolved' && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.closeButtonText}>닫기</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body1,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  section: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    ...Typography.body1,
    color: Colors.textSecondary,
  },
  infoValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  typeText: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '600',
  },
  urgencyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  urgencyBadgeText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '600',
  },
  statusCard: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  statusBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  statusBadgeText: {
    ...Typography.h3,
    color: Colors.white,
    fontWeight: '700',
  },
  resolutionCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  resolutionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  resolutionLabel: {
    ...Typography.body1,
    color: Colors.textSecondary,
  },
  resolutionValue: {
    ...Typography.body1,
    color: Colors.text,
    fontWeight: '600',
  },
  resolutionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  resolutionBadgeText: {
    ...Typography.body2,
    color: Colors.white,
    fontWeight: '600',
  },
  descriptionCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  descriptionText: {
    ...Typography.body1,
    color: Colors.text,
    lineHeight: 22,
  },
  photosTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  photosScroll: {
    marginTop: Spacing.sm,
  },
  photoImage: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  historyTime: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginRight: Spacing.md,
  },
  historyAction: {
    ...Typography.body1,
    color: Colors.text,
    flex: 1,
  },
  emptyText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    textAlign: 'center',
    padding: Spacing.lg,
  },
  noticeCard: {
    backgroundColor: '#4CAF50',
    margin: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  noticeIcon: {
    fontSize: 32,
    marginRight: Spacing.md,
  },
  noticeText: {
    ...Typography.body1,
    color: Colors.white,
    flex: 1,
  },
  footer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  closeButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  closeButtonText: {
    ...Typography.h3,
    color: Colors.white,
    fontWeight: '700',
  },
});

// Helper functions
function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case 'normal':
      return '#4CAF50'; // Green
    case 'urgent':
      return '#FF9800'; // Orange
    case 'critical':
      return '#FF5252'; // Red
    default:
      return '#9E9E9E';
  }
}

function getResolutionColor(decision: string): string {
  switch (decision) {
    case 'accepted':
      return '#4CAF50'; // Green
    case 'rejected':
      return '#FF5252'; // Red
    case 'partial':
      return '#FF9800'; // Orange
    default:
      return '#9E9E9E';
  }
}
