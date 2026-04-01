import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, requireUserId } from '../../services/firebase';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { B2BStackParamList } from '../../types/navigation';

type NavigationProp = StackNavigationProp<B2BStackParamList, 'B2BOnboarding'>;

type Props = {
  navigation: NavigationProp;
};

type FormData = {
  companyName: string;
  registrationNumber: string;
  ceoName: string;
  contact: string;
  email: string;
  address: string;
};

function isValidBusinessNumber(value: string): boolean {
  return /^\d{3}-\d{2}-\d{5}$/.test(value);
}

export default function B2BOnboardingScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    companyName: '',
    registrationNumber: '',
    ceoName: '',
    contact: '',
    email: '',
    address: '',
  });

  const updateField = (field: keyof FormData, value: string): void => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (): Promise<void> => {
    if (Object.values(formData).some((value) => !value.trim())) {
      Alert.alert('입력 확인', '필수 정보를 입력해 주세요.');
      return;
    }

    if (!isValidBusinessNumber(formData.registrationNumber)) {
      Alert.alert('입력 확인', '사업자번호 형식을 확인해 주세요.');
      return;
    }

    if (!agreed) {
      Alert.alert('동의 필요', '약관에 동의해 주세요.');
      return;
    }

    try {
      setLoading(true);
      const businessId = requireUserId();

      await addDoc(collection(db, 'business_contracts'), {
        businessId,
        companyName: formData.companyName.trim(),
        registrationNumber: formData.registrationNumber.trim(),
        ceoName: formData.ceoName.trim(),
        contact: formData.contact.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        status: 'pending',
        tier: 'basic',
        duration: {
          start: new Date(),
          end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          autoRenew: false,
        },
        deliverySettings: {
          dailyLimit: 100,
          priority: 'normal',
          preferredTimeSlots: ['09:00-18:00'],
        },
        billing: {
          method: 'invoice',
          paymentTerms: 30,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      Alert.alert('요청 완료', '계약 요청이 접수되었습니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Failed to create B2B contract request:', error);
      Alert.alert('요청 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>B2B 계약 요청</Text>
        <Text style={styles.subtitle}>기본 정보만 입력해 주세요.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>회사 정보</Text>
        <TextInput
          style={styles.input}
          placeholder="회사명"
          value={formData.companyName}
          onChangeText={(value) => updateField('companyName', value)}
        />
        <TextInput
          style={styles.input}
          placeholder="사업자등록번호 (123-45-67890)"
          value={formData.registrationNumber}
          onChangeText={(value) => updateField('registrationNumber', value)}
        />
        <TextInput
          style={styles.input}
          placeholder="대표자명"
          value={formData.ceoName}
          onChangeText={(value) => updateField('ceoName', value)}
        />
        <TextInput
          style={styles.input}
          placeholder="담당자 연락처"
          value={formData.contact}
          onChangeText={(value) => updateField('contact', value)}
        />
        <TextInput
          style={styles.input}
          placeholder="담당자 이메일"
          value={formData.email}
          onChangeText={(value) => updateField('email', value)}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="주소"
          value={formData.address}
          onChangeText={(value) => updateField('address', value)}
          multiline
        />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>안내</Text>
        <Text style={styles.infoText}>검토 후 계약 조건을 확정합니다.</Text>
      </View>

      <View style={styles.agreementRow}>
        <View style={styles.agreementText}>
          <Text style={styles.agreementTitle}>약관 및 정보 제공 동의</Text>
          <Text style={styles.agreementDescription}>검토에 필요한 정보만 사용합니다.</Text>
        </View>
        <Switch
          value={agreed}
          onValueChange={setAgreed}
          trackColor={{ false: Colors.border, true: Colors.textTertiary }}
          thumbColor=Colors.white
        />
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={() => void handleSubmit()} disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <Text style={styles.submitButtonText}>계약 요청하기</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  header: {
    gap: Spacing.sm,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: Typography.fontSize.sm,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  infoCard: {
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  infoTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
    color: Colors.warningDark,
  },
  infoText: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 21,
    color: Colors.warningDark,
  },
  agreementRow: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  agreementText: {
    flex: 1,
  },
  agreementTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  agreementDescription: {
    marginTop: 4,
    fontSize: Typography.fontSize.xs,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  submitButton: {
    minHeight: 54,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  submitButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
    color: Colors.white,
  },
});
