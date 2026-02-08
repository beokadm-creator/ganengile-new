/**
 * Chat List Screen
 * 사용자의 채팅방 목록 표시
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import type { MainStackNavigationProp } from '../../types/navigation';
import { createChatService } from '../../services/chat-service';
import type { ChatRoom } from '../../types/chat';
import { useUser } from '../../contexts/UserContext';

type Props = {
  navigation: MainStackNavigationProp;
};

export default function ChatListScreen({ navigation }: Props) {
  const { user } = useUser();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChatRooms = useCallback(() => {
    if (!user) return;

    const chatService = createChatService();
    const unsubscribe = chatService.subscribeToUserChatRooms((rooms) => {
      setChatRooms(rooms);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

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

    navigation.navigate('Chat', {
      chatRoomId: chatRoom.chatRoomId,
      otherUserId,
      otherUserName,
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
      return chatRoom.lastMessage.content;
    }
    return '메시지가 없습니다';
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

  const renderChatRoom = ({ item }: { item: ChatRoom }) => {
    const unreadCount = getUnreadCount(item);
    const otherUser = item.participants.user1.userId === user?.uid
      ? item.participants.user2
      : item.participants.user1;

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
            <Text style={styles.chatRoomTitle}>{otherUser.name}</Text>
            {item.lastMessage && (
              <Text style={styles.chatRoomTime}>
                {formatTime(item.lastMessage.createdAt)}
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={chatRooms}
        keyExtractor={(item) => item.chatRoomId}
        renderItem={renderChatRoom}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={chatRooms.length === 0 ? styles.emptyList : undefined}
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
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
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
  },
  chatRoomTitle: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
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
});
