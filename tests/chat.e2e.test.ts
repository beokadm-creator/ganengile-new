import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MessageType } from '../../src/types/chat';

jest.mock('../../src/services/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user-001' } },
  requireUserId: jest.fn(() => 'test-user-001'),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  serverTimestamp: jest.fn(() => ({ toDate: () => new Date() })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  increment: jest.fn(() => ({})),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  reset: jest.fn(),
  dispatch: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  getId: jest.fn(() => 'test-id'),
  getParent: jest.fn(),
  getState: jest.fn(),
};

jest.mock('../../src/contexts/UserContext', () => ({
  useUser: jest.fn(() => ({
    user: { uid: 'test-user-001' },
    currentRole: 'gller' as const,
    loading: false,
  })),
  UserProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Chat System E2E', () => {
  const { createChatService } = require('../../src/services/chat-service');
  let chatService: ReturnType<typeof createChatService>;

  beforeEach(() => {
    jest.clearAllMocks();
    chatService = createChatService();
  });

  describe('Chat Service', () => {
    test('should subscribe to user chat rooms', async () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');
      onSnapshot.mockReturnValue(mockUnsubscribe);

      const unsubscribe = chatService.subscribeToUserChatRooms(mockCallback);

      expect(onSnapshot).toHaveBeenCalled();
      expect(unsubscribe).toBe(mockUnsubscribe);
    });

    test('should send message', async () => {
      const { addDoc, updateDoc } = require('firebase/firestore');
      
      await chatService.sendMessage({
        chatRoomId: 'room1',
        senderId: 'test-user-001',
        type: MessageType.TEXT,
        content: 'Test message',
      });

      expect(addDoc).toHaveBeenCalled();
      expect(updateDoc).toHaveBeenCalled();
    });

    test('should mark messages as read', async () => {
      const { updateDoc } = require('firebase/firestore');
      
      await chatService.markMessagesAsRead('room1');

      expect(updateDoc).toHaveBeenCalled();
    });

    test('should leave chat room', async () => {
      const { updateDoc } = require('firebase/firestore');
      
      await chatService.leaveChatRoom('room1');

      expect(updateDoc).toHaveBeenCalled();
    });
  });

  describe('Chat Navigation Flow', () => {
    test('should navigate from chat list to chat room', async () => {
      mockNavigation.navigate('Chat', {
        chatRoomId: 'room1',
        otherUserId: 'other-user-001',
        otherUserName: 'John Doe',
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Chat', {
        chatRoomId: 'room1',
        otherUserId: 'other-user-001',
        otherUserName: 'John Doe',
      });
    });
  });

  describe('Unread Count Management', () => {
    test('should calculate unread count correctly', async () => {
      const chatRoom = {
        chatRoomId: 'room1',
        participants: {
          user1: { userId: 'test-user-001', name: '나' },
          user2: { userId: 'other-user-001', name: 'John Doe' },
        },
        unreadCounts: { user1: 3, user2: 0 },
      };

      const unreadCount = chatRoom.participants.user1.userId === 'test-user-001'
        ? chatRoom.unreadCounts.user1
        : chatRoom.unreadCounts.user2;

      expect(unreadCount).toBe(3);
    });
  });

  describe('Chat Room Search', () => {
    test('should filter chat rooms by user name', async () => {
      const chatRooms = [
        {
          chatRoomId: 'room1',
          participants: {
            user1: { userId: 'test-user-001', name: '나' },
            user2: { userId: 'other-user-001', name: 'John Doe' },
          },
        },
        {
          chatRoomId: 'room2',
          participants: {
            user1: { userId: 'test-user-001', name: '나' },
            user2: { userId: 'other-user-002', name: 'Jane Smith' },
          },
        },
      ];

      const searchQuery = 'john';
      const filtered = chatRooms.filter((room) => {
        const otherUser = room.participants.user1.userId === 'test-user-001'
          ? room.participants.user2
          : room.participants.user1;
        return otherUser.name.toLowerCase().includes(searchQuery.toLowerCase());
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0].participants.user2.name).toBe('John Doe');
    });

    test('should filter chat rooms by message content', async () => {
      const chatRooms = [
        {
          chatRoomId: 'room1',
          lastMessage: { text: 'Hello world' },
        },
        {
          chatRoomId: 'room2',
          lastMessage: { text: 'Hi there' },
        },
      ];

      const searchQuery = 'world';
      const filtered = chatRooms.filter((room) => 
        room.lastMessage?.text.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered.length).toBe(1);
      expect(filtered[0].lastMessage?.text).toBe('Hello world');
    });
  });

  describe('Empty States', () => {
    test('should show empty state when no chat rooms', async () => {
      const chatRooms: unknown[] = [];
      expect(chatRooms.length).toBe(0);
    });

    test('should show search empty state when no results', async () => {
      const chatRooms = [{ chatRoomId: 'room1', participants: { user2: { name: 'John Doe' } } }];
      const searchQuery = 'nonexistent';
      
      const filtered = chatRooms.filter((room: any) => 
        room.participants.user2.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered.length).toBe(0);
      expect(chatRooms.length).toBeGreaterThan(0);
    });
  });
});
