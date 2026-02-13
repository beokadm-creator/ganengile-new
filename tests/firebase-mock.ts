/**
 * Firebase Mock Utilities
 * All Firebase module mocks in one place
 */

import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, onSnapshot, serverTimestamp, addDoc } from 'firebase/firestore';
import { getAuth, getToken } from 'firebase/messaging';

// Mock document reference
export const mockDocRef = {
  id: 'test-doc-id',
  parent: null,
  path: 'collection/test-doc-id',
};

// Mock snapshot
export const mockDocSnapshot = {
  exists: true,
  id: 'test-doc-id',
  data: () => ({
    testField: 'testValue',
    userId: 'test-user-001',
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
};

// Mock query snapshot
export const mockQuerySnapshot = {
  docs: [],
  empty: true,
  size: 0,
  forEach: jest.fn(),
};

// Mock Firestore instance
export const mockDb = {
  collection: (name: string) => ({ id: name, path: name }),
};

// Mock match-specific snapshot factory
export const mockMatchSnapshot = (matchData: any) => ({
  exists: true,
  id: matchData.matchId || 'test-match-id',
  data: () => matchData,
});

// Mock matches query snapshot factory
export const mockMatchesQuerySnapshot = (matches: any[]) => ({
  docs: matches.map(m => ({ id: m.matchId, data: () => m })),
  empty: matches.length === 0,
  size: matches.length,
  forEach: (callback: Function) => matches.forEach(m => callback({ id: m.matchId, data: () => m })),
});

// Track mock functions for test customization
let mockGetDocFn: any;
let mockGetDocsFn: any;
let mockSetDocFn: any;
let mockUpdateDocFn: any;
let mockDeleteDocFn: any;
let mockAddDocFn: any;

// Setup mocks before tests
export function setupFirebaseMocks() {
  // Create mock functions
  mockGetDocFn = jest.fn();
  mockGetDocsFn = jest.fn();
  mockSetDocFn = jest.fn();
  mockUpdateDocFn = jest.fn();
  mockDeleteDocFn = jest.fn();
  mockAddDocFn = jest.fn();

  // Mock firebase/firestore
  jest.doMock('firebase/firestore', () => ({
    doc: jest.fn(() => mockDocRef),
    getDoc: mockGetDocFn,
    setDoc: mockSetDocFn,
    updateDoc: mockUpdateDocFn,
    deleteDoc: mockDeleteDocFn,
    addDoc: mockAddDocFn,
    collection: jest.fn(() => ({})),
    getDocs: mockGetDocsFn,
    query: jest.fn(() => ({})),
    where: jest.fn(() => ({})),
    onSnapshot: jest.fn(() => jest.fn()),
    serverTimestamp: jest.fn(() => ({ toDate: () => new Date() })),
  }));

  // Mock firebase/auth (only getAuth)
  jest.doMock('firebase/auth', () => ({
    getAuth: jest.fn(() => ({
      currentUser: { uid: 'test-user-001' },
    })),
  }));

  // Mock firebase/messaging
  jest.doMock('firebase/messaging', () => ({
    getToken: jest.fn(() => Promise.resolve('test-fcm-token')),
    onMessage: jest.fn(() => jest.fn()),
  }));

  // Mock src/services/firebase
  jest.doMock('../src/services/firebase', () => ({
    db: mockDb,
    auth: { currentUser: { uid: 'test-user-001' } },
    messaging: {},
    requireUserId: jest.fn(() => 'test-user-001'),
  }));

  // Set default mock return values
  mockGetDocFn.mockResolvedValue(mockDocSnapshot);
  mockGetDocsFn.mockResolvedValue(mockQuerySnapshot);
  mockSetDocFn.mockResolvedValue({});
  mockUpdateDocFn.mockResolvedValue({});
  mockDeleteDocFn.mockResolvedValue({});
  mockAddDocFn.mockResolvedValue({ id: 'new-doc-id' });
}

// Get mock functions for test customization
export function getFirebaseMocks() {
  return {
    getDoc: mockGetDocFn,
    getDocs: mockGetDocsFn,
    setDoc: mockSetDocFn,
    updateDoc: mockUpdateDocFn,
    deleteDoc: mockDeleteDocFn,
    addDoc: mockAddDocFn,
  };
}

// Clear all mocks
export function clearFirebaseMocks() {
  jest.clearAllMocks();
}
