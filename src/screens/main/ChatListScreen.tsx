/**
 * Chat List Screen
 * 사용자의 채팅방 목록 표시
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import type { MainStackNavigationProp } from '../../types/navigation';
import { createChatService } from '../../services/chat-service';
import type { ChatRoom, ChatRoomStatus } from '../../types/chat';
import { useUser } from '../../contexts/UserContext';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  navigation: MainStackNavigationProp;
};

export default function ChatListScreen({ navigation }: Props) {
  const { user } = useUser();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [filteredChatRooms, setFilteredChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ChatRoomStatus | 'all'>('all');
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const loadChatRooms = useCallback(() => {
    if (!user) return;

    const chatService = createChatService();
    const unsubscribe = chatService.subscribeToUserChatRooms((rooms) => {
      setChatRooms(rooms);
      setLoading(false);
      setRefreshing(false);
    });

    unsubscribeRef.current = unsubscribe;
    return unsubscribe;
  }, [user]);

  const onRefresh = useCallback(() => {
    if (!user) return;

    setRefreshing(true);
    unsubscribeRef.current?.();
    loadChatRooms();
  }, [user, loadChatRooms]);

  // Filter chat rooms based on search query and status
  useEffect(() => {
    let filtered = chatRooms;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((chatRoom) => chatRoom.status === statusFilter);
    }

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((chatRoom) => {
        const otherUser = chatRoom.participants.user1.userId === user?.uid
          ? chatRoom.participants.user2
          : chatRoom.participants.user1;

        const userNameMatches = otherUser.name.toLowerCase().includes(query);
        const messageMatches = chatRoom.lastMessage?.text.toLowerCase().includes(query);

        return userNameMatches || messageMatches;
      });
    }

    setFilteredChatRooms(filtered);
  }, [chatRooms, searchQuery, statusFilter, user]);

  useEffect(() => {
    const unsubscribe = loadChatRooms();
    return () => {
      unsubscribe?.();
    };
  }, [loadChatRooms]);

  const navigateToChat = (chatRoom: ChatRoom) => {
    const otherUserId = chatRoom.participants.user1.userId === user?.uid
      ? chatRoom.participants.user2.userId
      : chatRoom.participants.user1.userId;

    const otherUserName = chatRoom.participants.user1.userId === user?.uid
      ? chatRoom.participants.user2.name
      : chatRoom.participants.user1.name;

    const requestInfo = chatRoom.requestInfo ? {
      from: chatRoom.requestInfo.from,
      to: chatRoom.requestInfo.to,
      urgency: chatRoom.requestInfo.urgency,
    } : undefined;

    navigation.navigate('Chat', {
      chatRoomId: chatRoom.chatRoomId,
      otherUserId,
      otherUserName,
      requestInfo,
    });
  };

  const getUnreadCount = (chatRoom: ChatRoom): number => {
    if (chatRoom.participants.user1.userId === user?.uid) {
      return chatRoom.unreadCounts.user1;
    }
    return chatRoom.unreadCounts.user2;
  };

  const getLastMessageContent = (chatRoom: ChatRoom): string => {
    if (chatRoom.lastMessage) {
      return chatRoom.lastMessage.text;
    }
    return '메시지가 없습니다';
  };

  const getRequestSummary = (chatRoom: ChatRoom): string => {
    if (chatRoom.requestInfo) {
      return `${chatRoom.requestInfo.from} → ${chatRoom.requestInfo.to}`;
    }
    return '';
  };

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return '방금';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}일 전`;

    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return '';
    return formatTime(timestamp);
  };

  const getStatusBadge = (status?: ChatRoomStatus): { label: string; color: string; bgColor: string } => {
    switch (status) {
      case 'pending':
        return { label: '협의중', color: '#FFA726', bgColor: '#FFF3E0' };
      case 'active':
        return { label: '진행중', color: '#4CAF50', bgColor: '#E8F5E9' };
      case 'matched':
        return { label: '완료', color: '#2196F3', bgColor: '#E3F2FD' };
      case 'closed':
        return { label: '종료', color: '#9E9E9E', bgColor: '#F5F5F5' };
      default:
        return { label: '', color: '#999', bgColor: '#F5F5F5' };
    }
  };

  const renderChatRoom = ({ item }: { item: ChatRoom }) => {
    const unreadCount = getUnreadCount(item);
    const otherUser = item.participants.user1.userId === user?.uid
      ? item.participants.user2
      : item.participants.user1;
    const statusBadge = getStatusBadge(item.status);

    return (
      <TouchableOpacity
        style={styles.chatRoomItem}
        onPress={() => navigateToChat(item)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {otherUser.name.charAt(0)}
          </Text>
        </View>

        <View style={styles.chatRoomContent}>
          <View style={styles.chatRoomHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.chatRoomTitle}>{otherUser.name}</Text>
              {statusBadge.label && (
                <View style={[styles.statusBadge, { backgroundColor: statusBadge.bgColor }]}>
                  <Text style={[styles.statusBadgeText, { color: statusBadge.color }]}>
                    {statusBadge.label}
                  </Text>
                </View>
              )}
              {item.requestInfo && (
                <Text style={styles.requestSummary}>
                  {getRequestSummary(item)}
                </Text>
              )}
            </View>
            {item.lastMessage && (
              <Text style={styles.chatRoomTime}>
                {formatTimestamp(item.lastMessage.timestamp)}
              </Text>
            )}
          </View>

          <View style={styles.chatRoomFooter}>
            <Text
              style={styles.lastMessage}
              numberOfLines={1}
            >
              {getLastMessageContent(item)}
            </Text>

            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>💬</Text>
      <Text style={styles.emptyTitle}>아직 채팅이 없습니다</Text>
      <Text style={styles.emptySubtitle}>
        배송 매칭이 완료되면 채팅이 시작됩니다
      </Text>
    </View>
  );

  const renderSearchEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={styles.emptyTitle}>검색 결과가 없습니다</Text>
      <Text style={styles.emptySubtitle}>
        다른 검색어로 시도해보세요
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  // Display filtered results when searching, all results otherwise
  const displayData = searchQuery.trim() ? filteredChatRooms : chatRooms;
  const showSearchEmpty = searchQuery.trim() && filteredChatRooms.length === 0 && chatRooms.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="채팅방 또는 사용자 이름 검색"
          placeholderTextColor="#999"
        />
        {searchQuery.trim() ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, statusFilter === 'all' && styles.filterButtonActive]}
          onPress={() => setStatusFilter('all')}
        >
          <Text style={[styles.filterButtonText, statusFilter === 'all' && styles.filterButtonTextActive]}>
            전체
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, statusFilter === 'pending' && styles.filterButtonActive]}
          onPress={() => setStatusFilter('pending' as ChatRoomStatus)}
        >
          <Text style={[styles.filterButtonText, statusFilter === 'pending' && styles.filterButtonTextActive]}>
            협의중
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, statusFilter === 'active' && styles.filterButtonActive]}
          onPress={() => setStatusFilter('active' as ChatRoomStatus)}
        >
          <Text style={[styles.filterButtonText, statusFilter === 'active' && styles.filterButtonTextActive]}>
            진행중
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, statusFilter === 'matched' && styles.filterButtonActive]}
          onPress={() => setStatusFilter('matched' as ChatRoomStatus)}
        >
          <Text style={[styles.filterButtonText, statusFilter === 'matched' && styles.filterButtonTextActive]}>
            완료
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayData}
        keyExtractor={(item) => item.chatRoomId}
        renderItem={renderChatRoom}
        ListEmptyComponent={showSearchEmpty ? renderSearchEmptyState : renderEmptyState}
        contentContainerStyle={displayData.length === 0 ? styles.emptyList : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
      />
    </View>
  );
}

  const styles = StyleSheet.create({
    avatar: {
      alignItems: 'center',
      backgroundColor: '#4CAF50',
      borderRadius: 25,
      height: 50,
      justifyContent: 'center',
      marginRight: 12,
      width: 50,
    },
    avatarText: {
      color: '#fff',
      fontSize: 20,
      fontWeight: 'bold',
    },
    chatRoomContent: {
      flex: 1,
      justifyContent: 'center',
    },
    chatRoomFooter: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    chatRoomHeader: {
      alignItems: 'flex-start',
      flexDirection: 'column',
      marginBottom: 4,
    },
    headerLeft: {
      flex: 1,
    },
    chatRoomItem: {
      backgroundColor: '#fff',
      borderBottomColor: '#f0f0f0',
      borderBottomWidth: 1,
      flexDirection: 'row',
      padding: 16,
    },
    chatRoomTime: {
      color: '#999',
      fontSize: 12,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    chatRoomTitle: {
      color: '#333',
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 2,
    },
    requestSummary: {
      color: '#666',
      fontSize: 13,
    },
    statusBadge: {
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginLeft: 6,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    container: {
      backgroundColor: '#f5f5f5',
      flex: 1,
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
      padding: 20,
    },
    emptySubtitle: {
      color: '#666',
      fontSize: 16,
      textAlign: 'center',
    },
    emptyTitle: {
      color: '#333',
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
    },
    lastMessage: {
      color: '#666',
      flex: 1,
      fontSize: 14,
      marginRight: 8,
    },
    loadingContainer: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    unreadBadge: {
      alignItems: 'center',
      backgroundColor: '#FF9800',
      borderRadius: 10,
      minWidth: 20,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    unreadText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
    },
    searchContainer: {
      backgroundColor: '#fff',
      borderBottomColor: '#e0e0e0',
      borderBottomWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: '#333',
    },
    clearButton: {
      padding: 8,
    },
    filterContainer: {
      backgroundColor: '#fff',
      borderBottomColor: '#e0e0e0',
      borderBottomWidth: 1,
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    filterButton: {
      alignItems: 'center',
      backgroundColor: '#f5f5f5',
      borderRadius: 20,
      flex: 1,
      paddingVertical: 8,
    },
    filterButtonActive: {
      backgroundColor: '#4CAF50',
    },
    filterButtonText: {
      color: '#666',
      fontSize: 13,
      fontWeight: '600',
    },
    filterButtonTextActive: {
      color: '#fff',
    },
  });
