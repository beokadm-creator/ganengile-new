/**
 * Error Handler Utility
 * Centralized error handling for user-friendly error messages
 */

import { Alert, Platform } from 'react-native';
import * as Linking from 'expo-linking';

function isError(value: unknown): value is Error {
  return value instanceof Error;
}

function isErrorLike(value: unknown): value is { message?: string; code?: string; stack?: string } {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (isErrorLike(error) && error.message) {
    return error.message;
  }
  return String(error);
}

function getErrorCode(error: unknown): string | undefined {
  if (isErrorLike(error) && error.code) {
    return String(error.code);
  }
  return undefined;
}

function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) {
    return error.stack;
  }
  if (isErrorLike(error) && error.stack) {
    return String(error.stack);
  }
  return undefined;
}

export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  FIREBASE_ERROR = 'FIREBASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export enum ErrorCategory {
  NETWORK = 'NETWORK',
  PERMISSION = 'PERMISSION',
  VALIDATION = 'VALIDATION',
  FIREBASE = 'FIREBASE',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface AppError {
  code: ErrorCode;
  message: string;
  userMessage: string;
  actionable?: boolean;
  action?: () => void;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
}

/**
 * Get user-friendly message from error
 */
export function getUserFriendlyMessage(error: unknown): string {
  const parsedError = parseError(error);
  return parsedError.userMessage;
}

/**
 * Create a network error
 */
export function createNetworkError(message: string = 'Network error occurred'): AppError {
  return {
    code: ErrorCode.NETWORK_ERROR,
    message,
    userMessage: '네트워크 연결을 확인해주세요.',
    actionable: true,
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.MEDIUM,
  };
}

/**
 * Create a permission error
 */
export function createPermissionError(message: string = 'Permission denied'): AppError {
  return {
    code: ErrorCode.PERMISSION_DENIED,
    message,
    userMessage: '필요한 권한이 거부되었습니다.',
    actionable: true,
    action: () => openAppSettings(),
    category: ErrorCategory.PERMISSION,
    severity: ErrorSeverity.HIGH,
  };
}

/**
 * Parse error and convert to user-friendly message
 */
export function parseError(error: unknown): AppError {
  const errorMessage = getErrorMessage(error);
  const errorCode = getErrorCode(error);

  // Network errors
  if (errorMessage.includes('Network request failed')) {
    return {
      code: ErrorCode.NETWORK_ERROR,
      message: errorMessage,
      userMessage: '네트워크 연결을 확인해주세요.',
      actionable: true,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
    };
  }

  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return {
      code: ErrorCode.TIMEOUT_ERROR,
      message: errorMessage,
      userMessage: '요청 시간이 초과되었습니다. 다시 시도해주세요.',
      actionable: true,
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
    };
  }

  // Firebase errors
  if (errorCode?.startsWith('auth/')) {
    return {
      code: ErrorCode.FIREBASE_ERROR,
      message: errorMessage,
      userMessage: getFirebaseAuthErrorMessage(errorCode),
      category: ErrorCategory.FIREBASE,
      severity: ErrorSeverity.HIGH,
    };
  }

  if (errorCode?.startsWith('firestore/')) {
    return {
      code: ErrorCode.FIREBASE_ERROR,
      message: errorMessage,
      userMessage: '데이터 저장에 실패했습니다. 다시 시도해주세요.',
      actionable: true,
      category: ErrorCategory.FIREBASE,
      severity: ErrorSeverity.MEDIUM,
    };
  }

  // Permission errors
  if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
    return {
      code: ErrorCode.PERMISSION_DENIED,
      message: errorMessage,
      userMessage: '필요한 권한이 거부되었습니다.',
      actionable: true,
      action: () => openAppSettings(),
      category: ErrorCategory.PERMISSION,
      severity: ErrorSeverity.HIGH,
    };
  }

  // Default error
  return {
    code: ErrorCode.UNKNOWN_ERROR,
    message: errorMessage,
    userMessage: '오류가 발생했습니다. 다시 시도해주세요.',
    actionable: true,
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
  };
}

/**
 * Get user-friendly message for Firebase Auth errors
 */
function getFirebaseAuthErrorMessage(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
      return '사용자를 찾을 수 없습니다.';
    case 'auth/wrong-password':
      return '비밀번호가 올바르지 않습니다.';
    case 'auth/email-already-in-use':
      return '이미 사용 중인 이메일입니다.';
    case 'auth/invalid-email':
      return '올바르지 않은 이메일 형식입니다.';
    case 'auth/weak-password':
      return '비밀번호가 너무 약합니다. (최소 6자)';
    case 'auth/network-request-failed':
      return '네트워크 연결을 확인해주세요.';
    case 'auth/too-many-requests':
      return '너무 많은 요청을 보냈습니다. 나중에 다시 시도해주세요.';
    default:
      return '인증 오류가 발생했습니다.';
  }
}

/**
 * Show error alert with user-friendly message
 */
export function showErrorAlert(error: unknown, title: string = '오류', onRetry?: () => void): void {
  const parsedError = parseError(error);

  if (parsedError.actionable ?? onRetry) {
    Alert.alert(
      title,
      parsedError.userMessage,
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '다시 시도',
          onPress: onRetry ?? parsedError.action ?? undefined,
        },
      ]
    );
  } else {
    Alert.alert(title, parsedError.userMessage);
  }
}

/**
 * Show error alert with custom actions
 */
export function showErrorAlertWithActions(
  error: unknown,
  title: string,
  actions: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
): void {
  const parsedError = parseError(error);

  Alert.alert(
    title,
    parsedError.userMessage,
    actions,
    { cancelable: true }
  );
}

/**
 * Open app settings
 */
export function openAppSettings(): void {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else {
    Linking.openSettings();
  }
}

/**
 * Show permission denied alert with settings option
 */
export function showPermissionDeniedAlert(permission: string): void {
  Alert.alert(
    '권한 필요',
    `${permission} 권한이 필요합니다. 설정에서 권한을 허용해주세요.`,
    [
      {
        text: '취소',
        style: 'cancel',
      },
      {
        text: '설정으로 이동',
        onPress: openAppSettings,
      },
    ]
  );
}

/**
 * Log error for debugging
 */
export function logError(error: unknown, context?: string): void {
  const parsedError = parseError(error);

  console.group('❌ Error');
  console.error('Context:', context);
  console.error('Code:', parsedError.code);
  console.error('Message:', parsedError.message);
  console.error('User Message:', parsedError.userMessage);
  console.error('Stack:', getErrorStack(error));
  console.groupEnd();
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: {
    showError?: boolean;
    errorTitle?: string;
    context?: string;
  }
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error, options?.context);

      if (options?.showError !== false) {
        showErrorAlert(error, options?.errorTitle);
      }

      throw error;
    }
  }) as T;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;

  const errorMessage = getErrorMessage(error).toLowerCase();
  const errorCode = getErrorCode(error)?.toLowerCase() ?? '';

  return (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('request failed') ||
    errorCode.includes('network') ||
    errorCode.includes('offline')
  );
}

/**
 * Check if error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  if (!error) return false;

  const errorMessage = getErrorMessage(error).toLowerCase();
  const errorCode = getErrorCode(error)?.toLowerCase() ?? '';

  return (
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out') ||
    errorCode.includes('timeout') ||
    errorCode.includes('deadline-exceeded')
  );
}

/**
 * Check if error is a permission error
 */
export function isPermissionError(error: unknown): boolean {
  if (!error) return false;

  const errorMessage = getErrorMessage(error).toLowerCase();
  const errorCode = getErrorCode(error)?.toLowerCase() ?? '';

  return (
    errorMessage.includes('permission') ||
    errorCode.includes('permission') ||
    (errorCode.includes('auth/') && errorMessage.includes('denied'))
  );
}

/**
 * Check if error is a Firebase error
 */
export function isFirebaseError(error: unknown): boolean {
  if (!error) return false;

  const errorCode = getErrorCode(error)?.toLowerCase() ?? '';

  return (
    errorCode.startsWith('auth/') ||
    errorCode.startsWith('firestore/') ||
    errorCode.startsWith('firebase/')
  );
}

/**
 * Categorize error
 */
export function categorizeError(error: unknown): ErrorCategory {
  const parsed = parseError(error);
  return parsed.category ?? ErrorCategory.UNKNOWN;
}

/**
 * Assess error severity
 */
export function assessSeverity(error: unknown): ErrorSeverity {
  const parsed = parseError(error);
  return parsed.severity ?? ErrorSeverity.MEDIUM;
}
