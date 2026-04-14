import { Colors } from '../../theme';
import { Typography } from '../../theme/typography';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  BackHandler,
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

const TOTAL_STEPS = 2;
const ACCENT = Colors.primary;

export default function GillerApplyScreen({ navigation }: { navigation: MainStackNavigationProp }) {
  const { user, refreshUser } = useUser();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verification, setVerification] = useState<UserVerification | null>(null);
  const [identityConfig, setIdentityConfig] = useState<IdentityIntegrationConfig | null>(null);
  const [submitHint, setSubmitHint] = useState('');

  const verificationDisplay = useMemo(() => getVerificationStatusDisplay(verification), [verification]);
  const identityTestMode = identityConfig?.testMode ?? true;

  const load = useCallback(async () => {
    if (!user?.uid) {
      return;
    }

    setVerificationLoading(true);
    try {
      const [verificationData, identityData] = await Promise.all([
        getUserVerification(user.uid),
        getIdentityIntegrationConfig(),
      ]);
      setVerification(verificationData);
      setIdentityConfig(identityData);
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
    if (step === 2 && (verification?.status === 'approved' || verification?.status === 'pending' || verification?.status === 'under_review')) {
      // Allow them to stay on step 2 and submit from there.
    }
  }, [step, verification?.status]);

  const steps = ['안내', '본인확인'];

  const validateIdentityStep = () => {
    if (!identityConfig?.requiredForGillerUpgrade) {
      return true;
    }

    // Allow proceeding if verification is already approved, OR if it's currently pending/under review.
    // This allows the admin to approve both Identity and Giller Application at the same time.
    if (verification?.status !== 'approved' && verification?.status !== 'pending' && verification?.status !== 'under_review') {
      if (identityTestMode && identityConfig?.allowTestBypass) {
        Alert.alert(
          '테스트 모드 우회',
          '현재 테스트 모드입니다. 본인확인 절차를 건너뛰고 다음 단계로 진행하시겠습니까?',
          [
            { text: '취소', style: 'cancel' },
            { text: '건너뛰기', onPress: () => handleSubmit() },
          ]
        );
        return false;
      }
      Alert.alert('본인확인 필요', '본인확인(신분증 제출 등)을 먼저 완료해 주세요.');
      return false;
    }

    return true;
  };



  const handleNext = async () => {
    if (step === 2) {
      if (!validateIdentityStep()) {
        return;
      }
      await handleSubmit();
      return;
    }
    setStep((current) => current + 1);
  };

  const handleBack = () => {
    if (step === 1 || user?.gillerApplicationStatus === 'pending') {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Tabs', { screen: 'Profile' });
      }
      return true;
    }
    setStep((current) => current - 1);
    return true;
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => subscription.remove();
  }, [step, user?.gillerApplicationStatus, navigation]);

  const handleSubmit = async () => {
    setSubmitHint('');
    if (!user?.uid) {
      Alert.alert('로그인 필요', '사용자 정보를 찾을 수 없습니다.');
      return;
    }

    setLoading(true);
    setSubmitHint('신청을 접수하고 있습니다.');

    try {
      await addDoc(collection(db, 'giller_applications'), {
        userId: user.uid,
        userName: user.name,
        phone: user.phoneNumber ?? '',
        verificationStatus:
          identityTestMode && identityConfig?.allowTestBypass
            ? 'approved_test_bypass'
            : verification?.status ?? 'not_submitted',
        verificationProvider: verification?.externalAuth?.provider ?? null,
        integrationSnapshot: {
          identity: {
            testMode: identityTestMode,
            liveReady: identityConfig?.liveReady ?? false,
            allowTestBypass: identityConfig?.allowTestBypass ?? true,
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
      Alert.alert('신청 완료', '길러 전환 신청이 접수되었습니다.\n승인 완료 후 활동 권역과 동선을 등록해 주세요.', [
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
            <Text style={styles.stepTitle}>길러 전환 신청</Text>
            <Text style={styles.stepDescription}>요청자 이용과 별개로, 길러 역할 활성화에 필요한 정보와 심사 단계를 진행합니다.</Text>

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
            </View>
          </ScrollView>
        );
      case 2:
        return (
          <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>본인확인</Text>
            <Text style={styles.stepDescription}>길러 전환을 위한 본인확인 상태를 확인합니다.</Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>현재 상태</Text>
              <Text style={styles.statusHeadline}>{verificationDisplay.statusKo}</Text>
              <Text style={styles.statusBody}>{verificationDisplay.description}</Text>
              <Text style={styles.helperText}>
                PASS {identityConfig?.providers.pass.liveReady ? '준비됨' : '대기'} / Kakao {identityConfig?.providers.kakao.liveReady ? '준비됨' : '대기'}
              </Text>
            </View>

            {verification?.status === 'approved' ? (
              <TouchableOpacity style={styles.secondaryAction} onPress={() => handleSubmit()} activeOpacity={0.9}>
                <Text style={styles.secondaryActionText}>길러 전환 신청하기</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.primaryAction}
                  onPress={() => navigation.navigate('IdentityVerification')}
                  disabled={verificationLoading}
                  activeOpacity={0.9}
                >
                  <Text style={styles.primaryActionText}>길러 전환용 본인확인 하러 가기</Text>
                </TouchableOpacity>
                <Text style={styles.helperText}>완료 후 돌아오면 길러 신청 절차를 계속 진행할 수 있습니다.</Text>

                {identityTestMode && identityConfig?.allowTestBypass ? (
                  <TouchableOpacity
                    style={[styles.secondaryAction, { marginTop: 16 }]}
                    onPress={() => handleSubmit()}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.secondaryActionText}>[테스트용] 본인확인 건너뛰기</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </ScrollView>
        );
      default:
        return null;
    }
  };

  if (user?.gillerApplicationStatus === 'pending') {
    return (
      <View style={styles.container}>
        <AppTopBar title="길러 전환 신청" onBack={handleBack} />
        <View style={styles.centerState}>
          <Text style={styles.statusHeadline}>심사 중입니다</Text>
          <Text style={styles.statusBody}>길러 전환 신청이 접수되어 검토 중입니다.</Text>
          <Text style={styles.statusBody}>승인 완료 후 활동 권역과 동선을 등록할 수 있습니다.</Text>
          <TouchableOpacity style={styles.primaryAction} onPress={handleBack} activeOpacity={0.9}>
            <Text style={styles.primaryActionText}>프로필로 돌아가기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (user?.gillerApplicationStatus === 'approved') {
    return (
      <View style={styles.container}>
        <AppTopBar title="길러 전환 신청" onBack={handleBack} />
        <View style={styles.centerState}>
          <Text style={styles.statusHeadline}>승인 완료</Text>
          <Text style={styles.statusBody}>이미 길러로 승인되었습니다.</Text>
          <TouchableOpacity style={styles.primaryAction} onPress={handleBack} activeOpacity={0.9}>
            <Text style={styles.primaryActionText}>길러 메뉴로 가기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <AppTopBar title="길러 전환 신청" onBack={handleBack} />

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
            <Text style={styles.footerButtonText}>{step === TOTAL_STEPS ? '길러 전환 신청하기' : '다음'}</Text>
          )}
        </TouchableOpacity>
        {submitHint ? <Text style={styles.submitHint}>{submitHint}</Text> : null}
      </View>
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
        placeholderTextColor={Colors.textTertiary}
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
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    gap: 12,
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
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  stepTitle: {
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: Typography.fontSize.base,
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
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  field: {
    marginBottom: 16,
    gap: 8,
  },
  label: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
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
    fontSize: Typography.fontSize.base,
  },
  textArea: {
    minHeight: 120,
  },
  helperText: {
    fontSize: Typography.fontSize.sm,
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
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.primary,
  },
  timelineText: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  alertCard: {
    backgroundColor: Colors.warningLight,
  },
  alertText: {
    fontSize: Typography.fontSize.base,
    lineHeight: 20,
    color: Colors.warningDark,
  },
  statusHeadline: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  statusBody: {
    fontSize: Typography.fontSize.base,
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
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.extrabold,
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
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.extrabold,
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
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  bankPlaceholder: {
    color: Colors.textTertiary,
  },
  bankButtonArrow: {
    fontSize: Typography.fontSize.xl,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.bold,
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
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.surface,
  },
  submitHint: {
    marginTop: 10,
    fontSize: Typography.fontSize.sm,
    lineHeight: 18,
    color: Colors.error,
  },
});
