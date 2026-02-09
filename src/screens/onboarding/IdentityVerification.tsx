/**
 * Identity Verification Screen
 * 길러 신원 확인 화면
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import type { OnboardingNavigationProp } from '../../types/navigation';
import { useUser } from '../../contexts/UserContext';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';
import Button from '../../components/common/Button';

type VerificationStep = 1 | 2 | 3;

export default function IdentityVerification() {
  const navigation = useNavigation<OnboardingNavigationProp>();
  const { completeOnboarding } = useUser();
  const [step, setStep] = useState<VerificationStep>(1);
  const [loading, setLoading] = useState(false);

  const [idCardType, setIdCardType] = useState<'resident' | 'driver' | 'passport'>('resident');
  const [idCardNumber, setIdCardNumber] = useState('');

  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  const handleNext = async () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (!idCardNumber) {
        Alert.alert('필수 정보', '신분증 번호를 입력해주세요.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!bankName || !accountNumber || !accountHolder) {
        Alert.alert('필수 정보', '모든 계좌 정보를 입력해주세요.');
        return;
      }
      await saveVerification();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as VerificationStep);
    } else {
      navigation.goBack();
    }
  };

  const saveVerification = async () => {
    setLoading(true);
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      await updateDoc(doc(db, 'users', userId), {
        isVerified: true,
        verificationInfo: {
          idCardType,
          idCardNumber: idCardNumber.substring(0, 3) + '******',
          bankName,
          accountNumber: accountNumber.substring(accountNumber.length - 4) + '****',
          accountHolder,
          verifiedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });

      Alert.alert(
        '신원 확인 완료',
        '신원 확인이 완료되었습니다. 이제 길러 활동을 시작할 수 있습니다!',
        [
          {
            text: '확인',
            onPress: async () => {
              await completeOnboarding();
              navigation.getParent()?.reset({
                index: 0,
                routes: [{ name: 'Main' }],
              });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Verification error:', error);
      Alert.alert('오류', error.message || '신원 확인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>신원 확인 안내</Text>
      <Text style={styles.stepDescription}>
        길러 활동을 위해 신원 확인이 필요합니다.
      </Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>📋 필요한 서류</Text>
        <Text style={styles.infoText}>• 신분증 (주민등록증/운전면허/여권)</Text>
        <Text style={styles.infoText}>• 계좌 정보 (수익 정산용)</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>⏱️ 소요 시간</Text>
        <Text style={styles.infoText}>약 3분</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>🔒 개인정보 보호</Text>
        <Text style={styles.infoText}>
          입력하신 정보는 신원 확인 목적으로만 사용되며,
          {'\n'}안전하게 보관됩니다.
        </Text>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>신분증 정보 입력</Text>
      <Text style={styles.stepDescription}>
        신분증 종류와 번호를 입력해주세요.
      </Text>

      <Text style={styles.label}>신분증 종류</Text>
      <View style={styles.typeContainer}>
        <TouchableOpacity
          style={[
            styles.typeButton,
            idCardType === 'resident' && styles.typeButtonSelected,
          ]}
          onPress={() => setIdCardType('resident')}
        >
          <Ionicons name="card-outline" size={32} color={idCardType === 'resident' ? Colors.primary : Colors.textSecondary} style={styles.typeIcon} />
          <Text
            style={[
              styles.typeText,
              idCardType === 'resident' && styles.typeTextSelected,
            ]}
          >
            주민등록증
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeButton,
            idCardType === 'driver' && styles.typeButtonSelected,
          ]}
          onPress={() => setIdCardType('driver')}
        >
          <Ionicons name="car-outline" size={32} color={idCardType === 'driver' ? Colors.primary : Colors.textSecondary} style={styles.typeIcon} />
          <Text
            style={[
              styles.typeText,
              idCardType === 'driver' && styles.typeTextSelected,
            ]}
          >
            운전면허증
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeButton,
            idCardType === 'passport' && styles.typeButtonSelected,
          ]}
          onPress={() => setIdCardType('passport')}
        >
          <Ionicons name="airplane-outline" size={32} color={idCardType === 'passport' ? Colors.primary : Colors.textSecondary} style={styles.typeIcon} />
          <Text
            style={[
              styles.typeText,
              idCardType === 'passport' && styles.typeTextSelected,
            ]}
          >
            여권
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>신분증 번호</Text>
      <TextInput
        style={styles.input}
        value={idCardNumber}
        onChangeText={setIdCardNumber}
        placeholder={
          idCardType === 'resident'
            ? '주민등록번호 (예: 9001011234567)'
            : idCardType === 'driver'
            ? '운전면허번호 (예: 12-34-567890)'
            : '여권번호 (예: M12345678)'
        }
        keyboardType="default"
        autoCapitalize="characters"
      />

      <View style={styles.uploadPlaceholder}>
        <Text style={styles.uploadIcon}>📷</Text>
        <Text style={styles.uploadText}>신분증 사진 업로드</Text>
        <Text style={styles.uploadSubtext}>
          (추후 구현 예정 - 현재는 번호로만 진행)
        </Text>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>계좌 정보 입력</Text>
      <Text style={styles.stepDescription}>
        수익 정산을 위한 계좌 정보를 입력해주세요.
      </Text>

      <Text style={styles.label}>은행명</Text>
      <TextInput
        style={styles.input}
        value={bankName}
        onChangeText={setBankName}
        placeholder="예: 국민은행, 신한은행"
      />

      <Text style={styles.label}>계좌번호</Text>
      <TextInput
        style={styles.input}
        value={accountNumber}
        onChangeText={setAccountNumber}
        placeholder="예: 1234567890123"
        keyboardType="number-pad"
      />

      <Text style={styles.label}>예금주</Text>
      <TextInput
        style={styles.input}
        value={accountHolder}
        onChangeText={setAccountHolder}
        placeholder="예금주 성명 입력"
      />

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>💡 계좌 정보 활용</Text>
        <Text style={styles.infoText}>
          • 배송 완료 후 수익이 입금됩니다.
          {'\n'}• 주 1회 정산 (매주 목요일)
          {'\n'}• 즉시 출금 기능도 지원 예정
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backButton}>
            {step === 1 ? '←' : '← 이전'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>신원 확인 ({step}/3)</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${(step / 3) * 100}%` }]} />
      </View>

      <ScrollView style={styles.content}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={step === 3 ? '신원 확인 완료' : '다음'}
          onPress={handleNext}
          variant="primary"
          size="large"
          fullWidth
          loading={loading}
          disabled={loading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    color: Colors.primary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  container: {
    backgroundColor: Colors.white,
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  footer: {
    borderTopColor: Colors.gray200,
    borderTopWidth: 1,
    padding: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: Colors.gray200,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  infoCard: {
    backgroundColor: Colors.gray50,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  infoTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.white,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: Typography.fontSize.base,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  placeholder: {
    width: 40,
  },
  progressBar: {
    backgroundColor: Colors.secondary,
    height: '100%',
  },
  progressContainer: {
    backgroundColor: Colors.gray200,
    height: 4,
  },
  stepContainer: {
    paddingBottom: Spacing.xl,
  },
  stepDescription: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
    marginBottom: Spacing.xl,
  },
  stepTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
  },
  typeButton: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    flex: 1,
    padding: Spacing.md,
  },
  typeButtonSelected: {
    backgroundColor: Colors.secondaryLight,
    borderColor: Colors.secondary,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  typeIcon: {
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  typeText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  typeTextSelected: {
    color: Colors.secondaryDark,
    fontWeight: Typography.fontWeight.semibold,
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  uploadPlaceholder: {
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.md,
    borderStyle: 'dashed',
    borderWidth: 2,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  uploadSubtext: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    marginTop: Spacing.xs,
  },
  uploadText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
});
