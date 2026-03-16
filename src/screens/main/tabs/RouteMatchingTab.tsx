/**
 * Route Matching Tab
 * 동선 기반 매칭 탭 - 등록된 동선과 요청을 매칭하여 표시
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import {
  applyMatchingFilters,
  fetchGillerStats,
  getPendingGillerRequests,
} from '../../../services/matching-service';
import { requireUserId } from '../../../services/firebase';
import type { RouteFilteredRequest, MatchingFilterOptions, RouteMatchScore } from '../../../types/matching-extended';
import { Spacing, BorderRadius, Colors, Shadows } from '../../../theme';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

export default function RouteMatchingTab({ navigation }: Props) {
  const [requests, setRequests] = useState<RouteFilteredRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<RouteFilteredRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gillerId, setGillerId] = useState<string | null>(null);
  const [gillerStats, setGillerStats] = useState<any>(null);

  const [filters, setFilters] = useState<MatchingFilterOptions>({
    maxDistance: 10000,
    minFee: 0,
    lineFilter: { selectedLines: [], showAllLines: true }
  });

  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [acceptingRequestId, setAcceptingRequestId] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const userId = requireUserId();
      setGillerId(userId);

      const [requestsData, stats] = await Promise.all([
        getPendingGillerRequests(),
        fetchGillerStats(userId),
      ]);

      // 동선 기반 필터링 적용 (누락되었던 부분)
      const { filterRequestsByGillerRoutes } = await import('../../../services/matching-service');
      const filteredByRoute = await filterRequestsByGillerRoutes(requestsData, userId);

      setRequests(filteredByRoute);
      setGillerStats(stats);
      applyFiltersLocal(filteredByRoute, filters);
    } catch (error) {
      console.error('Error loading requests:', error);
      Alert.alert('오류', '요청 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    applyFiltersLocal(requests, filters);
  }, [requests, filters]);

  const applyFiltersLocal = (data: RouteFilteredRequest[], filterOpts: MatchingFilterOptions) => {
    let filtered = applyMatchingFilters(data, filterOpts);
    
    // 추가적인 상세 필터 (호선 다중 선택)
    if (filterOpts.lineFilter?.selectedLines.length && !filterOpts.lineFilter.showAllLines) {
      filtered = filtered.filter((request: any) => {
        // 동선 매칭 요청은 여러 호선을 가질 수 있음 (lines 배열)
        const pickupLines = request.pickupStation?.lines?.map((l: any) => l.lineId) || [request.pickupStation?.line];
        const deliveryLines = request.deliveryStation?.lines?.map((l: any) => l.lineId) || [request.deliveryStation?.line];
        
        return filterOpts.lineFilter!.selectedLines.some(line => 
          pickupLines.includes(line) || deliveryLines.includes(line)
        );
      });
    }

    setFilteredRequests(filtered);
  };

  const handleChat = async (request: RouteFilteredRequest) => {
    try {
      if (!gillerId || !gillerStats) return;
      const { createChatService, getChatRoomByRequestId } = await import('../../../services/chat-service');
      const chatService = createChatService();
      
      let chatRoom = await getChatRoomByRequestId(request.requestId);
      if (!chatRoom) {
        chatRoom = await chatService.createChatRoom({
          user1: { userId: gillerId, name: gillerStats.nickname || '길러' },
          user2: { userId: request.gllerId, name: request.gllerName || '의뢰인' },
          requestId: request.requestId,
          requestInfo: { 
            from: request.pickupStation.stationName, 
            to: request.deliveryStation.stationName, 
            urgency: request.packageInfo?.size || '일반' 
          }
        }, 'pending');
      }
      
      navigation.navigate('Chat', {
        chatRoomId: chatRoom.chatRoomId,
        otherUserId: request.gllerId,
        otherUserName: request.gllerName || '의뢰인',
        requestInfo: chatRoom.requestInfo,
      });
    } catch (error) {
      console.error('Error opening chat:', error);
      Alert.alert('오류', '채팅방을 열 수 없습니다.');
    }
  };

  const handleAccept = async (request: RouteFilteredRequest) => {
    if (acceptingRequestId) return; // 중복 클릭 방지
    try {
      if (!gillerId) return;
      setAcceptingRequestId(request.requestId);

      const { gillerAcceptRequest } = await import('../../../services/delivery-service');
      const result = await gillerAcceptRequest(request.requestId, gillerId);

      if (result.success) {
        // 채팅방 자동 생성 및 시스템 메시지 전송
        const { createChatService, getChatRoomByRequestId } = await import('../../../services/chat-service');
        const chatService = createChatService();
        
        let chatRoom = await getChatRoomByRequestId(request.requestId);
        if (!chatRoom) {
           chatRoom = await chatService.createChatRoom({
             user1: { userId: gillerId, name: gillerStats?.nickname || '길러' },
             user2: { userId: request.gllerId, name: request.gllerName || '의뢰인' },
             requestId: request.requestId,
             requestInfo: { 
               from: request.pickupStation.stationName, 
               to: request.deliveryStation.stationName, 
               urgency: request.packageInfo?.size || '일반' 
             }
           }, 'active');
        } else {
           await chatService.activateChatRoom(chatRoom.chatRoomId);
        }
        
        const maskedPhone = request.recipientPhone ? request.recipientPhone.replace(/(\d{3})-?(\d{4})-?(\d{4})/, '$1-****-$3') : '번호 없음';
        await chatService.sendSystemMessage(
          chatRoom.chatRoomId, 
          'match_accepted', 
          `배송자가 배송을 수락했습니다.\n받는 분 연락처: ${maskedPhone}`
        );

        Alert.alert('배송 수락 완료!', '의뢰인과 채팅하거나 픽업을 진행하세요.', [
          {
            text: '채팅하기',
            onPress: () => {
              navigation.navigate('Chat', {
                chatRoomId: chatRoom.chatRoomId,
                otherUserId: request.gllerId,
                otherUserName: request.gllerName || '의뢰인',
              });
            },
          },
          {
            text: '배송 시작하기',
            style: 'default',
            onPress: () => {
              navigation.navigate('DeliveryTracking', {
                requestId: request.requestId,
              });
            },
          },
        ]);
        
        // 목록 다시 불러오기
        loadRequests();
      } else {
        Alert.alert('실패', result.message);
      }
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('오류', '수락 처리에 실패했습니다.');
    } finally {
      setAcceptingRequestId(null);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  }, []);

  const handleRequestPress = (request: RouteFilteredRequest) => {
    navigation.navigate('RequestDetail', { requestId: request.requestId });
  };

  // 배지 색상
  const _renderMatchScoreBadge = (score: RouteMatchScore) => (
    <View style={[styles.matchScoreBadge, { backgroundColor: getMatchScoreColor(score.score) }]}>
      <Text style={styles.matchScoreText}>{score.score}%</Text>
      <Text style={styles.matchScoreLabel}>매칭</Text>
    </View>
  );

  const renderRequest = ({ item }: { item: RouteFilteredRequest }) => (
    <TouchableOpacity
      style={styles.requestCard}
      onPress={() => handleRequestPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={styles.matchContainer}>
          <View style={[styles.scoreCircle, { borderColor: getMatchScoreColor(item.matchScore?.score || 0) }]}>
            <Text style={[styles.scoreValue, { color: getMatchScoreColor(item.matchScore?.score || 0) }]}>
              {item.matchScore?.score || 0}<Text style={styles.scorePercent}>%</Text>
            </Text>
          </View>
        </View>
        
        <View style={styles.routeContainer}>
          <View style={styles.stationRow}>
            <View style={[styles.stationDot, { backgroundColor: Colors.primary }]} />
            <Text style={styles.stationName} numberOfLines={1}>
              {item.pickupStation?.stationName || '출발역'}
            </Text>
          </View>
          <View style={styles.routeLine}>
            <View style={styles.verticalLine} />
            <Text style={styles.routeArrow}>↓</Text>
          </View>
          <View style={styles.stationRow}>
            <View style={[styles.stationDot, { backgroundColor: Colors.secondary }]} />
            <Text style={styles.stationName} numberOfLines={1}>
              {item.deliveryStation?.stationName || '도착역'}
            </Text>
          </View>
        </View>

        <View style={styles.feeContainer}>
          <Text style={styles.feeLabel}>상금</Text>
          <Text style={styles.feeValue}>₩{(item.fee?.totalFee || 0).toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardFooter}>
        <View style={styles.infoBadge}>
          <Text style={styles.infoIcon}>📦</Text>
          <Text style={styles.infoText}>
            {item.packageInfo?.size || '중형'} • {item.packageInfo?.weight || 1}kg
          </Text>
        </View>

        <View style={styles.infoBadge}>
          <Text style={styles.infoIcon}>⏰</Text>
          <Text style={styles.infoText}>
            {item.pickupDeadline ? new Date(item.pickupDeadline).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '제한 없음'}
          </Text>
        </View>

        {/* Footer: Action */}
        <View style={styles.requestFooter}>
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => handleChat(item)}
          >
            <Text style={styles.chatIcon}>💬</Text>
            <Text style={styles.chatButtonText}>채팅</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAccept(item)}
          >
            <Text style={styles.acceptButtonText}>수락하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>최적의 동선을 찾는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerSummary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>매칭된 요청</Text>
          <Text style={styles.summaryValue}>{filteredRequests.length}건</Text>
        </View>
        <View style={styles.verticalDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>최대 수익</Text>
          <Text style={[styles.summaryValue, { color: Colors.secondaryDark }]}>
            ₩{filteredRequests.reduce((acc, curr) => Math.max(acc, (curr.fee?.totalFee || 0)), 0).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Advanced Filter Bar */}
      <View style={styles.advancedFilterBar}>
        <TouchableOpacity 
          style={styles.filterOpenButton}
          onPress={() => setIsFilterModalVisible(true)}
        >
          <Text style={styles.filterOpenText}>🔍 </Text>
          <Text style={styles.filterOpenText}>
            {(filters.lineFilter?.selectedLines.length || 0) > 0 
              ? `${filters.lineFilter?.selectedLines.length}개 호선 선택 중` 
              : '전체 호선'} • 상금 {filters.minFee === 0 ? '무관' : `${filters.minFee?.toLocaleString()}원↑`}
          </Text>
          <Text style={styles.filterOpenIcon}>  ∨</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Modal */}
      <Modal
        visible={isFilterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>동선 매칭 필터</Text>
              <TouchableOpacity onPress={() => setIsFilterModalVisible(false)}>
                <Text style={styles.closeButton}>닫기</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.filterSectionTitle}>선호 호선 (다중 선택)</Text>
              <View style={styles.lineGrid}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'sinbundang', 'suin', 'gyeongui', 'airport'].map((line) => {
                  const isSelected = filters.lineFilter?.selectedLines.includes(line);
                  const lineNames: any = { '1':'1호','2':'2호','3':'3호','4':'4호','5':'5호','6':'6호','7':'7호','8':'8호','9':'9호','sinbundang':'신분당','suin':'수인','gyeongui':'경의','airport':'공항' };
                  return (
                    <TouchableOpacity
                      key={line}
                      style={[styles.gridLineButton, isSelected && styles.gridLineButtonActive]}
                      onPress={() => {
                        const current = filters.lineFilter?.selectedLines || [];
                        const next = isSelected ? current.filter(l => l !== line) : [...current, line];
                        setFilters({...filters, lineFilter: { showAllLines: next.length === 0, selectedLines: next }});
                      }}
                    >
                      <Text style={[styles.gridLineText, isSelected && styles.gridLineTextActive]}>{lineNames[line]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.filterDivider} />

              <Text style={styles.filterSectionTitle}>최소 상금</Text>
              <View style={styles.rangeRow}>
                {[0, 3000, 5000, 7000].map((fee) => (
                  <TouchableOpacity
                    key={fee}
                    style={[styles.rangeButton, filters.minFee === fee && styles.rangeButtonActive]}
                    onPress={() => setFilters({ ...filters, minFee: fee })}
                  >
                    <Text style={[styles.rangeText, filters.minFee === fee && styles.rangeTextActive]}>
                      {fee === 0 ? '무관' : `${fee/1000}천원↑`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.filterDivider} />
              
              <Text style={styles.filterSectionTitle}>최소 매칭 점수</Text>
              <View style={styles.rangeRow}>
                {[10, 30, 50, 70].map((score) => (
                  <TouchableOpacity
                    key={score}
                    style={[styles.rangeButton, filters.minMatchScore === score && styles.rangeButtonActive]}
                    onPress={() => setFilters({ ...filters, minMatchScore: score })}
                  >
                    <Text style={[styles.rangeText, filters.minMatchScore === score && styles.rangeTextActive]}>
                      {score}%↑
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.resetButton}
                onPress={() => setFilters({ minFee: 0, minMatchScore:10, lineFilter: { selectedLines: [], showAllLines: true }})}
              >
                <Text style={styles.resetButtonText}>초기화</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyButton} onPress={() => setIsFilterModalVisible(false)}>
                <Text style={styles.applyButtonText}>필터 적용</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        data={filteredRequests}
        renderItem={renderRequest}
        keyExtractor={(item) => item.requestId}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>🔍</Text>
            </View>
            <Text style={styles.emptyText}>현재 경로와 일치하는 요청이 없습니다</Text>
            <Text style={styles.emptySubText}>등록한 동선을 확인하거나 새로운 요청을 기다려주세요</Text>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('RouteManagement')}
            >
              <Text style={styles.actionButtonText}>내 동선 관리하기</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const getMatchScoreColor = (score: number): string => {
  if (score >= 80) return Colors.secondary;
  if (score >= 60) return Colors.accent;
  if (score >= 40) return Colors.warning;
  return Colors.error;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray100,
  },
  headerSummary: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingVertical: 6, // 최소 수치로 조정
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: Colors.gray600,
    marginBottom: 0, // 마진 제거
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.gray900,
  },
  verticalDivider: {
    width: 1,
    height: 20, // 30 -> 20으로 줄임
    backgroundColor: Colors.gray200,
  },
  advancedFilterBar: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  filterOpenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  filterOpenText: {
    fontSize: 14,
    color: Colors.gray800,
    fontWeight: '600',
  },
  filterOpenIcon: {
    fontSize: 12,
    color: Colors.gray500,
    marginLeft: 'auto',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    height: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.gray900,
  },
  closeButton: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.gray800,
    marginBottom: 16,
    marginTop: 8,
  },
  lineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridLineButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.gray300,
    backgroundColor: Colors.white,
    minWidth: 70,
    alignItems: 'center',
  },
  gridLineButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  gridLineText: {
    fontSize: 13,
    color: Colors.gray700,
  },
  gridLineTextActive: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  filterDivider: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginVertical: 24,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.gray200,
    alignItems: 'center',
  },
  rangeButtonActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  rangeText: {
    fontSize: 13,
    color: Colors.gray700,
  },
  rangeTextActive: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    gap: 12,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    color: Colors.gray700,
    fontWeight: 'bold',
  },
  applyButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    color: Colors.white,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray100,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.gray600,
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  requestCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  matchContainer: {
    width: 50,
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  scoreCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  scorePercent: {
    fontSize: 10,
  },
  routeContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  stationName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray900,
    flex: 1,
  },
  routeLine: {
    paddingLeft: 3,
    height: 16,
    justifyContent: 'center',
  },
  verticalLine: {
    width: 2,
    height: 10,
    backgroundColor: Colors.gray200,
    marginLeft: 0,
  },
  feeContainer: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  feeLabel: {
    fontSize: 10,
    color: Colors.gray500,
    marginBottom: 2,
  },
  feeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.secondaryDark,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginBottom: Spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: Colors.gray700,
    fontWeight: '500',
  },
  matchScoreBadge: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  matchScoreText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  matchScoreLabel: {
    color: Colors.white,
    fontSize: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: Spacing.xxl,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.gray800,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  emptySubText: {
    fontSize: 14,
    color: Colors.gray500,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  actionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: 'bold',
  },
  routeArrow: {
    fontSize: 12,
    color: Colors.gray400,
  },
  infoIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  emptyIcon: {
    fontSize: 48,
    color: Colors.gray300,
  },
  requestFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 10,
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 8,
  },
  chatIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  chatButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#00BCD4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
