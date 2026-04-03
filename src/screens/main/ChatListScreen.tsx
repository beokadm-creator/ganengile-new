import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { useUser } from '../../contexts/UserContext';
import { createChatService } from '../../services/chat-service';
import { getBeta1ChatContext, type Beta1ChatContext } from '../../services/beta1-orchestration-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp } from '../../types/navigation';
import { ChatRoomStatus, type ChatParticipant, type ChatRoom } from '../../types/chat';

export default function ChatListScreen({ navigation }: { navigation: MainStackNavigationProp }) {
  const { user } = useUser();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [contexts, setContexts] = useState<Record<string, Beta1ChatContext | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    const chatService = createChatService();
    const unsubscribe = chatService.subscribeToUserChatRooms((rooms) => {
      setChatRooms(rooms);
      setLoading(false);
      setRefreshing(false);
    });

    unsubscribeRef.current = unsubscribe;
    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    let cancelled = false;

    async function loadContexts() {
      const entries = await Promise.all(
        chatRooms.map(async (room) => [room.chatRoomId, await getBeta1ChatContext(room.chatRoomId)] as const)
      );

      if (!cancelled) {
        setContexts(Object.fromEntries(entries));
      }
    }

    if (chatRooms.length > 0) {
      void loadContexts();
    }

    return () => {
      cancelled = true;
    };
  }, [chatRooms]);

  const currentUserId = user?.uid;
  const filteredRooms = chatRooms.filter((room) => {
    const otherUser = getOtherParticipant(room, currentUserId);
    const context = contexts[room.chatRoomId];
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return [
      otherUser?.name,
      room.requestInfo?.from,
      room.requestInfo?.to,
      room.lastMessage?.text,
      context?.trustSummary,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const unreadTotal = filteredRooms.reduce((sum, room) => {
    if (!currentUserId) return sum;
    if (room.participants.user1.userId === currentUserId) return sum + (room.unreadCounts.user1 ?? 0);
    if (room.participants.user2.userId === currentUserId) return sum + (room.unreadCounts.user2 ?? 0);
    return sum;
  }, 0);

  function onRefresh() {
    setRefreshing(true);
    unsubscribeRef.current?.();

    if (!user?.uid) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const chatService = createChatService();
    const unsubscribe = chatService.subscribeToUserChatRooms((rooms) => {
      setChatRooms(rooms);
      setLoading(false);
      setRefreshing(false);
    });
    unsubscribeRef.current = unsubscribe;
  }

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.centerText}>채팅을 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>가는길에 채팅</Text>
        <Text style={styles.heroTitle}>채팅과 진행 상황을 함께 봅니다.</Text>
        <Text style={styles.heroSubtitle}>상대 정보는 필요한 범위만 열리고, 진행 상태와 ETA를 같이 확인할 수 있습니다.</Text>

        <View style={styles.heroMetrics}>
          <MetricCard label="전체 채팅" value={chatRooms.length} />
          <MetricCard label="읽지 않음" value={unreadTotal} />
          <MetricCard label="진행 중" value={chatRooms.filter((room) => room.status === ChatRoomStatus.ACTIVE).length} />
        </View>
      </View>

      <View style={styles.searchBox}>
        <MaterialIcons name="search" size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="상대 이름, 역 이름, 최근 메시지로 검색"
          placeholderTextColor={Colors.textDisabled}
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialIcons name="close" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {filteredRooms.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>열린 채팅이 없습니다</Text>
          <Text style={styles.emptyBody}>매칭이나 배송이 시작되면 여기에서 채팅을 확인할 수 있습니다.</Text>
        </View>
      ) : (
        filteredRooms.map((room) => {
          const otherUser = getOtherParticipant(room, currentUserId);
          const context = contexts[room.chatRoomId];
          return (
            <TouchableOpacity
              key={room.chatRoomId}
              style={styles.roomCard}
              activeOpacity={0.9}
              onPress={() =>
                navigation.navigate('Chat', {
                  chatRoomId: room.chatRoomId,
                  otherUserId: otherUser?.userId ?? '',
                  otherUserName: otherUser?.name ?? '상대방',
                })
              }
            >
              <View style={styles.roomHeader}>
                <Text style={styles.roomTitle}>{otherUser?.name ?? '상대방'}</Text>
                <Text style={styles.roomTime}>{formatTimestamp(room.lastMessage?.timestamp)}</Text>
              </View>
              <Text style={styles.roomMeta}>{context?.currentDeliveryStatus ?? room.requestInfo?.from ?? '진행 정보 확인 중'}</Text>
              <Text style={styles.roomMessage} numberOfLines={2}>{room.lastMessage?.text ?? '아직 메시지가 없습니다.'}</Text>
              {context?.trustSummary ? <Text style={styles.roomTrust}>{context.trustSummary}</Text> : null}
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

function getOtherParticipant(room: ChatRoom, currentUserId?: string): ChatParticipant | null {
  if (!currentUserId) return room.participants.user1;
  return room.participants.user1.userId === currentUserId ? room.participants.user2 : room.participants.user1;
}

function formatTimestamp(value?: Timestamp): string {
  if (!value) return '-';
  const date = value.toDate();
  return date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  centerText: { marginTop: Spacing.md, color: Colors.textSecondary, ...Typography.body },
  hero: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: 8, ...Shadows.sm },
  heroKicker: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  heroTitle: { fontSize: Typography.fontSize['2xl'], fontWeight: '800', color: Colors.textPrimary },
  heroSubtitle: { color: Colors.textSecondary, ...Typography.body },
  heroMetrics: { flexDirection: 'row', gap: Spacing.sm },
  metricCard: { flex: 1, backgroundColor: Colors.gray100, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 4 },
  metricValue: { fontSize: Typography.fontSize['2xl'], fontWeight: '800', color: Colors.textPrimary },
  metricLabel: { color: Colors.textTertiary, ...Typography.caption },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.md, minHeight: 52, ...Shadows.sm },
  searchInput: { flex: 1, color: Colors.textPrimary, ...Typography.body },
  emptyCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: 6, ...Shadows.sm },
  emptyTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize.xl, fontWeight: '700' },
  emptyBody: { color: Colors.textTertiary, ...Typography.body },
  roomCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: 6, ...Shadows.sm },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize.lg, fontWeight: '700' },
  roomTime: { color: Colors.textDisabled, ...Typography.caption },
  roomMeta: { color: Colors.primary, ...Typography.bodySmall },
  roomMessage: { color: Colors.gray700, ...Typography.bodySmall },
  roomTrust: { color: Colors.textTertiary, ...Typography.caption },
});
