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
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
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

type Step = 'name' | 'email' | 'phone' | 'password' | 'terms';

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

type PhoneVerificationState = {
  sessionId: string | null;
  code: string;
  hintCode: string | null;
  destination: string;
  expiresAt: string | null;
  verificationToken: string | null;
  verifiedAt: string | null;
};

const STEP_ORDER: Step[] = ['name', 'email', 'phone', 'password', 'terms'];

const STEP_COPY: Record<
  Step,
  {
    title: string;
    subtitle: string;
    cta: string;
  }
> = {
  name: {
    title: '이름을 알려주세요',
    subtitle: '처음에는 가장 쉬운 정보부터 받을게요. 가입 후 화면에서도 그대로 보여집니다.',
    cta: '다음',
  },
  email: {
    title: '이메일을 입력해주세요',
    subtitle: '로그인과 안내 메일에 사용됩니다. 가입 완료 후 인증 메일도 함께 보냅니다.',
    cta: '다음',
  },
  phone: {
    title: '휴대폰 번호를 확인할게요',
    subtitle: '이 단계는 본인 인증이 아니라 연락 가능한 번호 확인입니다. 신원 확인은 가입 후 별도로 진행됩니다.',
    cta: '번호 확인 완료',
  },
  password: {
    title: '비밀번호를 설정해주세요',
    subtitle: '이메일 로그인용 비밀번호입니다. 너무 복잡하게 느껴지지 않도록 여기서만 한 번 정리합니다.',
    cta: '다음',
  },
  terms: {
    title: '약관 동의를 마치면 끝입니다',
    subtitle: '필수 약관만 먼저 받고, 마케팅 수신은 선택으로 남겨둡니다.',
    cta: '가입 완료',
  },
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
      return '이미 가입된 이메일입니다. 로그인으로 이동해주세요.';
    case 'auth/invalid-email':
      return '이메일 형식을 다시 확인해주세요.';
    case 'auth/operation-not-allowed':
      return '이메일 가입이 현재 비활성화되어 있습니다.';
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 합니다.';
    default:
      return getErrorMessage(error, '회원가입에 실패했습니다.');
  }
}

export default function NewSignUpScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [stepIndex, setStepIndex] = useState(0);
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
  const [phoneVerification, setPhoneVerification] = useState<PhoneVerificationState>({
    sessionId: null,
    code: '',
    hintCode: null,
    destination: '',
    expiresAt: null,
    verificationToken: null,
    verifiedAt: null,
  });

  const step = STEP_ORDER[stepIndex];
  const progressWidth = useMemo<DimensionValue>(
    () => `${((stepIndex + 1) / STEP_ORDER.length) * 100}%`,
    [stepIndex],
  );
  const footerPaddingBottom = Math.max(insets.bottom, 12);

  function resetPhoneVerification() {
    setPhoneVerification({
      sessionId: null,
      code: '',
      hintCode: null,
      destination: '',
      expiresAt: null,
      verificationToken: null,
      verifiedAt: null,
    });
  }

  function updateForm(key: keyof SignUpForm, value: string) {
    setForm((current) => ({
      ...current,
      [key]: key === 'phoneNumber' ? formatPhoneDigits(value) : value,
    }));

    if (key === 'phoneNumber') {
      resetPhoneVerification();
    }
  }

  function setAgreement(key: keyof TermsAgreement, value: boolean) {
    setTermsAgreed((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validateNameStep(): boolean {
    if (!form.name.trim()) {
      Alert.alert('이름이 필요합니다', '이름을 입력해주세요.');
      return false;
    }

    return true;
  }

  function validateEmailStep(): boolean {
    if (!form.email.trim()) {
      Alert.alert('이메일이 필요합니다', '이메일을 입력해주세요.');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      Alert.alert('이메일 형식 확인', '올바른 이메일 형식으로 입력해주세요.');
      return false;
    }

    return true;
  }

  function validatePhoneStep(): boolean {
    if (!/^010\d{8}$/.test(normalizePhoneNumber(form.phoneNumber))) {
      Alert.alert('휴대폰 번호 확인', '010으로 시작하는 번호를 입력해주세요.');
      return false;
    }

    if (!phoneVerification.verificationToken || !phoneVerification.verifiedAt) {
      Alert.alert('번호 확인 필요', '문자로 받은 인증번호를 먼저 확인해주세요.');
      return false;
    }

    return true;
  }

  function validatePasswordStep(): boolean {
    if (!form.password || form.password.length < 6) {
      Alert.alert('비밀번호 확인', '비밀번호는 6자 이상이어야 합니다.');
      return false;
    }

    if (form.password !== form.confirmPassword) {
      Alert.alert('비밀번호 불일치', '비밀번호 확인 값이 일치하지 않습니다.');
      return false;
    }

    return true;
  }

  function validateTermsStep(): boolean {
    if (!termsAgreed.service || !termsAgreed.privacy) {
      Alert.alert('필수 약관 동의 필요', '서비스 이용약관과 개인정보 처리방침에 동의해주세요.');
      return false;
    }

    return true;
  }

  function validateCurrentStep(): boolean {
    switch (step) {
      case 'name':
        return validateNameStep();
      case 'email':
        return validateEmailStep();
      case 'phone':
        return validatePhoneStep();
      case 'password':
        return validatePasswordStep();
      case 'terms':
        return validateTermsStep();
      default:
        return false;
    }
  }

  function handleNext() {
    if (!validateCurrentStep()) {
      return;
    }

    if (stepIndex < STEP_ORDER.length - 1) {
      setStepIndex((current) => current + 1);
      return;
    }

    void handleEmailSignUp();
  }

  function handleBack() {
    if (stepIndex > 0) {
      setStepIndex((current) => current - 1);
      return;
    }

    navigation.goBack();
  }

  async function handleRequestOtpPress() {
    const phoneNumber = normalizePhoneNumber(form.phoneNumber);

    if (!/^010\d{8}$/.test(phoneNumber)) {
      Alert.alert('휴대폰 번호 확인', '010으로 시작하는 번호를 먼저 입력해주세요.');
      return;
    }

    setOtpSending(true);
    try {
      const result = await requestPhoneOtp(phoneNumber);
      setPhoneVerification({
        sessionId: result.sessionId,
        code: '',
        hintCode: result.testCode ?? null,
        destination: result.maskedDestination,
        expiresAt: result.expiresAt,
        verificationToken: null,
        verifiedAt: null,
      });

      Alert.alert(
        '인증번호 전송 완료',
        result.testCode
          ? `개발용 테스트 코드 ${result.testCode}가 준비되었습니다.`
          : `${result.maskedDestination} 번호로 인증번호를 전송했습니다.`,
      );
    } catch (error) {
      Alert.alert('인증번호 전송 실패', getErrorMessage(error, '인증번호를 전송하지 못했습니다.'));
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtpPress() {
    if (!phoneVerification.sessionId) {
      Alert.alert('인증번호 요청 필요', '먼저 인증번호를 요청해주세요.');
      return;
    }

    if (!/^\d{6}$/.test(phoneVerification.code.trim())) {
      Alert.alert('인증번호 확인', '6자리 인증번호를 입력해주세요.');
      return;
    }

    setOtpVerifying(true);
    try {
      const result = await confirmPhoneOtp({
        sessionId: phoneVerification.sessionId,
        phoneNumber: normalizePhoneNumber(form.phoneNumber),
        code: phoneVerification.code,
      });

      setPhoneVerification((current) => ({
        ...current,
        verificationToken: result.verificationToken,
        verifiedAt: result.verifiedAt,
      }));
      Alert.alert('휴대폰 번호 확인 완료', '이제 다음 단계로 진행할 수 있습니다.');
    } catch (error) {
      Alert.alert('인증 실패', getErrorMessage(error, '인증번호를 확인하지 못했습니다.'));
    } finally {
      setOtpVerifying(false);
    }
  }

  async function handleEmailSignUp() {
    if (
      !validateNameStep() ||
      !validateEmailStep() ||
      !validatePhoneStep() ||
      !validatePasswordStep() ||
      !validateTermsStep()
    ) {
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      await sendEmailVerification(userCredential.user);

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
            verificationToken: phoneVerification.verificationToken,
            verifiedAt: phoneVerification.verifiedAt,
            phoneNumber: normalizePhoneNumber(form.phoneNumber),
          },
          emailVerification: {
            verified: false,
            sentAt: new Date().toISOString(),
            email: form.email.trim(),
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
        { merge: true },
      );

      Alert.alert(
        '가입이 완료되었습니다',
        '이메일 인증 메일을 보냈습니다. 메일 확인 후 로그인하면 온보딩과 본인 확인을 이어서 진행할 수 있습니다.',
      );
      navigation.navigate('Login');
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
      Alert.alert('이름이 필요합니다', '간편 가입 전 이름을 먼저 입력해주세요.');
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

  const copy = STEP_COPY[step];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>간편 가입</Text>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.progressCaption}>
            {stepIndex + 1} / {STEP_ORDER.length}
          </Text>
        </View>

        <View style={styles.card}>{renderStepContent(step, form, phoneVerification, termsAgreed, updateForm, setAgreement, setPhoneVerification, otpSending, otpVerifying, handleRequestOtpPress, handleVerifyOtpPress)}</View>

        <View style={styles.contextCard}>
          <Text style={styles.contextTitle}>가입 구조 안내</Text>
          <Text style={styles.contextBody}>휴대폰 인증은 연락 가능한 번호를 확인하는 단계입니다.</Text>
          <Text style={styles.contextBody}>실제 본인 확인은 가입 후 별도의 PASS/카카오 본인확인 화면에서 진행됩니다.</Text>
        </View>

        {step === 'name' ? (
          <View style={styles.socialCard}>
            <Text style={styles.sectionTitle}>간편 가입도 가능합니다</Text>
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
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={loading}>
          <Text style={styles.backButtonText}>{stepIndex === 0 ? '돌아가기' : '이전'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, loading && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.nextButtonText}>{copy.cta}</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function renderStepContent(
  step: Step,
  form: SignUpForm,
  phoneVerification: PhoneVerificationState,
  termsAgreed: TermsAgreement,
  updateForm: (key: keyof SignUpForm, value: string) => void,
  setAgreement: (key: keyof TermsAgreement, value: boolean) => void,
  setPhoneVerification: React.Dispatch<React.SetStateAction<PhoneVerificationState>>,
  otpSending: boolean,
  otpVerifying: boolean,
  handleRequestOtpPress: () => Promise<void>,
  handleVerifyOtpPress: () => Promise<void>,
) {
  switch (step) {
    case 'name':
      return (
        <>
          <Field
            label="이름"
            value={form.name}
            onChangeText={(value) => updateForm('name', value)}
            placeholder="실명 또는 닉네임"
            autoCapitalize="words"
            autoFocus
          />
          <Text style={styles.helperText}>길러 신청과 사용자 프로필에서 사용됩니다.</Text>
        </>
      );
    case 'email':
      return (
        <>
          <Field
            label="이메일"
            value={form.email}
            onChangeText={(value) => updateForm('email', value)}
            placeholder="name@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoFocus
          />
          <Text style={styles.helperText}>로그인 계정으로 사용되며 가입 후 인증 메일을 발송합니다.</Text>
        </>
      );
    case 'phone':
      return (
        <>
          <Field
            label="휴대폰 번호"
            value={form.phoneNumber}
            onChangeText={(value) => updateForm('phoneNumber', value)}
            placeholder="010-1234-5678"
            keyboardType="number-pad"
            autoFocus
          />
          <View style={styles.otpRow}>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="문자로 받은 6자리 숫자"
              placeholderTextColor={Colors.textTertiary}
              value={phoneVerification.code}
              onChangeText={(value) =>
                setPhoneVerification((current) => ({
                  ...current,
                  code: value.replace(/\D/g, '').slice(0, 6),
                }))
              }
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
                  {phoneVerification.sessionId ? '재전송' : '번호 전송'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => void handleVerifyOtpPress()}
            disabled={otpVerifying || !phoneVerification.sessionId}
          >
            {otpVerifying ? (
              <ActivityIndicator color={Colors.textPrimary} />
            ) : (
              <Text style={styles.secondaryButtonText}>휴대폰 번호 확인</Text>
            )}
          </TouchableOpacity>
          {phoneVerification.destination ? (
            <Text style={styles.helperText}>전송 대상: {phoneVerification.destination}</Text>
          ) : null}
          {phoneVerification.expiresAt ? (
            <Text style={styles.helperText}>
              만료 시각: {new Date(phoneVerification.expiresAt).toLocaleTimeString()}
            </Text>
          ) : null}
          {phoneVerification.hintCode ? (
            <Text style={styles.helperText}>개발 테스트 코드: {phoneVerification.hintCode}</Text>
          ) : null}
          {phoneVerification.verifiedAt ? (
            <Text style={styles.successText}>번호 확인이 완료되었습니다.</Text>
          ) : null}
        </>
      );
    case 'password':
      return (
        <>
          <Field
            label="비밀번호"
            value={form.password}
            onChangeText={(value) => updateForm('password', value)}
            placeholder="6자 이상 입력"
            secureTextEntry
            autoFocus
          />
          <Field
            label="비밀번호 확인"
            value={form.confirmPassword}
            onChangeText={(value) => updateForm('confirmPassword', value)}
            placeholder="같은 비밀번호를 다시 입력"
            secureTextEntry
          />
          <Text style={styles.helperText}>문자와 숫자를 섞어두면 더 안전합니다.</Text>
        </>
      );
    case 'terms':
      return (
        <>
          <AgreementRow
            title="서비스 이용약관"
            description="서비스 이용에 필요한 기본 약관입니다."
            required
            value={termsAgreed.service}
            onValueChange={(value) => setAgreement('service', value)}
          />
          <AgreementRow
            title="개인정보 처리방침"
            description="주문, 정산, 본인 확인에 필요한 개인정보 처리 안내입니다."
            required
            value={termsAgreed.privacy}
            onValueChange={(value) => setAgreement('privacy', value)}
          />
          <AgreementRow
            title="마케팅 정보 수신"
            description="이벤트와 혜택 소식을 받습니다."
            value={termsAgreed.marketing}
            onValueChange={(value) => setAgreement('marketing', value)}
          />
        </>
      );
    default:
      return null;
  }
}

function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...props} style={[styles.input, style]} placeholderTextColor={Colors.textTertiary} />
    </View>
  );
}

function AgreementRow({
  title,
  description,
  required = false,
  value,
  onValueChange,
}: {
  title: string;
  description: string;
  required?: boolean;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchCopy}>
        <View style={styles.switchTitleRow}>
          <Text style={styles.switchTitle}>{title}</Text>
          <Text style={[styles.badge, required ? styles.badgeRequired : styles.badgeOptional]}>
            {required ? '필수' : '선택'}
          </Text>
        </View>
        <Text style={styles.switchBody}>{description}</Text>
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    gap: 10,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.primaryMint,
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 12,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 38,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 999,
  },
  progressCaption: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 22,
    gap: 14,
  },
  contextCard: {
    backgroundColor: Colors.primaryMint,
    borderRadius: 20,
    padding: 18,
    gap: 6,
  },
  contextTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  contextBody: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  socialCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  input: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  helperText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  successText: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  otpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  otpInput: {
    flex: 1,
  },
  inlineActionButton: {
    minHeight: 54,
    minWidth: 104,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  inlineActionButtonText: {
    color: Colors.surface,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  kakaoButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakaoButtonText: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  switchCopy: {
    flex: 1,
    gap: 6,
  },
  switchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  switchTitle: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  switchBody: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
  },
  badgeRequired: {
    backgroundColor: Colors.errorLight,
    color: Colors.error,
  },
  badgeOptional: {
    backgroundColor: Colors.gray100,
    color: Colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  backButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  backButtonText: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  nextButton: {
    flex: 1.35,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.7,
  },
  nextButtonText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
});
