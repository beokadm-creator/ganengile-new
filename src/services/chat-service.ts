/**
 * Chat Service
 * Firestore 湲곕컲 ?ㅼ떆媛?梨꾪똿 ?쒕퉬??
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

  /**
   * ?ъ슜?먮퀎 梨꾪똿諛?紐⑸줉 ?ㅼ떆媛?援щ룆
   */
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
        const aTime = (a.updatedAt as any)?.toDate?.()?.getTime?.() || 0;
        const bTime = (b.updatedAt as any)?.toDate?.()?.getTime?.() || 0;
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

  /**
   * ?뱀젙 梨꾪똿諛⑹쓽 硫붿떆吏 ?ㅼ떆媛?援щ룆
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
   * ???ъ슜??媛꾩쓽 梨꾪똿諛?李얘린 ?먮뒗 ?앹꽦
   */
  async findOrCreateChatRoom(otherUserId: string, data?: CreateChatRoomData): Promise<ChatRoom> {
    // ?뺣갑??寃??(?닿? user1)
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

    // ??갑??寃??(?곷?媛 user1)
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

  /**
   * ??梨꾪똿諛??앹꽦
   */
  async createChatRoom(data: CreateChatRoomData, status: 'pending' | 'active' = 'pending'): Promise<ChatRoom> {
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
      requestInfo: data.requestInfo || null,
      unreadCounts: {
        user1: 0,
        user2: 0,
      },
      status,
      isActive: status === 'active',  // pending硫?false, active硫?true
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
   * 梨꾪똿諛⑹뿉???ъ슜???꾩튂 議고쉶 (Firestore?먯꽌 吏곸젒 議고쉶)
   */
  private async fetchUserPosition(chatRoomId: string): Promise<1 | 2> {
    const chatRoomDoc = await getDoc(doc(db, CHAT_ROOMS_COLLECTION, chatRoomId));
    if (!chatRoomDoc.exists()) return 2;
    const data = chatRoomDoc.data();
    return data.participants.user1.userId === this.userId ? 1 : 2;
  }

  /**
   * 硫붿떆吏 ?꾩넚
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

    // ?섏떊???곷?諛???誘몄씫??移댁슫??利앷?
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

  /**
   * 硫붿떆吏 ?쎌쓬 泥섎━
   */
  async markMessagesAsRead(chatRoomId: string): Promise<void> {
    const chatRoomRef = doc(db, CHAT_ROOMS_COLLECTION, chatRoomId);
    const userPosition = await this.fetchUserPosition(chatRoomId);

    await updateDoc(chatRoomRef, {
      [`unreadCounts.user${userPosition}`]: 0,
      [`participants.user${userPosition}.lastReadAt`]: serverTimestamp(),
    });
  }

  /**
   * 梨꾪똿諛?鍮꾪솢?깊솕 (諛곗넚 ?꾨즺 ??
   */
  async deactivateChatRoom(chatRoomId: string): Promise<void> {
    const chatRoomRef = doc(db, CHAT_ROOMS_COLLECTION, chatRoomId);

    await updateDoc(chatRoomRef, {
      isActive: false,
      status: 'closed',
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * 梨꾪똿諛??섍?湲?
   */
  async leaveChatRoom(chatRoomId: string): Promise<void> {
    const chatRoomRef = doc(db, CHAT_ROOMS_COLLECTION, chatRoomId);

    await updateDoc(chatRoomRef, {
      status: 'closed',
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * 留ㅼ묶 ?꾨즺 ??梨꾪똿諛??곹깭瑜?active濡?蹂寃?
   */
  async activateChatRoom(chatRoomId: string): Promise<void> {
    const chatRoomRef = doc(db, CHAT_ROOMS_COLLECTION, chatRoomId);

    await updateDoc(chatRoomRef, {
      status: 'active',
      isActive: true,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * 梨꾪똿諛??뺣낫 媛?몄삤湲?
   */
  async getChatRoom(chatRoomId: string): Promise<ChatRoom | null> {
    const docRef = doc(db, CHAT_ROOMS_COLLECTION, chatRoomId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists) {
      return null;
    }

    return {
      chatRoomId: docSnap.id,
      ...docSnap.data(),
    } as ChatRoom;
  }

  /**
   * ?쒖뒪??硫붿떆吏 ?꾩넚 (留ㅼ묶, 諛곗넚 ?곹깭 蹂寃???
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

}

/**
 * 梨꾪똿 ?쒕퉬???몄뒪?댁뒪 ?앹꽦
 */
export function createChatService(): ChatService {
  return new ChatService();
}

/**
 * ?뱀젙 ?붿껌/留ㅼ묶?????梨꾪똿諛?媛?몄삤湲?
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
 * ?뱀젙 ?붿껌/留ㅼ묶?????梨꾪똿諛?媛?몄삤湲?(matchId)
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
