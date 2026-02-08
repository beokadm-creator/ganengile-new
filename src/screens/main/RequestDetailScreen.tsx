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
import type { DeliveryRequest, DeliveryStatus } from '../../types/delivery';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
  route: {
    params: {
      requestId: string;
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
  const { requestId } = route.params;
  const [request, setRequest] = useState<DeliveryRequest | null>(null);
  const [matches, setMatches] = useState<MatchingGiller[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

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

      setRequest(requestData as any);

      // 매칭 결과 조회 (PENDING 상태인 경우만)
      if ((requestData as any).status === 'pending') {
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

    Alert.prompt(
      '취소 사유',
      '배송 요청을 취소하는 사유를 입력해주세요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          onPress: async (reason: string | undefined) => {
            if (!reason || reason.trim().length === 0) {
              Alert.alert('오류', '취소 사유를 입력해주세요.');
              return;
            }

            setCancelling(true);
            try {
              const userId = requireUserId();
              await cancelRequest(requestId, userId, reason);
              Alert.alert('성공', '배송 요청이 취소되었습니다.', [
                { text: '확인', onPress: () => navigation.goBack() },
              ]);
            } catch (error) {
              console.error('Error cancelling request:', error);
              Alert.alert('오류', '요청 취소에 실패했습니다.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
      'plain-text',
      ''
    );
  };

  const getStatusColor = (status: DeliveryStatus): string => {
    switch (status) {
      case 'pending':
        return '#FFA726';
      case 'matched':
        return '#42A5F5';
      case 'accepted':
        return '#26C6DA';
      case 'in_transit':
        return '#AB47BC';
      case 'arrived':
        return '#66BB6A';
      case 'completed':
        return '#4CAF50';
      case 'cancelled':
        return '#EF5350';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status: DeliveryStatus): string => {
    switch (status) {
      case 'pending':
        return '매칭 대기 중';
      case 'matched':
        return '매칭 완료';
      case 'accepted':
        return '수락 완료';
      case 'in_transit':
        return '배송 중';
      case 'arrived':
        return '도착 완료';
      case 'completed':
        return '배송 완료';
      case 'cancelled':
        return '취소됨';
      default:
        return status;
    }
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00BCD4" />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  if (!request) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>요청 상세</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        {/* Status Badge */}
        <View style={[styles.statusBanner, { backgroundColor: getStatusColor(request.status) }]}>
          <Text style={styles.statusText}>{getStatusText(request.status)}</Text>
        </View>

        {/* Route Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🚇 배송 경로</Text>
          <View style={styles.routeContainer}>
            <View style={styles.stationInfo}>
              <Text style={styles.stationLabel}>픽업</Text>
              <Text style={styles.stationName}>{request.pickupStation.stationName}</Text>
              <Text style={styles.stationLine}>{request.pickupStation.line}</Text>
            </View>

            <View style={styles.arrowContainer}>
              <Text style={styles.arrow}>↓</Text>
              <Text style={styles.travelTime}>약 25분</Text>
            </View>

            <View style={styles.stationInfo}>
              <Text style={styles.stationLabel}>배송</Text>
              <Text style={styles.stationName}>{request.deliveryStation.stationName}</Text>
              <Text style={styles.stationLine}>{request.deliveryStation.line}</Text>
            </View>
          </View>
        </View>

        {/* Package Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📦 패키지 정보</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>크기</Text>
            <Text style={styles.infoValue}>
              {request.packageInfo.size === 'small' ? '소형' :
               request.packageInfo.size === 'medium' ? '중형' :
               request.packageInfo.size === 'large' ? '대형' : '특대'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>무게</Text>
            <Text style={styles.infoValue}>{request.packageInfo.weight}kg</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>설명</Text>
            <Text style={styles.infoValue}>{request.packageInfo.description}</Text>
          </View>
          {request.packageInfo.isFragile && (
            <View style={styles.tagContainer}>
              <Text style={styles.tag}>⚠️ 깨지기 쉬움</Text>
            </View>
          )}
          {request.packageInfo.isPerishable && (
            <View style={styles.tagContainer}>
              <Text style={styles.tag}>❄️ 부패하기 쉬움</Text>
            </View>
          )}
        </View>

        {/* Recipient Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 수신자 정보</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>이름</Text>
            <Text style={styles.infoValue}>{request.recipientName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>전화번호</Text>
            <Text style={styles.infoValue}>{request.recipientPhone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>인증코드</Text>
            <Text style={styles.verificationCode}>{request.recipientVerificationCode}</Text>
          </View>
        </View>

        {/* Time Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⏰ 시간 정보</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>픽업 마감</Text>
            <Text style={styles.infoValue}>{formatDate(request.pickupDeadline)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>배송 마감</Text>
            <Text style={styles.infoValue}>{formatDate(request.deliveryDeadline)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>생성일</Text>
            <Text style={styles.infoValue}>{formatDate(request.createdAt)}</Text>
          </View>
        </View>

        {/* Fee Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💵 배송비</Text>
          <View style={styles.feeTotal}>
            <Text style={styles.feeTotalLabel}>총합계</Text>
            <Text style={styles.feeTotalValue}>{request.fee.totalFee.toLocaleString()}원</Text>
          </View>
          <View style={styles.feeBreakdown}>
            <View style={styles.feeItem}>
              <Text style={styles.feeItemLabel}>기본요금</Text>
              <Text style={styles.feeItemValue}>{request.fee.baseFee.toLocaleString()}원</Text>
            </View>
            <View style={styles.feeItem}>
              <Text style={styles.feeItemLabel}>거리요금</Text>
              <Text style={styles.feeItemValue}>{request.fee.distanceFee.toLocaleString()}원</Text>
            </View>
            <View style={styles.feeItem}>
              <Text style={styles.feeItemLabel}>무게요금</Text>
              <Text style={styles.feeItemValue}>{request.fee.weightFee.toLocaleString()}원</Text>
            </View>
            <View style={styles.feeItem}>
              <Text style={styles.feeItemLabel}>크기요금</Text>
              <Text style={styles.feeItemValue}>{request.fee.sizeFee.toLocaleString()}원</Text>
            </View>
            <View style={styles.feeItem}>
              <Text style={styles.feeItemLabel}>부가세</Text>
              <Text style={styles.feeItemValue}>{request.fee.vat.toLocaleString()}원</Text>
            </View>
          </View>
        </View>

        {/* Matching Gillers */}
        {request.status === 'pending' && matches.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🎯 매칭된 길러 ({matches.length})</Text>
            {matches.map((match) => (
              <View key={match.gillerId} style={styles.gillerCard}>
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
                <View style={styles.reasonsContainer}>
                  {match.reasons.map((reason, index) => (
                    <Text key={index} style={styles.reasonText}>✓ {reason}</Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Cancellation Info */}
        {request.status === 'cancelled' && (
          <View style={[styles.card, styles.cancelledCard]}>
            <Text style={styles.cardTitle}>⚠️ 취소 정보</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>사유</Text>
              <Text style={styles.infoValue}>{request.cancellationReason}</Text>
            </View>
            {request.cancelledAt && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>취소일</Text>
                <Text style={styles.infoValue}>{formatDate(request.cancelledAt)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Actions */}
        {request.status === 'pending' && (
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
      </ScrollView>
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
  verificationCode: {
    color: '#00BCD4',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
});
