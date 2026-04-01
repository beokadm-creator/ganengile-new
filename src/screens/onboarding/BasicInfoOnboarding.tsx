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
      <TextInput {...props} style={styles.input} placeholderTextColor="#94A3B8" />
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
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#CBD5E1', true: '#99F6E4' }} thumbColor={value ? '#0F766E' : '#FFFFFF'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 16, paddingBottom: 120 },
  hero: { gap: 6 },
  eyebrow: { color: '#0F766E', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: '#0F172A', fontSize: 28, fontWeight: '800' },
  description: { color: '#475569', fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, gap: 16 },
  sectionTitle: { color: '#0F172A', fontSize: 18, fontWeight: '800' },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: '#334155', fontWeight: '700' },
  input: { minHeight: 52, borderRadius: 16, backgroundColor: '#F8FAFC', paddingHorizontal: 16, color: '#0F172A' },
  helper: { color: '#64748B', fontSize: 12 },
  agreementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  agreementCopy: { flex: 1, gap: 2 },
  agreementTitle: { color: '#0F172A', fontWeight: '700' },
  agreementSubtitle: { color: '#64748B', fontSize: 12 },
  notice: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, gap: 6 },
  noticeTitle: { color: '#0F172A', fontWeight: '800' },
  noticeBody: { color: '#475569', lineHeight: 20 },
  footer: { position: 'absolute', left: 20, right: 20, bottom: 20 },
  submitButton: { minHeight: 56, borderRadius: 18, backgroundColor: '#115E59', alignItems: 'center', justifyContent: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
