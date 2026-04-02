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
import type { AuthNavigationProp } from '../../types/navigation';
import { UserRole } from '../../types/user';

type Props = {
  navigation: AuthNavigationProp;
};

type Step = 'name' | 'email' | 'password' | 'terms';

type SignUpForm = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type TermsAgreement = {
  service: boolean;
  privacy: boolean;
  marketing: boolean;
};

const STEP_ORDER: Step[] = ['name', 'email', 'password', 'terms'];

const STEP_COPY: Record<Step, { title: string; subtitle: string; cta: string }> = {
  name: {
    title: '이름만 먼저 알려주세요',
    subtitle: '처음 가입은 가볍게 끝내고, 실제 배송 요청 전에 필요한 인증만 이어서 받겠습니다.',
    cta: '다음',
  },
  email: {
    title: '로그인할 이메일을 입력해주세요',
    subtitle: '계정 확인용 메일을 보내드리고, 이후 로그인 계정으로 그대로 사용됩니다.',
    cta: '다음',
  },
  password: {
    title: '비밀번호를 설정해주세요',
    subtitle: '가입 자체는 여기서 마무리됩니다. 휴대폰 확인은 배송 요청 직전에만 진행됩니다.',
    cta: '다음',
  },
  terms: {
    title: '필수 동의만 마치면 끝입니다',
    subtitle: '지금은 최소 정보만 받고, 연락처와 인증은 실제 기능 사용 시점에 확인합니다.',
    cta: '가입 완료',
  },
};

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
  const [form, setForm] = useState<SignUpForm>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [termsAgreed, setTermsAgreed] = useState<TermsAgreement>({
    service: false,
    privacy: false,
    marketing: false,
  });

  const step = STEP_ORDER[stepIndex];
  const copy = STEP_COPY[step];
  const progressWidth = useMemo<DimensionValue>(
    () => `${((stepIndex + 1) / STEP_ORDER.length) * 100}%`,
    [stepIndex]
  );
  const footerPaddingBottom = Math.max(insets.bottom, 12);

  function updateForm(key: keyof SignUpForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setAgreement(key: keyof TermsAgreement, value: boolean) {
    setTermsAgreed((current) => ({ ...current, [key]: value }));
  }

  function validateCurrentStep() {
    if (step === 'name' && !form.name.trim()) {
      Alert.alert('이름이 필요합니다', '이름을 입력해주세요.');
      return false;
    }

    if (step === 'email') {
      if (!form.email.trim()) {
        Alert.alert('이메일이 필요합니다', '이메일을 입력해주세요.');
        return false;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        Alert.alert('이메일 형식 확인', '올바른 이메일 형식으로 입력해주세요.');
        return false;
      }
    }

    if (step === 'password') {
      if (!form.password || form.password.length < 6) {
        Alert.alert('비밀번호 확인', '비밀번호는 6자 이상이어야 합니다.');
        return false;
      }

      if (form.password !== form.confirmPassword) {
        Alert.alert('비밀번호 불일치', '비밀번호 확인 값이 일치하지 않습니다.');
        return false;
      }
    }

    if (step === 'terms' && (!termsAgreed.service || !termsAgreed.privacy)) {
      Alert.alert('필수 약관 동의 필요', '서비스 이용약관과 개인정보 처리방침에 동의해주세요.');
      return false;
    }

    return true;
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

  async function handleEmailSignUp() {
    if (!form.name.trim() || !form.email.trim() || !form.password || form.password !== form.confirmPassword) {
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
          role: UserRole.GLER,
          signupMethod: 'email',
          authProvider: 'email',
          hasCompletedOnboarding: false,
          isActive: true,
          phoneVerification: {
            verified: false,
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
        { merge: true }
      );

      Alert.alert(
        '가입이 완료되었습니다',
        '가입은 바로 완료됐습니다. 이메일 인증 메일을 보냈고, 배송 요청 전에 휴대폰 확인만 진행하면 됩니다.'
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

        <View style={styles.card}>{renderStepContent(step, form, termsAgreed, updateForm, setAgreement)}</View>

        <View style={styles.contextCard}>
          <Text style={styles.contextTitle}>인증 흐름 안내</Text>
          <Text style={styles.contextBody}>가입은 가볍게 끝내고, 배송 요청 전에 휴대폰 번호 확인을 진행합니다.</Text>
          <Text style={styles.contextBody}>길러 승급이나 정산 단계의 본인확인은 기존 PASS/카카오 본인확인 흐름을 그대로 사용합니다.</Text>
        </View>

        {step === 'name' ? (
          <View style={styles.socialCard}>
            <Text style={styles.sectionTitle}>간편 가입도 가능합니다</Text>
            <TouchableOpacity style={styles.kakaoButton} onPress={() => void handleKakaoSignUpPress()} disabled={loading}>
              <Text style={styles.kakaoButtonText}>카카오로 가입</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleGoogleSignUpPress()} disabled={loading}>
              <Text style={styles.secondaryButtonText}>Google로 가입</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={loading}>
          <Text style={styles.backButtonText}>{stepIndex === 0 ? '돌아가기' : '이전'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.nextButton, loading && styles.nextButtonDisabled]} onPress={handleNext} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.nextButtonText}>{copy.cta}</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function renderStepContent(
  step: Step,
  form: SignUpForm,
  termsAgreed: TermsAgreement,
  updateForm: (key: keyof SignUpForm, value: string) => void,
  setAgreement: (key: keyof TermsAgreement, value: boolean) => void
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
          <Text style={styles.helperText}>요청자 화면과 프로필에서 사용됩니다.</Text>
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
          <Text style={styles.helperText}>로그인 계정으로 사용되며, 가입 직후 인증 메일을 보냅니다.</Text>
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
          <Text style={styles.helperText}>배송 요청 전 연락처 확인은 따로 진행되니, 가입 단계에서는 여기까지만 받습니다.</Text>
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
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32, gap: 16 },
  header: { gap: 10 },
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
  title: { color: Colors.textPrimary, fontSize: 30, fontWeight: '800', lineHeight: 38 },
  subtitle: { color: Colors.textSecondary, fontSize: 15, lineHeight: 24 },
  progressTrack: { height: 8, backgroundColor: Colors.border, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 999 },
  progressCaption: { color: Colors.textTertiary, fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: Colors.surface, borderRadius: 24, padding: 22, gap: 14 },
  contextCard: { backgroundColor: Colors.primaryMint, borderRadius: 20, padding: 18, gap: 6 },
  contextTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  contextBody: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20 },
  socialCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 20, gap: 12 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: Colors.textPrimary, fontWeight: '700' },
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
  helperText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15 },
  kakaoButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakaoButtonText: { color: Colors.textPrimary, fontWeight: '800', fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  switchCopy: { flex: 1, gap: 6 },
  switchTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  switchTitle: { color: Colors.textPrimary, fontWeight: '700' },
  switchBody: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, fontSize: 11, fontWeight: '800' },
  badgeRequired: { backgroundColor: Colors.errorBackground, color: Colors.error },
  badgeOptional: { backgroundColor: Colors.gray100, color: Colors.textSecondary },
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
  backButtonText: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15 },
  nextButton: {
    flex: 1.35,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: { opacity: 0.7 },
  nextButtonText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
});
