/**
 * B2B Onboarding Screen
 * B2B 계약 신청 화면
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { auth, db } from '../../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

interface FormData {
  companyName: string;
  registrationNumber: string;
  ceoName: string;
  contact: string;
  email: string;
  address: string;
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

  const validateRegistrationNumber = (number: string): boolean => {
    // 사업자등록번호 형식 검증 (000-00-00000)
    const regex = /^\d{3}-\d{2}-\d{5}$/;
    return regex.test(number);
  };

  const handleSubmit = async () => {
    // 유효성 검사
    if (!formData.companyName || !formData.registrationNumber || !formData.ceoName ||
        !formData.contact || !formData.email || !formData.address) {
      Alert.alert('입력 오류', '모든 필수 정보를 입력해주세요.');
      return;
    }

    if (!validateRegistrationNumber(formData.registrationNumber)) {
      Alert.alert('입력 오류', '사업자등록번호 형식이 올바르지 않습니다.\n예: 123-45-67890');
      return;
    }

    if (!agreed) {
      Alert.alert('약관 동의', 'B2B 이용약관에 동의해주세요.');
      return;
    }

    setLoading(true);

    try {
      // 현재 사용자 확인
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('로그인 필요', '로그인 후 이용해주세요.');
        setLoading(false);
        return;
      }

      const businessId = currentUser.uid;

      // B2B 계약 신청 데이터 생성
      const contractApplication = {
        businessId,
        companyName: formData.companyName,
        registrationNumber: formData.registrationNumber,
        ceoName: formData.ceoName,
        contact: formData.contact,
        email: formData.email,
        address: formData.address,
        status: 'pending',
        tier: 'basic',
        duration: {
          start: new Date(),
          end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1년
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
      };

      // Firestore에 저장
      await addDoc(collection(db, 'business_contracts'), contractApplication);

      Alert.alert(
        '신청 완료',
        'B2B 계약 신청이 완료되었습니다.\n영업일 기준 3일 이내 검토 후 승인됩니다.',
        [
          {
            text: '확인',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error creating B2B contract:', error);
      Alert.alert('신청 실패', '다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>B2B 계약 신청</Text>
          <Text style={styles.subtitle}>
            기업 고객을 위한 특별 혜택을 받으세요.
          </Text>
        </View>

        {/* Form Fields */}
        <View style={styles.form}>
          {/* 기업명 */}
          <View style={styles.field}>
            <Text style={styles.label}>기업명 *</Text>
            <TextInput
              style={styles.input}
              placeholder="(주)가는길에"
              value={formData.companyName}
              onChangeText={(value) => updateField('companyName', value)}
              autoCapitalize="words"
            />
          </View>

          {/* 사업자등록번호 */}
          <View style={styles.field}>
            <Text style={styles.label}>사업자등록번호 *</Text>
            <TextInput
              style={styles.input}
              placeholder="123-45-67890"
              value={formData.registrationNumber}
              onChangeText={(value) => updateField('registrationNumber', value)}
              keyboardType="number-pad"
              maxLength={12}
            />
            <Text style={styles.hint}>형식: 000-00-00000</Text>
          </View>

          {/* 대표자명 */}
          <View style={styles.field}>
            <Text style={styles.label}>대표자명 *</Text>
            <TextInput
              style={styles.input}
              placeholder="김OO"
              value={formData.ceoName}
              onChangeText={(value) => updateField('ceoName', value)}
              autoCapitalize="words"
            />
          </View>

          {/* 연락처 */}
          <View style={styles.field}>
            <Text style={styles.label}>담당자 연락처 *</Text>
            <TextInput
              style={styles.input}
              placeholder="010-1234-5678"
              value={formData.contact}
              onChangeText={(value) => updateField('contact', value)}
              keyboardType="phone-pad"
              maxLength={13}
            />
          </View>

          {/* 이메일 */}
          <View style={styles.field}>
            <Text style={styles.label}>담당자 이메일 *</Text>
            <TextInput
              style={styles.input}
              placeholder="contact@company.com"
              value={formData.email}
              onChangeText={(value) => updateField('email', value)}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* 주소 */}
          <View style={styles.field}>
            <Text style={styles.label}>사업장 주소 *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="서울특별시 OO구 OO로 123"
              value={formData.address}
              onChangeText={(value) => updateField('address', value)}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Terms Agreement */}
        <View style={styles.terms}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => setAgreed(!agreed)}
          >
            <View style={[styles.checkboxInner, agreed && styles.checkboxChecked]}>
              {agreed && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>
          <Text style={styles.termsText}>
            B2B 이용약관 및 개인정보 처리방침에 동의합니다.
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, (!agreed || loading) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!agreed || loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>신청하기</Text>
          )}
        </TouchableOpacity>

        {/* B2B Benefits */}
        <View style={styles.benefits}>
          <Text style={styles.benefitsTitle}>🎁 B2B 특별 혜택</Text>
          <Text style={styles.benefitItem}>✓ 월간 배송 요금 할인</Text>
          <Text style={styles.benefitItem}>✓ 세금계산서 자동 발행</Text>
          <Text style={styles.benefitItem}>✓ 전용 길러 매칭</Text>
          <Text style={styles.benefitItem}>✓ 월간 정산 및 보고서</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  content: {
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h1,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  form: {
    marginBottom: Spacing.lg,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.bodyBold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  input: {
    ...Typography.body,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text.primary,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  hint: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
  terms: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  checkbox: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  checkboxInner: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  termsText: {
    ...Typography.body,
    color: Colors.text.secondary,
    flex: 1,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.border,
  },
  submitButtonText: {
    ...Typography.bodyBold,
    color: Colors.white,
    fontSize: 18,
  },
  benefits: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  benefitsTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  benefitItem: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
});
