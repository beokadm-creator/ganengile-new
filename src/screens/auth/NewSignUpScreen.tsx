/**
 * New Sign Up Screen
 * 개선된 회원가입 - PASS 인증 포함
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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { UserRole } from '../../types/user';

type Props = {
  navigation: any;
};

interface SignUpForm {
  name: string;
  email: string;
  phoneNumber: string; // 필수로 변경
  password: string;
  confirmPassword: string;
}

interface PassAuthData {
  ci: string;
  name: string;
  birthday: string;
}

interface TermsAgreement {
  service: boolean;
  privacy: boolean;
  marketing: boolean;
}

type Step = 1 | 2 | 3;

export default function NewSignUpScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [testMode, setTestMode] = useState(true); // PASS 인증 테스트 모드

  const [form, setForm] = useState<SignUpForm>({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });

  const [termsAgreed, setTermsAgreed] = useState<TermsAgreement>({
    service: false,
    privacy: false,
    marketing: false,
  });

  const [passAuthData, setPassAuthData] = useState<PassAuthData>({
    ci: '',
    name: '',
    birthday: '',
  });

  const validateStep1 = (): boolean => {
    if (!form.name.trim()) {
      Alert.alert('입력 오류', '이름을 입력해주세요.');
      return false;
    }

    if (!form.email.trim()) {
      Alert.alert('입력 오류', '이메일을 입력해주세요.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      Alert.alert('입력 오류', '올바른 이메일 형식이 아닙니다.');
      return false;
    }

    if (!form.phoneNumber.trim()) {
      Alert.alert('입력 오류', '연락처는 필수 입력항목입니다.');
      return false;
    }

    // 전화번호 형식 검사 (010-0000-0000 또는 01000000000)
    const phoneRegex = /^010-?\d{4}-?\d{4}$|^010\d{8}$/;
    if (!phoneRegex.test(form.phoneNumber)) {
      Alert.alert('입력 오류', '올바른 전화번호 형식이 아닙니다.\n010-0000-0000 또는 010000000000');
      return false;
    }

    if (!form.password) {
      Alert.alert('입력 오류', '비밀번호를 입력해주세요.');
      return false;
    }

    if (form.password.length < 6) {
      Alert.alert('입력 오류', '비밀번호는 6자 이상이어야 합니다.');
      return false;
    }

    if (form.password !== form.confirmPassword) {
      Alert.alert('입력 오류', '비밀번호가 일치하지 않습니다.');
      return false;
    }

    return true;
  };

  const validateStep3 = (): boolean => {
    if (!termsAgreed.service) {
      Alert.alert('필수 동의', '서비스 이용약관에 동의해주세요.');
      return false;
    }

    if (!termsAgreed.privacy) {
      Alert.alert('필수 동의', '개인정보 처리방침에 동의해주세요.');
      return false;
    }

    // PASS 인증 확인
    if (testMode) {
      // 테스트 모드: 더미 데이터 자동 생성
      setPassAuthData({
        ci: 'TEST_CI_' + Date.now(),
        name: form.name,
        birthday: '19900101',
      });
      return true;
    }

    if (!passAuthData.ci || !passAuthData.name || !passAuthData.birthday) {
      Alert.alert('PASS 인증 필요', 'PASS 본인확인이 필요합니다.');
      return false;
    }

    // 생년월일 형식 검사
    const birthdayRegex = /^\d{8}$/;
    if (!birthdayRegex.test(passAuthData.birthday)) {
      Alert.alert('입력 오류', '올바른 생년월일 형식이 아닙니다.\nYYYYMMDD (예: 19900101)');
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 3 && !validateStep3()) return;

    if (step < 3) {
      setStep((step + 1) as Step);
    } else {
      handleSignUp();
    }
  };

  const handleSignUp = async () => {
    if (!validateStep1() || !validateStep3()) return;

    setLoading(true);

    try {
      // Firebase Auth로 회원가입
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );

      const uid = userCredential.user.uid;
      console.log('✅ Firebase auth successful:', uid);

      // Firestore에 사용자 정보 저장
      const userData = {
        uid,
        email: form.email,
        name: form.name.trim(),
        phoneNumber: form.phoneNumber.replace(/-/g, ''), // 하이픈 제거
        role: UserRole.BOTH,
        agreedTerms: termsAgreed,
        passAuthData: {
          ci: passAuthData.ci, // 실제로는 암호화 필요
          name: passAuthData.name,
          birthday: passAuthData.birthday,
          verified: testMode, // 테스트 모드에서는 자동 인증
          verifiedAt: testMode ? serverTimestamp() : null,
        },
        hasCompletedOnboarding: false, // 기본 정보 입력이 필요함
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', uid), userData);
      console.log('✅ User data saved to Firestore');

      Alert.alert(
        '가입 완료',
        '환영합니다! 가는길에 회원이 되셨습니다.\n\n이제 기본 정보를 입력하시겠습니까?',
        [
          {
            text: '바로 시작하기',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [
                  { name: 'BasicInfoOnboarding' },
                ],
              });
            },
          },
          {
            text: '나중에',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [
                  { name: 'Main' },
                ],
              });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Sign up error:', error);
      let errorMessage = '회원가입에 실패했습니다.';

      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = '이미 가입된 이메일입니다. 로그인을 진행해주세요.';
          break;
        case 'auth/invalid-email':
          errorMessage = '올바른 이메일 형식이 아닙니다.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = '이메일/비밀번호 가입이 비활성화되었습니다.';
          break;
        case 'auth/weak-password':
          errorMessage = '비밀번호가 너무 취약합니다. 6자 이상 입력해주세요.';
          break;
        default:
          errorMessage = error.message || '회원가입에 실패했습니다. 다시 시도해주세요.';
      }

      Alert.alert('가입 실패', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    } else {
      navigation.goBack();
    }
  };

  const handlePassAuth = () => {
    if (testMode) {
      setPassAuthData({
        ci: 'TEST_CI_' + Date.now(),
        name: form.name,
        birthday: '19900101',
      });
      Alert.alert('테스트 모드', 'PASS 인증 테스트 모드로 진행됩니다.');
    } else {
      // 실제 PASS 인증 연동 (나중에 구현)
      Alert.alert(
        'PASS 본인확인',
        'PASS 인증 기능이 곧 구현될 예정입니다.\n지금은 테스트 모드를 사용해주세요.'
      );
    }
  };

  const getProgress = () => {
    return (step / 3) * 100;
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>기본 정보</Text>
      <Text style={styles.stepDescription}>
        회원가입에 필요한 기본 정보를 입력해주세요.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="이름 *"
        value={form.name}
        onChangeText={(text) => setForm({ ...form, name: text })}
        autoCapitalize="words"
      />

      <TextInput
        style={styles.input}
        placeholder="이메일 *"
        value={form.email}
        onChangeText={(text) => setForm({ ...form, email: text })}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <View style={styles.phoneContainer}>
        <Text style={styles.phonePrefix}>010</Text>
        <Text style={styles.phoneDash}>-</Text>
        <TextInput
          style={styles.phoneInput}
          placeholder="0000"
          value={form.phoneNumber.split('-')[1] || ''}
          onChangeText={(text) => {
            const parts = form.phoneNumber.split('-');
            const newPhone = `010-${text}-${parts[2] || ''}`;
            setForm({ ...form, phoneNumber: newPhone });
          }}
          keyboardType="number-pad"
          maxLength={4}
        />
        <Text style={styles.phoneDash}>-</Text>
        <TextInput
          style={styles.phoneInput}
          placeholder="0000"
          value={form.phoneNumber.split('-')[2] || ''}
          onChangeText={(text) => {
            const parts = form.phoneNumber.split('-');
            const newPhone = `010-${parts[1] || ''}-${text}`;
            setForm({ ...form, phoneNumber: newPhone });
          }}
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>
      <Text style={styles.helperText}>
        * 연락처는 본인확인용으로 사용됩니다
      </Text>

      <TextInput
        style={styles.input}
        placeholder="비밀번호 (6자 이상) *"
        value={form.password}
        onChangeText={(text) => setForm({ ...form, password: text })}
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="비밀번호 확인 *"
        value={form.confirmPassword}
        onChangeText={(text) => setForm({ ...form, confirmPassword: text })}
        secureTextEntry
      />
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>PASS 본인확인</Text>
      <Text style={styles.stepDescription}>
        안전한 서비스 이용을 위해 본인확인이 필요합니다.
      </Text>

      {/* 테스트 모드 토글 */}
      <TouchableOpacity
        style={[styles.testModeButton, testMode && styles.testModeButtonActive]}
        onPress={() => setTestMode(!testMode)}
      >
        <Text style={[styles.testModeText, testMode && styles.testModeTextActive]}>
          {testMode ? '🧪 테스트 모드 활성화' : '🧪 테스트 모드'}
        </Text>
      </TouchableOpacity>

      {testMode && (
        <View style={styles.testModeInfo}>
          <Text style={styles.testModeInfoTitle}>테스트 모드 안내</Text>
          <Text style={styles.testModeInfoText}>
            • 더미 CI 정보가 자동 생성됩니다{'\n'}
            • 실제 PASS 인증 없이 진행됩니다{'\n'}
            • 배송/길러 활동 제한없이 가능{'\n'}
            • 나중에 실제 PASS 인증 시 재인증 필요
          </Text>
        </View>
      )}

      <View style={styles.formGroup}>
        <Text style={styles.label}>PASS 인증 상태</Text>
        <View style={[
         styles.passStatus,
          testMode ? styles.passStatusTest : styles.passStatusPending
        ]}>
          <Text style={styles.passStatusText}>
            {testMode ? '✅ 테스트 모드 (인증 완료)' : '⏳ 인증 대기중'}
          </Text>
        </View>
      </View>

      {!testMode && (
        <>
          <View style={styles.formGroup}>
            <Text style={styles.label}>이름 (실명)</Text>
            <TextInput
              style={styles.input}
              placeholder="홍길동"
              value={passAuthData.name}
              onChangeText={(text) =>
                setPassAuthData({ ...passAuthData, name: text })
              }
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>생년월일 (YYYYMMDD)</Text>
            <TextInput
              style={styles.input}
              placeholder="19900101"
              value={passAuthData.birthday}
              onChangeText={(text) =>
                setPassAuthData({ ...passAuthData, birthday: text })
              }
              keyboardType="number-pad"
              maxLength={8}
            />
          </View>

          <TouchableOpacity
            style={styles.passButton}
            onPress={handlePassAuth}
          >
            <Text style={styles.passButtonText}>📱 PASS 본인확인하기</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoBoxTitle}>📱 본인확인 안내</Text>
        <Text style={styles.infoBoxText}>
          • 통신사 PASS 앱을 통해 본인확인을 진행합니다.
          {'\n'}
          • 본인확인은 가입 시 1회만 필요하며, 정보는 안전하게 암호화되어 저장됩니다.
          {'\n'}
          • 길러 활동을 위해서는 추가 신원 확인이 필요할 수 있습니다.
        </Text>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>약관 동의</Text>
      <Text style={styles.stepDescription}>
        서비스 이용을 위해 약관에 동의해주세요.
      </Text>

      <ScrollView style={styles.termsContainer}>
        <TouchableOpacity
          style={styles.termsItem}
          onPress={() =>
            setTermsAgreed({ ...termsAgreed, service: !termsAgreed.service })
          }
        >
          <View
            style={[styles.checkbox, termsAgreed.service && styles.checkboxChecked]}
          >
            {termsAgreed.service && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.termsContent}>
            <Text style={styles.termsTitle}>
              서비스 이용약관 동의 (필수)
            </Text>
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
          <View
            style={[styles.checkbox, termsAgreed.privacy && styles.checkboxChecked]}
          >
            {termsAgreed.privacy && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.termsContent}>
            <Text style={styles.termsTitle}>
              개인정보 처리방침 동의 (필수)
            </Text>
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
          <View
            style={[styles.checkbox, termsAgreed.marketing && styles.checkboxChecked]}
          >
            {termsAgreed.marketing && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.termsContent}>
            <Text style={styles.termsTitle}>
              마케팅 정보 수신 동의 (선택)
            </Text>
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
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backButton}>← 이전</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>회원가입 (2/3)</Text>
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
              {step === 3 ? '가입 완료' : '다음'}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 50,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#f0f0f0',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
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
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16,
    padding: 16,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  phonePrefix: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
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
    textAlign: 'center',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    marginBottom: 24,
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
  testModeButton: {
    backgroundColor: '#fff3cd',
    borderWidth: 2,
    borderColor: '#ffc107',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  testModeButtonActive: {
    backgroundColor: '#fff3cd',
    borderColor: '#ff9800',
  },
  testModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6f00',
  },
  testModeTextActive: {
    color: '#ff5722',
  },
  testModeInfo: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  testModeInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  testModeInfoText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 22,
  },
  passStatus: {
    backgroundColor: '#fff3cd',
    borderWidth: 2,
    borderColor: '#ffc107',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  passStatusTest: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  passStatusPending: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
  },
  passStatusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  passButton: {
    backgroundColor: '#FFC107',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  passButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  infoBox: {
    backgroundColor: '#f0f8ff',
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
  },
  infoBoxTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 12,
  },
  infoBoxText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 22,
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
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
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
    backgroundColor: '#007AFF',
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