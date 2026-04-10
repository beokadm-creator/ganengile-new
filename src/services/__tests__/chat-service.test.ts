/**
 * Chat Service Unit Tests
 */

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  serverTimestamp: jest.fn(() => 'mock-server-timestamp'),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  increment: jest.fn((val: number) => ({ _increment: val })),
}));

// Mock firebase module
jest.mock('../firebase', () => ({
  db: {},
  requireUserId: jest.fn(() => 'mock-user-id'),
}));

// Mock user-service
jest.mock('../user-service', () => ({
  getUserById: jest.fn(),
}));

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import { createChatService, getChatRoomByRequestId, getChatRoomByMatchId, ensureChatRoomForRequest } from '../chat-service';
import { getUserById } from '../user-service';

describe('Chat Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createChatService', () => {
    it('ChatService 인스턴스를 생성해야 한다', () => {
      const service = createChatService();
      expect(service).toBeDefined();
    });
  });

  describe('findOrCreateChatRoom', () => {
    it('기존 채팅방이 있으면 반환해야 한다', async () => {
      const service = createChatService();
      const mockDoc = { id: 'chat-1', data: () => ({ status: 'active' }) };
      const mockSnapshot = { empty: false, docs: [mockDoc] };
      const mockQuery = {};

      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue(mockQuery);
      (query as jest.Mock).mockReturnValue(mockQuery);
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await service.findOrCreateChatRoom('other-user-1');

      expect(result).toBeDefined();
      expect(result.chatRoomId).toBe('chat-1');
    });

    it('기존 채팅방이 없고 data가 없으면 에러를 던져야 한다', async () => {
      const service = createChatService();
      const mockQuery = {};

      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue(mockQuery);
      (query as jest.Mock).mockReturnValue(mockQuery);
      (getDocs as jest.Mock).mockResolvedValue({ empty: true });

      await expect(service.findOrCreateChatRoom('other-user-1'))
        .rejects.toThrow('Chat room data is required');
    });

    it('역방향 조회에서 기존 채팅방을 찾으면 반환해야 한다', async () => {
      const service = createChatService();
      const mockDoc = { id: 'chat-2', data: () => ({ status: 'pending' }) };
      const mockQuery = {};

      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue(mockQuery);
      (query as jest.Mock).mockReturnValue(mockQuery);
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ empty: true })
        .mockResolvedValueOnce({ empty: false, docs: [mockDoc] });

      const data = {
        user1: { userId: 'mock-user-id', name: '사용자' },
        user2: { userId: 'other-user-1', name: '상대방' },
      };
      const result = await service.findOrCreateChatRoom('other-user-1', data);

      expect(result.chatRoomId).toBe('chat-2');
    });
  });

  describe('createChatRoom', () => {
    it('새 채팅방을 생성해야 한다', async () => {
      const service = createChatService();
      const mockDocRef = { id: 'new-chat-1' };

      (collection as jest.Mock).mockReturnValue({});
      (addDoc as jest.Mock).mockResolvedValue(mockDocRef);

      const data = {
        user1: { userId: 'u1', name: '사용자1' },
        user2: { userId: 'u2', name: '사용자2' },
      };

      const result = await service.createChatRoom(data);

      expect(result.chatRoomId).toBe('new-chat-1');
      expect(result.participants.user1.userId).toBe('u1');
      expect(result.participants.user2.userId).toBe('u2');
      expect(result.unreadCounts.user1).toBe(0);
      expect(result.unreadCounts.user2).toBe(0);
      expect(addDoc).toHaveBeenCalledWith({}, expect.objectContaining({
        participants: expect.objectContaining({
          user1: expect.objectContaining({ userId: 'u1' }),
          user2: expect.objectContaining({ userId: 'u2' }),
        }),
      }));
    });

    it('기본 상태는 pending이어야 한다', async () => {
      const service = createChatService();
      const mockDocRef = { id: 'chat-default' };

      (collection as jest.Mock).mockReturnValue({});
      (addDoc as jest.Mock).mockResolvedValue(mockDocRef);

      const data = {
        user1: { userId: 'u1', name: '사용자1' },
        user2: { userId: 'u2', name: '사용자2' },
      };

      const result = await service.createChatRoom(data);

      expect(result.status).toBe('pending');
      expect(result.isActive).toBe(false);
    });

    it('active 상태로 채팅방을 생성할 수 있어야 한다', async () => {
      const service = createChatService();
      const mockDocRef = { id: 'chat-active' };

      (collection as jest.Mock).mockReturnValue({});
      (addDoc as jest.Mock).mockResolvedValue(mockDocRef);

      const data = {
        user1: { userId: 'u1', name: '사용자1' },
        user2: { userId: 'u2', name: '사용자2' },
      };

      const result = await service.createChatRoom(data, 'active');

      expect(result.status).toBe('active');
      expect(result.isActive).toBe(true);
    });

    it('requestId와 matchId를 포함할 수 있어야 한다', async () => {
      const service = createChatService();
      const mockDocRef = { id: 'chat-with-ids' };

      (collection as jest.Mock).mockReturnValue({});
      (addDoc as jest.Mock).mockResolvedValue(mockDocRef);

      const data = {
        user1: { userId: 'u1', name: '사용자1' },
        user2: { userId: 'u2', name: '사용자2' },
        requestId: 'req-1',
        matchId: 'match-1',
      };

      const result = await service.createChatRoom(data, 'active');

      expect(result.requestId).toBe('req-1');
      expect(result.matchId).toBe('match-1');
    });
  });

  describe('sendMessage', () => {
    it('메시지를 전송하고 수신자 미읽음 카운트를 증가시켜야 한다', async () => {
      const service = createChatService();
      const mockDocRef = { id: 'msg-1' };
      const mockChatRoomDoc = {
        exists: () => true,
        data: () => ({
          participants: {
            user1: { userId: 'mock-user-id' },
            user2: { userId: 'other-user' },
          },
        }),
      };

      (collection as jest.Mock).mockReturnValue({});
      (addDoc as jest.Mock).mockResolvedValue(mockDocRef);
      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue(mockChatRoomDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await service.sendMessage({
        chatRoomId: 'chat-1',
        type: 'text',
        content: '안녕하세요',
      });

      expect(result.messageId).toBe('msg-1');
      expect(result.content).toBe('안녕하세요');
      expect(result.senderId).toBe('mock-user-id');
      expect(result.readStatus).toBe('sent');
      expect(updateDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          'unreadCounts.user2': expect.any(Object),
        })
      );
    });
  });

  describe('markMessagesAsRead', () => {
    it('자신의 미읽음 카운트를 0으로 변경해야 한다', async () => {
      const service = createChatService();
      const mockChatRoomDoc = {
        exists: () => true,
        data: () => ({
          participants: {
            user1: { userId: 'mock-user-id' },
          },
        }),
      };

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue(mockChatRoomDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await service.markMessagesAsRead('chat-1');

      expect(updateDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          'unreadCounts.user1': 0,
        })
      );
    });
  });

  describe('deactivateChatRoom', () => {
    it('채팅방을 비활성화해야 한다', async () => {
      const service = createChatService();

      (doc as jest.Mock).mockReturnValue({});
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await service.deactivateChatRoom('chat-1');

      expect(updateDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          isActive: false,
          status: 'closed',
        })
      );
    });
  });

  describe('leaveChatRoom', () => {
    it('채팅방을 종료 상태로 변경해야 한다', async () => {
      const service = createChatService();

      (doc as jest.Mock).mockReturnValue({});
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await service.leaveChatRoom('chat-1');

      expect(updateDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          status: 'closed',
        })
      );
    });
  });

  describe('activateChatRoom', () => {
    it('채팅방을 활성화해야 한다', async () => {
      const service = createChatService();

      (doc as jest.Mock).mockReturnValue({});
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await service.activateChatRoom('chat-1');

      expect(updateDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          status: 'active',
          isActive: true,
        })
      );
    });
  });

  describe('getChatRoom', () => {
    it('채팅방이 존재하면 반환해야 한다', async () => {
      const service = createChatService();
      const mockDocSnap = {
        exists: () => true,
        id: 'chat-1',
        data: () => ({ status: 'active', participants: {} }),
      };

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue(mockDocSnap);

      const result = await service.getChatRoom('chat-1');

      expect(result).not.toBeNull();
      expect(result!.chatRoomId).toBe('chat-1');
    });

    it('채팅방이 존재하지 않으면 null을 반환해야 한다', async () => {
      const service = createChatService();

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

      const result = await service.getChatRoom('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('sendSystemMessage', () => {
    it('시스템 메시지를 전송해야 한다', async () => {
      const service = createChatService();
      const mockDocRef = { id: 'sys-msg-1' };
      const mockChatRoomDoc = {
        exists: () => true,
        data: () => ({
          participants: {
            user1: { userId: 'mock-user-id' },
            user2: { userId: 'other-user' },
          },
        }),
      };

      (collection as jest.Mock).mockReturnValue({});
      (addDoc as jest.Mock).mockResolvedValue(mockDocRef);
      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue(mockChatRoomDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await service.sendSystemMessage('chat-1', 'match_created', '매칭이 완료되었습니다', { requestId: 'req-1' });

      expect(result.messageId).toBe('sys-msg-1');
      expect(result.type).toBe('system');
      expect(result.metadata).toEqual(expect.objectContaining({
        type: 'match_created',
        requestId: 'req-1',
      }));
    });
  });
});

describe('getChatRoomByRequestId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('요청 ID로 채팅방을 찾아야 한다', async () => {
    const mockDoc = { id: 'chat-req', data: () => ({ requestId: 'req-123' }) };
    const mockQuery = {};

    (collection as jest.Mock).mockReturnValue({});
    (where as jest.Mock).mockReturnValue(mockQuery);
    (query as jest.Mock).mockReturnValue(mockQuery);
    (getDocs as jest.Mock).mockResolvedValue({ empty: false, docs: [mockDoc] });

    const result = await getChatRoomByRequestId('req-123');

    expect(result).not.toBeNull();
    expect(result!.chatRoomId).toBe('chat-req');
  });

  it('채팅방이 없으면 null을 반환해야 한다', async () => {
    const mockQuery = {};

    (collection as jest.Mock).mockReturnValue({});
    (where as jest.Mock).mockReturnValue(mockQuery);
    (query as jest.Mock).mockReturnValue(mockQuery);
    (getDocs as jest.Mock).mockResolvedValue({ empty: true });

    const result = await getChatRoomByRequestId('nonexistent');

    expect(result).toBeNull();
  });
});

describe('getChatRoomByMatchId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('매칭 ID로 채팅방을 찾아야 한다', async () => {
    const mockDoc = { id: 'chat-match', data: () => ({ matchId: 'match-123' }) };
    const mockQuery = {};

    (collection as jest.Mock).mockReturnValue({});
    (where as jest.Mock).mockReturnValue(mockQuery);
    (query as jest.Mock).mockReturnValue(mockQuery);
    (getDocs as jest.Mock).mockResolvedValue({ empty: false, docs: [mockDoc] });

    const result = await getChatRoomByMatchId('match-123');

    expect(result).not.toBeNull();
    expect(result!.chatRoomId).toBe('chat-match');
  });

  it('매칭 ID로 채팅방을 찾지 못하면 null을 반환해야 한다', async () => {
    const mockQuery = {};

    (collection as jest.Mock).mockReturnValue({});
    (where as jest.Mock).mockReturnValue(mockQuery);
    (query as jest.Mock).mockReturnValue(mockQuery);
    (getDocs as jest.Mock).mockResolvedValue({ empty: true });

    const result = await getChatRoomByMatchId('nonexistent');

    expect(result).toBeNull();
  });
});

describe('ensureChatRoomForRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('기존 채팅방이 있으면 그것을 반환해야 한다', async () => {
    const mockDoc = { id: 'existing-chat', data: () => ({ requestId: 'req-1' }) };
    const mockQuery = {};

    (collection as jest.Mock).mockReturnValue({});
    (where as jest.Mock).mockReturnValue(mockQuery);
    (query as jest.Mock).mockReturnValue(mockQuery);
    (getDocs as jest.Mock).mockResolvedValue({ empty: false, docs: [mockDoc] });

    const result = await ensureChatRoomForRequest({
      requestId: 'req-1',
      requesterId: 'user-1',
      gillerId: 'giller-1',
    });

    expect(result.chatRoomId).toBe('existing-chat');
    expect(getUserById).not.toHaveBeenCalled();
  });

  it('기존 채팅방이 없으면 새로 생성해야 한다', async () => {
    const mockQuery = {};
    const mockDocRef = { id: 'new-chat' };

    (collection as jest.Mock).mockReturnValue({});
    (where as jest.Mock).mockReturnValue(mockQuery);
    (query as jest.Mock).mockReturnValue(mockQuery);
    (getDocs as jest.Mock).mockResolvedValue({ empty: true });
    (getUserById as jest.Mock)
      .mockResolvedValueOnce({ name: '요청자', profilePhoto: 'photo1' })
      .mockResolvedValueOnce({ name: '길러', profilePhoto: 'photo2' });
    (addDoc as jest.Mock).mockResolvedValue(mockDocRef);

    const result = await ensureChatRoomForRequest({
      requestId: 'req-1',
      requesterId: 'user-1',
      gillerId: 'giller-1',
    });

    expect(result.chatRoomId).toBe('new-chat');
    expect(getUserById).toHaveBeenCalledWith('user-1');
    expect(getUserById).toHaveBeenCalledWith('giller-1');
  });
});
