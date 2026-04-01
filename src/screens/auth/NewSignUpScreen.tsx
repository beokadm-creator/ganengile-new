import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type DimensionValue,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { Colors } from '../../theme';
import { auth, db } from '../../services/firebase';
import { handleGoogleSignIn } from '../../services/google-auth';
import { getKakaoLoginErrorMessage, signUpWithKakao } from '../../services/kakao-auth';
import { confirmPhoneOtp, requestPhoneOtp } from '../../services/otp-service';
import type { AuthNavigationProp } from '../../types/navigation';
import { UserRole } from '../../types/user';

type Props = {
  navigation: AuthNavigationProp;
};

type Step = 1 | 2 | 3;

type SignUpForm = {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
};

type TermsAgreement = {
  service: boolean;
  privacy: boolean;
  marketing: boolean;
};

function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '');
}

function formatPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function getFirebaseAuthCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }

  return undefined;
}

function getSignUpErrorMessage(error: unknown): string {
  switch (getFirebaseAuthCode(error)) {
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일입니다. 로그인으로 이동해 주세요.';
    case 'auth/invalid-email':
      return '이메일 형식을 확인해 주세요.';
    case 'auth/operation-not-allowed':
      return '이메일 가입이 현재 비활성화되어 있습니다.';
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 합니다.';
    default:
      return getErrorMessage(error, '회원가입에 실패했습니다.');
  }
}

export default function NewSignUpScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [form, setForm] = useState<SignUpForm>({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [termsAgreed, setTermsAgreed] = useState<TermsAgreement>({
    service: false,
    privacy: false,
    marketing: false,
  });
  const [otpSessionId, setOtpSessionId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpHintCode, setOtpHintCode] = useState<string | null>(null);
  const [otpDestination, setOtpDestination] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
  const [otpVerificationToken, setOtpVerificationToken] = useState<string | null>(null);
  const [otpVerifiedAt, setOtpVerifiedAt] = useState<string | null>(null);

  const progressWidth = useMemo<DimensionValue>(() => `${(step / 3) * 100}%`, [step]);

  function resetOtpState() {
    setOtpSessionId(null);
    setOtpCode('');
    setOtpHintCode(null);
    setOtpDestination('');
    setOtpExpiresAt(null);
    setOtpVerificationToken(null);
    setOtpVerifiedAt(null);
  }

  function updateForm(key: keyof SignUpForm, value: string) {
    setForm((current) => ({
      ...current,
      [key]: key === 'phoneNumber' ? formatPhoneDigits(value) : value,
    }));

    if (key === 'phoneNumber') {
      resetOtpState();
    }
  }

  function setAgreement(key: keyof TermsAgreement, value: boolean) {
    setTermsAgreed((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validateStep1(): boolean {
    if (!form.name.trim()) {
      Alert.alert('이름이 필요합니다', '이름을 입력해 주세요.');
      return false;
    }

    if (!form.email.trim()) {
      Alert.alert('이메일이 필요합니다', '이메일을 입력해 주세요.');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      Alert.alert('이메일 형식 확인', '올바른 이메일 형식으로 입력해 주세요.');
      return false;
    }

    if (!/^010\d{8}$/.test(normalizePhoneNumber(form.phoneNumber))) {
      Alert.alert('휴대폰 번호 확인', '010으로 시작하는 번호를 입력해 주세요.');
      return false;
    }

    if (!form.password || form.password.length < 6) {
      Alert.alert('비밀번호 확인', '비밀번호는 6자 이상이어야 합니다.');
      return false;
    }

    if (form.password !== form.confirmPassword) {
      Alert.alert('비밀번호 불일치', '비밀번호 확인이 일치하지 않습니다.');
      return false;
    }

    return true;
  }

  function validateStep2(): boolean {
    if (!/^010\d{8}$/.test(normalizePhoneNumber(form.phoneNumber))) {
      Alert.alert('휴대폰 번호 확인', '먼저 올바른 휴대폰 번호를 입력해 주세요.');
      return false;
    }

    if (!otpVerificationToken || !otpVerifiedAt) {
      Alert.alert('인증 필요', '휴대폰으로 받은 인증번호를 확인해 주세요.');
      return false;
    }

    return true;
  }

  function validateStep3(): boolean {
    if (!termsAgreed.service || !termsAgreed.privacy) {
      Alert.alert('필수 약관 동의 필요', '서비스 이용약관과 개인정보 처리방침에 동의해 주세요.');
      return false;
    }

    return true;
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;

    if (step < 3) {
      setStep((current) => (current + 1) as Step);
      return;
    }

    void handleEmailSignUp();
  }

  function handleBack() {
    if (step > 1) {
      setStep((current) => (current - 1) as Step);
      return;
    }

    navigation.goBack();
  }

  async function handleRequestOtpPress() {
    const phoneNumber = normalizePhoneNumber(form.phoneNumber);
    if (!/^010\d{8}$/.test(phoneNumber)) {
      Alert.alert('휴대폰 번호 확인', '010으로 시작하는 번호를 먼저 입력해 주세요.');
      return;
    }

    setOtpSending(true);
    try {
      const result = await requestPhoneOtp(phoneNumber);
      setOtpSessionId(result.sessionId);
      setOtpHintCode(result.testCode ?? null);
      setOtpDestination(result.maskedDestination);
      setOtpExpiresAt(result.expiresAt);
      setOtpCode('');
      setOtpVerificationToken(null);
      setOtpVerifiedAt(null);

      Alert.alert(
        '인증번호 전송 완료',
        result.testCode
          ? `테스트 코드 ${result.testCode}가 준비되었습니다.`
          : `${result.maskedDestination} 번호로 인증번호를 전송했습니다.`
      );
    } catch (error) {
      Alert.alert('인증번호 전송 실패', getErrorMessage(error, '인증번호를 전송하지 못했습니다.'));
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtpPress() {
    if (!otpSessionId) {
      Alert.alert('인증번호 요청 필요', '먼저 인증번호를 요청해 주세요.');
      return;
    }

    if (!/^\d{6}$/.test(otpCode.trim())) {
      Alert.alert('인증번호 확인', '6자리 인증번호를 입력해 주세요.');
      return;
    }

    setOtpVerifying(true);
    try {
      const result = await confirmPhoneOtp({
        sessionId: otpSessionId,
        phoneNumber: normalizePhoneNumber(form.phoneNumber),
        code: otpCode,
      });

      setOtpVerificationToken(result.verificationToken);
      setOtpVerifiedAt(result.verifiedAt);
      Alert.alert('휴대폰 인증 완료', '회원가입을 계속 진행할 수 있습니다.');
    } catch (error) {
      Alert.alert('인증 실패', getErrorMessage(error, '인증번호를 확인하지 못했습니다.'));
    } finally {
      setOtpVerifying(false);
    }
  }

  async function handleEmailSignUp() {
    if (!validateStep1() || !validateStep2() || !validateStep3()) {
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      await setDoc(
        doc(db, 'users', userCredential.user.uid),
        {
          uid: userCredential.user.uid,
          email: form.email.trim(),
          name: form.name.trim(),
          phoneNumber: normalizePhoneNumber(form.phoneNumber),
          role: UserRole.GLER,
          signupMethod: 'email',
          authProvider: 'email',
          hasCompletedOnboarding: false,
          isActive: true,
          phoneVerification: {
            verified: true,
            verificationToken: otpVerificationToken,
            verifiedAt: otpVerifiedAt,
            phoneNumber: normalizePhoneNumber(form.phoneNumber),
          },
          agreedTerms: {
            giller: false,
            gller: termsAgreed.service,
            privacy: termsAgreed.privacy,
            marketing: termsAgreed.marketing,
          },
          gillerApplicationStatus: 'none',
          isVerified: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      Alert.alert('가입이 완료되었습니다', '기본 가입이 완료되었습니다. 계속해서 온보딩을 진행해 주세요.');
    } catch (error) {
      Alert.alert('회원가입 실패', getSignUpErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignUpPress() {
    setLoading(true);
    try {
      await handleGoogleSignIn();
    } catch (error) {
      Alert.alert('Google 가입 실패', getErrorMessage(error, 'Google 가입에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleKakaoSignUpPress() {
    if (!form.name.trim()) {
      Alert.alert('이름이 필요합니다', '카카오 가입 전에 이름을 먼저 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      await signUpWithKakao({
        name: form.name.trim(),
        phoneNumber: normalizePhoneNumber(form.phoneNumber),
        role: UserRole.GLER,
      });
    } catch (error) {
      Alert.alert('카카오 가입 실패', getKakaoLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>회원가입</Text>
          <Text style={styles.subtitle}>
            필요한 정보부터 받고, 2단계에서 휴대폰 OTP 인증을 완료한 뒤 가입을 마무리합니다.
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
        </View>

        {step === 1 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>기본 정보</Text>
            <Field
              label="이름"
              value={form.name}
              onChangeText={(value) => updateForm('name', value)}
              placeholder="홍길동"
            />
            <Field
              label="이메일"
              value={form.email}
              onChangeText={(value) => updateForm('email', value)}
              placeholder="name@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Field
              label="휴대폰 번호"
              value={form.phoneNumber}
              onChangeText={(value) => updateForm('phoneNumber', value)}
              placeholder="010-1234-5678"
              keyboardType="number-pad"
            />
            <Field
              label="비밀번호"
              value={form.password}
              onChangeText={(value) => updateForm('password', value)}
              placeholder="6자 이상"
              secureTextEntry
            />
            <Field
              label="비밀번호 확인"
              value={form.confirmPassword}
              onChangeText={(value) => updateForm('confirmPassword', value)}
              placeholder="비밀번호 다시 입력"
              secureTextEntry
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>휴대폰 OTP 인증</Text>
            <Text style={styles.switchBody}>
              회원가입 전에 휴대폰 번호로 6자리 인증번호를 확인합니다.
            </Text>

            <View style={styles.otpRow}>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="6자리 인증번호"
                placeholderTextColor={Colors.textTertiary}
                value={otpCode}
                onChangeText={(value) => setOtpCode(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={styles.inlineActionButton}
                onPress={() => void handleRequestOtpPress()}
                disabled={otpSending}
              >
                {otpSending ? (
                  <ActivityIndicator color={Colors.surface} />
                ) : (
                  <Text style={styles.inlineActionButtonText}>
                    {otpSessionId ? '재전송' : '번호 전송'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => void handleVerifyOtpPress()}
              disabled={otpVerifying || !otpSessionId}
            >
              {otpVerifying ? (
                <ActivityIndicator color={Colors.textPrimary} />
              ) : (
                <Text style={styles.secondaryButtonText}>인증번호 확인</Text>
              )}
            </TouchableOpacity>

            {otpDestination ? <Text style={styles.helperText}>전송 대상: {otpDestination}</Text> : null}
            {otpExpiresAt ? (
              <Text style={styles.helperText}>
                만료 시각: {new Date(otpExpiresAt).toLocaleTimeString()}
              </Text>
            ) : null}
            {otpHintCode ? <Text style={styles.helperText}>테스트 코드: {otpHintCode}</Text> : null}
            {otpVerifiedAt ? <Text style={styles.successText}>휴대폰 인증이 완료되었습니다.</Text> : null}
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>약관 동의</Text>
            <AgreementRow
              title="서비스 이용약관"
              required
              value={termsAgreed.service}
              onValueChange={(value) => setAgreement('service', value)}
            />
            <AgreementRow
              title="개인정보 처리방침"
              required
              value={termsAgreed.privacy}
              onValueChange={(value) => setAgreement('privacy', value)}
            />
            <AgreementRow
              title="마케팅 정보 수신"
              value={termsAgreed.marketing}
              onValueChange={(value) => setAgreement('marketing', value)}
            />
          </View>
        ) : null}

        <View style={styles.socialCard}>
          <Text style={styles.sectionTitle}>간편 가입</Text>
          <TouchableOpacity
            style={styles.kakaoButton}
            onPress={() => void handleKakaoSignUpPress()}
            disabled={loading}
          >
            <Text style={styles.kakaoButtonText}>카카오로 가입</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => void handleGoogleSignUpPress()}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Google로 가입</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={loading}>
          <Text style={styles.backButtonText}>이전</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, loading && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.nextButtonText}>{step === 3 ? '가입 완료' : '다음'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...props} style={styles.input} placeholderTextColor={Colors.textTertiary} />
    </View>
  );
}

function AgreementRow({
  title,
  required = false,
  value,
  onValueChange,
}: {
  title: string;
  required?: boolean;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchCopy}>
        <Text style={styles.switchTitle}>{title}</Text>
        <Text style={styles.switchBody}>{required ? '필수' : '선택'}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.border, true: Colors.primaryMint }}
        thumbColor={value ? Colors.primary : Colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, gap: 16, paddingBottom: 120 },
  header: { gap: 10 },
  title: { color: Colors.textPrimary, fontSize: 30, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, lineHeight: 22 },
  progressTrack: { height: 8, backgroundColor: Colors.border, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 999 },
  card: { backgroundColor: Colors.surface, borderRadius: 20, padding: 20, gap: 14 },
  socialCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 20, gap: 12 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: Colors.textPrimary, fontWeight: '700' },
  input: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    color: Colors.textPrimary,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchCopy: { flex: 1, gap: 4 },
  switchTitle: { color: Colors.textPrimary, fontWeight: '700' },
  switchBody: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  otpRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  otpInput: { flex: 1 },
  inlineActionButton: {
    minHeight: 52,
    minWidth: 96,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  inlineActionButtonText: { color: Colors.surface, fontWeight: '800' },
  helperText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  successText: { color: Colors.primary, fontWeight: '700' },
  kakaoButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakaoButtonText: { color: Colors.textPrimary, fontWeight: '800', fontSize: 15 },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15 },
  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { color: Colors.textPrimary, fontWeight: '700' },
  nextButton: {
    flex: 1.4,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: { opacity: 0.7 },
  nextButtonText: { color: Colors.surface, fontWeight: '800', fontSize: 15 },
});
