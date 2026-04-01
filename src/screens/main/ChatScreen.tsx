import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { RouteProp, useRoute } from '@react-navigation/native';
import { createChatService } from '../../services/chat-service';
import { getBeta1ChatContext, type Beta1ChatContext } from '../../services/beta1-orchestration-service';
import { useUser } from '../../contexts/UserContext';
import { BorderRadius, Colors, Spacing, Typography } from '../../theme';
import { MessageType, type ChatMessage } from '../../types/chat';
import type { MainStackParamList } from '../../types/navigation';

type ChatRoute = RouteProp<MainStackParamList, 'Chat'>;

export default function ChatScreen() {
  const route = useRoute<ChatRoute>();
  const { user } = useUser();
  const chatService = useRef(createChatService()).current;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [context, setContext] = useState<Beta1ChatContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    const unsubscribe = chatService.subscribeToChatMessages(route.params.chatRoomId, (nextMessages) => {
      setMessages(nextMessages);
      setLoading(false);
    });
    void chatService.markMessagesAsRead(route.params.chatRoomId);
    return unsubscribe;
  }, [chatService, route.params.chatRoomId]);

  useEffect(() => {
    const loadContext = async () => {
      const nextContext = await getBeta1ChatContext(route.params.chatRoomId);
      setContext(nextContext);
    };
    void loadContext();
  }, [route.params.chatRoomId]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !user?.uid || sending) {
      return;
    }

    setSending(true);
    try {
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
  }, [chatService, input, route.params.chatRoomId, sending, user?.uid]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topPanel}>
        <Text style={styles.chatTitle}>{context?.title ?? route.params.otherUserName}</Text>
        <Text style={styles.chatSubtitle}>{context?.subtitle ?? '미션 진행과 인계 협의를 위한 채팅입니다.'}</Text>

        <View style={styles.contextCard}>
          <View style={styles.contextHeader}>
            <MaterialIcons name="shield" size={18} color={Colors.primary} />
            <Text style={styles.contextLabel}>{context?.actionLabel ?? '채팅 안내'}</Text>
          </View>

          <View style={styles.metaRow}>
            <StatusBadge label={`공개 수준 ${context?.recipientRevealLevel ?? 'minimal'}`} />
            {context?.currentDeliveryStatus ? <StatusBadge label={`상태 ${context.currentDeliveryStatus}`} /> : null}
          </View>

          <Text style={styles.contextRecipient}>{context?.recipientSummary ?? '수령인 정보는 아직 제한 공개 상태입니다.'}</Text>
          {(context?.trustSummary ?? []).map((item) => (
            <View key={item} style={styles.trustRow}>
              <MaterialIcons name="check-circle" size={16} color={Colors.successDark} />
              <Text style={styles.trustText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
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
                  <Text style={[styles.messageText, item.senderId === user?.uid && styles.myMessageText]}>{item.content}</Text>
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
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="인계 방식, 위치, 사진 요청을 간단히 남겨보세요"
          placeholderTextcolor={Colors.textTertiary}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
          onPress={() => {
            void sendMessage();
          }}
          disabled={sending || !input.trim()}
        >
          <MaterialIcons name="north-east" size={18} color=Colors.white />
        </TouchableOpacity>
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
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
