import { Colors } from '../../theme';
﻿import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { FirebaseError } from 'firebase/app';
import { useUser } from '../../contexts/UserContext';
import { db } from '../../services/firebase';
import { getUserVerification, getVerificationStatusDisplay } from '../../services/verification-service';
import {
  getBankIntegrationConfig,
  getIdentityIntegrationConfig,
  type BankIntegrationConfig,
  type IdentityIntegrationConfig,
} from '../../services/integration-config-service';
import type { MainStackNavigationProp } from '../../types/navigation';
import type { UserVerification } from '../../types/profile';
import AppTopBar from '../../components/common/AppTopBar';
import BankSelectModal from '../../components/common/BankSelectModal';
import { createProtectedBankAccount } from '../../../shared/bank-account';

const TOTAL_STEPS = 4;
const ACCENT = Colors.primary;

export default function GillerApplyScreen({ navigation }: { navigation: MainStackNavigationProp }) {
  const { user, refreshUser } = useUser();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verification, setVerification] = useState<UserVerification | null>(null);
  const [identityConfig, setIdentityConfig] = useState<IdentityIntegrationConfig | null>(null);
  const [bankConfig, setBankConfig] = useState<BankIntegrationConfig | null>(null);
  const [submitHint, setSubmitHint] = useState('');
  const [bankModalVisible, setBankModalVisible] = useState(false);

  const [phone, setPhone] = useState(user?.phoneNumber ?? '');
  const [routeDescription, setRouteDescription] = useState('');
  const [selfIntroduction, setSelfIntroduction] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState(user?.name ?? '');

  const verificationDisplay = useMemo(() => getVerificationStatusDisplay(verification), [verification]);
  const identityTestMode = identityConfig?.testMode ?? true;
  const bankTestMode = bankConfig?.testMode ?? true;

  const load = useCallback(async () => {
    if (!user?.uid) {
      return;
    }

    setVerificationLoading(true);
    try {
      const [verificationData, identityData, bankData] = await Promise.all([
        getUserVerification(user.uid),
        getIdentityIntegrationConfig(),
        getBankIntegrationConfig(),
      ]);
      setVerification(verificationData);
      setIdentityConfig(identityData);
      setBankConfig(bankData);
    } catch (error) {
      console.error('Failed to load giller apply screen', error);
    } finally {
      setVerificationLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (step === 3 && verification?.status === 'approved') {
      setStep(4);
    }
  }, [step, verification?.status]);

  const steps = ['안내', '기본 정보', '본인확인', '정산 계좌'];

  const validateProfileStep = () => {
    if (!phone.trim()) {
      Alert.alert('입력 확인', '연락처를 입력해 주세요.');
      return false;
    }

    const cleaned = phone.replace(/-/g, '');
    if (!/^010[0-9]{8}$/.test(cleaned)) {
      Alert.alert('입력 확인', '휴대폰 번호를 확인해 주세요.');
      return false;
    }

    if (!routeDescription.trim()) {
      Alert.alert('입력 확인', '주요 이동 구간을 입력해 주세요.');
      return false;
    }

    return true;
  };

  const validateIdentityStep = () => {
    if (!identityConfig?.requiredForGillerUpgrade) {
      return true;
    }

    if (identityTestMode && identityConfig.allowTestBypass) {
      return true;
    }

    if (verification?.status !== 'approved') {
      Alert.alert('본인확인 필요', '본인확인을 완료해 주세요.');
      return false;
    }

    return true;
  };

  const validateBankStep = () => {
    if (!bankName.trim()) {
      setSubmitHint('은행을 선택해 주세요.');
      Alert.alert('입력 확인', '은행을 선택해 주세요.');
      return false;
    }

    if (!accountNumber.trim()) {
      setSubmitHint('계좌번호를 입력해 주세요.');
      Alert.alert('입력 확인', '계좌번호를 입력해 주세요.');
      return false;
    }

    if (accountNumber.replace(/-/g, '').length < 10) {
      setSubmitHint('계좌번호를 확인해 주세요.');
      Alert.alert('입력 확인', '계좌번호를 확인해 주세요.');
      return false;
    }

    if (!accountHolder.trim()) {
      setSubmitHint('예금주명을 입력해 주세요.');
      Alert.alert('입력 확인', '예금주명을 입력해 주세요.');
      return false;
    }

    return true;
  };

  const handleNext = async () => {
    if (step === 2 && !validateProfileStep()) {
      return;
    }
    if (step === 3 && !validateIdentityStep()) {
      return;
    }
    if (step === 4) {
      await handleSubmit();
      return;
    }
    setStep((current) => current + 1);
  };

  const handleBack = () => {
    if (step === 1) {
      navigation.goBack();
      return;
    }
    setStep((current) => current - 1);
  };

  const handleSubmit = async () => {
    setSubmitHint('');
    if (!validateBankStep()) {
      return;
    }
    if (!user?.uid) {
      Alert.alert('로그인 필요', '사용자 정보를 찾을 수 없습니다.');
      return;
    }

    setLoading(true);
    setSubmitHint('신청을 접수하고 있습니다.');

    try {
      const bankVerificationStatus =
        bankTestMode && bankConfig?.allowTestBypass ? 'approved_test_bypass' : 'manual_review';
      const protectedBankAccount = createProtectedBankAccount({
        bankName,
        accountNumber,
        accountHolder,
        verificationStatus: bankVerificationStatus,
      });

      await addDoc(collection(db, 'giller_applications'), {
        userId: user.uid,
        userName: user.name,
        phone: phone.trim(),
        routeDescription: routeDescription.trim(),
        selfIntroduction: selfIntroduction.trim(),
        verificationStatus:
          identityTestMode && identityConfig?.allowTestBypass
            ? 'approved_test_bypass'
            : verification?.status ?? 'not_submitted',
        verificationProvider: verification?.externalAuth?.provider ?? null,
        bankAccount: protectedBankAccount,
        integrationSnapshot: {
          identity: {
            testMode: identityTestMode,
            liveReady: identityConfig?.liveReady ?? false,
            allowTestBypass: identityConfig?.allowTestBypass ?? true,
          },
          bank: {
            testMode: bankTestMode,
            liveReady: bankConfig?.liveReady ?? false,
            allowTestBypass: bankConfig?.allowTestBypass ?? true,
            provider: bankConfig?.provider ?? 'manual_review',
            verificationMode: bankConfig?.verificationMode ?? 'manual_review',
          },
        },
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, 'users', user.uid),
        {
          gillerApplicationStatus: 'pending',
          gillerInfo: {
            bankAccount: protectedBankAccount,
            identityVerificationStatus:
              identityTestMode && identityConfig?.allowTestBypass
                ? 'approved_test_bypass'
                : verification?.status ?? 'not_submitted',
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await refreshUser();
      Alert.alert('신청 완료', '길러 신청이 접수되었습니다.', [
        { text: '확인', onPress: () => navigation.navigate('Tabs', { screen: 'Profile' }) },
      ]);
    } catch (error) {
      console.error('Failed to submit giller application', error);
      const message =
        error instanceof FirebaseError
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : '신청 처리 중 문제가 발생했습니다.';
      setSubmitHint(message);
      Alert.alert('신청 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>길러 신청</Text>
            <Text style={styles.stepDescription}>기본 정보와 계좌를 등록하면 심사로 넘어갑니다.</Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>진행 순서</Text>
              {steps.map((item, index) => (
                <View key={item} style={styles.timelineRow}>
                  <View style={styles.timelineIndex}>
                    <Text style={styles.timelineIndexText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.timelineText}>{item}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.card, styles.alertCard]}>
              <Text style={styles.alertText}>본인확인: {identityTestMode ? '테스트 가능' : '실서비스 대기'}</Text>
              <Text style={styles.alertText}>계좌확인: {bankTestMode ? '테스트 또는 수동 검토' : '실서비스 대기'}</Text>
            </View>
          </ScrollView>
        );
      case 2:
        return (
          <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.stepTitle}>기본 정보</Text>
            <Text style={styles.stepDescription}>연락처와 활동 정보를 입력해 주세요.</Text>

            <InputField
              label="연락처"
              value={phone}
              onChangeText={setPhone}
              placeholder="010-0000-0000"
              keyboardType="phone-pad"
            />
            <InputField
              label="주요 이동 구간"
              value={routeDescription}
              onChangeText={setRouteDescription}
              placeholder="예: 강남-여의도, 평일 저녁 이동"
            />
            <InputField
              label="소개"
              value={selfIntroduction}
              onChangeText={setSelfIntroduction}
              placeholder="선택 입력"
              multiline
            />
          </ScrollView>
        );
      case 3:
        return (
          <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>본인확인</Text>
            <Text style={styles.stepDescription}>현재 상태를 확인합니다.</Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>현재 상태</Text>
              <Text style={styles.statusHeadline}>{verificationDisplay.statusKo}</Text>
              <Text style={styles.statusBody}>{verificationDisplay.description}</Text>
              <Text style={styles.helperText}>
                PASS {identityConfig?.providers.pass.liveReady ? '준비됨' : '대기'} / Kakao {identityConfig?.providers.kakao.liveReady ? '준비됨' : '대기'}
              </Text>
            </View>

            {verification?.status === 'approved' ? (
              <TouchableOpacity style={styles.secondaryAction} onPress={() => setStep(4)} activeOpacity={0.9}>
                <Text style={styles.secondaryActionText}>다음 단계</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.primaryAction}
                  onPress={() => navigation.navigate('IdentityVerification')}
                  disabled={verificationLoading}
                  activeOpacity={0.9}
                >
                  <Text style={styles.primaryActionText}>본인확인 하러 가기</Text>
                </TouchableOpacity>
                <Text style={styles.helperText}>완료 후 돌아오면 계속 진행됩니다.</Text>
              </>
            )}
          </ScrollView>
        );
      default:
        return (
          <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.stepTitle}>정산 계좌</Text>
            <Text style={styles.stepDescription}>계좌 정보를 입력해 주세요.</Text>

            <View style={[styles.card, styles.infoCard]}>
              <Text style={styles.cardTitle}>{bankTestMode ? '테스트 또는 수동 검토' : '실서비스 준비 상태'}</Text>
              <Text style={styles.statusBody}>
                {bankConfig?.statusMessage ?? '관리자 설정 상태를 불러오고 있습니다.'}
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>은행</Text>
              <TouchableOpacity style={styles.bankButton} onPress={() => setBankModalVisible(true)} activeOpacity={0.9}>
                <Text style={[styles.bankButtonText, !bankName && styles.bankPlaceholder]}>
                  {bankName || '은행 선택'}
                </Text>
                <Text style={styles.bankButtonArrow}>{'>'}</Text>
              </TouchableOpacity>
            </View>

            <InputField
              label="계좌번호"
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="숫자만 입력"
              keyboardType="number-pad"
            />
            <InputField
              label="예금주명"
              value={accountHolder}
              onChangeText={setAccountHolder}
              placeholder="예금주명"
            />
          </ScrollView>
        );
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <AppTopBar title="길러 신청" onBack={handleBack} />

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        {step} / {TOTAL_STEPS} 단계 · {steps[step - 1]}
      </Text>

      {renderStep()}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.footerButton, loading && styles.footerButtonDisabled]}
          onPress={() => void handleNext()}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.footerButtonText}>{step === TOTAL_STEPS ? '신청하기' : '다음'}</Text>
          )}
        </TouchableOpacity>
        {submitHint ? <Text style={styles.submitHint}>{submitHint}</Text> : null}
      </View>

      <BankSelectModal
        visible={bankModalVisible}
        selectedBank={bankName}
        onClose={() => setBankModalVisible(false)}
        onSelect={(selectedBank: string) => {
          setBankName(selectedBank);
          setBankModalVisible(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  helper,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  helper?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline ? styles.textArea : undefined]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextcolor={Colors.textTertiary}
        multiline={multiline}
        keyboardType={keyboardType ?? 'default'}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      {helper ? <Text style={styles.helperText}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.border,
  },
  progressFill: {
    height: 6,
    backgroundColor: ACCENT,
  },
  progressLabel: {
    paddingHorizontal: 20,
    paddingTop: 12,
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    gap: 12,
    shadowColor: Colors.textPrimary,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: Colors.primaryMint,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  field: {
    marginBottom: 16,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  textArea: {
    minHeight: 120,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timelineIndex: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryMint,
  },
  timelineIndexText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  timelineText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  alertCard: {
    backgroundColor: Colors.warningLight,
  },
  alertText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.warningDark,
  },
  statusHeadline: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statusBody: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  primaryAction: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.surface,
  },
  secondaryAction: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: Colors.primaryMint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },
  bankButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bankButtonText: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  bankPlaceholder: {
    color: Colors.textTertiary,
  },
  bankButtonArrow: {
    fontSize: 18,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonDisabled: {
    opacity: 0.6,
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.surface,
  },
  submitHint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.error,
  },
});
