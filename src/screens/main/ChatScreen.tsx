/**
 * Chat Screen
 * 1:1 채팅 인터페이스
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { MainStackNavigationProp } from '../../types/navigation';
import { createChatService } from '../../services/chat-service';
import { MessageType, ChatRoomStatus, type ChatMessage, type ChatRoom } from '../../types/chat';
import { useUser } from '../../contexts/UserContext';

type Props = {
  navigation: MainStackNavigationProp;
  route: {
    params: {
      chatRoomId: string;
      otherUserId: string;
      otherUserName: string;
      requestInfo?: { from: string; to: string; urgency: string };
    };
  };
};

export default function ChatScreen({ navigation, route }: Props) {
  const { user } = useUser();
  const { chatRoomId, otherUserId: _otherUserId, otherUserName, requestInfo: routeRequestInfo } = route.params;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatRoom, setChatRoom] = useState<ChatRoom | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const chatService = useRef(createChatService()).current;

  useEffect(() => {
    const loadChatRoom = async () => {
      const room = await chatService.getChatRoom(chatRoomId);
      setChatRoom(room);
    };

    loadChatRoom();
  }, [chatRoomId, chatService]);

  const displayRequestInfo = chatRoom?.requestInfo || routeRequestInfo;

  useEffect(() => {
    navigation.setOptions({
      title: otherUserName,
      headerRight: () => (
        <TouchableOpacity onPress={handleLeaveChat} style={styles.leaveButton}>
          <Text style={styles.leaveButtonText}>나가기</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, otherUserName]);

  const handleLeaveChat = useCallback(() => {
    Alert.alert(
      '채팅방 나가기',
      '정말로 채팅방에서 나가시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '나가기',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatService.leaveChatRoom(chatRoomId);
              navigation.goBack();
            } catch (error) {
              console.error('Error leaving chat room:', error);
            }
          },
        },
      ]
    );
  }, [chatRoomId, chatService, navigation]);

  const loadMessages = useCallback(() => {
    const unsubscribe = chatService.subscribeToChatMessages(chatRoomId, (msgs) => {
      setMessages(msgs);
      setLoading(false);

      if (msgs.length > 0 && flatListRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });

    chatService.markMessagesAsRead(chatRoomId);

    return unsubscribe;
  }, [chatRoomId, chatService]);

  useEffect(() => {
    const unsubscribe = loadMessages();
    return () => {
      unsubscribe?.();
    };
  }, [loadMessages]);

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || sending) return;

    setSending(true);
    try {
      await chatService.sendMessage({
        chatRoomId,
        senderId: user?.uid || '',
        type: MessageType.TEXT,
        content: inputText.trim(),
      });
      setInputText('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  }, [inputText, chatRoomId, chatService, sending, user]);

  const isMyMessage = (message: ChatMessage): boolean => {
    return message.senderId === user?.uid;
  };

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const myMessage = isMyMessage(item);

    if (item.type === MessageType.SYSTEM) {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessageBubble}>
            <Text style={styles.systemMessageText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageContainer,
          myMessage ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {!myMessage && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {otherUserName.charAt(0)}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            myMessage ? styles.myMessageBubble : styles.otherMessageBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              myMessage ? styles.myMessageText : styles.otherMessageText,
            ]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.messageTime,
              myMessage ? styles.myMessageTime : styles.otherMessageTime,
            ]}
          >
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  const renderListEmptyComponent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>💬</Text>
        <Text style={styles.emptyText}>첫 메시지를 보내보세요</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {displayRequestInfo && (
        <View style={styles.requestInfoBar}>
          <Text style={styles.requestInfoText}>
            📦 {displayRequestInfo.from} → {displayRequestInfo.to}
            {displayRequestInfo.urgency && (
              <Text style={styles.urgencyBadge}> {displayRequestInfo.urgency}</Text>
            )}
          </Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.messageId}
        renderItem={renderMessage}
        contentContainerStyle={messages.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={renderListEmptyComponent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="메시지를 입력하세요..."
          placeholderTextColor="#999"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() || sending) && styles.sendButtonDisabled,
          ]}
          onPress={sendMessage}
          disabled={!inputText.trim() || sending}
        >
          <Text style={styles.sendButtonText}>
            {sending ? '...' : '전송'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginRight: 8,
    width: 36,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  emptyList: {
    flex: 1,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    color: '#333',
    flex: 1,
    fontSize: 15,
    marginRight: 8,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputContainer: {
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderTopColor: '#e0e0e0',
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leaveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  leaveButtonText: {
    color: '#FF5252',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  messageBubble: {
    borderRadius: 16,
    maxWidth: '70%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageBubble: {
    backgroundColor: '#4CAF50',
    borderBottomRightRadius: 4,
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  myMessageText: {
    color: '#fff',
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  otherMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  otherMessageText: {
    color: '#333',
  },
  otherMessageTime: {
    color: '#999',
  },
  requestInfoBar: {
    backgroundColor: '#fff',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  requestInfoText: {
    color: '#333',
    fontSize: 14,
  },
  urgencyBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 4,
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    minWidth: 60,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  systemMessageBubble: {
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessageText: {
    color: '#666',
    fontSize: 13,
  },
});
