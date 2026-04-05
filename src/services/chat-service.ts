/**
 * Chat Service
 * Firestore 기반 실시간 채팅 서비스
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDoc,
  getDocs,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { requireUserId } from './firebase';
import { getUserById } from './user-service';
import type {
  ChatRoom,
  ChatMessage,
  CreateChatRoomData,
  CreateMessageData,
  MessageReadStatus,
} from '../types/chat';
import { MessageType } from '../types/chat';

const CHAT_ROOMS_COLLECTION = 'chatRooms';
const MESSAGES_COLLECTION = 'messages';

export type MessageListener = (messages: ChatMessage[]) => void;
export type ChatRoomListener = (chatRooms: ChatRoom[]) => void;

export class ChatService {
  private userId: string;

  constructor() {
    this.userId = requireUserId();
  }

  /** 사용자별 채팅방 목록을 실시간 구독합니다. */
  subscribeToUserChatRooms(listener: ChatRoomListener): () => void {
    const qUser1 = query(
      collection(db, CHAT_ROOMS_COLLECTION),
      where('participants.user1.userId', '==', this.userId)
    );

    const qUser2 = query(
      collection(db, CHAT_ROOMS_COLLECTION),
      where('participants.user2.userId', '==', this.userId)
    );

    let roomsAsUser1: ChatRoom[] = [];
    let roomsAsUser2: ChatRoom[] = [];

    const emitMerged = () => {
      const deduped = new Map<string, ChatRoom>();
      [...roomsAsUser1, ...roomsAsUser2].forEach((room) => {
        deduped.set(room.chatRoomId, room);
      });

      const merged = [...deduped.values()].sort((a, b) => {
        const aTime = a.updatedAt?.toDate?.()?.getTime?.() ?? 0;
        const bTime = b.updatedAt?.toDate?.()?.getTime?.() ?? 0;
        return bTime - aTime;
      });
      listener(merged);
    };

    const unsubUser1 = onSnapshot(qUser1, (snapshot) => {
      roomsAsUser1 = snapshot.docs.map((doc) => ({
        chatRoomId: doc.id,
        ...doc.data(),
      })) as ChatRoom[];
      emitMerged();
    }, (error) => {
      console.error('Error subscribing to chat rooms (user1):', error);
      roomsAsUser1 = [];
      emitMerged();
    });

    const unsubUser2 = onSnapshot(qUser2, (snapshot) => {
      roomsAsUser2 = snapshot.docs.map((doc) => ({
        chatRoomId: doc.id,
        ...doc.data(),
      })) as ChatRoom[];
      emitMerged();
    }, (error) => {
      console.error('Error subscribing to chat rooms (user2):', error);
      roomsAsUser2 = [];
      emitMerged();
    });

    return () => {
      unsubUser1();
      unsubUser2();
    };
  }

  /** 특정 채팅방의 메시지를 실시간 구독합니다. */
  subscribeToChatMessages(chatRoomId: string, listener: MessageListener): () => void {
    const q = query(
      collection(db, CHAT_ROOMS_COLLECTION, chatRoomId, MESSAGES_COLLECTION),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({
        messageId: doc.id,
        ...doc.data(),
      })) as ChatMessage[];

      listener(messages);
    }, (error) => {
      console.error('Error subscribing to messages:', error);
    });

    return unsubscribe;
  }

  /** 두 사용자 사이의 채팅방을 찾거나 새로 생성합니다. */
  async findOrCreateChatRoom(otherUserId: string, data?: CreateChatRoomData): Promise<ChatRoom> {
    // 정방향 조회 (내가 user1)
    const q1 = query(
      collection(db, CHAT_ROOMS_COLLECTION),
      where('participants.user1.userId', '==', this.userId),
      where('participants.user2.userId', '==', otherUserId)
    );
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      const d = snap1.docs[0];
      return { chatRoomId: d.id, ...d.data() } as ChatRoom;
    }

    // 역방향 조회 (상대가 user1)
    const q2 = query(
      collection(db, CHAT_ROOMS_COLLECTION),
      where('participants.user1.userId', '==', otherUserId),
      where('participants.user2.userId', '==', this.userId)
    );
    const snap2 = await getDocs(q2);
    if (!snap2.empty) {
      const d = snap2.docs[0];
      return { chatRoomId: d.id, ...d.data() } as ChatRoom;
    }

    if (!data) {
      throw new Error('Chat room data is required for creation');
    }

    return this.createChatRoom(data);
  }

  /** 새 채팅방을 생성합니다. */
  async createChatRoom(data: CreateChatRoomData, status: 'pending' | 'active' = 'pending'): Promise<ChatRoom> {
    const chatRoomData = {
      participants: {
        user1: {
          userId: data.user1.userId,
          name: data.user1.name,
          profileImage: data.user1.profileImage ?? null,
        },
        user2: {
          userId: data.user2.userId,
          name: data.user2.name,
          profileImage: data.user2.profileImage ?? null,
        },
      },
      requestId: data.requestId ?? null,
      matchId: data.matchId ?? null,
      requestInfo: data.requestInfo ?? null,
      unreadCounts: {
        user1: 0,
        user2: 0,
      },
      status,
      isActive: status === 'active', // pending이면 false, active면 true
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, CHAT_ROOMS_COLLECTION), chatRoomData);

    return {
      chatRoomId: docRef.id,
      ...chatRoomData,
    } as ChatRoom;
  }

  /** 채팅방에서 현재 사용자의 위치(user1/user2)를 확인합니다. */
  private async fetchUserPosition(chatRoomId: string): Promise<1 | 2> {
    const chatRoomDoc = await getDoc(doc(db, CHAT_ROOMS_COLLECTION, chatRoomId));
    if (!chatRoomDoc.exists()) return 2;
    const data = chatRoomDoc.data();
    return data.participants.user1.userId === this.userId ? 1 : 2;
  }

  /** 메시지를 전송합니다. */
  async sendMessage(data: CreateMessageData): Promise<ChatMessage> {
    const messageData = {
      chatRoomId: data.chatRoomId,
      senderId: this.userId,
      type: data.type,
      content: data.content,
      imageUrl: data.imageUrl ?? null,
      readStatus: 'sent' as MessageReadStatus,
      metadata: data.metadata ?? null,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(
      collection(db, CHAT_ROOMS_COLLECTION, data.chatRoomId, MESSAGES_COLLECTION),
      messageData
    );

    // 수신자 기준 미읽음 카운트를 증가시킵니다.
    const senderPosition = await this.fetchUserPosition(data.chatRoomId);
    const receiverPosition = senderPosition === 1 ? 2 : 1;

    const chatRoomRef = doc(db, CHAT_ROOMS_COLLECTION, data.chatRoomId);
    await updateDoc(chatRoomRef, {
      lastMessage: {
        text: data.content,
        senderId: this.userId,
        timestamp: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
      [`unreadCounts.user${receiverPosition}`]: increment(1),
    });

    return {
      messageId: docRef.id,
      ...messageData,
    } as ChatMessage;
  }

  /** 메시지를 읽음 처리합니다. */
  async markMessagesAsRead(chatRoomId: string): Promise<void> {
    const chatRoomRef = doc(db, CHAT_ROOMS_COLLECTION, chatRoomId);
    const userPosition = await this.fetchUserPosition(chatRoomId);

    await updateDoc(chatRoomRef, {
      [`unreadCounts.user${userPosition}`]: 0,
      [`participants.user${userPosition}.lastReadAt`]: serverTimestamp(),
    });
  }

  /** 배송 완료 등으로 채팅방을 비활성화합니다. */
  async deactivateChatRoom(chatRoomId: string): Promise<void> {
    const chatRoomRef = doc(db, CHAT_ROOMS_COLLECTION, chatRoomId);

    await updateDoc(chatRoomRef, {
      isActive: false,
      status: 'closed',
      updatedAt: serverTimestamp(),
    });
  }

  /** 채팅방을 종료 상태로 전환합니다. */
  async leaveChatRoom(chatRoomId: string): Promise<void> {
    const chatRoomRef = doc(db, CHAT_ROOMS_COLLECTION, chatRoomId);

    await updateDoc(chatRoomRef, {
      status: 'closed',
      updatedAt: serverTimestamp(),
    });
  }

  /** 매칭 완료 후 채팅방을 active 상태로 전환합니다. */
  async activateChatRoom(chatRoomId: string): Promise<void> {
    const chatRoomRef = doc(db, CHAT_ROOMS_COLLECTION, chatRoomId);

    await updateDoc(chatRoomRef, {
      status: 'active',
      isActive: true,
      updatedAt: serverTimestamp(),
    });
  }

  /** 채팅방 정보를 조회합니다. */
  async getChatRoom(chatRoomId: string): Promise<ChatRoom | null> {
    const docRef = doc(db, CHAT_ROOMS_COLLECTION, chatRoomId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      chatRoomId: docSnap.id,
      ...docSnap.data(),
    } as ChatRoom;
  }

  /** 매칭/배송 상태 변경용 시스템 메시지를 전송합니다. */
  async sendSystemMessage(
    chatRoomId: string,
    type: 'match_created' | 'match_accepted' | 'pickup_verified' | 'delivery_completed',
    content: string,
    metadata?: { requestId?: string; matchId?: string }
  ): Promise<ChatMessage> {
    return this.sendMessage({
      chatRoomId,
      senderId: 'system',
      type: MessageType.SYSTEM,
      content,
      metadata: {
        ...metadata,
        type,
      },
    });
  }

}

/** 채팅 서비스 인스턴스를 생성합니다. */
export function createChatService(): ChatService {
  return new ChatService();
}

/** 특정 요청 ID에 연결된 채팅방을 조회합니다. */
export async function getChatRoomByRequestId(requestId: string): Promise<ChatRoom | null> {
  const q = query(
    collection(db, CHAT_ROOMS_COLLECTION),
    where('requestId', '==', requestId)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  const doc = querySnapshot.docs[0];
  return {
    chatRoomId: doc.id,
    ...doc.data(),
  } as ChatRoom;
}

/** 특정 매칭 ID에 연결된 채팅방을 조회합니다. */
export async function getChatRoomByMatchId(matchId: string): Promise<ChatRoom | null> {
  const q = query(
    collection(db, CHAT_ROOMS_COLLECTION),
    where('matchId', '==', matchId)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  const doc = querySnapshot.docs[0];
  return {
    chatRoomId: doc.id,
    ...doc.data(),
  } as ChatRoom;
}

export async function ensureChatRoomForRequest(args: {
  requestId: string;
  requesterId: string;
  gillerId: string;
  requestInfo?: CreateChatRoomData['requestInfo'];
}): Promise<ChatRoom> {
  const existingRoom = await getChatRoomByRequestId(args.requestId);
  if (existingRoom) {
    return existingRoom;
  }

  const [requester, giller] = await Promise.all([
    getUserById(args.requesterId),
    getUserById(args.gillerId),
  ]);

  const chatService = createChatService();
  const createdRoom = await chatService.createChatRoom(
    {
      user1: {
        userId: args.requesterId,
        name: requester?.name ?? '이용자',
        profileImage: requester?.profilePhoto,
      },
      user2: {
        userId: args.gillerId,
        name: giller?.name ?? '길러',
        profileImage: giller?.profilePhoto,
      },
      requestId: args.requestId,
      requestInfo: args.requestInfo,
    },
    'active'
  );

  return createdRoom;
}
