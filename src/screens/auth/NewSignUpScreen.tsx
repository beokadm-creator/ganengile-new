import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  type DimensionValue,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { handleGoogleSignIn } from '../../services/google-auth';
import { getKakaoLoginErrorMessage, signUpWithKakao } from '../../services/kakao-auth';
import { UserRole } from '../../types/user';
import type { AuthNavigationProp } from '../../types/navigation';

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
      return '비밀번호는 6자 이상으로 입력해 주세요.';
    default:
      return getErrorMessage(error, '회원가입에 실패했습니다.');
  }
}

export default function NewSignUpScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [testMode, setTestMode] = useState(true);
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

  const progressWidth = useMemo<DimensionValue>(() => `${(step / 3) * 100}%`, [step]);

  function updateForm(key: keyof SignUpForm, value: string) {
    setForm((current) => ({
      ...current,
      [key]: key === 'phoneNumber' ? formatPhoneDigits(value) : value,
    }));
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
      Alert.alert('이메일 형식을 확인해 주세요', '올바른 이메일 형식으로 입력해 주세요.');
      return false;
    }
    if (!/^010\d{8}$/.test(normalizePhoneNumber(form.phoneNumber))) {
      Alert.alert('휴대폰 번호를 확인해 주세요', '010으로 시작하는 번호를 입력해 주세요.');
      return false;
    }
    if (!form.password || form.password.length < 6) {
      Alert.alert('비밀번호를 확인해 주세요', '비밀번호는 6자 이상이어야 합니다.');
      return false;
    }
    if (form.password !== form.confirmPassword) {
      Alert.alert('비밀번호가 다릅니다', '비밀번호 확인이 일치하지 않습니다.');
      return false;
    }
    return true;
  }

  function validateStep2(): boolean {
    if (testMode) {
      return true;
    }
    Alert.alert('본인확인 연결 준비 중', '현재는 테스트 모드로 가입을 이어갈 수 있습니다.');
    return false;
  }

  function validateStep3(): boolean {
    if (!termsAgreed.service || !termsAgreed.privacy) {
      Alert.alert('필수 약관 동의가 필요합니다', '서비스 이용약관과 개인정보 처리방침에 동의해 주세요.');
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
          role: UserRole.BOTH,
          signupMethod: 'email',
          authProvider: 'email',
          hasCompletedOnboarding: false,
          isActive: true,
          agreedTerms: {
            giller: false,
            gller: false,
            privacy: termsAgreed.privacy,
            marketing: termsAgreed.marketing,
          },
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
        role: UserRole.BOTH,
      });
    } catch (error) {
      Alert.alert('카카오 가입 실패', getKakaoLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>회원가입</Text>
          <Text style={styles.subtitle}>필요한 정보만 먼저 받고, 나머지는 앱 안에서 이어집니다.</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
        </View>

        {step === 1 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>기본 정보</Text>
            <Field label="이름" value={form.name} onChangeText={(value) => updateForm('name', value)} placeholder="홍길동" />
            <Field label="이메일" value={form.email} onChangeText={(value) => updateForm('email', value)} placeholder="name@example.com" autoCapitalize="none" keyboardType="email-address" />
            <Field label="휴대폰 번호" value={form.phoneNumber} onChangeText={(value) => updateForm('phoneNumber', value)} placeholder="010-1234-5678" keyboardType="number-pad" />
            <Field label="비밀번호" value={form.password} onChangeText={(value) => updateForm('password', value)} placeholder="6자 이상" secureTextEntry />
            <Field label="비밀번호 확인" value={form.confirmPassword} onChangeText={(value) => updateForm('confirmPassword', value)} placeholder="비밀번호 다시 입력" secureTextEntry />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>본인확인 준비</Text>
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.switchTitle}>테스트 모드</Text>
                <Text style={styles.switchBody}>지금은 테스트 모드로 이어가고, 실서비스 전에는 인증 설정만 바꾸면 됩니다.</Text>
              </View>
              <Switch value={testMode} onValueChange={setTestMode} trackColor={{ false: '#CBD5E1', true: '#99F6E4' }} thumbColor={testMode ? '#0F766E' : '#FFFFFF'} />
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>약관 동의</Text>
            <AgreementRow title="서비스 이용약관" required value={termsAgreed.service} onValueChange={(value) => setAgreement('service', value)} />
            <AgreementRow title="개인정보 처리방침" required value={termsAgreed.privacy} onValueChange={(value) => setAgreement('privacy', value)} />
            <AgreementRow title="마케팅 정보 수신" value={termsAgreed.marketing} onValueChange={(value) => setAgreement('marketing', value)} />
          </View>
        ) : null}

        <View style={styles.socialCard}>
          <Text style={styles.sectionTitle}>간편 가입</Text>
          <TouchableOpacity style={styles.kakaoButton} onPress={() => void handleKakaoSignUpPress()} disabled={loading}>
            <Text style={styles.kakaoButtonText}>카카오로 가입</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleGoogleSignUpPress()} disabled={loading}>
            <Text style={styles.secondaryButtonText}>Google로 가입</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={loading}>
          <Text style={styles.backButtonText}>이전</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.nextButton, loading && styles.nextButtonDisabled]} onPress={handleNext} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.nextButtonText}>{step === 3 ? '가입 완료' : '다음'}</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...props} style={styles.input} placeholderTextColor="#94A3B8" />
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
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#CBD5E1', true: '#99F6E4' }} thumbColor={value ? '#0F766E' : '#FFFFFF'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 16, paddingBottom: 120 },
  header: { gap: 10 },
  title: { color: '#0F172A', fontSize: 30, fontWeight: '800' },
  subtitle: { color: '#64748B', lineHeight: 22 },
  progressTrack: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#0F766E', borderRadius: 999 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, gap: 14 },
  socialCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, gap: 12 },
  sectionTitle: { color: '#0F172A', fontSize: 18, fontWeight: '800' },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: '#334155', fontWeight: '700' },
  input: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    color: '#0F172A',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchCopy: { flex: 1, gap: 4 },
  switchTitle: { color: '#0F172A', fontWeight: '700' },
  switchBody: { color: '#64748B', fontSize: 13, lineHeight: 19 },
  kakaoButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#FEE500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakaoButtonText: { color: '#191600', fontWeight: '800', fontSize: 15 },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#0F172A', fontWeight: '700', fontSize: 15 },
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { color: '#334155', fontWeight: '700' },
  nextButton: {
    flex: 1.4,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#115E59',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: { opacity: 0.7 },
  nextButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
