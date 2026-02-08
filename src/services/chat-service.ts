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
  setDoc,
  arrayUnion,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { requireUserId } from './firebase';
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

  /**
   * 사용자별 채팅방 목록 실시간 구독
   */
  subscribeToUserChatRooms(listener: ChatRoomListener): () => void {
    const q = query(
      collection(db, CHAT_ROOMS_COLLECTION),
      where('participants.user1.userId', '==', this.userId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatRooms = snapshot.docs.map((doc) => ({
        chatRoomId: doc.id,
        ...doc.data(),
      })) as ChatRoom[];

      listener(chatRooms);
    }, (error) => {
      console.error('Error subscribing to chat rooms:', error);
    });

    return unsubscribe;
  }

  /**
   * 특정 채팅방의 메시지 실시간 구독
   */
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

  /**
   * 두 사용자 간의 채팅방 찾기 또는 생성
   */
  async findOrCreateChatRoom(otherUserId: string, data?: CreateChatRoomData): Promise<ChatRoom> {
    const q = query(
      collection(db, CHAT_ROOMS_COLLECTION),
      where('participants.user1.userId', '==', this.userId),
      where('participants.user2.userId', '==', otherUserId)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        chatRoomId: doc.id,
        ...doc.data(),
      } as ChatRoom;
    }

    if (!data) {
      throw new Error('Chat room data is required for creation');
    }

    return this.createChatRoom(data);
  }

  /**
   * 새 채팅방 생성
   */
  async createChatRoom(data: CreateChatRoomData): Promise<ChatRoom> {
    const chatRoomData = {
      participants: {
        user1: {
          userId: data.user1.userId,
          name: data.user1.name,
          profileImage: data.user1.profileImage || null,
        },
        user2: {
          userId: data.user2.userId,
          name: data.user2.name,
          profileImage: data.user2.profileImage || null,
        },
      },
      requestId: data.requestId || null,
      matchId: data.matchId || null,
      unreadCounts: {
        user1: 0,
        user2: 0,
      },
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, CHAT_ROOMS_COLLECTION), chatRoomData);

    return {
      chatRoomId: docRef.id,
      ...chatRoomData,
    } as ChatRoom;
  }

  /**
   * 메시지 전송
   */
  async sendMessage(data: CreateMessageData): Promise<ChatMessage> {
    const messageData = {
      chatRoomId: data.chatRoomId,
      senderId: this.userId,
      type: data.type,
      content: data.content,
      imageUrl: data.imageUrl || null,
      readStatus: 'sent' as MessageReadStatus,
      metadata: data.metadata || null,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(
      collection(db, CHAT_ROOMS_COLLECTION, data.chatRoomId, MESSAGES_COLLECTION),
      messageData
    );

    const chatRoomRef = doc(db, CHAT_ROOMS_COLLECTION, data.chatRoomId);
    await updateDoc(chatRoomRef, {
      lastMessage: {
        content: data.content,
        senderId: this.userId,
        createdAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
      [`unreadCounts.user${this.getUserIdPosition(data.chatRoomId)}`]: increment(1),
    });

    return {
      messageId: docRef.id,
      ...messageData,
    } as ChatMessage;
  }

  /**
   * 메시지 읽음 처리
   */
  async markMessagesAsRead(chatRoomId: string): Promise<void> {
    const chatRoomRef = doc(db, CHAT_ROOMS_COLLECTION, chatRoomId);
    const userPosition = this.getUserIdPosition(chatRoomId);

    await updateDoc(chatRoomRef, {
      [`unreadCounts.user${userPosition}`]: 0,
      [`participants.user${userPosition}.lastReadAt`]: serverTimestamp(),
    });
  }

  /**
   * 채팅방 비활성화 (배송 완료 등)
   */
  async deactivateChatRoom(chatRoomId: string): Promise<void> {
    const chatRoomRef = doc(db, CHAT_ROOMS_COLLECTION, chatRoomId);

    await updateDoc(chatRoomRef, {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * 채팅방 정보 가져오기
   */
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

  /**
   * 시스템 메시지 전송 (매칭, 배송 상태 변경 등)
   */
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

  /**
   * 사용자의 채팅방 내 위치 반환 (user1 또는 user2)
   */
  private getUserIdPosition(chatRoomId: string): 1 | 2 {
    const chatRoom = this.getChatRoomFromCache(chatRoomId);
    if (chatRoom?.participants.user1.userId === this.userId) {
      return 1;
    }
    return 2;
  }

  private getChatRoomFromCache(chatRoomId: string): ChatRoom | null {
    return null;
  }
}

/**
 * 채팅 서비스 인스턴스 생성
 */
export function createChatService(): ChatService {
  return new ChatService();
}

/**
 * 특정 요청/매칭에 대한 채팅방 가져오기
 */
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

/**
 * 특정 요청/매칭에 대한 채팅방 가져오기 (matchId)
 */
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
