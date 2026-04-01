import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useRoute } from '@react-navigation/native';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { MainStackParamList } from '../../types/navigation';

type DisputeResolutionRoute = RouteProp<MainStackParamList, 'DisputeResolution'>;
type DisputeType = 'damage' | 'loss' | 'delay' | 'other' | 'quality';
type DisputeUrgency = 'normal' | 'urgent' | 'critical';
type DisputeStatus = 'pending' | 'investigating' | 'resolved' | 'rejected';
type ResolutionDecision = 'accepted' | 'rejected' | 'partial';
type ResponsibleParty = 'giller' | 'requester' | 'platform' | 'system';

type DisputeResolution = {
  decision: ResolutionDecision;
  reason: string;
  compensationAmount?: number;
  responsibleParty?: ResponsibleParty;
  determinedAt?: Date;
};

type DisputeDetail = {
  id: string;
  type: DisputeType;
  description: string;
  photoUrls: string[];
  urgency: DisputeUrgency;
  deliveryId?: string;
  matchId?: string;
  reporterId: string;
  status: DisputeStatus;
  resolution?: DisputeResolution;
  createdAt?: Date;
};

type DisputeHistoryItem = {
  id: string;
  action: string;
  note: string;
  actorName: string;
  createdAt?: Date;
};

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === 'object' && 'toDate' in value) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate();
    }
  }

  return undefined;
}

function toType(value: unknown): DisputeType {
  return value === 'damage' || value === 'loss' || value === 'delay' || value === 'other' || value === 'quality'
    ? value
    : 'other';
}

function toUrgency(value: unknown): DisputeUrgency {
  return value === 'normal' || value === 'urgent' || value === 'critical' ? value : 'normal';
}

function toStatus(value: unknown): DisputeStatus {
  return value === 'pending' || value === 'investigating' || value === 'resolved' || value === 'rejected'
    ? value
    : 'pending';
}

function toDecision(value: unknown): ResolutionDecision | undefined {
  return value === 'accepted' || value === 'rejected' || value === 'partial' ? value : undefined;
}

function toResponsibleParty(value: unknown): ResponsibleParty | undefined {
  return value === 'giller' || value === 'requester' || value === 'platform' || value === 'system' ? value : undefined;
}

function getTypeLabel(type: DisputeType): string {
  switch (type) {
    case 'damage':
      return '파손';
    case 'loss':
      return '분실';
    case 'delay':
      return '지연';
    case 'quality':
      return '품질';
    case 'other':
      return '기타';
  }
}

function getTypeIcon(type: DisputeType): React.ComponentProps<typeof Ionicons>['name'] {
  switch (type) {
    case 'damage':
      return 'warning-outline';
    case 'loss':
      return 'help-buoy-outline';
    case 'delay':
      return 'time-outline';
    case 'quality':
      return 'ribbon-outline';
    case 'other':
      return 'document-text-outline';
  }
}

function getUrgencyLabel(urgency: DisputeUrgency): string {
  switch (urgency) {
    case 'normal':
      return '일반';
    case 'urgent':
      return '긴급';
    case 'critical':
      return '매우 긴급';
  }
}

function getUrgencyColor(urgency: DisputeUrgency): string {
  switch (urgency) {
    case 'normal':
      return '#475569';
    case 'urgent':
      return '#D97706';
    case 'critical':
      return '#DC2626';
  }
}

function getStatusMeta(status: DisputeStatus): { label: string; color: string } {
  switch (status) {
    case 'pending':
      return { label: '접수 대기', color: '#D97706' };
    case 'investigating':
      return { label: '조사 중', color: '#2563EB' };
    case 'resolved':
      return { label: '해결 완료', color: '#16A34A' };
    case 'rejected':
      return { label: '반려', color: '#64748B' };
  }
}

function getDecisionLabel(decision: ResolutionDecision): string {
  switch (decision) {
    case 'accepted':
      return '인정';
    case 'rejected':
      return '기각';
    case 'partial':
      return '부분 인정';
  }
}

function getResponsiblePartyLabel(party?: ResponsibleParty): string {
  switch (party) {
    case 'giller':
      return '길러';
    case 'requester':
      return '요청자';
    case 'platform':
      return '플랫폼';
    case 'system':
      return '시스템';
    default:
      return '운영 검토 중';
  }
}

function formatDate(value?: Date): string {
  return value ? value.toLocaleString('ko-KR') : '-';
}

function mapDispute(rawId: string, raw: Record<string, unknown>): DisputeDetail {
  const resolutionRaw = raw.resolution;
  const resolutionRecord =
    resolutionRaw && typeof resolutionRaw === 'object' ? (resolutionRaw as Record<string, unknown>) : undefined;
  const decision = toDecision(resolutionRecord?.decision);

  return {
    id: rawId,
    type: toType(raw.type),
    description: typeof raw.description === 'string' ? raw.description : '',
    photoUrls: Array.isArray(raw.photoUrls)
      ? raw.photoUrls.filter((item): item is string => typeof item === 'string')
      : [],
    urgency: toUrgency(raw.urgency),
    deliveryId: typeof raw.deliveryId === 'string' ? raw.deliveryId : undefined,
    matchId: typeof raw.matchId === 'string' ? raw.matchId : undefined,
    reporterId: typeof raw.reporterId === 'string' ? raw.reporterId : '',
    status: toStatus(raw.status),
    resolution:
      resolutionRecord && decision
        ? {
            decision,
            reason: typeof resolutionRecord.reason === 'string' ? resolutionRecord.reason : '',
            compensationAmount:
              typeof resolutionRecord.compensationAmount === 'number'
                ? resolutionRecord.compensationAmount
                : undefined,
            responsibleParty: toResponsibleParty(resolutionRecord.responsibleParty),
            determinedAt: toDate(resolutionRecord.determinedAt),
          }
        : undefined,
    createdAt: toDate(raw.createdAt),
  };
}

function mapHistoryItem(rawId: string, raw: Record<string, unknown>): DisputeHistoryItem {
  return {
    id: rawId,
    action: typeof raw.action === 'string' ? raw.action : '업데이트',
    note: typeof raw.note === 'string' ? raw.note : '',
    actorName: typeof raw.actorName === 'string' ? raw.actorName : '운영 시스템',
    createdAt: toDate(raw.createdAt),
  };
}

export default function DisputeResolutionScreen() {
  const route = useRoute<DisputeResolutionRoute>();
  const [loading, setLoading] = useState(true);
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [history, setHistory] = useState<DisputeHistoryItem[]>([]);

  useEffect(() => {
    void loadDispute(route.params.disputeId);
  }, [route.params.disputeId]);

  const loadDispute = async (disputeId: string): Promise<void> => {
    try {
      setLoading(true);
      const disputeSnapshot = await getDoc(doc(db, 'disputes', disputeId));

      if (!disputeSnapshot.exists()) {
        setDispute(null);
        setHistory([]);
        return;
      }

      setDispute(mapDispute(disputeSnapshot.id, disputeSnapshot.data() as Record<string, unknown>));

      const historyQuery = query(collection(db, 'dispute_history'), where('disputeId', '==', disputeId));
      const historySnapshot = await getDocs(historyQuery);
      const items = historySnapshot.docs.map((snapshot) =>
        mapHistoryItem(snapshot.id, snapshot.data() as Record<string, unknown>)
      );
      setHistory(items.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)));
    } catch (error) {
      console.error('Failed to load dispute resolution data:', error);
      Alert.alert('분쟁 정보를 불러오지 못했습니다', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>분쟁 처리 정보를 확인하고 있습니다.</Text>
      </View>
    );
  }

  if (!dispute) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>분쟁 정보를 찾을 수 없습니다.</Text>
        <Text style={styles.emptyDescription}>접수 직후라면 잠시 뒤 다시 확인해 주세요.</Text>
      </View>
    );
  }

  const statusMeta = getStatusMeta(dispute.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.iconBadge}>
            <Ionicons name={getTypeIcon(dispute.type)} size={22} color="#1D4ED8" />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.title}>{getTypeLabel(dispute.type)} 분쟁</Text>
            <Text style={styles.subtitle}>
              접수 시각 {formatDate(dispute.createdAt)} · 긴급도{' '}
              <Text style={[styles.urgencyText, { color: getUrgencyColor(dispute.urgency) }]}>
                {getUrgencyLabel(dispute.urgency)}
              </Text>
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${statusMeta.color}14` }]}>
          <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>신고 내용</Text>
        <Text style={styles.description}>{dispute.description}</Text>
        <Text style={styles.metaText}>배송 ID: {dispute.deliveryId ?? '-'}</Text>
        <Text style={styles.metaText}>매칭 ID: {dispute.matchId ?? '-'}</Text>
        <Text style={styles.metaText}>신고자: {dispute.reporterId}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>증빙 사진</Text>
        {dispute.photoUrls.length === 0 ? (
          <Text style={styles.metaText}>등록된 사진 증빙이 아직 없습니다.</Text>
        ) : (
          dispute.photoUrls.map((url, index) => (
            <Text key={url} style={styles.metaText}>
              {index + 1}. {url}
            </Text>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>운영 판단</Text>
        {dispute.resolution ? (
          <>
            <Text style={styles.metaText}>결정: {getDecisionLabel(dispute.resolution.decision)}</Text>
            <Text style={styles.metaText}>책임 주체: {getResponsiblePartyLabel(dispute.resolution.responsibleParty)}</Text>
            <Text style={styles.metaText}>
              보상 금액: {typeof dispute.resolution.compensationAmount === 'number'
                ? `${dispute.resolution.compensationAmount.toLocaleString('ko-KR')}원`
                : '-'}
            </Text>
            <Text style={styles.metaText}>판정 시각: {formatDate(dispute.resolution.determinedAt)}</Text>
            <Text style={styles.description}>{dispute.resolution.reason || '운영 메모가 아직 없습니다.'}</Text>
          </>
        ) : (
          <Text style={styles.metaText}>아직 운영 검토가 진행 중입니다. 보증금, 환불, 패널티는 운영 판단 뒤 확정됩니다.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>처리 이력</Text>
        {history.length === 0 ? (
          <Text style={styles.metaText}>운영 이력이 아직 기록되지 않았습니다.</Text>
        ) : (
          history.map((item) => (
            <View key={item.id} style={styles.historyItem}>
              <Text style={styles.historyTitle}>{item.action}</Text>
              <Text style={styles.metaText}>{item.note || '메모 없음'}</Text>
              <Text style={styles.historyMeta}>
                {item.actorName} · {formatDate(item.createdAt)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    fontSize: 15,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
    backgroundColor: '#F8FAFC',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  urgencyText: {
    fontWeight: '700',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1E293B',
  },
  metaText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  historyItem: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyMeta: {
    fontSize: 12,
    color: '#94A3B8',
  },
});
