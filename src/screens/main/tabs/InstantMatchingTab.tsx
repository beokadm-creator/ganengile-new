/**
 * Instant Matching Tab
 * 즉시 매칭 탭 - 현재 위치 기반 5km 반경 내 요청 표시
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
  Switch,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import {
  filterRequestsByLocation,
  applyMatchingFilters,
  fetchGillerStats,
  getPendingGillerRequests,
} from '../../../services/matching-service';
import { locationService, type LocationData } from '../../../services/location-service';
import { requireUserId } from '../../../services/firebase';
import type { LocationFilteredRequest, MatchingFilterOptions } from '../../../types/matching-extended';
import { Spacing, BorderRadius, Colors, Shadows } from '../../../theme';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

export default function InstantMatchingTab({ navigation }: Props) {
  const [requests, setRequests] = useState<LocationFilteredRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<LocationFilteredRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gillerId, setGillerId] = useState<string | null>(null);
  const [gillerStats, setGillerStats] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // 필터 상태
  const [filters, setFilters] = useState<MatchingFilterOptions>({
    maxDistance: 30000, // 30km로 대폭 상향
    minFee: 0,
    lineFilter: { selectedLines: [], showAllLines: true }
  });

  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  useEffect(() => {
    initializeGiller();
  }, []);

  useEffect(() => {
    if (gillerId && currentLocation) {
      loadRequests();
    }
  }, [gillerId, currentLocation]);

  useEffect(() => {
    applyFilters();
  }, [requests, filters]);

  const initializeGiller = async () => {
    try {
      const userId = requireUserId();
      setGillerId(userId);

      // 길러 통계 로드
      const stats = await fetchGillerStats(userId);
      setGillerStats(stats);

      // 현재 위치 획득
      await getCurrentLocation();
    } catch (error) {
      console.error('Error initializing giller:', error);
      setLoading(false);
      setLocationError('초기화에 실패했습니다.');
    }
  };

  const getCurrentLocation = async () => {
    try {
      const hasPermission = await locationService.requestLocationPermission();
      if (!hasPermission) {
        setLocationError('위치 권한이 필요합니다.');
        setLoading(false);
        return;
      }

      const location = await locationService.getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
      } else {
        setLocationError('위치를 가져올 수 없습니다.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      setLocationError('위치 가져오기에 실패했습니다.');
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      if (!gillerId || !currentLocation) return;

      const allRequests = await getPendingGillerRequests();
      const matchedRequests = await filterRequestsByLocation(
        allRequests,
        currentLocation,
        30 // 30km 반경으로 대폭 상향
      );

      setRequests(matchedRequests);
    } catch (error) {
      console.error('Error loading instant matching requests:', error);
      Alert.alert('오류', '위치 기반 요청을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await getCurrentLocation();
    if (currentLocation) {
      await loadRequests();
    }
    setRefreshing(false);
  };

  const applyFilters = () => {
    let filtered = applyMatchingFilters(requests, filters);

    // 호선 필터 적용 (다중 선택 대응)
    if (filters.lineFilter?.selectedLines.length && !filters.lineFilter.showAllLines) {
      filtered = filtered.filter((request: any) => {
        const pickupLine = request.pickupStation.line;
        const deliveryLine = request.deliveryStation.line;
        return filters.lineFilter!.selectedLines.some(line => 
          pickupLine?.includes(line) || deliveryLine?.includes(line)
        );
      });
    }

    setFilteredRequests(filtered);
  };

  const handleChat = async (request: LocationFilteredRequest) => {
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

  const handleAccept = async (request: LocationFilteredRequest) => {
    try {
      if (!gillerId) return;

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

        Alert.alert('성공', '배송 수락 완료! 채팅으로 이동합니다.', [
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
        ]);
        
        // 목록 다시 불러오기
        loadRequests();
      } else {
        Alert.alert('실패', result.message);
      }
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('오류', '수락 처리에 실패했습니다.');
    }
  };

  const getDistanceColor = (distance: number): string => {
    if (distance < 1000) return Colors.secondary; // 1km 미만: 녹색
    if (distance < 3000) return Colors.accent; // 3km 미만: 노란색
    return Colors.warning; // 3km 이상: 주황색
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${meters}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const renderLocationInfo = (request: LocationFilteredRequest) => (
    <View style={styles.locationInfo}>
      <View style={styles.locationItem}>
        <Text style={styles.locationIcon}>📍</Text>
        <Text style={styles.locationLabel}>거리</Text>
        <Text style={[styles.locationValue, { color: getDistanceColor(request.metadata.distanceFromCurrent) }]}>
          {formatDistance(request.metadata.distanceFromCurrent)}
        </Text>
      </View>

      <View style={styles.locationItem}>
        <Text style={styles.locationIcon}>🚇</Text>
        <Text style={styles.locationLabel}>가까운 역</Text>
        <Text style={styles.locationValue}>{request.metadata.nearestStation}</Text>
      </View>

      <View style={styles.locationItem}>
        <Text style={styles.locationIcon}>⏰</Text>
        <Text style={styles.locationLabel}>예상 시간</Text>
        <Text style={styles.locationValue}>{request.metadata.estimatedTimeMinutes}분</Text>
      </View>

      {request.metadata.distanceRank && request.metadata.distanceRank <= 3 && (
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>🏆 {request.metadata.distanceRank}위</Text>
        </View>
      )}
    </View>
  );

  const renderFilterModal = () => {
    const lines = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'sinbundang', 'suin', 'gyeongui', 'airport'];
    const lineNames: { [key: string]: string } = {
      '1': '1호선', '2': '2호선', '3': '3호선', '4': '4호선', '5': '5호선',
      '6': '6호선', '7': '7호선', '8': '8호선', '9': '9호선',
      'sinbundang': '신분당', 'suin': '수인분당', 'gyeongui': '경의중앙', 'airport': '공항철도'
    };

    return (
      <Modal
        visible={isFilterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>상세 필터 설정</Text>
              <TouchableOpacity onPress={() => setIsFilterModalVisible(false)}>
                <Text style={styles.closeButton}>닫기</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.filterSectionTitle}>전체 호선 (다중 선택)</Text>
              <View style={styles.lineGrid}>
                {lines.map((line) => {
                  const isSelected = filters.lineFilter?.selectedLines.includes(line);
                  return (
                    <TouchableOpacity
                      key={line}
                      style={[
                        styles.gridLineButton,
                        isSelected && styles.gridLineButtonActive
                      ]}
                      onPress={() => {
                        const currentLines = filters.lineFilter?.selectedLines || [];
                        const newLines = isSelected
                          ? currentLines.filter(l => l !== line)
                          : [...currentLines, line];
                        
                        setFilters({
                          ...filters,
                          lineFilter: {
                            showAllLines: newLines.length === 0,
                            selectedLines: newLines
                          }
                        });
                      }}
                    >
                      <Text style={[styles.gridLineText, isSelected && styles.gridLineTextActive]}>
                        {lineNames[line]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.filterDivider} />

              <Text style={styles.filterSectionTitle}>최대 반경 (범위)</Text>
              <View style={styles.rangeRow}>
                {[5000, 10000, 20000, 30000].map((dist) => (
                  <TouchableOpacity
                    key={dist}
                    style={[
                      styles.rangeButton,
                      filters.maxDistance === dist && styles.rangeButtonActive
                    ]}
                    onPress={() => setFilters({ ...filters, maxDistance: dist })}
                  >
                    <Text style={[styles.rangeText, filters.maxDistance === dist && styles.rangeTextActive]}>
                      {dist/1000}km
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.filterDivider} />

              <Text style={styles.filterSectionTitle}>최소 상금</Text>
              <View style={styles.rangeRow}>
                {[0, 3000, 5000, 7000].map((fee) => (
                  <TouchableOpacity
                    key={fee}
                    style={[
                      styles.rangeButton,
                      filters.minFee === fee && styles.rangeButtonActive
                    ]}
                    onPress={() => setFilters({ ...filters, minFee: fee })}
                  >
                    <Text style={[styles.rangeText, filters.minFee === fee && styles.rangeTextActive]}>
                      {fee === 0 ? '무관' : `${fee/1000}천원↑`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.resetButton}
                onPress={() => setFilters({ maxDistance: 30000, minFee: 0, lineFilter: { selectedLines: [], showAllLines: true }})}
              >
                <Text style={styles.resetButtonText}>초기화</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.applyButton}
                onPress={() => setIsFilterModalVisible(false)}
              >
                <Text style={styles.applyButtonText}>필터 적용하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderFilterBar = () => {
    const selectedCount = (filters.lineFilter?.selectedLines.length || 0);
    
    return (
      <View style={styles.advancedFilterBar}>
        <TouchableOpacity 
          style={styles.filterOpenButton}
          onPress={() => setIsFilterModalVisible(true)}
        >
          <Text style={styles.filterOpenText}>🔍 </Text>
          <Text style={styles.filterOpenText}>
            {selectedCount > 0 ? `${selectedCount}개 호선 선택 중` : '전체 호선'} • {filters.maxDistance!/1000}km 이내
          </Text>
          <Text style={styles.filterOpenIcon}>  ∨</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRequest = ({ item }: { item: LocationFilteredRequest }) => (
    <TouchableOpacity
      style={styles.requestCard}
      onPress={() => navigation.navigate('RequestDetail', { requestId: item.requestId })}
    >
      {/* Header: Route & Distance */}
      <View style={styles.requestHeader}>
        <View style={styles.routeInfo}>
          <View style={[styles.stationDot, { backgroundColor: Colors.primary }]} />
          <Text style={styles.stationName}>{item.pickupStation.stationName}</Text>
          <Text style={styles.arrowIcon}>→</Text>
          <View style={[styles.stationDot, { backgroundColor: Colors.secondary }]} />
          <Text style={styles.stationName}>{item.deliveryStation.stationName}</Text>
        </View>
        <View style={[styles.distanceBadge, { backgroundColor: getDistanceColor(item.metadata.distanceFromCurrent) }]}>
          <Text style={styles.distanceText}>
            {formatDistance(item.metadata.distanceFromCurrent)}
          </Text>
        </View>
      </View>

      {/* Location Info */}
      <View style={styles.locationInfoContainer}>
        {renderLocationInfo(item)}
      </View>

      {/* Body: Details */}
      <View style={styles.requestBody}>
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>📦 크기</Text>
            <Text style={styles.detailValue}>
              {item.packageInfo.size === 'small' ? '소형' :
               item.packageInfo.size === 'medium' ? '중형' :
               item.packageInfo.size === 'large' ? '대형' : '특대'}
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>⚖️ 무게</Text>
            <Text style={styles.detailValue}>{item.packageInfo.weight}kg</Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>💰 상금</Text>
            <Text style={[styles.detailValue, { color: Colors.secondaryDark }]}>
              {item.fee.totalFee.toLocaleString()}원
            </Text>
          </View>
        </View>

        {gillerStats && (
          <View style={styles.estimatedEarnings}>
            <Text style={styles.earningsIcon}>💰</Text>
            <Text style={styles.earningsLabel}>예상 수익</Text>
            <Text style={styles.earningsValue}>
              {Math.round(item.fee.totalFee * 0.85).toLocaleString()}원
            </Text>
            <Text style={styles.earningsNote}>(85%)</Text>
          </View>
        )}
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
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      {locationError ? (
        <>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>위치 오류</Text>
          <Text style={styles.emptyDesc}>{locationError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={getCurrentLocation}
          >
            <Text style={styles.retryButtonText}>위치 다시 가져오기</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={styles.emptyTitle}>반경 내 요청이 없습니다</Text>
          <Text style={styles.emptyDesc}>
            {requests.length === 0
              ? `현재 위치 5km 반경 내에 배송 요청이 없습니다.\n\n반경을 넓히거나 다른 탭을 확인해보세요.`
              : '필터 조건에 맞는 요청이 없습니다.'}
          </Text>
          {filters.maxDistance && filters.maxDistance < 10000 && (
            <TouchableOpacity
              style={styles.adjustFilterButton}
              onPress={() => setFilters({ ...filters, maxDistance: filters.maxDistance! + 2000 })}
            >
              <Text style={styles.adjustFilterButtonText}>
                반경 {formatDistance(filters.maxDistance! + 2000)}로 확장
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00BCD4" />
        <Text style={styles.loadingText}>위치 확인 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header 요약 */}
      <View style={styles.headerSummary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>주변 요청</Text>
          <Text style={styles.summaryValue}>{filteredRequests.length}건</Text>
        </View>
        <View style={styles.verticalDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>최대 상금</Text>
          <Text style={[styles.summaryValue, { color: Colors.secondaryDark }]}>
            ₩{filteredRequests.reduce((acc, curr) => Math.max(acc, curr.fee.totalFee), 0).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Advanced Filter Bar & Modal */}
      {renderFilterBar()}
      {renderFilterModal()}

      {/* Request List */}
      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.requestId}
        renderItem={renderRequest}
        contentContainerStyle={
          filteredRequests.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray100,
    flex: 1,
  },
  headerSummary: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingVertical: 4, // 극단적으로 줄임
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 40, // 높이 고정으로 불필요한 마진 방지
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: Colors.gray600,
    marginBottom: 0,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.gray900,
  },
  verticalDivider: {
    width: 1,
    height: 20, // 높이 축소
    backgroundColor: Colors.gray200,
  },
  acceptButton: {
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.md,
    flex: 1,
    paddingVertical: 12,
    ...Shadows.sm,
  },
  acceptButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  adjustFilterButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...Shadows.sm,
  },
  adjustFilterButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  chatButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    color: Colors.gray500,
    fontSize: 12,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailValue: {
    color: Colors.gray900,
    fontSize: 14,
    fontWeight: '600',
  },
  distanceBadge: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  distanceText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: 'bold',
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
    color: Colors.gray900,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 16,
  },
  emptyDesc: {
    color: Colors.gray600,
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  estimatedEarnings: {
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 10,
    gap: 6,
  },
  earningsLabel: {
    color: Colors.successDark,
    fontSize: 13,
    fontWeight: '600',
  },
  earningsValue: {
    color: Colors.successDark,
    fontSize: 16,
    fontWeight: 'bold',
  },
  earningsNote: {
    color: Colors.successDark,
    fontSize: 11,
  },
  lineFilterContent: {
    paddingHorizontal: 12,
    paddingVertical: 2, // 세로 패딩 최소화
    alignItems: 'center',
  },
  lineFilterScroll: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.gray700,
    marginRight: 8,
  },
  lineButton: {
    backgroundColor: Colors.gray100,
    borderColor: Colors.gray200,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    height: 28, // 높이 명시적 고정
    justifyContent: 'center',
  },
  lineButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  lineButtonText: {
    color: Colors.gray700,
    fontSize: 12,
    fontWeight: '600',
  },
  lineButtonTextActive: {
    color: Colors.white,
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
  list: {
    padding: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    backgroundColor: Colors.gray100,
  },
  loadingText: {
    color: Colors.gray600,
    fontSize: 16,
    marginTop: 12,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationInfoContainer: {
    backgroundColor: Colors.gray50,
    borderBottomColor: Colors.gray200,
    borderBottomWidth: 1,
    padding: 12,
  },
  locationItem: {
    alignItems: 'center',
    flex: 1,
  },
  locationLabel: {
    color: Colors.gray600,
    fontSize: 11,
    marginTop: 4,
  },
  locationValue: {
    color: Colors.gray900,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  rankBadge: {
    position: 'absolute',
    right: 8,
    top: -8,
  },
  rankText: {
    fontSize: 12,
  },
  requestBody: {
    padding: 16,
  },
  requestCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: 16,
    overflow: 'hidden',
    ...Shadows.md,
  },
  requestFooter: {
    borderTopColor: Colors.gray100,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  requestHeader: {
    alignItems: 'center',
    borderBottomColor: Colors.gray100,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  retryButton: {
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.md,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...Shadows.sm,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  routeInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  stationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  stationName: {
    color: Colors.gray900,
    fontSize: 15,
    fontWeight: '600',
  },
  retryButtonText_old: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  arrowIcon: {
    fontSize: 14,
    color: Colors.gray400,
    marginHorizontal: 8,
  },
  earningsIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  chatIcon: {
    fontSize: 20,
    marginRight: 4,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
});
