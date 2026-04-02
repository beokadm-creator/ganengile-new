import { getFunctions, httpsCallable } from 'firebase/functions';

type OtpSessionFallback = {
  phoneNumber: string;
  code: string;
  expiresAt: string;
};

export interface RequestOtpResult {
  sessionId: string;
  expiresAt: string;
  resendAvailableAt: string;
  maskedDestination: string;
  testCode?: string;
}

export interface ConfirmOtpResult {
  verificationToken: string;
  verifiedAt: string;
}

const fallbackSessions = new Map<string, OtpSessionFallback>();
const isDevelopmentOtpFallbackEnabled = process.env.NODE_ENV !== 'production';

function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '');
}

function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length < 7) {
    return phoneNumber;
  }

  return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 4)}**-${phoneNumber.slice(-4)}`;
}

function createFallbackOtpCode(): string {
  return '123456';
}

export async function requestPhoneOtp(phoneNumber: string): Promise<RequestOtpResult> {
  const normalized = normalizePhoneNumber(phoneNumber);

  try {
    const functionsInstance = getFunctions();
    const requestOtp = httpsCallable<{ phoneNumber: string }, RequestOtpResult>(functionsInstance, 'requestPhoneOtp');
    const response = await requestOtp({ phoneNumber: normalized });
    return response.data;
  } catch (error) {
    console.warn('requestPhoneOtp fallback:', error);

    if (!isDevelopmentOtpFallbackEnabled) {
      throw new Error('휴대폰 인증 서비스를 지금 사용할 수 없습니다. 운영 환경에서는 개발용 OTP를 사용할 수 없습니다.');
    }

    const sessionId = `local-${Date.now()}`;
    const now = Date.now();
    const code = createFallbackOtpCode();
    const expiresAt = new Date(now + 1000 * 60 * 5).toISOString();
    const resendAvailableAt = new Date(now + 1000 * 30).toISOString();

    fallbackSessions.set(sessionId, {
      phoneNumber: normalized,
      code,
      expiresAt,
    });

    return {
      sessionId,
      expiresAt,
      resendAvailableAt,
      maskedDestination: maskPhoneNumber(normalized),
      testCode: code,
    };
  }
}

export async function confirmPhoneOtp(params: {
  sessionId: string;
  phoneNumber: string;
  code: string;
}): Promise<ConfirmOtpResult> {
  const payload = {
    sessionId: params.sessionId,
    phoneNumber: normalizePhoneNumber(params.phoneNumber),
    code: params.code.trim(),
  };

  try {
    const functionsInstance = getFunctions();
    const confirmOtp = httpsCallable<typeof payload, ConfirmOtpResult>(functionsInstance, 'confirmPhoneOtp');
    const response = await confirmOtp(payload);
    return response.data;
  } catch (error) {
    console.warn('confirmPhoneOtp fallback:', error);

    if (!isDevelopmentOtpFallbackEnabled) {
      throw new Error('휴대폰 인증 확인을 완료하지 못했습니다. 운영 환경에서는 개발용 OTP를 사용할 수 없습니다.');
    }

    const session = fallbackSessions.get(payload.sessionId);
    if (session?.phoneNumber !== payload.phoneNumber) {
      throw new Error('인증 세션을 찾지 못했습니다. 인증번호를 다시 요청해주세요.');
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      fallbackSessions.delete(payload.sessionId);
      throw new Error('인증번호가 만료되었습니다. 다시 요청해주세요.');
    }

    if (session.code !== payload.code) {
      throw new Error('인증번호가 올바르지 않습니다.');
    }

    fallbackSessions.delete(payload.sessionId);
    return {
      verificationToken: `local-verified-${Date.now()}`,
      verifiedAt: new Date().toISOString(),
    };
  }
}
