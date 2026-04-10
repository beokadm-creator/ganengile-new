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
} from 'react-native';
import { serverTimestamp, setDoc, doc, Timestamp } from 'firebase/firestore';

import { useUser } from '../../contexts/UserContext';
import { db } from '../../services/firebase';
import {
  checkRequiredConsents,
  fetchConsentTemplates,
  getFallbackConsentItems,
} from '../../services/consent-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import { ConsentDisplayItem, ConsentKey, ConsentRecord } from '../../types/consent';
import { UserRole } from '../../types/user';

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

export default function BasicInfoOnboarding() {
  const { user, completeOnboarding } = useUser();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '');
  const [consentTemplates, setConsentTemplates] = useState<ConsentDisplayItem[]>([]);
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const cleanedPhone = useMemo(() => phoneNumber.replace(/[^0-9]/g, ''), [phoneNumber]);

  useEffect(() => {
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
  }, []);

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

  function validate() {
    if (loadingTemplates || consentTemplates.length === 0) {
      Alert.alert('약관을 불러오는 중입니다', '약관 정보를 모두 불러온 뒤 다시 시도해 주세요.');
      return false;
    }

    if (!name.trim()) {
      Alert.alert('이름이 필요합니다', '이름을 입력해 주세요.');
      return false;
    }

    if (!/^010[0-9]{8}$/.test(cleanedPhone)) {
      Alert.alert('휴대폰 번호를 확인해 주세요', '010으로 시작하는 번호를 입력해 주세요.');
      return false;
    }

    if (!checkRequiredConsents(consents, consentTemplates)) {
      Alert.alert('필수 약관 동의가 필요합니다', '모든 필수 약관에 동의해 주세요.');
      return false;
    }

    if (!user?.uid) {
      Alert.alert('계정을 다시 확인해 주세요', '사용자 정보를 다시 불러온 뒤 다시 시도해 주세요.');
      return false;
    }

    return true;
  }

  async function handleSubmit() {
    if (!validate() || !user?.uid) {
      return;
    }

    setLoading(true);
    try {
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
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          email: user.email ?? '',
          name: name.trim(),
          phoneNumber: cleanedPhone,
          role: user.role ?? UserRole.GLER,
          agreedTerms,
          consentHistory: consentRecords,
          hasCompletedOnboarding: true,
          isActive: true,
          updatedAt: serverTimestamp(),
          ...(user.createdAt ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true },
      );

      await completeOnboarding();
    } catch (error) {
      console.error('Failed to complete basic onboarding', error);
      Alert.alert('저장에 실패했습니다', '잠시 후 다시 시도해 주세요.');
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
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>첫 배송 요청 준비</Text>
          <Text style={styles.title}>이용자 정보만 간단히 확인합니다.</Text>
          <Text style={styles.description}>
            계정 생성은 이미 끝났습니다. 첫 배송 요청에 필요한 정보만 입력하면 바로 이용할 수 있습니다.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>기본 정보</Text>
          <Field
            label="이름"
            placeholder="홍길동"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <Field
            label="휴대폰 번호"
            placeholder="01012345678"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="number-pad"
            helper="배송 연락과 본인 확인 진행에 사용합니다."
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>약관 동의</Text>

          {loadingTemplates ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.loadingText}>약관을 불러오는 중...</Text>
            </View>
          ) : (
            <>
              {/* 전체 동의 토글 */}
              <View style={styles.agreementRow}>
                <View style={styles.agreementCopy}>
                  <Text style={styles.agreementTitle}>전체 동의</Text>
                </View>
                <Switch
                  value={allAgreed}
                  onValueChange={toggleAll}
                  trackColor={{ false: Colors.gray300, true: Colors.primaryMint }}
                  thumbColor={allAgreed ? Colors.primary : Colors.white}
                />
              </View>

              <View style={styles.divider} />

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
          )}
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>다음 단계</Text>
          <Text style={styles.noticeBody}>
            이 단계는 요청자 이용 시작 준비입니다. 길러 신청, 본인확인, 정산 계좌 연결은 별도 절차로 홈과 프로필에서 이어집니다.
          </Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={() => void handleSubmit()}
            disabled={loading || loadingTemplates}
          >
            <Text style={styles.submitButtonText}>{loading ? '저장 중...' : '배송 요청 준비 완료'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  helper,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; helper?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...props} style={styles.input} placeholderTextColor={Colors.gray400} />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
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
      <View style={styles.agreementRow}>
        <View style={styles.agreementCopy}>
          <View style={styles.titleRow}>
            <Text style={styles.agreementTitle}>{item.title}</Text>
            <Text style={[
              styles.badge,
              item.isRequired ? styles.badgeRequired : styles.badgeOptional,
            ]}>
              {item.isRequired ? '필수' : '선택'}
            </Text>
          </View>
          <Text style={styles.agreementSubtitle}>{item.description}</Text>
        </View>
        <Switch
          value={agreed}
          onValueChange={onToggle}
          trackColor={{ false: Colors.gray300, true: Colors.primaryMint }}
          thumbColor={agreed ? Colors.primary : Colors.white}
        />
      </View>
      {item.content ? (
        <TouchableOpacity onPress={onToggleExpand} activeOpacity={0.6}>
          <Text style={styles.expandButton}>
            {expanded ? '내용 닫기' : '내용 보기'}
          </Text>
        </TouchableOpacity>
      ) : null}
      {expanded && item.content ? (
        <View style={styles.expandedContent}>
          <Text style={styles.expandedText}>{item.content}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing['4xl'] },
  hero: {
    backgroundColor: Colors.primaryMint,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  eyebrow: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
    lineHeight: 32,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 22,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  fieldWrap: { gap: Spacing.xs },
  fieldLabel: {
    color: Colors.textTertiary,
    fontWeight: '700',
    fontSize: Typography.fontSize.sm,
  },
  input: {
    minHeight: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.gray50,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  helper: {
    color: Colors.gray500,
    fontSize: Typography.fontSize.xs,
    marginTop: Spacing.xs,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  loadingText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  agreementCopy: { flex: 1, gap: 2 },
  agreementTitle: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: Typography.fontSize.base,
  },
  agreementSubtitle: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
  },
  badgeRequired: {
    backgroundColor: Colors.errorBackground,
    color: Colors.error,
  },
  badgeOptional: {
    backgroundColor: Colors.gray100,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  consentItemWrap: {
    gap: Spacing.xs,
  },
  expandButton: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    paddingLeft: 2,
  },
  expandedContent: {
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  expandedText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
    lineHeight: 18,
  },
  notice: {
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  noticeTitle: {
    color: Colors.warningDark,
    fontWeight: '800',
    fontSize: Typography.fontSize.sm,
  },
  noticeBody: {
    color: Colors.warningDark,
    lineHeight: 20,
    fontSize: Typography.fontSize.sm,
  },
  footer: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  submitButton: {
    minHeight: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
});
