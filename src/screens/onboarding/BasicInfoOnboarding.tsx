import React, { useMemo, useState } from 'react';
import {
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
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useUser } from '../../contexts/UserContext';
import { UserRole } from '../../types/user';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';

export default function BasicInfoOnboarding() {
  const { user, completeOnboarding } = useUser();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '');
  const [agreements, setAgreements] = useState({ service: false, privacy: false, marketing: false });

  const cleanedPhone = useMemo(() => phoneNumber.replace(/[^0-9]/g, ''), [phoneNumber]);

  function toggleAgreement(key: 'service' | 'privacy' | 'marketing') {
    setAgreements((current) => ({ ...current, [key]: !current[key] }));
  }

  function validate() {
    if (!name.trim()) {
      Alert.alert('이름이 필요합니다', '이름을 입력해 주세요.');
      return false;
    }
    if (!/^010[0-9]{8}$/.test(cleanedPhone)) {
      Alert.alert('휴대폰 번호를 확인해 주세요', '010으로 시작하는 번호를 입력해 주세요.');
      return false;
    }
    if (!agreements.service || !agreements.privacy) {
      Alert.alert('필수 약관 동의가 필요합니다', '서비스 이용약관과 개인정보 처리방침에 동의해 주세요.');
      return false;
    }
    if (!user?.uid) {
      Alert.alert('계정을 다시 확인해 주세요', '사용자 정보를 다시 불러온 뒤 시도해 주세요.');
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
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          email: user.email ?? '',
          name: name.trim(),
          phoneNumber: cleanedPhone,
          role: user.role ?? UserRole.GLER,
          agreedTerms: agreements,
          hasCompletedOnboarding: true,
          isActive: true,
          updatedAt: serverTimestamp(),
          ...(user.createdAt ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>가는길에 시작하기</Text>
          <Text style={styles.title}>기본 정보만 먼저 확인합니다.</Text>
          <Text style={styles.description}>필요한 정보만 입력하면 바로 홈으로 이어집니다.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>기본 정보</Text>
          <Field label="이름" placeholder="홍길동" value={name} onChangeText={setName} autoCapitalize="words" />
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
          <AgreementRow title="서비스 이용약관" subtitle="필수" value={agreements.service} onValueChange={() => toggleAgreement('service')} />
          <AgreementRow title="개인정보 처리방침" subtitle="필수" value={agreements.privacy} onValueChange={() => toggleAgreement('privacy')} />
          <AgreementRow title="마케팅 정보 수신" subtitle="선택" value={agreements.marketing} onValueChange={() => toggleAgreement('marketing')} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>다음 단계</Text>
          <Text style={styles.noticeBody}>길러 승급, 본인확인, 정산 계좌 연결은 홈과 프로필에서 이어집니다.</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.submitButton, loading && styles.submitButtonDisabled]} onPress={() => void handleSubmit()} disabled={loading}>
          <Text style={styles.submitButtonText}>{loading ? '저장 중...' : '시작하기'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, helper, ...props }: React.ComponentProps<typeof TextInput> & { label: string; helper?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...props} style={styles.input} placeholderTextColor={Colors.gray400} />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

function AgreementRow({ title, subtitle, value, onValueChange }: { title: string; subtitle: string; value: boolean; onValueChange: () => void }) {
  return (
    <View style={styles.agreementRow}>
      <View style={styles.agreementCopy}>
        <Text style={styles.agreementTitle}>{title}</Text>
        <Text style={styles.agreementSubtitle}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: Colors.gray300, true: Colors.primaryMint }} thumbColor={value ? Colors.primary : Colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: 120 },
  hero: { backgroundColor: Colors.primaryMint, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.sm, ...Shadows.sm },
  eyebrow: { color: Colors.primary, fontSize: Typography.fontSize.xs, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: Colors.textPrimary, fontSize: Typography.fontSize['2xl'], fontWeight: '800', lineHeight: 32 },
  description: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm, lineHeight: 22 },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize.lg, fontWeight: '800' },
  fieldWrap: { gap: Spacing.xs },
  fieldLabel: { color: Colors.textTertiary, fontWeight: '700', fontSize: Typography.fontSize.sm },
  input: { minHeight: 52, borderRadius: BorderRadius.md, backgroundColor: Colors.gray50, paddingHorizontal: Spacing.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  helper: { color: Colors.gray500, fontSize: Typography.fontSize.xs, marginTop: Spacing.xs },
  agreementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  agreementCopy: { flex: 1, gap: 2 },
  agreementTitle: { color: Colors.textPrimary, fontWeight: '700', fontSize: Typography.fontSize.base },
  agreementSubtitle: { color: Colors.textTertiary, fontSize: Typography.fontSize.xs },
  notice: { backgroundColor: Colors.warningLight, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.sm },
  noticeTitle: { color: Colors.warningDark, fontWeight: '800', fontSize: Typography.fontSize.sm },
  noticeBody: { color: Colors.warningDark, lineHeight: 20, fontSize: Typography.fontSize.sm },
  footer: { position: 'absolute', left: Spacing.xl, right: Spacing.xl, bottom: Spacing.xl, backgroundColor: 'transparent' },
  submitButton: { minHeight: 56, borderRadius: BorderRadius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadows.sm },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
});
