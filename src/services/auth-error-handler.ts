/**
 * Firebase Auth Error Handler
 * Firebase 에러 코드를 한글 메시지로 변환
 */

import { FirebaseError } from 'firebase/app';

export interface AuthErrorResult {
  success: boolean;
  message: string;
  code?: string;
}

export const getAuthErrorMessage = (error: FirebaseError): string => {
  const errorMessages: Record<string, string> = {
    // Authentication errors
    'auth/user-not-found': '존재하지 않는 계정입니다. 이메일을 확인해주세요.',
    'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
    'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
    'auth/invalid-email': '올바른 이메일 형식이 아닙니다.',
    'auth/user-disabled': '사용이 정지된 계정입니다. 고객센터에 문의해주세요.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',

    // Password errors
    'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
    'auth/password-does-not-meet-requirements': '비밀번호가 요구 사항을 충족하지 않습니다.',

    // Network errors
    'auth/network-request-failed': '네트워크 연결을 확인해주세요.',
    'auth/too-many-requests': '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.',

    // Operation errors
    'auth/popup-closed-by-user': '로그인이 취소되었습니다.',
    'auth/operation-not-allowed': '이 작업은 현재 지원되지 않습니다.',
    'auth/timeout': '요청 시간이 초과되었습니다. 다시 시도해주세요.',

    // Session errors
    'auth/user-token-expired': '세션이 만료되었습니다. 다시 로그인해주세요.',
    'auth/invalid-user-token': '유효하지 않은 세션입니다. 다시 로그인해주세요.',
    'auth/session-expired': '세션이 만료되었습니다. 다시 로그인해주세요.',

    // Account errors
    'auth/account-exists-with-different-credential': '이미 다른 방법으로 가입된 계정입니다.',
    'auth/credential-already-in-use': '이미 사용 중인 인증 정보입니다.',
    'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
    'auth/provider-already-linked': '이미 연결된 프로바이더입니다.',
    'auth/invalid-verification-code': '잘못된 인증 코드입니다.',
    'auth/invalid-verification-id': '유효하지 않은 인증 ID입니다.',

    // Phone auth errors
    'auth/invalid-phone-number': '올바른 전화번호 형식이 아닙니다.',
    'auth/missing-phone-number': '전화번호를 입력해주세요.',
    'auth/quota-exceeded': 'SMS 전송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
    'auth/captcha-check-failed': '캡차 인증에 실패했습니다.',

    // Default error
    'auth/unknown': '알 수 없는 오류가 발생했습니다. 다시 시도해주세요.'
  };

  // 에러 코드에 해당하는 메시지 반환
  const message = errorMessages[error.code];

  if (message) {
    return message;
  }

  // 에러 코드가 없으면 기본 메시지 반환
  if (error.message) {
    // Firebase 기본 에러 메시지도 한글화 시도
    const defaultMessage = error.message.replace(/Firebase: /g, '').replace(/\.$/, '');
    return `${defaultMessage}. 다시 시도해주세요.`;
  }

  return '알 수 없는 오류가 발생했습니다. 다시 시도해주세요.';
};

/**
 * 인증 에러를 포맷팅하여 반환
 */
export const formatAuthError = (error: unknown): AuthErrorResult => {
  // Firebase 에러인 경우
  if (error instanceof FirebaseError) {
    return {
      success: false,
      message: getAuthErrorMessage(error),
      code: error.code
    };
  }

  // 문자열 에러인 경우
  if (typeof error === 'string') {
    return {
      success: false,
      message: error
    };
  }

  // 그 외 에러
  if (error instanceof Error) {
    return {
      success: false,
      message: error.message
    };
  }

  return {
    success: false,
    message: '알 수 없는 오류가 발생했습니다.'
  };
};

/**
 * 인증 성공 결과 반환
 */
export const authSuccess = (message?: string): AuthErrorResult => ({
  success: true,
  message: message || '성공'
});
