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
// global.__mockFirestoreData = mockFirestoreData;
// global.__clearMockFirestore = () => mockFirestoreData.clear();

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
