import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createChatService } from '../../services/chat-service';
import { getBeta1ChatContext, type Beta1ChatContext } from '../../services/beta1-orchestration-service';
import { useUser } from '../../contexts/UserContext';
import { BorderRadius, Colors, Spacing, Typography } from '../../theme';
import { MessageType, type ChatMessage } from '../../types/chat';
import type { MainStackParamList } from '../../types/navigation';

type ChatRoute = RouteProp<MainStackParamList, 'Chat'>;

export default function ChatScreen() {
  const route = useRoute<ChatRoute>();
  const navigation = useNavigation<any>();
  const { user, loading: userLoading } = useUser();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [context, setContext] = useState<Beta1ChatContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (userLoading) {
      return;
    }

    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const chatService = createChatService();
    const unsubscribe = chatService.subscribeToChatMessages(route.params.chatRoomId, (nextMessages) => {
      setMessages(nextMessages);
      setLoading(false);
    });

    void chatService.markMessagesAsRead(route.params.chatRoomId).catch((error) => {
      console.error('Failed to mark messages as read', error);
    });

    return unsubscribe;
  }, [route.params.chatRoomId, user?.uid, userLoading]);

  useEffect(() => {
    let cancelled = false;

    const loadContext = async () => {
      try {
        const nextContext = await getBeta1ChatContext(route.params.chatRoomId);
        if (!cancelled) {
          setContext(nextContext);
        }
      } catch (error) {
        console.error('Failed to load chat context', error);
      }
    };

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, [route.params.chatRoomId]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !user?.uid || sending) {
      return;
    }

    setSending(true);
    try {
      const chatService = createChatService();
      await chatService.sendMessage({
        chatRoomId: route.params.chatRoomId,
        senderId: user.uid,
        type: MessageType.TEXT,
        content: input.trim(),
      });
      setInput('');
    } finally {
      setSending(false);
    }
  }, [input, route.params.chatRoomId, sending, user?.uid]);

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loaderText}>채팅을 불러오는 중입니다.</Text>
      </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.topPanel}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.chatTitle}>{context?.title ?? route.params.otherUserName}</Text>
            <Text style={styles.chatSubtitle}>
              {context?.subtitle ?? '배송 진행 상황과 필요한 이야기만 간단히 주고받습니다.'}
            </Text>
          </View>
          <TouchableOpacity
            style={{ padding: 4 }}
            onPress={() => {
              Alert.alert('문제 신고', '배송과 관련하여 문제가 발생했나요? 관리자에게 신고할 수 있습니다.', [
                { text: '취소', style: 'cancel' },
                {
                  text: '신고하기',
                  style: 'destructive',
                  onPress: () => {
                    const deliveryId = chatRoom?.matchId || route.params.chatRoomId;
                  if (deliveryId) {
                    navigation.navigate('DisputeReport', { deliveryId });
                  } else {
                    Alert.alert('오류', '배송 정보를 찾을 수 없어 신고 화면으로 이동할 수 없습니다.');
                  }
                  },
                },
              ]);
            }}
          >
            <MaterialIcons name="error-outline" size={24} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.contextCard}>
          <View style={styles.contextHeader}>
            <MaterialIcons name="shield" size={18} color={Colors.primary} />
            <Text style={styles.contextLabel}>{context?.actionLabel ?? '채팅 안내'}</Text>
          </View>

          <View style={styles.metaRow}>
            <StatusBadge label={`공개 범위 ${context?.recipientRevealLevel ?? 'minimal'}`} />
            {context?.currentDeliveryStatus ? (
              <StatusBadge label={`상태 ${context.currentDeliveryStatus}`} />
            ) : null}
          </View>

          <Text style={styles.contextRecipient}>
            {context?.recipientSummary ?? '수령인 정보는 필요한 시점에만 최소 범위로 공개됩니다.'}
          </Text>

          {(context?.trustSummary ?? []).map((item) => (
            <View key={item} style={styles.trustRow}>
              <MaterialIcons name="check-circle" size={16} color={Colors.successDark} />
              <Text style={styles.trustText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.messageId}
        renderItem={({ item }) =>
          item.type === MessageType.SYSTEM ? (
            <View style={styles.systemRow}>
              <Text style={styles.systemText}>{item.content}</Text>
            </View>
          ) : (
            <View style={[styles.messageRow, item.senderId === user?.uid ? styles.myRow : styles.otherRow]}>
              <View style={[styles.bubble, item.senderId === user?.uid ? styles.myBubble : styles.otherBubble]}>
                <Text style={[styles.messageText, item.senderId === user?.uid && styles.myMessageText]}>
                  {item.content}
                </Text>
                <Text style={[styles.messageMeta, item.senderId === user?.uid && styles.myMessageMeta]}>
                  {formatMessageTime(item.createdAt)}
                </Text>
              </View>
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="메시지를 입력해 주세요"
            placeholderTextColor={Colors.textTertiary}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
            onPress={() => {
              void sendMessage();
            }}
            disabled={sending || !input.trim()}
            activeOpacity={0.85}
          >
            <MaterialIcons name="send" size={18} color={Colors.white} />
            <Text style={styles.sendButtonText}>보내기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function formatMessageTime(timestamp: ChatMessage['createdAt']) {
  const date = timestamp.toDate();
  return date.toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topPanel: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  chatTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  chatSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },
  contextCard: {
    backgroundColor: Colors.primaryMint,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: 8,
  },
  contextHeader: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  contextLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: Colors.successLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.successDark,
  },
  contextRecipient: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  trustRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  trustText: {
    flex: 1,
    color: Colors.gray700,
    fontSize: Typography.fontSize.sm,
    lineHeight: 19,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 10,
  },
  messageRow: {
    flexDirection: 'row',
  },
  myRow: {
    justifyContent: 'flex-end',
  },
  otherRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 6,
  },
  myBubble: {
    backgroundColor: Colors.primary,
  },
  otherBubble: {
    backgroundColor: Colors.surface,
  },
  messageText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    lineHeight: 21,
  },
  myMessageText: {
    color: Colors.textWhite,
  },
  messageMeta: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    textAlign: 'right',
  },
  myMessageMeta: {
    color: Colors.primaryMint,
  },
  systemRow: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputBar: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.xl,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 6,
    paddingBottom: 6,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 132,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    color: Colors.textPrimary,
  },
  sendButton: {
    minWidth: 72,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 14,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loaderText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    ...Typography.body,
  },
});
