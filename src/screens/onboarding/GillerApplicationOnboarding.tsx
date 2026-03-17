/**
 * Giller Application Onboarding Screen
 * 길러 신청을 위한 추가 정보 입력 및 PASS 인증
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
  ScrollView,
} from 'react-native';
import { useUser } from '../../contexts/UserContext';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from '../../services/firebase';
import { PASS_TEST_MODE } from '../../config/feature-flags';

type Props = {
  navigation: any;
};

interface GillerInfo {
  activeDays: {
    weekdays: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  activeTime: 'morning' | 'evening' | 'both';
  bankAccount: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
}

interface PassAuthData {
  ci: string; // 연계정보 (암호화)
  name: string;
  birthday: string;
}

export default function GillerApplicationOnboarding({ navigation }: Props) {
  const { user, refreshUser } = useUser();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [testMode, setTestMode] = useState(PASS_TEST_MODE); // 테스트 모드

  const [phone, setPhone] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [selfIntroduction, setSelfIntroduction] = useState('');

  const [gillerInfo, setGillerInfo] = useState<GillerInfo>({
    activeDays: {
      weekdays: true,
      saturday: false,
      sunday: false,
    },
    activeTime: 'both',
    bankAccount: {
      bankName: '',
      accountNumber: '',
      accountHolder: user?.name || '',
    },
  });

  const [passAuthData, setPassAuthData] = useState<PassAuthData>({
    ci: '',
    name: user?.name || '',
    birthday: '',
  });

  const handleDayToggle = (day: keyof GillerInfo['activeDays']) => {
    setGillerInfo({
      ...gillerInfo,
      activeDays: {
        ...gillerInfo.activeDays,
        [day]: !gillerInfo.activeDays[day],
      },
    });
  };

  const validateStep1 = (): boolean => {
    if (!phone.trim()) {
      Alert.alert('입력 오류', '연락처를 입력해주세요.');
      return false;
    }
    if (!routeDescription.trim()) {
      Alert.alert('입력 오류', '주로 이용하는 노선을 입력해주세요.');
      return false;
    }
    const hasActiveDay = Object.values(gillerInfo.activeDays).some(Boolean);
    if (!hasActiveDay) {
      Alert.alert('입력 오류', '활동 가능한 요일을 하나 이상 선택해주세요.');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!gillerInfo.bankAccount.bankName.trim()) {
      Alert.alert('입력 오류', '은행을 선택해주세요.');
      return false;
    }

    if (!gillerInfo.bankAccount.accountNumber.trim()) {
      Alert.alert('입력 오류', '계좌번호를 입력해주세요.');
      return false;
    }

    if (gillerInfo.bankAccount.accountNumber.length < 10) {
      Alert.alert('입력 오류', '올바른 계좌번호를 입력해주세요.');
      return false;
    }

    return true;
  };

  const validateStep3 = (): boolean => {
    if (testMode) {
      // 테스트 모드: 더미 데이터 자동 생성
      setPassAuthData({
        ci: 'TEST_CI_' + Date.now(),
        name: user?.name || '테스트',
        birthday: '19900101',
      });
      return true;
    }

    if (!passAuthData.name.trim()) {
      Alert.alert('입력 오류', '이름을 입력해주세요.');
      return false;
    }

    if (!passAuthData.birthday.trim()) {
      Alert.alert('입력 오류', '생년월일을 입력해주세요.');
      return false;
    }

    // 생년월일 형식 검사 (YYYYMMDD)
    const birthdayRegex = /^\d{8}$/;
    if (!birthdayRegex.test(passAuthData.birthday)) {
      Alert.alert('입력 오류', '올바른 생년월일 형식이 아닙니다.\n예: 19900101');
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;

    if (currentStep < 3) {
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

    setSubmitError('');
    setLoading(true);

    try {
      // 1. giller_applications 컬렉션에 신청서 저장 (관리자 심사 대기)
      await addDoc(collection(db, 'giller_applications'), {
        userId: user.uid,
        userName: user.name,
        phone: phone.trim(),
        routeDescription: routeDescription.trim(),
        selfIntroduction: selfIntroduction.trim(),
        activeDays: gillerInfo.activeDays,
        activeTime: gillerInfo.activeTime,
        passAuthData: {
          ci: passAuthData.ci,
          name: passAuthData.name,
          birthday: passAuthData.birthday,
        },
        bankAccount: gillerInfo.bankAccount,
        verificationStatus: testMode ? 'approved' : 'not_submitted',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // 2. 사용자 계정에 신청 중 상태 + 계좌 정보 저장 (role은 관리자 승인 후 변경됨)
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        gillerApplicationStatus: 'pending',
        gillerInfo: {
          activeDays: gillerInfo.activeDays,
          activeTime: gillerInfo.activeTime,
          bankAccount: gillerInfo.bankAccount,
        },
        hasCompletedOnboarding: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await refreshUser();

      Alert.alert(
        '신청 완료',
        '길러 신청이 접수되었습니다.\n\n관리자 심사 후 승인 결과를 알려드립니다.',
        [{ text: '확인', onPress: () => navigation.replace('Main') }]
      );
    } catch (error) {
      console.error('❌ Error processing Giller application:', error);
      const firebaseMessage =
        error instanceof FirebaseError ? `${error.code}: ${error.message}` : null;
      setSubmitError(firebaseMessage || '신청 처리에 실패했습니다. 잠시 후 다시 시도해주세요.');
      Alert.alert('오류', '길러 신청 처리에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>기본 정보 입력</Text>
      <Text style={styles.stepDescription}>
        연락처와 주로 이용하는 노선을 입력해주세요.
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>연락처 *</Text>
        <TextInput
          style={styles.input}
          placeholder="010-0000-0000"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>주 이용 노선 *</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 2호선 강남역 ↔ 홍대입구역"
          value={routeDescription}
          onChangeText={setRouteDescription}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>자기소개 (선택)</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          placeholder="간단한 자기소개를 입력해주세요."
          value={selfIntroduction}
          onChangeText={setSelfIntroduction}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>활동 요일</Text>
        <View style={styles.dayContainer}>
          <TouchableOpacity
            style={[styles.dayButton, gillerInfo.activeDays.weekdays && styles.dayButtonSelected]}
            onPress={() => handleDayToggle('weekdays')}
          >
            <Text style={[styles.dayText, gillerInfo.activeDays.weekdays && styles.dayTextSelected]}>
              평일
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dayButton, gillerInfo.activeDays.saturday && styles.dayButtonSelected]}
            onPress={() => handleDayToggle('saturday')}
          >
            <Text style={[styles.dayText, gillerInfo.activeDays.saturday && styles.dayTextSelected]}>
              토요일
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dayButton, gillerInfo.activeDays.sunday && styles.dayButtonSelected]}
            onPress={() => handleDayToggle('sunday')}
          >
            <Text style={[styles.dayText, gillerInfo.activeDays.sunday && styles.dayTextSelected]}>
              일요일
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>활동 시간대</Text>
        <View style={styles.timeContainer}>
          <TouchableOpacity
            style={[styles.timeButton, gillerInfo.activeTime === 'morning' && styles.timeButtonSelected]}
            onPress={() => setGillerInfo({ ...gillerInfo, activeTime: 'morning' })}
          >
            <Text style={styles.timeEmoji}>🌅</Text>
            <Text style={styles.timeTitle}>출근길</Text>
            <Text style={styles.timeDescription}>아침 시간대</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timeButton, gillerInfo.activeTime === 'evening' && styles.timeButtonSelected]}
            onPress={() => setGillerInfo({ ...gillerInfo, activeTime: 'evening' })}
          >
            <Text style={styles.timeEmoji}>🌇</Text>
            <Text style={styles.timeTitle}>퇴근길</Text>
            <Text style={styles.timeDescription}>저녁 시간대</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timeButton, gillerInfo.activeTime === 'both' && styles.timeButtonSelected]}
            onPress={() => setGillerInfo({ ...gillerInfo, activeTime: 'both' })}
          >
            <Text style={styles.timeEmoji}>🔄</Text>
            <Text style={styles.timeTitle}>둘 다</Text>
            <Text style={styles.timeDescription}>하루 종일</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>계좌 정보 입력</Text>
      <Text style={styles.stepDescription}>
        수익 정산을 위한 계좌 정보를 입력해주세요
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>은행 *</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 카카오뱅크, 국민은행"
          value={gillerInfo.bankAccount.bankName}
          onChangeText={(text) =>
            setGillerInfo({
              ...gillerInfo,
              bankAccount: { ...gillerInfo.bankAccount, bankName: text },
            })
          }
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>계좌번호 *</Text>
        <TextInput
          style={styles.input}
          placeholder="숫자만 입력"
          value={gillerInfo.bankAccount.accountNumber}
          onChangeText={(text) =>
            setGillerInfo({
              ...gillerInfo,
              bankAccount: { ...gillerInfo.bankAccount, accountNumber: text },
            })
          }
          keyboardType="number-pad"
          maxLength={14}
        />
        <Text style={styles.helperText}>
          계좌번호는 안전하게 암호화되어 저장됩니다
        </Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>예금주 *</Text>
        <TextInput
          style={styles.input}
          placeholder="홍길동"
          value={gillerInfo.bankAccount.accountHolder}
          onChangeText={(text) =>
            setGillerInfo({
              ...gillerInfo,
              bankAccount: { ...gillerInfo.bankAccount, accountHolder: text },
            })
          }
        />
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>신원 확인</Text>
      <Text style={styles.stepDescription}>
        안전한 배송 서비스를 위해 신원 확인이 필요합니다
      </Text>

      {/* 테스트 모드 토글 */}
      <View style={styles.testModeContainer}>
        <TouchableOpacity
          style={[styles.testModeButton, testMode && styles.testModeButtonActive]}
          onPress={() => setTestMode(!testMode)}
        >
          <Text style={[styles.testModeText, testMode && styles.testModeTextActive]}>
            {testMode ? '🧪 테스트 모드 활성화' : '🧪 테스트 모드'}
          </Text>
        </TouchableOpacity>
        {testMode && (
          <Text style={styles.testModeDescription}>
            테스트 모드에서는 실제 PASS 인증 없이 진행됩니다
          </Text>
        )}
      </View>

      {!testMode && (
        <>
          <View style={styles.formGroup}>
            <Text style={styles.label}>이름 *</Text>
            <TextInput
              style={styles.input}
              placeholder="실명 확인"
              value={passAuthData.name}
              onChangeText={(text) =>
                setPassAuthData({ ...passAuthData, name: text })
              }
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>생년월일 *</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYYMMDD (예: 19900101)"
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
            onPress={() => {
              // 실제 PASS 인증 연동 (나중에 구현)
              Alert.alert(
                'PASS 인증',
                'PASS 본인확인 기능이 곧 구현될 예정입니다.\n지금은 테스트 모드를 사용해주세요.'
              );
            }}
          >
            <Text style={styles.passButtonText}>📱 PASS 본인확인하기</Text>
          </TouchableOpacity>
        </>
      )}

      {testMode && (
        <View style={styles.testModeInfo}>
          <Text style={styles.testModeInfoTitle}>테스트 모드</Text>
          <Text style={styles.testModeInfoText}>
            • 더미 CI 정보가 자동 생성됩니다{'\n'}
            • 길러 자격이 바로 부여됩니다{'\n'}
            • 실제 배송 활동이 가능합니다
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← 이전</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>길러 신청하기</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View
          style={[styles.progressBar, { width: `${(currentStep / 3) * 100}%` }]}
        />
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
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
              {currentStep === 3 ? '길러 신청 완료' : '다음'}
            </Text>
          )}
        </TouchableOpacity>
        {!!submitError && <Text style={styles.submitErrorText}>{submitError}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    fontSize: 16,
    color: '#9C27B0',
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
    backgroundColor: '#4CAF50',
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  dayContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dayButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  dayButtonSelected: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  dayText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  dayTextSelected: {
    color: '#4CAF50',
  },
  timeContainer: {
    gap: 12,
  },
  timeButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  timeButtonSelected: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  timeEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  timeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  timeDescription: {
    fontSize: 14,
    color: '#666',
  },
  testModeContainer: {
    marginBottom: 24,
  },
  testModeButton: {
    backgroundColor: '#fff3cd',
    borderWidth: 2,
    borderColor: '#ffc107',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
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
  testModeDescription: {
    fontSize: 12,
    color: '#ff9800',
    marginTop: 8,
    textAlign: 'center',
  },
  testModeInfo: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
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
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  nextButton: {
    backgroundColor: '#4CAF50',
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
  submitErrorText: {
    marginTop: 10,
    fontSize: 12,
    color: '#C62828',
    textAlign: 'center',
  },
});
