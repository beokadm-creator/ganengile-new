/**
 * Requests Screen
 * 배송 요청 목록 화면 (사용자의 요청 목록)
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
  Alert,
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getUserRequests, cancelRequest } from '../../services/request-service';
import { requireUserId } from '../../services/firebase';
import type { DeliveryRequest, DeliveryStatus } from '../../types/delivery';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

export default function RequestsScreen({ navigation }: Props) {
  const [requests, setRequests] = useState<DeliveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState<DeliveryRequest | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const userId = requireUserId();
      const data = await getUserRequests(userId);
      setRequests(data as any);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const handleCancel = (requestId: string) => {
    console.log('🔴 Cancel button pressed for request:', requestId);

    // 요청 상태 확인
    const request = requests.find(r => r.requestId === requestId);
    if (!request) {
      console.log('❌ Request not found:', requestId);
      return;
    }

    console.log('📋 Request status:', request.status);

    // 취소 불가능한 상태 체크
    if (request.status !== 'pending' && request.status !== 'matched') {
      console.log('❌ Cannot cancel - invalid status');
      Alert.alert(
        '취소 불가',
        '이미 배송이 진행 중이거나 완료된 요청은 취소할 수 없습니다.',
        [{ text: '확인' }]
      );
      return;
    }

    console.log('🚀 About to show confirmation modal');
    setRequestToCancel(request);
    setCancelConfirmVisible(true);
  };

  const handleConfirmCancel = async () => {
    if (!requestToCancel) return;

    console.log('✅ User confirmed cancellation for:', requestToCancel.requestId);
    try {
      setCancellingRequestId(requestToCancel.requestId);
      setCancelConfirmVisible(false);

      const userId = requireUserId();
      await cancelRequest(requestToCancel.requestId, userId, '사용자 요청으로 취소');

      // 로컬 상태 즉시 업데이트
      setRequests(prevRequests =>
        prevRequests.map(req =>
          req.requestId === requestToCancel.requestId
            ? { ...req, status: 'cancelled' as any }
            : req
        )
      );

      Alert.alert(
        '✅ 취소 완료',
        '배송 요청이 취소되었습니다.\n\n이용해 주셔서 감사합니다. 다음에 또 이용해주세요!',
        [
          {
            text: '확인',
            onPress: () => {
              console.log('✅ Cancel completed for:', requestToCancel.requestId);
              // 확인 후 목록 새로고침
              loadRequests();
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('❌ Error cancelling request:', error);
      Alert.alert(
        '❌ 취소 실패',
        error.message || '요청 취소에 실패했습니다. 다시 시도해주세요.',
        [{ text: '확인' }]
      );
    } finally {
      setCancellingRequestId(null);
      setRequestToCancel(null);
    }
  };

  const handleCancelDismiss = () => {
    console.log('❌ Cancel dialog dismissed');
    setCancelConfirmVisible(false);
    setRequestToCancel(null);
  };

  const getStatusColor = (status: DeliveryStatus): string => {
    switch (status) {
      case 'pending':
        return '#FFA726'; // Orange
      case 'matched':
        return '#42A5F5'; // Blue
      case 'accepted':
        return '#26C6DA'; // Cyan
      case 'in_transit':
        return '#AB47BC'; // Purple
      case 'arrived':
        return '#66BB6A'; // Green
      case 'at_locker':
        return '#7CB342'; // Green
      case 'delivered':
        return '#8BC34A'; // Light Green
      case 'completed':
        return '#4CAF50'; // Dark Green
      case 'cancelled':
        return '#EF5350'; // Red
      default:
        return '#9E9E9E'; // Grey
    }
  };

  const getStatusText = (status: DeliveryStatus): string => {
    switch (status) {
      case 'pending':
        return '매칭 대기';
      case 'matched':
        return '매칭 완료';
      case 'accepted':
        return '수락 완료';
      case 'in_transit':
        return '배송 중';
      case 'arrived':
        return '도착 완료';
      case 'at_locker':
        return '사물함 보관 완료';
      case 'delivered':
        return '수령 확인 대기';
      case 'completed':
        return '배송 완료';
      case 'cancelled':
        return '취소됨';
      default:
        return status;
    }
  };

  const formatDate = (date: any): string => {
    const now = new Date();
    let dateObj: Date;

    // Handle Firestore Timestamp
    if (date && typeof date.toDate === 'function') {
      dateObj = date.toDate();
    } else if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
      dateObj = new Date(date);
    } else {
      return '알 수 없음';
    }

    if (isNaN(dateObj.getTime())) {
      return '알 수 없음';
    }

    const diff = now.getTime() - dateObj.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}일 전`;
    } else if (hours > 0) {
      return `${hours}시간 전`;
    } else if (minutes > 0) {
      return `${minutes}분 전`;
    } else {
      return '방금 전';
    }
  };

  const renderRequest = ({ item }: { item: DeliveryRequest }) => (
    <View style={styles.requestCard}>
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => {
          // 요청 상세 화면으로 이동
          navigation.navigate('RequestDetail' as never, {
            requestId: item.requestId,
          });
        }}
      >
        <View style={styles.requestHeader}>
          <View style={styles.routeInfo}>
            <Text style={styles.stationName}>{item.pickupStation.stationName}</Text>
            <Text style={styles.arrow}>→</Text>
            <Text style={styles.stationName}>{item.deliveryStation.stationName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>

        <View style={styles.requestBody}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📦 패키지</Text>
            <Text style={styles.infoValue}>
              {item.packageInfo.size === 'small' ? '소형' : item.packageInfo.size === 'medium' ? '중형' : item.packageInfo.size === 'large' ? '대형' : '특대'} ({item.packageInfo.weight}kg)
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>👤 수신자</Text>
            <Text style={styles.infoValue}>{item.recipientName}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>💵 배송비</Text>
            <Text style={styles.infoValue}>{(item.fee?.totalFee || 0).toLocaleString()}원</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>⏰ 생성일</Text>
            <Text style={styles.infoValue}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {(item.status === 'pending' || item.status === 'matched') && (
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.cancelButton,
              cancellingRequestId === item.requestId && styles.disabledButton
            ]}
            onPress={() => handleCancel(item.requestId)}
            disabled={cancellingRequestId === item.requestId}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>
              {cancellingRequestId === item.requestId ? '취소 중...' : '요청 취소'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📦</Text>
      <Text style={styles.emptyTitle}>배송 요청이 없습니다</Text>
      <Text style={styles.emptyDesc}>
        첫 번째 배송을 요청해보세요!
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00BCD4" />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>내 배송 요청</Text>
        <Text style={styles.subtitle}>총 {requests.length}개의 요청</Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.requestId}
        renderItem={renderRequest}
        contentContainerStyle={requests.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      {/* 취소 확인 모달 */}
      <Modal
        visible={cancelConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelDismiss}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {requestToCancel?.status === 'matched'
                ? '길러와 매칭되었습니다'
                : '배송 요청 취소'}
            </Text>
            <Text style={styles.modalMessage}>
              {requestToCancel?.status === 'matched'
                ? '정말로 취소하시겠습니까?'
                : '정말로 이 배송 요청을 취소하시겠습니까?'}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={handleCancelDismiss}
                disabled={cancellingRequestId !== null}
              >
                <Text style={styles.modalCancelButtonText}>아니요</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleConfirmCancel}
                disabled={cancellingRequestId !== null}
              >
                {cancellingRequestId ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>예, 취소합니다</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    paddingVertical: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  arrow: {
    color: '#666',
    fontSize: 16,
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#EF5350',
  },
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  emptyDesc: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyList: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    color: '#333',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  header: {
    backgroundColor: '#FF9800',
    padding: 20,
    paddingBottom: 16,
    paddingTop: 60,
  },
  infoLabel: {
    color: '#666',
    fontSize: 14,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: 16,
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
  requestActions: {
    borderTopColor: '#e0e0e0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
  },
  requestBody: {
    gap: 8,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
  },
  requestHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  routeInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  stationName: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
    opacity: 0.9,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  modalOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#f0f0f0',
  },
  modalCancelButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirmButton: {
    backgroundColor: '#EF5350',
  },
  modalConfirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
