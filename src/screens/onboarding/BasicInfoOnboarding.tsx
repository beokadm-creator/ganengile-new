/**
 * Basic Info Onboarding Screen
 * 모든 사용자가 입력하는 최소 기본 정보
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useUser } from '../../contexts/UserContext';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { UserRole } from '../../types/user';

type Props = {
  navigation: any;
};

interface BasicInfo {
  name: string;
  phoneNumber: string;
}

interface TermsAgreement {
  service: boolean;
  privacy: boolean;
  marketing: boolean; // 선택
}

export default function BasicInfoOnboarding({ navigation }: Props) {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [basicInfo, setBasicInfo] = useState<BasicInfo>({
    name: user?.name || '',
    phoneNumber: '',
  });

  const [termsAgreed, setTermsAgreed] = useState<TermsAgreement>({
    service: false,
    privacy: false,
    marketing: false,
  });

  const validateStep1 = (): boolean => {
    if (!basicInfo.name.trim()) {
      Alert.alert('입력 오류', '이름을 입력해주세요.');
      return false;
    }

    if (!basicInfo.phoneNumber.trim()) {
      Alert.alert('입력 오류', '연락처를 입력해주세요.');
      return false;
    }

    // 간단한 전화번호 형식 검사
    const phoneRegex = /^010[0-9]{8}$/;
    if (!phoneRegex.test(basicInfo.phoneNumber.replace(/-/g, ''))) {
      Alert.alert('입력 오류', '올바른 전화번호 형식이 아닙니다.\n010-0000-0000');
      return false;
    }

    return true;
  };

  const validateStep2 = (): boolean => {
    if (!termsAgreed.service) {
      Alert.alert('필수 동의', '서비스 이용약관에 동의해주세요.');
      return false;
    }

    if (!termsAgreed.privacy) {
      Alert.alert('필수 동의', '개인정보 처리방침에 동의해주세요.');
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;

    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!user?.uid) {
      Alert.alert('오류', '사용자 정보를 찾을 수 없습니다.');
      return;
    }

    setLoading(true);

    try {
      console.log('🎯 Saving basic user info...');

      // Firestore에 기본 정보 저장
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        name: basicInfo.name.trim(),
        phoneNumber: basicInfo.phoneNumber.trim(),
        role: UserRole.GLER, // 모든 신규 가입자는 이용자로 시작
        agreedTerms: {
          service: termsAgreed.service,
          privacy: termsAgreed.privacy,
          marketing: termsAgreed.marketing,
        },
        hasCompletedOnboarding: false,
        isActive: true,
        pointBalance: 0,
        totalEarnedPoints: 0,
        totalSpentPoints: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      console.log('✅ Basic info saved to Firestore');

      // 서비스 소개 온보딩으로 이동
      navigation.navigate('GllerOnboarding');
      console.log('✅ Navigated to GllerOnboarding');
    } catch (error) {
      console.error('❌ Error saving basic info:', error);
      Alert.alert('오류', '기본 정보 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>기본 정보 입력</Text>
      <Text style={styles.stepDescription}>
        서비스 이용을 위해 최소한의 정보를 입력해주세요
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>이름 *</Text>
        <TextInput
          style={styles.input}
          placeholder="홍길동"
          value={basicInfo.name}
          onChangeText={(text) => setBasicInfo({ ...basicInfo, name: text })}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>연락처 *</Text>
        <View style={styles.phoneContainer}>
          <Text style={styles.phonePrefix}>010</Text>
          <Text style={styles.phoneDash}>-</Text>
          <TextInput
            style={styles.phoneInput}
            placeholder="0000"
            value={basicInfo.phoneNumber.split('-')[1] || ''}
            onChangeText={(text) => {
              const parts = basicInfo.phoneNumber.split('-');
              const newPhone = `010-${text}-${parts[2] || ''}`;
              setBasicInfo({ ...basicInfo, phoneNumber: newPhone });
            }}
            keyboardType="number-pad"
            maxLength={4}
          />
          <Text style={styles.phoneDash}>-</Text>
          <TextInput
            style={styles.phoneInput}
            placeholder="0000"
            value={basicInfo.phoneNumber.split('-')[2] || ''}
            onChangeText={(text) => {
              const parts = basicInfo.phoneNumber.split('-');
              const newPhone = `010-${parts[1] || ''}-${text}`;
              setBasicInfo({ ...basicInfo, phoneNumber: newPhone });
            }}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
        <Text style={styles.helperText}>
          배송 연락용으로 사용됩니다
        </Text>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>약관 동의</Text>
      <Text style={styles.stepDescription}>
        서비스 이용을 위해 약관에 동의해주세요
      </Text>

      <ScrollView style={styles.termsContainer}>
        <TouchableOpacity
          style={styles.termsItem}
          onPress={() =>
            setTermsAgreed({ ...termsAgreed, service: !termsAgreed.service })
          }
        >
          <View style={[styles.checkbox, termsAgreed.service && styles.checkboxChecked]}>
            {termsAgreed.service && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.termsContent}>
            <Text style={styles.termsTitle}>서비스 이용약관 동의 (필수)</Text>
            <Text style={styles.termsPreview}>
              가는길에 서비스 이용약관에 동의합니다
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.termsItem}
          onPress={() =>
            setTermsAgreed({ ...termsAgreed, privacy: !termsAgreed.privacy })
          }
        >
          <View style={[styles.checkbox, termsAgreed.privacy && styles.checkboxChecked]}>
            {termsAgreed.privacy && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.termsContent}>
            <Text style={styles.termsTitle}>개인정보 처리방침 동의 (필수)</Text>
            <Text style={styles.termsPreview}>
              개인정보 수집 및 이용에 동의합니다
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.termsItem}
          onPress={() =>
            setTermsAgreed({ ...termsAgreed, marketing: !termsAgreed.marketing })
          }
        >
          <View style={[styles.checkbox, termsAgreed.marketing && styles.checkboxChecked]}>
            {termsAgreed.marketing && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.termsContent}>
            <Text style={styles.termsTitle}>마케팅 정보 수신 동의 (선택)</Text>
            <Text style={styles.termsPreview}>
              할인 혜택과 이벤트 정보를 받아보세요
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>가는길에 시작하기</Text>
        <Text style={styles.headerSubtitle}>
          {currentStep}/2 단계
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View
          style={[styles.progressBar, { width: `${(currentStep / 2) * 100}%` }]}
        />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, loading && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextButtonText}>
              {currentStep === 2 ? '시작하기' : '다음'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#999',
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#f0f0f0',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#9C27B0',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  stepContainer: {
    paddingBottom: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  stepDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  phonePrefix: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  phoneDash: {
    fontSize: 16,
    color: '#999',
    marginHorizontal: 4,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  termsContainer: {
    maxHeight: 400,
  },
  termsItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#9C27B0',
    borderColor: '#9C27B0',
  },
  checkmark: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  termsContent: {
    flex: 1,
  },
  termsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  termsPreview: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  nextButton: {
    backgroundColor: '#9C27B0',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});