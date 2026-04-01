import { FirebaseError } from 'firebase/app';

export interface AuthErrorResult {
  success: boolean;
  message: string;
  code?: string;
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/user-not-found': '계정을 찾을 수 없습니다. 이메일을 다시 확인해 주세요.',
  'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
  'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
  'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
  'auth/user-disabled': '이 계정은 사용할 수 없습니다. 고객센터로 문의해 주세요.',
  'auth/invalid-credential': '로그인 정보가 올바르지 않습니다.',
  'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
  'auth/password-does-not-meet-requirements': '비밀번호 조건을 다시 확인해 주세요.',
  'auth/network-request-failed': '네트워크 연결을 확인해 주세요.',
  'auth/too-many-requests': '요청이 많습니다. 잠시 후 다시 시도해 주세요.',
  'auth/popup-closed-by-user': '로그인이 취소되었습니다.',
  'auth/operation-not-allowed': '현재 지원하지 않는 로그인 방식입니다.',
  'auth/timeout': '응답 시간이 초과되었습니다. 다시 시도해 주세요.',
  'auth/user-token-expired': '세션이 만료되었습니다. 다시 로그인해 주세요.',
  'auth/invalid-user-token': '로그인 상태를 다시 확인해 주세요.',
  'auth/session-expired': '세션이 만료되었습니다. 다시 로그인해 주세요.',
  'auth/account-exists-with-different-credential': '다른 로그인 방식으로 가입된 계정입니다.',
  'auth/credential-already-in-use': '이미 사용 중인 인증 정보입니다.',
  'auth/provider-already-linked': '이미 연결된 로그인 방식입니다.',
  'auth/invalid-verification-code': '인증 코드가 올바르지 않습니다.',
  'auth/invalid-verification-id': '인증 정보가 유효하지 않습니다.',
  'auth/invalid-phone-number': '전화번호 형식이 올바르지 않습니다.',
  'auth/missing-phone-number': '전화번호를 입력해 주세요.',
  'auth/quota-exceeded': '인증 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
  'auth/captcha-check-failed': '보안 확인에 실패했습니다. 다시 시도해 주세요.',
  'auth/unknown': '알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.',
};

export const getAuthErrorMessage = (error: FirebaseError): string => {
  const mappedMessage = AUTH_ERROR_MESSAGES[error.code];
  if (mappedMessage) {
    return mappedMessage;
  }

  if (error.message) {
    const normalizedMessage = error.message.replace(/^Firebase:\s*/u, '').replace(/\.$/u, '');
    return `${normalizedMessage}. 다시 시도해 주세요.`;
  }

  return AUTH_ERROR_MESSAGES['auth/unknown'];
};

export const formatAuthError = (error: unknown): AuthErrorResult => {
  if (error instanceof FirebaseError) {
    return {
      success: false,
      message: getAuthErrorMessage(error),
      code: error.code,
    };
  }

  if (typeof error === 'string') {
    return {
      success: false,
      message: error,
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      message: error.message,
    };
  }

  return {
    success: false,
    message: '알 수 없는 오류가 발생했습니다.',
  };
};

export const authSuccess = (message?: string): AuthErrorResult => ({
  success: true,
  message: message ?? '성공',
});
