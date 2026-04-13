import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';

import { Colors, Typography } from '../../theme';
import { auth, db } from '../../services/firebase';
import {
  checkRequiredConsents,
  fetchConsentTemplates,
  getFallbackConsentItems,
} from '../../services/consent-service';
import { autoIssueCouponsByTrigger } from '../../services/coupon-service';
import { handleGoogleSignIn } from '../../services/google-auth';
import { getKakaoLoginErrorMessage, signUpWithKakao } from '../../services/kakao-auth';
import type { AuthNavigationProp } from '../../types/navigation';
import { ConsentDisplayItem, ConsentKey, ConsentRecord } from '../../types/consent';
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

const STEP_ORDER: Step[] = ['name', 'email', 'password', 'terms'];

const STEP_COPY: Record<Step, { title: string; subtitle: string; cta: string }> = {
  name: {
    title: '이름만 먼저 알려주세요',
    subtitle: '지금은 계정만 빠르게 만들고, 실제 서비스 이용 준비는 첫 배송 요청 직전에 이어집니다.',
    cta: '다음',
  },
  email: {
    title: '로그인할 이메일을 입력해주세요',
    subtitle: '계정 확인용 메일을 보내드리고, 이후 로그인 계정으로 그대로 사용됩니다.',
    cta: '다음',
  },
  password: {
    title: '비밀번호를 설정해주세요',
    subtitle: '계정 생성은 여기서 거의 끝납니다. 연락처 확인은 첫 배송 요청 직전에만 진행합니다.',
    cta: '다음',
  },
  terms: {
    title: '계정 생성에 필요한 동의만 마치면 됩니다',
    subtitle: '이 단계는 계정 생성입니다. 요청자 이용 시작 준비와 길러 절차는 이후에 분리되어 진행됩니다.',
    cta: '계정 만들기',
  },
};

function buildRequesterAgreedTerms(consents: Record<string, boolean>) {
  return {
    giller: false,
    gller: consents[ConsentKey.SERVICE_TERMS] === true,
    privacy:
      consents[ConsentKey.PRIVACY_COLLECTION] === true &&
      consents[ConsentKey.PRIVACY_POLICY] === true,
    marketing: consents[ConsentKey.MARKETING] === true,
  };
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
  const [form, setForm] = useState<SignUpForm>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Dynamic consent state
  const [consentTemplates, setConsentTemplates] = useState<ConsentDisplayItem[]>([]);
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const step = STEP_ORDER[stepIndex];
  const copy = STEP_COPY[step];
  const progressWidth = useMemo<DimensionValue>(
    () => `${((stepIndex + 1) / STEP_ORDER.length) * 100}%`,
    [stepIndex],
  );
  const footerPaddingBottom = Math.max(insets.bottom, 12);

  // Load consent templates when reaching the terms step
  useEffect(() => {
    if (step !== 'terms') return;
    if (consentTemplates.length > 0) return;

    let cancelled = false;
    async function load() {
      setLoadingTemplates(true);
      try {
        const templates = await fetchConsentTemplates();
        if (cancelled) return;
        if (templates.length > 0) {
          setConsentTemplates(templates);
        } else {
          setConsentTemplates(getFallbackConsentItems());
        }
      } catch {
        if (!cancelled) {
          setConsentTemplates(getFallbackConsentItems());
        }
      } finally {
        if (!cancelled) setLoadingTemplates(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [step, consentTemplates.length]);

  function updateForm(key: keyof SignUpForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const toggleConsent = useCallback((key: string) => {
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const allAgreed = useMemo(
    () => consentTemplates.length > 0 && consentTemplates.every((t) => consents[t.key]),
    [consentTemplates, consents],
  );

  const toggleAll = useCallback(() => {
    const nextValue = !allAgreed;
    setConsents((prev) => {
      const next = { ...prev };
      for (const t of consentTemplates) {
        next[t.key] = nextValue;
      }
      return next;
    });
  }, [allAgreed, consentTemplates]);

  const toggleExpanded = useCallback((key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

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

    if (step === 'terms') {
      if (loadingTemplates || consentTemplates.length === 0) {
        Alert.alert('약관을 불러오는 중입니다', '약관 정보를 모두 불러온 뒤 다시 시도해 주세요.');
        return false;
      }

      if (!checkRequiredConsents(consents, consentTemplates)) {
        Alert.alert('필수 약관 동의 필요', '모든 필수 약관에 동의해주세요.');
        return false;
      }
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

      const agreedTerms = buildRequesterAgreedTerms(consents);

      // Build consent history records
      const now = Timestamp.now();
      const consentRecords: ConsentRecord[] = consentTemplates
        .filter((t) => consents[t.key])
        .map((t) => ({
          templateId: t.templateId,
          key: t.key,
          version: t.version,
          agreedAt: now,
          title: t.title,
        }));

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
          agreedTerms,
          consentHistory: consentRecords,
          gillerApplicationStatus: 'none',
          isVerified: false,
          pointBalance: 0,
          walletBalances: {
            chargeBalance: 0,
            earnedBalance: 0,
            promoBalance: 0,
            lockedChargeBalance: 0,
            lockedEarnedBalance: 0,
            lockedPromoBalance: 0,
            pendingWithdrawalBalance: 0,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      await autoIssueCouponsByTrigger(userCredential.user.uid, 'signup').catch(console.error);

      Alert.alert(
        '계정이 만들어졌습니다',
        '이메일 인증 메일을 보냈습니다. 실제 배송 요청 전에는 이용자 정보 확인과 휴대폰 인증이 이어집니다.',
      );
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

        <View style={styles.card}>
          {renderStepContent({
            step,
            form,
            consentTemplates,
            consents,
            loadingTemplates,
            expandedItems,
            allAgreed,
            updateForm,
            toggleConsent,
            toggleAll,
            toggleExpanded,
          })}
        </View>

        <View style={styles.contextCard}>
          <Text style={styles.contextTitle}>가입 이후 절차</Text>
          <Text style={styles.contextBody}>지금은 계정만 만들고, 첫 배송 요청 전에 이용자 온보딩과 휴대폰 확인을 진행합니다.</Text>
          <Text style={styles.contextBody}>길러 신청은 별도 절차입니다. 본인확인과 정산 정보 등록은 길러 전환 시점에만 진행합니다.</Text>
        </View>

        {step === 'name' ? (
          <View style={styles.socialCard}>
            <Text style={styles.sectionTitle}>소셜 계정으로도 바로 시작할 수 있습니다</Text>
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

// ─── Step content renderer ────────────────────────────────

type StepContentProps = {
  step: Step;
  form: SignUpForm;
  consentTemplates: ConsentDisplayItem[];
  consents: Record<string, boolean>;
  loadingTemplates: boolean;
  expandedItems: Set<string>;
  allAgreed: boolean;
  updateForm: (key: keyof SignUpForm, value: string) => void;
  toggleConsent: (key: string) => void;
  toggleAll: () => void;
  toggleExpanded: (key: string) => void;
};

function renderStepContent(props: StepContentProps) {
  const {
    step,
    form,
    consentTemplates,
    consents,
    loadingTemplates,
    expandedItems,
    allAgreed,
    updateForm,
    toggleConsent,
    toggleAll,
    toggleExpanded,
  } = props;

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
          <Text style={styles.helperText}>계정 이름으로 저장되며, 이용자 프로필과 요청 화면에서 사용됩니다.</Text>
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
          <Text style={styles.helperText}>계정 생성은 여기까지입니다. 이용자 온보딩과 휴대폰 확인은 첫 요청 직전에 진행합니다.</Text>
        </>
      );
    case 'terms':
      return (
        <TermsStepContent
          consentTemplates={consentTemplates}
          consents={consents}
          loadingTemplates={loadingTemplates}
          expandedItems={expandedItems}
          allAgreed={allAgreed}
          toggleConsent={toggleConsent}
          toggleAll={toggleAll}
          toggleExpanded={toggleExpanded}
        />
      );
    default:
      return null;
  }
}

// ─── Terms step content ───────────────────────────────────

function TermsStepContent({
  consentTemplates,
  consents,
  loadingTemplates,
  expandedItems,
  allAgreed,
  toggleConsent,
  toggleAll,
  toggleExpanded,
}: {
  consentTemplates: ConsentDisplayItem[];
  consents: Record<string, boolean>;
  loadingTemplates: boolean;
  expandedItems: Set<string>;
  allAgreed: boolean;
  toggleConsent: (key: string) => void;
  toggleAll: () => void;
  toggleExpanded: (key: string) => void;
}) {
  if (loadingTemplates) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.loadingText}>약관을 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <>
      {/* 전체 동의 토글 */}
      <View style={styles.switchRow}>
        <View style={styles.switchCopy}>
          <Text style={styles.switchTitle}>전체 동의</Text>
        </View>
        <Switch
          value={allAgreed}
          onValueChange={toggleAll}
          trackColor={{ false: Colors.border, true: Colors.primaryMint }}
          thumbColor={allAgreed ? Colors.primary : Colors.surface}
        />
      </View>

      <View style={styles.termsDivider} />

      {/* 개별 동의 항목 */}
      {consentTemplates.map((item) => (
        <ConsentItemRow
          key={item.key}
          item={item}
          agreed={consents[item.key] === true}
          expanded={expandedItems.has(item.key)}
          onToggle={() => toggleConsent(item.key)}
          onToggleExpand={() => toggleExpanded(item.key)}
        />
      ))}
    </>
  );
}

// ─── Reusable components ──────────────────────────────────

function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...props} style={[styles.input, style]} placeholderTextColor={Colors.textTertiary} />
    </View>
  );
}

function ConsentItemRow({
  item,
  agreed,
  expanded,
  onToggle,
  onToggleExpand,
}: {
  item: ConsentDisplayItem;
  agreed: boolean;
  expanded: boolean;
  onToggle: () => void;
  onToggleExpand: () => void;
  key?: string;
}) {
  return (
    <View style={styles.consentItemWrap}>
      <View style={styles.switchRow}>
        <View style={styles.switchCopy}>
          <View style={styles.switchTitleRow}>
            <Text style={styles.switchTitle}>{item.title}</Text>
            <Text style={[styles.badge, item.isRequired ? styles.badgeRequired : styles.badgeOptional]}>
              {item.isRequired ? '필수' : '선택'}
            </Text>
          </View>
          <Text style={styles.switchBody}>{item.description}</Text>
        </View>
        <Switch
          value={agreed}
          onValueChange={onToggle}
          trackColor={{ false: Colors.border, true: Colors.primaryMint }}
          thumbColor={agreed ? Colors.primary : Colors.surface}
        />
      </View>
      <TouchableOpacity onPress={onToggleExpand} activeOpacity={0.6}>
        <Text style={styles.expandButton}>{expanded ? '내용 닫기' : '내용 보기'}</Text>
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.expandedContent}>
          <Text style={styles.expandedText}>{item.content || '등록된 약관 내용이 없습니다.'}</Text>
        </View>
      ) : null}
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
  loadingWrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    color: Colors.textTertiary,
    fontSize: 13,
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
  termsDivider: { height: 1, backgroundColor: Colors.border },
  consentItemWrap: { gap: 4 },
  expandButton: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    paddingLeft: 2,
  },
  expandedContent: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  expandedText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
    lineHeight: 18,
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
