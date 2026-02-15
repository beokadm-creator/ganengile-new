/**
 * Giller Requests Screen
 * 길러(배송 대행자)용 매칭 가능한 요청 목록 화면
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
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getPendingRequests } from '../../services/request-service';
import { acceptRequest, declineRequest } from '../../services/matching-service';
import { requireUserId } from '../../services/firebase';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import type { DeliveryRequest } from '../../types/delivery';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

interface FilterOptions {
  minFee: number;
  maxFee: number;
  packageSize: string;
}

export default function GillerRequestsScreen({ navigation }: Props) {
  const [requests, setRequests] = useState<DeliveryRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<DeliveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    minFee: 0,
    maxFee: 50000,
    packageSize: 'all',
  });

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [requests, searchText, filters]);

  const loadRequests = async () => {
    try {
      const data = await getPendingRequests();
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

  const applyFilters = () => {
    let filtered = [...requests];

    // 검색어 필터
    if (searchText) {
      filtered = filtered.filter((req) =>
        req.pickupStation.stationName.includes(searchText) ||
        req.deliveryStation.stationName.includes(searchText) ||
        req.recipientName.includes(searchText)
      );
    }

    // 배송비 필터
    filtered = filtered.filter(
      (req) => req.fee.totalFee >= filters.minFee && req.fee.totalFee <= filters.maxFee
    );

    // 패키지 크기 필터
    if (filters.packageSize !== 'all') {
      filtered = filtered.filter((req) => req.packageInfo.size === filters.packageSize);
    }

    setFilteredRequests(filtered);
  };

  const handleAccept = async (requestId: string) => {
    try {
      const gillerId = requireUserId();
      const result = await acceptRequest(requestId, gillerId);

      if (result.success) {
        Alert.alert('성공', result.message, [
          {
            text: '확인',
            onPress: () => {
              if (result.deliveryId) {
                navigation.navigate('PickupVerification', {
                  deliveryId: result.deliveryId,
                  requestId,
                });
              }
            },
          },
        ]);
      } else {
        Alert.alert('실패', result.message);
      }
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('오류', '수락 처리에 실패했습니다.');
    }
  };

  const handleChatRequest = async (request: DeliveryRequest) => {
    try {
      // 채팅방은 acceptRequest에서 자동 생성됨
      navigation.navigate('ChatScreen', {
        requestId: request.requestId,
        status: 'pending',
        recipientName: request.recipientName,
      });
    } catch (error) {
      console.error('Error opening chat:', error);
      Alert.alert('오류', '채팅을 열 수 없습니다.');
    }
  };

  const getPackageSizeLabel = (size: string): string => {
    switch (size) {
      case 'small':
        return '소형';
      case 'medium':
        return '중형';
      case 'large':
        return '대형';
      case 'extra_large':
        return '특대';
      default:
        return size;
    }
  };

  const formatTime = (date: Date): string => {
    const now = new Date();
    const deadline = new Date(date);
    const diff = deadline.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 0) {
      return '마감됨';
    } else if (minutes < 60) {
      return `${minutes}분 남음`;
    } else {
      const hours = Math.floor(minutes / 60);
      return `${hours}시간 ${minutes % 60}분 남음`;
    }
  };

  const renderRequest = ({ item }: { item: DeliveryRequest }) => (
    <TouchableOpacity
      style={styles.requestCard}
      onPress={() => navigation.navigate('RequestDetail', { requestId: item.requestId })}
    >
      {/* Header: Route & Fee */}
      <View style={styles.requestHeader}>
        <View style={styles.routeInfo}>
          <Text style={styles.stationName}>{item.pickupStation.stationName}</Text>
          <Text style={styles.arrow}>→</Text>
          <Text style={styles.stationName}>{item.deliveryStation.stationName}</Text>
        </View>
        <View style={styles.feeBadge}>
          <Text style={styles.feeText}>{item.fee.totalFee.toLocaleString()}원</Text>
        </View>
      </View>

      {/* Body: Details */}
      <View style={styles.requestBody}>
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>📦 크기</Text>
            <Text style={styles.detailValue}>{getPackageSizeLabel(item.packageInfo.size)}</Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>⚖️ 무게</Text>
            <Text style={styles.detailValue}>{item.packageInfo.weight}kg</Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>⏰ 마감</Text>
            <Text style={[styles.detailValue, { color: '#FFA726' }]}>
              {formatTime(item.pickupDeadline)}
            </Text>
          </View>
        </View>

        <View style={styles.descriptionContainer}>
          <Text style={styles.description} numberOfLines={2}>
            {item.packageInfo.description}
          </Text>
        </View>

        {/* Tags */}
        <View style={styles.tagsContainer}>
          {item.packageInfo.isFragile && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>⚠️ 깨지기 쉬움</Text>
            </View>
          )}
          {item.packageInfo.isPerishable && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>❄️ 부패하기 쉬움</Text>
            </View>
          )}
          {item.packageInfo.weight > 5 && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>🏋️ 무거움</Text>
            </View>
          )}
        </View>
      </View>

      {/* Footer: Action */}
      <View style={styles.requestFooter}>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => handleChatRequest(item)}
        >
          <Ionicons name="chatbubbles" size={20} color="#00BCD4" />
          <Text style={styles.chatButtonText}>채팅으로 문의</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAccept(item.requestId)}
        >
          <Text style={styles.acceptButtonText}>수락하기</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <Text style={styles.filterTitle}>필터</Text>

      <Text style={styles.filterLabel}>최소 배송비</Text>
      <TextInput
        style={styles.filterInput}
        value={filters.minFee.toString()}
        onChangeText={(text) => setFilters({ ...filters, minFee: parseInt(text) || 0 })}
        keyboardType="numeric"
        placeholder="0"
      />

      <Text style={styles.filterLabel}>최대 배송비</Text>
      <TextInput
        style={styles.filterInput}
        value={filters.maxFee.toString()}
        onChangeText={(text) => setFilters({ ...filters, maxFee: parseInt(text) || 50000 })}
        keyboardType="numeric"
        placeholder="50000"
      />

      <Text style={styles.filterLabel}>패키지 크기</Text>
      <View style={styles.sizeSelector}>
        {(['all', 'small', 'medium', 'large'] as const).map((size) => (
          <TouchableOpacity
            key={size}
            style={[
              styles.sizeButton,
              filters.packageSize === size && styles.sizeButtonActive,
            ]}
            onPress={() => setFilters({ ...filters, packageSize: size })}
          >
            <Text
              style={[
                styles.sizeButtonText,
                filters.packageSize === size && styles.sizeButtonTextActive,
              ]}
            >
              {size === 'all' ? '전체' :
               size === 'small' ? '소형' :
               size === 'medium' ? '중형' : '대형'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.resetButton}
        onPress={() => setFilters({ minFee: 0, maxFee: 50000, packageSize: 'all' })}
      >
        <Text style={styles.resetButtonText}>필터 초기화</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📦</Text>
      <Text style={styles.emptyTitle}>매칭 가능한 요청이 없습니다</Text>
      <Text style={styles.emptyDesc}>
        {requests.length === 0
          ? '현재 대기 중인 요청이 없습니다.'
          : '필터 조건에 맞는 요청이 없습니다.'}
      </Text>
      {filters.packageSize !== 'all' || filters.minFee > 0 || filters.maxFee < 50000 ? (
        <TouchableOpacity
          style={styles.clearFilterButton}
          onPress={() => setFilters({ minFee: 0, maxFee: 50000, packageSize: 'all' })}
        >
          <Text style={styles.clearFilterButtonText}>필터 지우기</Text>
        </TouchableOpacity>
      ) : null}
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>배송 요청</Text>
        <Text style={styles.subtitle}>
          {filteredRequests.length}개의 요청 대기 중
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="역 이름, 수신자 검색..."
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={styles.filterToggleButton}
          onPress={() => setFiltersVisible(!filtersVisible)}
        >
          <Text style={styles.filterToggleButtonText}>
            {filtersVisible ? '▲' : '▼'} 필터
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filters Panel */}
      {filtersVisible && (
        <View style={styles.filtersPanel}>
          {renderFilters()}
        </View>
      )}

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
  acceptButton: {
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    flex: 1,
    paddingVertical: 12,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  arrow: {
    color: '#666',
    fontSize: 16,
    marginHorizontal: 8,
  },
  clearFilterButton: {
    backgroundColor: '#00BCD4',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  clearFilterButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  description: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
  },
  descriptionContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyDesc: {
    color: '#666',
    fontSize: 14,
    marginBottom: 20,
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
  feeBadge: {
    backgroundColor: '#00BCD4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  feeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  filterInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterLabel: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
    marginTop: 8,
  },
  filterTitle: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  filterToggleButton: {
    backgroundColor: '#00BCD4',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterToggleButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  filtersContainer: {
    padding: 16,
  },
  filtersPanel: {
    backgroundColor: '#fff',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    paddingBottom: 16,
    paddingTop: 60,
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
  requestBody: {
    padding: 16,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  requestFooter: {
    borderTopColor: '#e0e0e0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#00BCD4',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  chatButtonText: {
    color: '#00BCD4',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  requestHeader: {
    alignItems: 'center',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  resetButton: {
    alignItems: 'center',
    backgroundColor: '#EF5350',
    borderRadius: 8,
    marginTop: 12,
    paddingVertical: 12,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  routeInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  searchContainer: {
    backgroundColor: '#fff',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 16,
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sizeButton: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  sizeButtonActive: {
    backgroundColor: '#00BCD4',
    borderColor: '#00BCD4',
  },
  sizeButtonText: {
    color: '#333',
    fontSize: 14,
  },
  sizeButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  sizeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  stationName: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
    opacity: 0.9,
  },
  tag: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    color: '#F57C00',
    fontSize: 11,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
});
