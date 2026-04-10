import '@testing-library/jest-native/extend-expect';

process.env.EXPO_PUBLIC_FIREBASE_API_KEY ??= 'test-api-key';
process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ??= 'test-project.firebaseapp.com';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ??= 'test-project';
process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ??= 'test-project.appspot.com';
process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??= '1234567890';
process.env.EXPO_PUBLIC_FIREBASE_APP_ID ??= '1:1234567890:web:test';
process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ??= 'G-TEST1234';

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
    h3: { fontSize: 20, fontWeight: 'bold' },
    body: { fontSize: 16 },
    bodyBold: { fontSize: 16, fontWeight: '600' },
    bodyLarge: { fontSize: 18 },
    caption: { fontSize: 12 },
  },
  FontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
}));

jest.mock('./src/theme/spacing', () => ({
  Spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  BorderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  Shadows: {
    sm: {},
    md: {},
    lg: {},
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

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
  },
  manipulateAsync: jest.fn(async (uri: string) => ({
    uri,
    width: 100,
    height: 100,
  })),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  const MockIcon = ({ name, ...props }: { name?: string }) =>
    React.createElement(Text, props, name ?? 'icon');

  return {
    MaterialIcons: MockIcon,
  };
});

jest.mock('expo-location', () => ({
  Accuracy: {
    Balanced: 'balanced',
  },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: {
      latitude: 37.5665,
      longitude: 126.978,
      accuracy: 10,
      altitude: null,
      speed: null,
      heading: null,
    },
  })),
  watchPositionAsync: jest.fn(async (_options, callback) => {
    callback({
      coords: {
        latitude: 37.5665,
        longitude: 126.978,
        accuracy: 10,
        altitude: null,
        speed: null,
        heading: null,
      },
    });
    return { remove: jest.fn() };
  }),
  reverseGeocodeAsync: jest.fn(async () => []),
}));

// Firebase modules are NOT mocked - using real Firebase for integration tests
// Only Auth is mocked for authentication testing

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
const mockUploadBytesResumable = jest.fn((storageRef) => {
  const snapshot = {
    bytesTransferred: 1024 * 1024,
    totalBytes: 1024 * 1024,
    state: 'success',
    ref: storageRef,
    metadata: { contentType: 'image/jpeg' },
  };

  return {
    snapshot,
    on: (
      _event: string,
      onProgress?: (progress: typeof snapshot) => void,
      _onError?: (error: Error) => void,
      onComplete?: () => void
    ) => {
      setTimeout(() => {
        onProgress?.(snapshot);
        onComplete?.();
      }, 0);
    },
  };
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
// global.__mockFirestoreData = mockFirestoreData;
// global.__clearMockFirestore = () => mockFirestoreData.clear();
global.__clearMockFirestore = jest.fn(() => {
  mockFirestoreStore.clear();
  mockFirestoreIdCounter = 0;
});

const mockFirestoreStore = new Map<string, Map<string, Record<string, any>>>();
let mockFirestoreIdCounter = 0;

class MockTimestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static fromDate(date: Date): MockTimestamp {
    const millis = date.getTime();
    return new MockTimestamp(Math.floor(millis / 1000), (millis % 1000) * 1_000_000);
  }

  static now(): MockTimestamp {
    return MockTimestamp.fromDate(new Date());
  }

  toDate(): Date {
    return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1_000_000));
  }

  toMillis(): number {
    return this.toDate().getTime();
  }
}

function getCollectionStore(name: string): Map<string, Record<string, any>> {
  const existing = mockFirestoreStore.get(name);
  if (existing) {
    return existing;
  }

  const created = new Map<string, Record<string, any>>();
  mockFirestoreStore.set(name, created);
  return created;
}

function cloneFirestoreValue<T>(value: T): T {
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneFirestoreValue(item)) as T;
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      result[key] = cloneFirestoreValue(item);
    });
    return result as T;
  }
  return value;
}

function normalizeDocData(data: Record<string, any>): Record<string, any> {
  const normalized = cloneFirestoreValue(data);
  const visit = (node: any): any => {
    if (node instanceof Date) {
      return MockTimestamp.fromDate(node);
    }
    if (Array.isArray(node)) {
      return node.map(visit);
    }
    if (node && typeof node === 'object') {
      Object.keys(node).forEach((key) => {
        node[key] = visit(node[key]);
      });
    }
    return node;
  };

  return visit(normalized);
}

function unwrapComparableValue(value: any): any {
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return value;
}

function getRefParts(parts: string[]): { collectionName: string; docId: string } {
  if (parts.length < 2) {
    throw new Error(`Invalid document reference: ${parts.join('/')}`);
  }
  return { collectionName: parts[parts.length - 2], docId: parts[parts.length - 1] };
}

const mockFirestoreModule = {
  collection: jest.fn((_db, name?: string) => ({
    type: 'collection',
    name: name ?? String(_db),
  })),
  doc: jest.fn((_db, ...segments: string[]) => {
    const parts = segments.length > 0 ? segments : [String(_db)];
    const { collectionName, docId } = getRefParts(parts);
    return {
      type: 'doc',
      collectionName,
      id: docId,
      path: `${collectionName}/${docId}`,
    };
  }),
  addDoc: jest.fn(async (collectionRef, data) => {
    const id = `mock-doc-${mockFirestoreIdCounter += 1}`;
    getCollectionStore(collectionRef.name).set(id, normalizeDocData(data));
    return { id, path: `${collectionRef.name}/${id}` };
  }),
  getDoc: jest.fn(async (docRef) => {
    const data = getCollectionStore(docRef.collectionName).get(docRef.id);
    return {
      id: docRef.id,
      exists: data !== undefined,
      exists: () => data !== undefined,
      data: () => data,
    };
  }),
  setDoc: jest.fn(async (docRef, data, options?: { merge?: boolean }) => {
    const collectionStore = getCollectionStore(docRef.collectionName);
    const previous = collectionStore.get(docRef.id) ?? {};
    collectionStore.set(
      docRef.id,
      options?.merge ? { ...previous, ...normalizeDocData(data) } : normalizeDocData(data)
    );
  }),
  updateDoc: jest.fn(async (docRef, data) => {
    const collectionStore = getCollectionStore(docRef.collectionName);
    const previous = collectionStore.get(docRef.id) ?? {};
    const next = { ...previous };
    Object.entries(data).forEach(([key, value]) => {
      if (value && typeof value === 'object' && value.__op === 'increment') {
        next[key] = Number(next[key] ?? 0) + Number(value.amount);
      } else {
        next[key] = normalizeDocData({ value }).value;
      }
    });
    collectionStore.set(docRef.id, next);
  }),
  deleteDoc: jest.fn(async (docRef) => {
    getCollectionStore(docRef.collectionName).delete(docRef.id);
  }),
  query: jest.fn((collectionRef, ...constraints) => ({
    type: 'query',
    collectionName: collectionRef.name,
    constraints,
  })),
  where: jest.fn((field, op, value) => ({ type: 'where', field, op, value })),
  orderBy: jest.fn((field, direction = 'asc') => ({ type: 'orderBy', field, direction })),
  limit: jest.fn((count) => ({ type: 'limit', count })),
  getDocs: jest.fn(async (queryOrCollection) => {
    const collectionName = queryOrCollection.collectionName ?? queryOrCollection.name;
    let docs = Array.from(getCollectionStore(collectionName).entries()).map(([id, data]) => ({
      id,
      ref: { collectionName, id, path: `${collectionName}/${id}` },
      data: () => data,
    }));

    const constraints = queryOrCollection.constraints ?? [];
    for (const constraint of constraints) {
      if (constraint.type === 'where') {
        docs = docs.filter((doc) => {
          const value = unwrapComparableValue(doc.data()?.[constraint.field]);
          const expected = unwrapComparableValue(constraint.value);
          if (constraint.op === '==') return value === expected;
          if (constraint.op === '>=') return value >= expected;
          if (constraint.op === '<') return value < expected;
          return true;
        });
      } else if (constraint.type === 'orderBy') {
        docs = docs.slice().sort((left, right) => {
          const leftValue = unwrapComparableValue(left.data()?.[constraint.field]);
          const rightValue = unwrapComparableValue(right.data()?.[constraint.field]);
          if (leftValue === rightValue) return 0;
          const order = leftValue > rightValue ? 1 : -1;
          return constraint.direction === 'desc' ? -order : order;
        });
      } else if (constraint.type === 'limit') {
        docs = docs.slice(0, constraint.count);
      }
    }

    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
      forEach: (callback) => docs.forEach(callback),
    };
  }),
  onSnapshot: jest.fn((ref, onNext) => {
    if (ref?.type === 'doc') {
      const data = getCollectionStore(ref.collectionName).get(ref.id);
      onNext?.({
        id: ref.id,
        exists: () => data !== undefined,
        data: () => data,
      });
    }

    return jest.fn();
  }),
  serverTimestamp: jest.fn(() => new Date()),
  increment: jest.fn((amount) => ({ __op: 'increment', amount })),
  Timestamp: {
    fromDate: MockTimestamp.fromDate,
    now: MockTimestamp.now,
  },
};

jest.mock('firebase/firestore', () => mockFirestoreModule);

jest.mock('./src/services/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user-001' } },
  storage: {},
  messaging: null,
  firebaseApp: {},
  requireUserId: jest.fn(() => 'test-user-001'),
}));

// Global fail function for tests
global.fail = (message: string) => {
  throw new Error(`Test failed: ${message}`);
};

// Global Firebase mock helpers for tests
// global.setupFirebaseMocks = () => {
//   // Clear existing mock data
//   global.__clearMockFirestore();
//
//   // Reset mock counters
//   mockDocIdCounter = 0;
// };

// global.clearFirebaseMocks = () => {
//   jest.clearAllMocks();
//
//   // Clear mock data
//   global.__clearMockFirestore();
// };
