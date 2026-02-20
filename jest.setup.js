import '@testing-library/jest-native/extend-expect';

// Mock Colors theme
jest.mock('./src/theme/colors', () => ({
  Colors: {
    primary: '#00BCD4',
    secondary: '#4CAF50',
    accent: '#FF9800',
    text: {
      primary: '#212121',
      secondary: '#757575',
    },
    background: {
      primary: '#FFFFFF',
      secondary: '#F5F5F5',
    },
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    white: '#FFFFFF',
    black: '#000000',
  },
}));

jest.mock('./src/theme/typography', () => ({
  Typography: {
    h1: { fontSize: 32, fontWeight: 'bold' },
    h2: { fontSize: 24, fontWeight: 'bold' },
    body: { fontSize: 16 },
    bodyBold: { fontSize: 16, fontWeight: '600' },
    caption: { fontSize: 12 },
  },
}));

jest.mock('./src/theme/spacing', () => ({
  Spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  FileSystem: {
    EncodingType: {
      Base64: 'base64',
      UTF8: 'utf8',
    },
  },
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(() => Promise.resolve('VGVzdA==')), // Simple valid base64: "Test"
  deleteAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
}));

// Mock Firebase modules with in-memory storage
const mockFirestoreData = new Map();
let mockDocIdCounter = 0;

const createMockDocRef = (collectionName, docId) => {
  return {
    id: docId,
    ref: `${collectionName}/${docId}`,
    exists: mockFirestoreData.has(docId),
    data: () => mockFirestoreData.get(docId),
  };
};

const mockCollection = jest.fn((db, collectionName) => ({
  _collectionName: collectionName,
  collectionName
}));
const mockDoc = jest.fn((db, collectionName, docId) => createMockDocRef(collectionName, docId));
const mockGetDoc = jest.fn(async (docRef) => {
  const collectionName = docRef.ref.split('/')[0];
  const docId = docRef.id;
  console.log('mockGetDoc:', { collectionName, docId, hasData: mockFirestoreData.has(docId), dataSize: mockFirestoreData.size });
  return createMockDocRef(collectionName, docId);
});
const mockGetDocs = jest.fn(async (query) => {
  const collectionName = query._collectionName || query.collectionName || 'unknown';
  const docs = [];
  mockFirestoreData.forEach((value, key) => {
    const data = mockFirestoreData.get(key);
    if (data && data.collectionName === collectionName) {
      docs.push({
        id: key,
        ref: createMockDocRef(collectionName, key),
        data: () => value,
        exists: true,
      });
    }
  });
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (callback) => docs.forEach(callback),
  };
});
const mockAddDoc = jest.fn(async (collectionRef, data) => {
  const collectionName = collectionRef._collectionName || collectionRef.collectionName;
  const docId = `auto-${mockDocIdCounter++}`;
  console.log('mockAddDoc:', { collectionName, docId, dataSize: JSON.stringify(data).length });
  mockFirestoreData.set(docId, { ...data, id: docId, collectionName });
  const docRef = createMockDocRef(collectionName, docId);
  console.log('mockAddDoc after set:', { hasData: mockFirestoreData.has(docId) });
  return docRef;
});
const mockSetDoc = jest.fn(async (docRef, data) => {
  const collectionName = docRef.ref.split('/')[0];
  const docId = docRef.id;
  mockFirestoreData.set(docId, { ...data, id: docId, collectionName });
});
const mockUpdateDoc = jest.fn(async (docRef, updates) => {
  const docId = docRef.id;
  const existing = mockFirestoreData.get(docId) || {};
  mockFirestoreData.set(docId, { ...existing, ...updates });
});
const mockDeleteDoc = jest.fn(async (docRef) => {
  const docId = docRef.id;
  mockFirestoreData.delete(docId);
});
const mockQuery = jest.fn((collection, ...args) => {
  const collectionName = collection._collectionName || collection.collectionName;
  return { _collectionName: collectionName, collectionName, args };
});
const mockWhere = jest.fn((field, op, value) => ({ field, op, value }));
const mockOrderBy = jest.fn((field, dir) => ({ field, dir }));
const mockLimit = jest.fn((n) => ({ limit: n }));
const mockRunTransaction = jest.fn();

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: { uid: 'test-user-id', email: 'test@example.com' },
  })),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: mockCollection,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  addDoc: mockAddDoc,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  runTransaction: mockRunTransaction,
  serverTimestamp: jest.fn(() => new Date()),
}));

// Mock Firebase Storage
const mockStorageInstance = {};
const mockGetStorage = jest.fn(() => mockStorageInstance);
const mockRef = jest.fn().mockImplementation((storageOrPath, path?) => {
  const refPath = path ? path : (typeof storageOrPath === 'string' ? storageOrPath : 'mock/path');
  return {
    ref: refPath,
    toString: () => refPath,
  };
});
const mockUploadBytesResumable = jest.fn((storageRef, blob, options?) => {
  // Call onProgress callback immediately (synchronously for tests)
  if (options?.onProgress) {
    setTimeout(() => {
      const mockSnapshot = {
        bytesTransferred: 1024 * 1024,
        totalBytes: 1024 * 1024,
        state: 'success',
        ref: storageRef,
        metadata: { contentType: 'image/jpeg' },
      };
      options.onProgress(mockSnapshot);
    }, 0);
  }

  // Return a promise that resolves immediately
  return Promise.resolve({
    bytesTransferred: 1024 * 1024,
    totalBytes: 1024 * 1024,
    ref: storageRef,
    snapshot: {
      bytesTransferred: 1024 * 1024,
      totalBytes: 1024 * 1024,
      state: 'success',
      ref: storageRef,
      metadata: { contentType: 'image/jpeg' },
    },
  });
});
const mockGetDownloadURL = jest.fn(() => 'https://storage.url/mock.jpg');
const mockDeleteObject = jest.fn();

jest.mock('firebase/storage', () => ({
  getStorage: mockGetStorage,
  ref: mockRef,
  uploadBytesResumable: mockUploadBytesResumable,
  getDownloadURL: mockGetDownloadURL,
  deleteObject: mockDeleteObject,
}));

jest.mock('firebase/messaging', () => ({
  getMessaging: jest.fn(() => null),
  getToken: jest.fn(),
  onMessage: jest.fn(),
  onTokenRefresh: jest.fn(),
}));

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native/Libraries/Components/View/View');
  return {
    GestureHandlerRootView: View,
    ScrollView: View,
    State: {},
  };
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Global test utilities
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};

// Export mock utilities for tests to use
global.__mockFirestoreData = mockFirestoreData;
global.__clearMockFirestore = () => mockFirestoreData.clear();

// Global fail function for tests
global.fail = (message: string) => {
  throw new Error(`Test failed: ${message}`);
};

// Global Firebase mock helpers for tests
global.setupFirebaseMocks = () => {
  // Clear existing mock data
  global.__clearMockFirestore();
  
  // Reset mock counters
  mockDocIdCounter = 0;
};

global.clearFirebaseMocks = () => {
  jest.clearAllMocks();
  
  // Clear mock data
  global.__clearMockFirestore();
};
