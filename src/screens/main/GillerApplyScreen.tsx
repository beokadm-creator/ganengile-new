/**
 * GillerApplyScreen
 * 이용자 → 길러 신청 화면 (4단계)
 * Step 1: 신청 안내 + 필요 서류 확인
 * Step 2: 기본 정보 (연락처, 운행 노선, 자기소개)
 * Step 3: PASS 본인인증 (현재 테스트 모드)
 * Step 4: 계좌 정보 입력 (현재 형식 검증만)
 *
 * 완료 시 giller_applications 컬렉션에 pending 상태로 저장
 * → 관리자 승인 후 role: 'giller' 활성화
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useUser } from '../../contexts/UserContext';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from '../../services/firebase';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { getUserVerification, getVerificationStatusDisplay } from '../../services/verification-service';
import type { UserVerification } from '../../types/profile';
import { getIdentityTestMode } from '../../services/integration-config-service';
import AppTopBar from '../../components/common/AppTopBar';
import BankSelectModal from '../../components/common/BankSelectModal';

type Props = { navigation: StackNavigationProp<any> };

const TOTAL_STEPS = 4;

export default function GillerApplyScreen({ navigation }: Props) {
  const { user, refreshUser } = useUser();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 2 — 기본 정보
  const [phone, setPhone] = useState(user?.phoneNumber || '');
  const [routeDescription, setRouteDescription] = useState('');
  const [selfIntroduction, setSelfIntroduction] = useState('');

  // Step 3 — 신원 인증
  const [passTestMode, setPassTestMode] = useState(true);
  const [verification, setVerification] = useState<UserVerification | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);

  // Step 4 — 계좌 정보
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState(user?.name || '');
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [submitHint, setSubmitHint] = useState('');

  const loadVerification = useCallback(async () => {
    if (!user?.uid) return;
    setVerificationLoading(true);
    try {
      const data = await getUserVerification(user.uid);
      setVerification(data);
    } catch (error) {
      console.error('Verification load error:', error);
    } finally {
      setVerificationLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadVerification();
    getIdentityTestMode().then(setPassTestMode).catch(() => setPassTestMode(true));
  }, [loadVerification]);

  useFocusEffect(
    useCallback(() => {
      loadVerification();
    }, [loadVerification])
  );

  // 인증 완료 후 IdentityVerificationScreen에서 돌아오면 자동으로 Step 4로 이동
  useEffect(() => {
    if (step === 3 && verification?.status === 'approved') {
      setStep(4);
    }
  }, [step, verification?.status]);

  // ─── Validation ─────────────────────────────────────

  const validateStep2 = () => {
    if (!phone.trim()) { Alert.alert('필수 입력', '연락처를 입력해주세요.'); return false; }
    const cleaned = phone.replace(/-/g, '');
    if (!/^010[0-9]{8}$/.test(cleaned)) { Alert.alert('형식 오류', '올바른 휴대폰 번호를 입력해주세요. (010-XXXX-XXXX)'); return false; }
    if (!routeDescription.trim()) { Alert.alert('필수 입력', '주로 이용하는 노선을 입력해주세요.'); return false; }
    return true;
  };

  const validateStep3 = () => {
    if (passTestMode) {
      return true;
    }
    if (!verification) {
      Alert.alert('인증 필요', '신원 인증을 제출해주세요.');
      return false;
    }
    if (verification.status === 'rejected') {
      Alert.alert('인증 반려', '신원 인증이 반려되었습니다. 다시 제출해주세요.');
      return false;
    }
    return true;
  };

  const validateStep4 = () => {
    if (!bankName.trim()) {
      setSubmitHint('은행을 선택해주세요.');
      Alert.alert('필수 입력', '은행을 선택해주세요.');
      return false;
    }
    if (!accountNumber.trim()) {
      setSubmitHint('계좌번호를 입력해주세요.');
      Alert.alert('필수 입력', '계좌번호를 입력해주세요.');
      return false;
    }
    if (accountNumber.replace(/-/g, '').length < 10) {
      setSubmitHint('올바른 계좌번호를 입력해주세요.');
      Alert.alert('형식 오류', '올바른 계좌번호를 입력해주세요.');
      return false;
    }
    if (!accountHolder.trim()) {
      setSubmitHint('예금주명을 입력해주세요.');
      Alert.alert('필수 입력', '예금주명을 입력해주세요.');
      return false;
    }
    return true;
  };

  // ─── Navigation ─────────────────────────────────────

  const goNext = async () => {
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    if (step === 4) {
      await handleSubmit();
      return;
    }
    setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step === 1) { navigation.goBack(); return; }
    setStep((s) => s - 1);
  };

  // ─── Submit ──────────────────────────────────────────

  const handleSubmit = async () => {
    setSubmitHint('');
    if (!validateStep4()) return;
    if (!user?.uid) { Alert.alert('오류', '로그인 정보를 찾을 수 없습니다.'); return; }

    setLoading(true);
    setSubmitHint('신청을 처리하고 있습니다...');
    try {
      // 1. giller_applications 컬렉션에 신청서 저장
      await addDoc(collection(db, 'giller_applications'), {
        userId: user.uid,
        userName: user.name,
        phone: phone.trim(),
        routeDescription: routeDescription.trim(),
        selfIntroduction: selfIntroduction.trim(),
        verificationStatus: passTestMode ? 'approved' : verification?.status ?? 'not_submitted',
        bankAccount: {
          bankName: bankName.trim(),
          accountNumber: accountNumber.replace(/-/g, ''),
          accountHolder: accountHolder.trim(),
        },
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // 2. 사용자 문서에 신청 중 상태 + 계좌 정보 저장 (role은 관리자 승인 후 변경)
      await setDoc(doc(db, 'users', user.uid), {
        gillerApplicationStatus: 'pending',
        gillerInfo: {
          bankAccount: {
            bankName: bankName.trim(),
            accountNumber: accountNumber.replace(/-/g, ''),
            accountHolder: accountHolder.trim(),
          },
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await refreshUser();
      setSubmitHint('신청이 정상 접수되었습니다.');

      Alert.alert(
        '신청 완료 🎉',
        '길러 신청이 접수되었습니다.\n\n관리자 심사 후 결과를 앱 알림으로 알려드립니다.\n보통 1~3 영업일 내 처리됩니다.',
        [{
          text: '확인',
          onPress: () => navigation.navigate('Tabs', { screen: 'Home' } as never),
        }]
      );
    } catch (error) {
      console.error('길러 신청 오류:', error);
      const firebaseMessage =
        error instanceof FirebaseError ? `${error.code}: ${error.message}` : null;
      const message = firebaseMessage || (error instanceof Error ? error.message : '신청 처리 중 문제가 발생했습니다.');
      setSubmitHint(`오류: ${message}`);
      Alert.alert('오류', '신청 처리 중 문제가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Render Steps ────────────────────────────────────

  const renderStep1 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>길러 신청 안내</Text>
      <Text style={styles.stepDescription}>
        길러는 출퇴근 동선으로 이웃의 물건을 배달하고 수익을 얻는 배송 파트너입니다.{'\n'}
        아래 내용을 확인하고 신청을 시작하세요.
      </Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>📋 신청 절차</Text>
        {['기본 정보 입력 (연락처, 노선)', '신원 인증 제출', '정산 계좌 등록', '관리자 심사 (1~3 영업일)'].map((t, i) => (
          <View key={i} style={styles.infoRow}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{i + 1}</Text></View>
            <Text style={styles.infoText}>{t}</Text>
          </View>
        ))}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>✅ 심사 기준</Text>
        {[
          '만 19세 이상 성인',
          '정기적인 지하철 출퇴근 가능',
          '배송 물품 안전 취급 가능',
          '앱 서비스 정책 준수',
        ].map((t, i) => (
          <View key={i} style={styles.infoRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.infoText}>{t}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.infoCard, styles.warningCard]}>
        <Text style={styles.warningText}>
          ⚠️ 현재 신원 인증 및 계좌 인증은 테스트 모드로 운영될 수 있습니다. 정식 서비스 출시 전 실제 인증으로 전환될 예정입니다.
        </Text>
      </View>
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepTitle}>기본 정보</Text>
      <Text style={styles.stepDescription}>연락처와 주로 이용하는 노선을 알려주세요.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>휴대폰 번호 *</Text>
        <TextInput
          style={styles.input}
          placeholder="010-0000-0000"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>주 이용 노선 *</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 2호선 강남역 ↔ 홍대입구역 (평일 출근)"
          value={routeDescription}
          onChangeText={setRouteDescription}
        />
        <Text style={styles.helper}>배송 가능한 경로를 구체적으로 적어주세요.</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>자기소개 (선택)</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="간단한 자기소개나 배송 경험을 입력해주세요."
          value={selfIntroduction}
          onChangeText={setSelfIntroduction}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
    </ScrollView>
  );

  const renderStep3 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>신원 인증</Text>
      <Text style={styles.stepDescription}>
        PASS/카카오 인증을 완료한 뒤 다음 단계로 이동해주세요.
      </Text>

      {passTestMode && (
        <View style={styles.testBanner}>
          <Text style={styles.testBannerTitle}>🧪 테스트 모드</Text>
          <Text style={styles.testBannerText}>
            테스트 모드에서는 인증 제출 없이 다음 단계로 진행됩니다.{'\n'}
            정식 서비스 전 실명 인증으로 전환됩니다.
          </Text>
        </View>
      )}

      {!passTestMode && (
        <>
          <View style={styles.verifiedBox}>
            <Text style={styles.verifiedIcon}>
              {verification ? getVerificationStatusDisplay(verification).icon : '❓'}
            </Text>
            <Text style={styles.verifiedText}>
              {verification
                ? getVerificationStatusDisplay(verification).description
                : '신원 인증을 제출해주세요.'}
            </Text>
          </View>
          {verification?.status !== 'approved' && (
            <>
              <TouchableOpacity
                style={styles.passButton}
                disabled={verificationLoading}
                onPress={() => navigation.navigate('IdentityVerification')}
              >
                <Text style={styles.passButtonText}>PASS/카카오 인증 진행하기</Text>
              </TouchableOpacity>
              <Text style={styles.step3GuideText}>
                인증 완료 후 이 화면으로 돌아와 하단 `다음` 버튼을 눌러주세요.
              </Text>
            </>
          )}
          {verification?.status === 'approved' && (
            <TouchableOpacity
              style={styles.step3NextButton}
              onPress={() => setStep(4)}
              activeOpacity={0.85}
            >
              <Text style={styles.step3NextButtonText}>인증 완료 - 다음 단계로 이동</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );

  const renderStep4 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepTitle}>정산 계좌 등록</Text>
      <Text style={styles.stepDescription}>
        배송 수익을 받을 계좌를 등록해주세요.
      </Text>

      {/* 테스트 모드 배너 */}
      <View style={styles.testBanner}>
        <Text style={styles.testBannerTitle}>🧪 테스트 모드</Text>
        <Text style={styles.testBannerText}>
          현재 1원 계좌인증이 구현되지 않아 형식 검증만 진행합니다.{'\n'}
          정식 서비스 전 실계좌 인증으로 전환됩니다.
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>은행 *</Text>
        <TouchableOpacity
          style={styles.bankSelectButton}
          onPress={() => setBankModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={[styles.bankSelectText, !bankName && styles.bankSelectPlaceholder]}>
            {bankName || '은행을 선택해주세요'}
          </Text>
          <Text style={styles.bankSelectArrow}>▾</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>계좌번호 *</Text>
        <TextInput
          style={styles.input}
          placeholder="숫자만 입력 (하이픈 제외)"
          value={accountNumber}
          onChangeText={setAccountNumber}
          keyboardType="number-pad"
        />
        <Text style={styles.helper}>계좌번호는 암호화되어 안전하게 보관됩니다.</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>예금주 *</Text>
        <TextInput
          style={styles.input}
          placeholder="예금주 이름"
          value={accountHolder}
          onChangeText={setAccountHolder}
        />
      </View>
    </ScrollView>
  );

  // ─── Layout ──────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AppTopBar title="길러 신청" onBack={goBack} />

      {/* 프로그레스 바 */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>
      <Text style={styles.progressLabel}>{step} / {TOTAL_STEPS} 단계</Text>

      {/* 컨텐츠 */}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}

      {/* 다음/완료 버튼 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, loading && styles.disabled]}
          onPress={() => { void goNext(); }}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextButtonText}>
              {step === TOTAL_STEPS ? '신청 완료하기' : '다음'}
            </Text>
          )}
        </TouchableOpacity>
        {!!submitHint && <Text style={styles.submitHintText}>{submitHint}</Text>}
      </View>

      <BankSelectModal
        visible={bankModalVisible}
        onClose={() => setBankModalVisible(false)}
        onSelect={(selectedBank) => {
          setBankName(selectedBank);
          setBankModalVisible(false);
        }}
        selectedBank={bankName}
      />
    </KeyboardAvoidingView>
  );
}

const ACCENT = '#4CAF50';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  progressTrack: { height: 4, backgroundColor: '#f0f0f0' },
  progressFill: { height: '100%', backgroundColor: ACCENT },
  progressLabel: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 8 },
  stepContent: { flex: 1, padding: 20 },
  stepTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  stepDescription: { fontSize: 15, color: '#666', lineHeight: 24, marginBottom: 24 },
  infoCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  warningCard: { backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#FFD54F' },
  infoCardTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  stepBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  stepBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  bullet: { fontSize: 16, color: ACCENT, marginRight: 10 },
  infoText: { fontSize: 14, color: '#555', flex: 1, lineHeight: 20 },
  warningText: { fontSize: 13, color: '#795548', lineHeight: 20 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#333',
  },
  bankSelectButton: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bankSelectText: {
    fontSize: 15,
    color: '#333',
  },
  bankSelectPlaceholder: {
    color: '#9CA3AF',
  },
  bankSelectArrow: {
    fontSize: 16,
    color: '#6B7280',
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  helper: { fontSize: 12, color: '#999', marginTop: 6 },
  testBanner: {
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
  },
  testBannerTitle: { fontSize: 14, fontWeight: 'bold', color: '#E65100', marginBottom: 4 },
  testBannerText: { fontSize: 13, color: '#795548', lineHeight: 20 },
  verifiedBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  verifiedIcon: { fontSize: 36 },
  verifiedText: { fontSize: 15, color: '#2E7D32', textAlign: 'center' },
  passButton: {
    backgroundColor: '#FFC107',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  passButtonText: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  step3GuideText: {
    marginTop: 10,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  step3NextButton: {
    marginTop: 12,
    backgroundColor: '#0F766E',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  step3NextButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  nextButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  submitHintText: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 12,
    color: '#6B7280',
  },
});
