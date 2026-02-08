/**
 * Sign Up Screen - Multi-step Registration
 * 4단계 회원가입:
 * 1. 기본 정보
 * 2. 역할 선택
 * 3. 프로필 사진
 * 4. 약관 동의
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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { UserRole, RegistrationFormData, GILLER_TERMS, GLER_TERMS, PRIVACY_POLICY } from '../../types/user';

interface Props {
  navigation: any;
}

type Step = 1 | 2 | 3 | 4;

export default function SignUpScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);

  // 1단계: 기본 정보
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // 2단계: 역할 선택
  const [role, setRole] = useState<UserRole>(UserRole.BOTH);

  // 3단계: 프로필 사진 (추후 구현)
  // const [profilePhoto, setProfilePhoto] = useState<string | undefined>();

  // 4단계: 약관 동의
  const [agreedTerms, setAgreedTerms] = useState({
    giller: false,
    gller: false,
    privacy: false,
    marketing: false,
  });

  const validateStep1 = (): boolean => {
    if (!email || !password || !confirmPassword || !name) {
      Alert.alert('오류', '모든 필수 정보를 입력해주세요.');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('오류', '비밀번호가 일치하지 않습니다.');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('오류', '비밀번호는 6자 이상이어야 합니다.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('오류', '올바른 이메일 형식이 아닙니다.');
      return false;
    }

    return true;
  };

  const validateStep4 = (): boolean => {
    // 역할에 따라 필요한 약관 동의 확인
    if (role === UserRole.GILLER && !agreedTerms.giller) {
      Alert.alert('필수 동의', '길러 이용약관에 동의해주세요.');
      return false;
    }

    if (role === UserRole.GLER && !agreedTerms.gller) {
      Alert.alert('필수 동의', '이용자 이용약관에 동의해주세요.');
      return false;
    }

    if (role === UserRole.BOTH && (!agreedTerms.giller || !agreedTerms.gller)) {
      Alert.alert('필수 동의', '길러 및 이용자 이용약관에 모두 동의해주세요.');
      return false;
    }

    if (!agreedTerms.privacy) {
      Alert.alert('필수 동의', '개인정보 처리방침에 동의해주세요.');
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 4 && !validateStep4()) return;

    if (step < 4) {
      setStep((step + 1) as Step);
    } else {
      handleSignUp();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    } else {
      navigation.goBack();
    }
  };

  const handleSignUp = async () => {
    if (!validateStep1() || !validateStep4()) return;

    setLoading(true);

    try {
      // Firebase Auth로 회원가입
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const uid = userCredential.user.uid;

      // Firestore에 사용자 정보 저장
      const userData: Partial<RegistrationFormData> & {
        uid: string;
        createdAt: any;
        updatedAt: any;
        isActive: boolean;
        hasCompletedOnboarding: boolean;
      } = {
        uid,
        email,
        name,
        phoneNumber,
        role,
        agreedTerms,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true,
        hasCompletedOnboarding: false,
      };

      await setDoc(doc(db, 'users', uid), userData);

      Alert.alert(
        '가입 완료',
        '환영합니다! 가는길에 회원이 되셨습니다.\n\n이제 온보딩을 시작합니다.',
        [
          {
            text: '시작하기',
            onPress: () => navigation.replace('Auth'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Sign up error:', error);
      Alert.alert('가입 실패', error.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>기본 정보</Text>
      <Text style={styles.stepDescription}>회원가입에 필요한 기본 정보를 입력해주세요.</Text>

      <TextInput
        style={styles.input}
        placeholder="이름 *"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <TextInput
        style={styles.input}
        placeholder="이메일 *"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="연락처 (선택)"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
      />

      <TextInput
        style={styles.input}
        placeholder="비밀번호 (6자 이상) *"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="비밀번호 확인 *"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>역할 선택</Text>
      <Text style={styles.stepDescription}>서비스 이용 방식을 선택해주세요.</Text>

      <TouchableOpacity
        style={[
          styles.roleCard,
          role === UserRole.GLER && styles.roleCardSelected,
        ]}
        onPress={() => setRole(UserRole.GLER)}
      >
        <Text style={styles.roleTitle}>👤 이용자만</Text>
        <Text style={styles.roleDescription}>
          배송을 요청하고 싶으신 분
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.roleCard,
          role === UserRole.GILLER && styles.roleCardSelected,
        ]}
        onPress={() => setRole(UserRole.GILLER)}
      >
        <Text style={styles.roleTitle}>🚴 길러만</Text>
        <Text style={styles.roleDescription}>
          출퇴근길에 배송하고 싶으신 분
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.roleCard,
          role === UserRole.BOTH && styles.roleCardSelected,
        ]}
        onPress={() => setRole(UserRole.BOTH)}
      >
        <Text style={styles.roleTitle}>🔄 둘 다</Text>
        <Text style={styles.roleDescription}>
          배송도 하고 요청도 하고 싶으신 분
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>프로필 사진</Text>
      <Text style={styles.stepDescription}>
        프로필 사진을 등록하세요 (선택 사항)
      </Text>

      <View style={styles.photoPlaceholder}>
        <Text style={styles.photoIcon}>📷</Text>
        <Text style={styles.photoText}>
          카메라 또는 갤러리에서 선택
        </Text>
        <Text style={styles.photoSubtext}>
          (추후 구현 예정)
        </Text>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>약관 동의</Text>
      <Text style={styles.stepDescription}>
        선택하신 역할에 따라 약관 동의가 필요합니다.
      </Text>

      <ScrollView style={styles.termsContainer}>
        {/* 길러 약관 */}
        {(role === UserRole.GILLER || role === UserRole.BOTH) && (
          <View style={styles.termsSection}>
            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() =>
                  setAgreedTerms({ ...agreedTerms, giller: !agreedTerms.giller })
                }
              >
                <View
                  style={[
                    styles.checkboxInner,
                    agreedTerms.giller && styles.checkboxChecked,
                  ]}
                >
                  {agreedTerms.giller && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
              <Text style={styles.checkboxLabel}>길러 이용약관 동의 (필수)</Text>
            </View>
            <View style={styles.termsPreview}>
              <Text style={styles.termsText}>{GILLER_TERMS.content.slice(0, 200)}...</Text>
              <TouchableOpacity
                onPress={() => Alert.alert('길러 이용약관', GILLER_TERMS.content)}
              >
                <Text style={styles.termsLink}>전문 보기</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 이용자 약관 */}
        {(role === UserRole.GLER || role === UserRole.BOTH) && (
          <View style={styles.termsSection}>
            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() =>
                  setAgreedTerms({ ...agreedTerms, gller: !agreedTerms.gller })
                }
              >
                <View
                  style={[
                    styles.checkboxInner,
                    agreedTerms.gller && styles.checkboxChecked,
                  ]}
                >
                  {agreedTerms.gller && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
              <Text style={styles.checkboxLabel}>이용자 이용약관 동의 (필수)</Text>
            </View>
            <View style={styles.termsPreview}>
              <Text style={styles.termsText}>{GLER_TERMS.content.slice(0, 200)}...</Text>
              <TouchableOpacity
                onPress={() => Alert.alert('이용자 이용약관', GLER_TERMS.content)}
              >
                <Text style={styles.termsLink}>전문 보기</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 개인정보 처리방침 */}
        <View style={styles.termsSection}>
          <View style={styles.checkboxRow}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() =>
                setAgreedTerms({ ...agreedTerms, privacy: !agreedTerms.privacy })
              }
            >
              <View
                style={[
                  styles.checkboxInner,
                  agreedTerms.privacy && styles.checkboxChecked,
                ]}
              >
                {agreedTerms.privacy && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
            <Text style={styles.checkboxLabel}>개인정보 처리방침 동의 (필수)</Text>
          </View>
          <View style={styles.termsPreview}>
            <Text style={styles.termsText}>{PRIVACY_POLICY.content.slice(0, 200)}...</Text>
            <TouchableOpacity
              onPress={() => Alert.alert('개인정보 처리방침', PRIVACY_POLICY.content)}
            >
              <Text style={styles.termsLink}>전문 보기</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 마케팅 정보 수신 (선택) */}
        <View style={styles.termsSection}>
          <View style={styles.checkboxRow}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() =>
                setAgreedTerms({ ...agreedTerms, marketing: !agreedTerms.marketing })
              }
            >
              <View
                style={[
                  styles.checkboxInner,
                  agreedTerms.marketing && styles.checkboxChecked,
                ]}
              >
                {agreedTerms.marketing && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
            <Text style={styles.checkboxLabel}>마케팅 정보 수신 동의 (선택)</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const getProgress = () => {
    return (step / 4) * 100;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backButton}>{step === 1 ? '←' : '← 이전'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>회원가입 ({step}/4)</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${getProgress()}%` }]} />
      </View>

      {/* Step Content */}
      <ScrollView style={styles.content}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </ScrollView>

      {/* Next Button */}
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
              {step === 4 ? '가입 완료' : '다음'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    color: '#007AFF',
    fontSize: 16,
  },
  checkbox: {
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkboxInner: {
    alignItems: 'center',
    borderColor: '#ddd',
    borderRadius: 4,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12,
  },
  checkmark: {
    color: '#fff',
    fontWeight: 'bold',
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  footer: {
    borderTopColor: '#e0e0e0',
    borderTopWidth: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  input: {
    borderColor: '#ddd',
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 16,
    padding: 16,
  },
  nextButton: {
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  photoIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  photoPlaceholder: {
    alignItems: 'center',
    borderColor: '#ddd',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 2,
    justifyContent: 'center',
    padding: 60,
  },
  photoSubtext: {
    color: '#999',
    fontSize: 12,
    marginTop: 8,
  },
  photoText: {
    color: '#666',
    fontSize: 16,
  },
  placeholder: {
    width: 50,
  },
  progressBar: {
    backgroundColor: '#007AFF',
    height: '100%',
  },
  progressContainer: {
    backgroundColor: '#e0e0e0',
    height: 4,
  },
  roleCard: {
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
    padding: 20,
  },
  roleCardSelected: {
    backgroundColor: '#f0f8ff',
    borderColor: '#007AFF',
  },
  roleDescription: {
    color: '#666',
    fontSize: 14,
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stepContainer: {
    paddingBottom: 20,
  },
  stepDescription: {
    color: '#666',
    fontSize: 14,
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  termsContainer: {
    maxHeight: 400,
  },
  termsLink: {
    color: '#007AFF',
    fontSize: 12,
    marginTop: 8,
  },
  termsPreview: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginLeft: 36,
    padding: 12,
  },
  termsSection: {
    marginBottom: 20,
  },
  termsText: {
    color: '#666',
    fontSize: 12,
    lineHeight: 18,
  },
});
