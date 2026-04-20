jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Platform: { OS: 'ios' },
}));

jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
  openSettings: jest.fn(),
}));

import {
  parseError,
  getUserFriendlyMessage,
  isNetworkError,
  isTimeoutError,
  isPermissionError,
  isFirebaseError,
  createNetworkError,
  createPermissionError,
  categorizeError,
  assessSeverity,
  ErrorCode,
  ErrorCategory,
  ErrorSeverity,
} from '../../utils/error-handler';

describe('error-handler', () => {
  describe('parseError', () => {
    it('handles Error instances', () => {
      const result = parseError(new Error('test error'));
      expect(result.message).toBe('test error');
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('handles string errors', () => {
      const result = parseError('plain string error');
      expect(result.message).toBe('plain string error');
    });

    it('handles null', () => {
      const result = parseError(null);
      expect(result.message).toBe('null');
    });

    it('handles undefined', () => {
      const result = parseError(undefined);
      expect(result.message).toBe('undefined');
    });

    it('handles error-like objects with message', () => {
      const result = parseError({ message: 'like an error' });
      expect(result.message).toBe('like an error');
    });

    it('detects network errors', () => {
      const result = parseError(new Error('Network request failed'));
      expect(result.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(result.category).toBe(ErrorCategory.NETWORK);
    });

    it('detects timeout errors', () => {
      const result = parseError(new Error('request timed out'));
      expect(result.code).toBe(ErrorCode.TIMEOUT_ERROR);
      expect(result.category).toBe(ErrorCategory.TIMEOUT);
    });

    it('detects permission errors', () => {
      const result = parseError(new Error('permission denied'));
      expect(result.code).toBe(ErrorCode.PERMISSION_DENIED);
      expect(result.category).toBe(ErrorCategory.PERMISSION);
    });

    it('detects Firebase auth errors', () => {
      const result = parseError({ message: 'auth failed', code: 'auth/user-not-found' });
      expect(result.code).toBe(ErrorCode.FIREBASE_ERROR);
      expect(result.category).toBe(ErrorCategory.FIREBASE);
    });

    it('detects Firestore errors', () => {
      const result = parseError({ message: 'firestore error', code: 'firestore/permission-denied' });
      expect(result.code).toBe(ErrorCode.FIREBASE_ERROR);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('returns Korean user message for network error', () => {
      const msg = getUserFriendlyMessage(new Error('Network request failed'));
      expect(msg).toBe('네트워크 연결을 확인해주세요.');
    });

    it('returns default message for unknown error', () => {
      const msg = getUserFriendlyMessage(new Error('something odd'));
      expect(msg).toBe('오류가 발생했습니다. 다시 시도해주세요.');
    });
  });

  describe('type guard functions', () => {
    it('isNetworkError', () => {
      expect(isNetworkError(new Error('network failure'))).toBe(true);
      expect(isNetworkError(new Error('fetch failed'))).toBe(true);
      expect(isNetworkError(new Error('ok'))).toBe(false);
      expect(isNetworkError(null)).toBe(false);
    });

    it('isTimeoutError', () => {
      expect(isTimeoutError(new Error('timeout exceeded'))).toBe(true);
      expect(isTimeoutError(new Error('ok'))).toBe(false);
      expect(isTimeoutError(null)).toBe(false);
    });

    it('isPermissionError', () => {
      expect(isPermissionError(new Error('permission denied'))).toBe(true);
      expect(isPermissionError(new Error('ok'))).toBe(false);
      expect(isPermissionError(null)).toBe(false);
    });

    it('isFirebaseError', () => {
      expect(isFirebaseError({ code: 'auth/invalid-email', message: 'bad' })).toBe(true);
      expect(isFirebaseError({ code: 'firestore/not-found', message: 'bad' })).toBe(true);
      expect(isFirebaseError({ code: 'other', message: 'bad' })).toBe(false);
      expect(isFirebaseError(null)).toBe(false);
    });
  });

  describe('factory functions', () => {
    it('createNetworkError', () => {
      const err = createNetworkError();
      expect(err.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(err.category).toBe(ErrorCategory.NETWORK);
      expect(err.actionable).toBe(true);
    });

    it('createPermissionError', () => {
      const err = createPermissionError();
      expect(err.code).toBe(ErrorCode.PERMISSION_DENIED);
      expect(err.category).toBe(ErrorCategory.PERMISSION);
    });
  });

  describe('categorizeError / assessSeverity', () => {
    it('categorizeError returns correct category', () => {
      expect(categorizeError(new Error('Network request failed'))).toBe(ErrorCategory.NETWORK);
      expect(categorizeError(new Error('something'))).toBe(ErrorCategory.UNKNOWN);
    });

    it('assessSeverity returns correct severity', () => {
      expect(assessSeverity(new Error('Network request failed'))).toBe(ErrorSeverity.MEDIUM);
      expect(assessSeverity(new Error('permission denied'))).toBe(ErrorSeverity.HIGH);
    });
  });
});
