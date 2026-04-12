import { useState } from 'react';
import { Alert } from 'react-native';
import { useUser } from '../../../../contexts/UserContext';
import { requestPhoneOtp, confirmPhoneOtp } from '../../../../services/otp-service';
import { useCreateRequestStore } from '../store/useCreateRequestStore';
import { normalizePhoneNumber, formatPhoneDigits } from '../../../../utils/format';

export function usePhoneVerification() {
  const { user, refreshUser } = useUser();
  const {
    contactPhoneNumber,
    setContactPhoneNumber,
    verifiedPhoneOverride,
    setVerifiedPhoneOverride,
  } = useCreateRequestStore();

  const resetOtpState = () => {
    setContactOtpSessionId(null);
    setContactOtpCode('');
    setContactOtpHintCode(null);
    setContactOtpDestination('');
    setContactOtpExpiresAt(null);
  };

  const [contactOtpSessionId, setContactOtpSessionId] = useState<string | null>(null);
  const [contactOtpCode, setContactOtpCode] = useState('');
  const [contactOtpHintCode, setContactOtpHintCode] = useState<string | null>(null);
  const [contactOtpDestination, setContactOtpDestination] = useState('');
  const [contactOtpExpiresAt, setContactOtpExpiresAt] = useState<string | null>(null);
  const [contactOtpSending, setContactOtpSending] = useState(false);
  const [contactOtpVerifying, setContactOtpVerifying] = useState(false);

  const normalizedContactPhone = normalizePhoneNumber(contactPhoneNumber);
  const normalizedVerifiedPhone = normalizePhoneNumber(
    verifiedPhoneOverride ?? user?.phoneVerification?.phoneNumber ?? ''
  );

  const hasLockedVerifiedPhone =
    user?.phoneVerification?.verified === true && normalizedVerifiedPhone.length > 0;
  const isPhoneVerified =
    (verifiedPhoneOverride != null || user?.phoneVerification?.verified === true) &&
    normalizedVerifiedPhone.length > 0 &&
    normalizedVerifiedPhone === normalizedContactPhone;

  function handleContactPhoneChange(value: string) {
    if (hasLockedVerifiedPhone) return;
    const formatted = formatPhoneDigits(value);
    setContactPhoneNumber(formatted);
    if (normalizePhoneNumber(formatted) !== normalizedVerifiedPhone) {
      setVerifiedPhoneOverride(null);
      setContactOtpSessionId(null);
      setContactOtpCode('');
      setContactOtpHintCode(null);
      setContactOtpDestination('');
      setContactOtpExpiresAt(null);
    }
  }

  async function handleRequestContactOtp() {
    if (hasLockedVerifiedPhone && normalizedContactPhone === normalizedVerifiedPhone) {
      Alert.alert('이미 인증된 번호입니다', '이 번호는 다시 인증할 필요가 없습니다.');
      return;
    }

    const normalized = normalizedContactPhone;
    if (!/^010\d{8}$/.test(normalized)) {
      Alert.alert('휴대폰 번호', '010으로 시작하는 올바른 휴대폰 번호를 먼저 입력해 주세요.');
      return;
    }

    setContactOtpSending(true);
    try {
      const result = await requestPhoneOtp(normalized);
      if (result.alreadyVerified) {
        setVerifiedPhoneOverride(normalized);
        setContactOtpSessionId(null);
        setContactOtpCode('');
        setContactOtpHintCode(null);
        setContactOtpDestination(result.maskedDestination);
        setContactOtpExpiresAt(result.expiresAt);
        void refreshUser();
        Alert.alert('이미 인증된 번호입니다', '이 계정에서 이미 인증된 번호라 바로 사용할 수 있습니다.');
        return;
      }
      setContactOtpSessionId(result.sessionId);
      setContactOtpCode('');
      setContactOtpHintCode(result.testCode ?? null);
      setContactOtpDestination(result.maskedDestination);
      setContactOtpExpiresAt(result.expiresAt);
      Alert.alert(
        '인증번호를 보냈습니다',
        result.testCode ? `개발용 코드: ${result.testCode}` : `${result.maskedDestination} 번호로 전송했습니다.`
      );
    } catch (error) {
      Alert.alert('인증번호 전송 실패', error instanceof Error ? error.message : '인증번호를 보내지 못했습니다.');
    } finally {
      setContactOtpSending(false);
    }
  }

  async function handleVerifyContactOtp() {
    if (!user?.uid) {
      Alert.alert('로그인이 필요합니다', '다시 로그인한 뒤 휴대폰 인증을 진행해 주세요.');
      return;
    }

    if (!contactOtpSessionId) {
      Alert.alert('인증번호를 먼저 받아주세요', '휴대폰 인증 전 인증번호를 먼저 요청해 주세요.');
      return;
    }

    if (!/^\d{6}$/.test(contactOtpCode.trim())) {
      Alert.alert('인증번호', '인증번호 6자리를 입력해 주세요.');
      return;
    }

    setContactOtpVerifying(true);
    try {
      const normalized = normalizedContactPhone;
      await confirmPhoneOtp({
        sessionId: contactOtpSessionId,
        phoneNumber: normalized,
        code: contactOtpCode,
      });

      setVerifiedPhoneOverride(normalized);
      setContactOtpSessionId(null);
      setContactOtpCode('');
      setContactOtpHintCode(null);
      setContactOtpDestination('');
      setContactOtpExpiresAt(null);
      void refreshUser();
      Alert.alert('휴대폰 인증 완료', '이제 배송 요청을 계속 진행할 수 있습니다.');
    } catch (error) {
      Alert.alert('휴대폰 인증 실패', error instanceof Error ? error.message : '휴대폰 번호를 인증하지 못했습니다.');
    } finally {
      setContactOtpVerifying(false);
    }
  }

  return {
    contactOtpSessionId,
    contactOtpCode,
    setContactOtpCode,
    contactOtpHintCode,
    contactOtpDestination,
    contactOtpExpiresAt,
    contactOtpSending,
    contactOtpVerifying,
    hasLockedVerifiedPhone,
    isPhoneVerified,
    handleContactPhoneChange,
    handleRequestContactOtp,
    handleVerifyContactOtp,
    resetOtpState,
  };
}
