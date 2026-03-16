/**
 * Request Detail Screen
 * 배송 요청 상세 화면 - 요청 정보와 매칭된 길러 목록 표시
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getRequest, cancelRequest } from '../../services/request-service';
import { requireUserId } from '../../services/firebase';
import { getMatchingResults } from '../../services/matching-service';
import { confirmDeliveryByRequester, getDeliveryByRequestId } from '../../services/delivery-service';
import type { Request } from '../../types/request';
import { RequestStatus } from '../../types/request';
import { toRequestDetailView } from '../../utils/request-adapters';
import { formatDateTimeKR } from '../../utils/date';
import { TextInputModal } from '../../components/common';
import AppTopBar from '../../components/common/AppTopBar';
import { formatWeightDisplay } from '../../utils/package-weight';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
  route: {
    params: {
      requestId: string;
      gillerId?: string;  // 선택한 길러 ID (선택 사항)
    };
  };
}

interface MatchingGiller {
  rank: number;
  gillerId: string;
  gillerName: string;
  score: number;
  travelTime: number;
  hasExpress: boolean;
  transferCount: number;
  reasons: string[];
}

export default function RequestDetailScreen({ navigation, route }: Props) {
  const { requestId, gillerId: selectedGillerId } = route.params;
  const [request, setRequest] = useState<Request | null>(null);
  const [detailView, setDetailView] = useState<ReturnType<typeof toRequestDetailView> | null>(null);
  const [matches, setMatches] = useState<MatchingGiller[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    loadData();
  }, [requestId]);

  const loadData = async () => {
    try {
      const userId = requireUserId();

      // 요청 정보 조회
      const requestData = await getRequest(requestId, userId);
      if (!requestData) {
        Alert.alert('오류', '요청을 찾을 수 없습니다.');
        navigation.goBack();
        return;
      }

      const typedRequest = requestData;
      setRequest(typedRequest);
      setDetailView(toRequestDetailView(typedRequest));

      // 매칭 결과 조회 (PENDING 상태인 경우만)
      if ((requestData as any).status === 'pending' || (requestData as any).status === 'matched') {
        try {
          const matchingResults = await getMatchingResults(requestId);
          setMatches(matchingResults);
        } catch (error) {
          console.error('Error loading matches:', error);
          // 매칭 실패해도 요청은 표시
        }
      }
    } catch (error) {
      console.error('Error loading request detail:', error);
      Alert.alert('오류', '요청 정보를 불러오는데 실패했습니다.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (!request) return;
    setCancelReason('');
    setCancelModalVisible(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      Alert.alert('오류', '취소 사유를 입력해주세요.');
      return;
    }

    setCancelling(true);
    try {
      const userId = requireUserId();
      await cancelRequest(requestId, userId, cancelReason.trim());

      // 로컬 상태 즉시 업데이트
      if (request) {
        setRequest({
          ...request,
          status: RequestStatus.CANCELLED,
          cancellationReason: cancelReason.trim(),
          cancelledAt: new Date() as any,
        });
        setDetailView(toRequestDetailView({
          ...request,
          status: RequestStatus.CANCELLED,
          cancellationReason: cancelReason.trim(),
          cancelledAt: new Date() as any,
        }));
      }

      setCancelModalVisible(false);

      Alert.alert(
        '✅ 취소 완료',
        '배송 요청이 취소되었습니다.\n\n이용해 주셔서 감사합니다. 다음에 또 이용해주세요!',
        [
          {
            text: '확인',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error: any) {
      console.error('Error cancelling request:', error);
      Alert.alert(
        '❌ 취소 실패',
        error.message || '요청 취소에 실패했습니다. 다시 시도해주세요.',
        [{ text: '확인' }]
      );
    } finally {
      setCancelling(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!detailView) return;
    setConfirming(true);
    try {
      const requesterId = requireUserId();
      const delivery = await getDeliveryByRequestId(detailView.requestId);
      if (!delivery?.deliveryId) {
        Alert.alert('오류', '배송 정보를 찾을 수 없습니다.');
        return;
      }
      const result = await confirmDeliveryByRequester({
        deliveryId: delivery.deliveryId,
        requesterId,
      });
      if (result.success) {
        Alert.alert('완료', result.message);
        await loadData();
      } else {
        Alert.alert('실패', result.message);
      }
    } catch (error: any) {
      Alert.alert('오류', error?.message || '수령 확인에 실패했습니다.');
    } finally {
      setConfirming(false);
    }
  };

  const getStatusColor = (status: RequestStatus): string => {
    switch (status) {
      case RequestStatus.PENDING:
        return '#FFA726';
      case RequestStatus.MATCHED:
        return '#42A5F5';
      case RequestStatus.ACCEPTED:
        return '#26C6DA';
      case RequestStatus.IN_TRANSIT:
        return '#AB47BC';
      case RequestStatus.ARRIVED:
        return '#66BB6A';
      case RequestStatus.AT_LOCKER:
        return '#7CB342';
      case RequestStatus.DELIVERED:
        return '#8BC34A';
      case RequestStatus.COMPLETED:
        return '#4CAF50';
      case RequestStatus.CANCELLED:
        return '#EF5350';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status: RequestStatus): string => {
    switch (status) {
      case RequestStatus.PENDING:
        return '매칭 대기 중';
      case RequestStatus.MATCHED:
        return '매칭 완료';
      case RequestStatus.ACCEPTED:
        return '수락 완료';
      case RequestStatus.IN_TRANSIT:
        return '배송 중';
      case RequestStatus.ARRIVED:
        return '도착 완료';
      case RequestStatus.AT_LOCKER:
        return '사물함 보관 완료';
      case RequestStatus.DELIVERED:
        return '수령 확인 대기';
      case RequestStatus.COMPLETED:
        return '배송 완료';
      case RequestStatus.CANCELLED:
        return '취소됨';
      default:
        return status;
    }
  };

  const formatDate = (date?: Date | null): string => formatDateTimeKR(date);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00BCD4" />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  if (!request || !detailView) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <AppTopBar title="요청 상세" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.content}>
        {/* Status Badge */}
        <View style={[styles.statusBanner, { backgroundColor: getStatusColor(detailView.status) }]}>
          <Text style={styles.statusText}>{getStatusText(detailView.status)}</Text>
        </View>

        {/* Route Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>배송 경로</Text>
          <View style={styles.routeContainer}>
            <View style={styles.stationInfo}>
              <Text style={styles.stationLabel}>픽업</Text>
              <Text style={styles.stationName}>{detailView.pickupStation.stationName}</Text>
              <Text style={styles.stationLine}>{detailView.pickupStation.line}</Text>
            </View>

            <View style={styles.arrowContainer}>
              <Text style={styles.arrow}>↓</Text>
              <Text style={styles.travelTime}>약 25분</Text>
            </View>

            <View style={styles.stationInfo}>
              <Text style={styles.stationLabel}>배송</Text>
              <Text style={styles.stationName}>{detailView.deliveryStation.stationName}</Text>
              <Text style={styles.stationLine}>{detailView.deliveryStation.line}</Text>
            </View>
          </View>
        </View>

        {/* Package Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>패키지 정보</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>크기</Text>
            <Text style={styles.infoValue}>
              {detailView.packageInfo.size === 'small' ? '소형' :
               detailView.packageInfo.size === 'medium' ? '중형' :
               detailView.packageInfo.size === 'large' ? '대형' : detailView.packageInfo.size}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>무게</Text>
            <Text style={styles.infoValue}>
              {formatWeightDisplay(detailView.packageInfo.weight, detailView.packageInfo.weightKg)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>설명</Text>
            <Text style={styles.infoValue}>{detailView.packageInfo.description}</Text>
          </View>
        </View>

        {/* Time Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>시간 정보</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>요청 마감</Text>
        <Text style={styles.infoValue}>{formatDate(detailView.deadline || null)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>희망 시간</Text>
            <Text style={styles.infoValue}>
              {detailView.preferredTime?.departureTime || '-'} → {detailView.preferredTime?.arrivalTime || '-'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>생성일</Text>
        <Text style={styles.infoValue}>{formatDate(detailView.createdAt || null)}</Text>
          </View>
        </View>

        {/* Fee Info */}
        <View style={styles.card}>
            <Text style={styles.cardTitle}>배송비</Text>
          <View style={styles.feeTotal}>
            <Text style={styles.feeTotalLabel}>총합계</Text>
            <Text style={styles.feeTotalValue}>
              {Number.isFinite(detailView.feeTotal) ? detailView.feeTotal.toLocaleString() : '0'}원
            </Text>
          </View>
        </View>

        {/* Matching Gillers */}
        {detailView.status === RequestStatus.PENDING && matches.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🎯 매칭된 길러 ({matches.length})</Text>
            {matches.map((match) => {
              const isSelected = match.gillerId === selectedGillerId;
              return (
                <View
                  key={match.gillerId}
                  style={[styles.gillerCard, isSelected && styles.selectedGillerCard]}
                >
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>선택됨</Text>
                    </View>
                  )}
                  <View style={styles.gillerHeader}>
                    <View style={styles.gillerRank}>
                      <Text style={styles.gillerRankText}>#{match.rank}</Text>
                    </View>
                    <View style={styles.gillerInfo}>
                      <Text style={styles.gillerName}>{match.gillerName}</Text>
                      <View style={styles.gillerStats}>
                        <Text style={styles.gillerScore}>⭐ {match.score.toFixed(1)}점</Text>
                        <Text style={styles.gillerTime}>⏱ {match.travelTime}분</Text>
                      </View>
                    </View>
                  </View>
                  {match.hasExpress && (
                    <View style={styles.expressBadge}>
                      <Text style={styles.expressText}>급행</Text>
                    </View>
                  )}
                  {match.reasons && match.reasons.length > 0 && (
                    <View style={styles.reasonsContainer}>
                      {match.reasons.map((reason, index) => (
                        <Text key={index} style={styles.reasonText}>✓ {reason}</Text>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Cancellation Info */}
        {detailView.status === RequestStatus.CANCELLED && (
          <View style={[styles.card, styles.cancelledCard]}>
            <Text style={styles.cardTitle}>⚠️ 취소 정보</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>사유</Text>
              <Text style={styles.infoValue}>{detailView.cancellationReason}</Text>
            </View>
            {detailView.cancelledAt && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>취소일</Text>
                <Text style={styles.infoValue}>{formatDate(detailView.cancelledAt)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Actions */}
        {(detailView.status === RequestStatus.PENDING || detailView.status === RequestStatus.MATCHED) && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>요청 취소</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {detailView.status === RequestStatus.DELIVERED && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.confirmButton]}
              onPress={handleConfirmDelivery}
              disabled={confirming}
            >
              {confirming ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>수령 확인</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <TextInputModal
        visible={cancelModalVisible}
        title="취소 사유"
        subtitle="배송 요청을 취소하는 사유를 입력해주세요."
        value={cancelReason}
        onChangeText={setCancelReason}
        placeholder="예: 일정 변경"
        confirmText="확인"
        cancelText="취소"
        loading={cancelling}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: 8,
    padding: 16,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  arrow: {
    color: '#666',
    fontSize: 24,
  },
  arrowContainer: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  backButton: {
    width: 40,
  },
  backButtonText: {
    color: '#333',
    fontSize: 24,
  },
  cancelButton: {
    backgroundColor: '#EF5350',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  cancelledCard: {
    backgroundColor: '#FFEBEE',
    borderColor: '#EF5350',
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  cardTitle: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  expressBadge: {
    backgroundColor: '#FF5722',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    position: 'absolute',
    right: 12,
    top: 12,
  },
  expressText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  feeBreakdown: {
    gap: 8,
  },
  feeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  feeItemLabel: {
    color: '#666',
    fontSize: 14,
  },
  feeItemValue: {
    color: '#333',
    fontSize: 14,
  },
  feeTotal: {
    alignItems: 'center',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 12,
  },
  feeTotalLabel: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  feeTotalValue: {
    color: '#00BCD4',
    fontSize: 20,
    fontWeight: 'bold',
  },
  gillerCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
    padding: 12,
  },
  selectedGillerCard: {
    backgroundColor: '#E1F5FE',
    borderColor: '#00BCD4',
    borderWidth: 2,
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#00BCD4',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  gillerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  gillerInfo: {
    flex: 1,
  },
  gillerName: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  gillerRank: {
    backgroundColor: '#00BCD4',
    borderRadius: 16,
    marginRight: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  gillerRankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  gillerScore: {
    color: '#FFA726',
    fontSize: 14,
  },
  gillerStats: {
    flexDirection: 'row',
    gap: 12,
  },
  gillerTime: {
    color: '#666',
    fontSize: 14,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    color: '#333',
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  infoLabel: {
    color: '#666',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoValue: {
    color: '#333',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  reasonText: {
    color: '#666',
    fontSize: 12,
  },
  reasonsContainer: {
    gap: 4,
  },
  routeContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stationInfo: {
    alignItems: 'center',
    flex: 1,
  },
  stationLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  stationLine: {
    color: '#00BCD4',
    fontSize: 14,
  },
  stationName: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusBanner: {
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 16,
    padding: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tag: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    color: '#F57C00',
    fontSize: 12,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  travelTime: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
});
