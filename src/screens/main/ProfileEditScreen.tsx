import React, { useMemo, useState } from 'react';
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

import AppTopBar from '../../components/common/AppTopBar';
import { useUser } from '../../contexts/UserContext';
import { confirmPhoneOtp, requestPhoneOtp } from '../../services/otp-service';
import { updateUserProfile } from '../../services/user-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp } from '../../types/navigation';

function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '');
}

function formatPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export default function ProfileEditScreen({ navigation }: { navigation: MainStackNavigationProp }) {
  const { user, refreshUser } = useUser();
  const [name, setName] = useState(user?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(
    formatPhoneDigits(user?.phoneVerification?.phoneNumber ?? user?.phoneNumber ?? '')
  );
  const [otpSessionId, setOtpSessionId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpHintCode, setOtpHintCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [verifiedPhoneOverride, setVerifiedPhoneOverride] = useState<string | null>(null);

  const normalizedInputPhone = normalizePhoneNumber(phoneNumber);
  const normalizedVerifiedPhone = normalizePhoneNumber(
    verifiedPhoneOverride ?? user?.phoneVerification?.phoneNumber ?? ''
  );
  const phoneChanged = normalizedInputPhone !== normalizePhoneNumber(user?.phoneVerification?.phoneNumber ?? user?.phoneNumber ?? '');
  const isPhoneVerified =
    normalizedVerifiedPhone.length > 0 && normalizedInputPhone.length > 0 && normalizedVerifiedPhone === normalizedInputPhone;

  const helperText = useMemo(() => {
    if (!phoneChanged) {
      return '현재 인증된 번호를 유지합니다.';
    }
    if (isPhoneVerified) {
      return '새 번호 인증이 완료되었습니다.';
    }
    return '번호를 바꾸려면 이 화면에서 인증을 다시 완료해야 합니다.';
  }, [isPhoneVerified, phoneChanged]);

  async function handleRequestOtp() {
    if (!/^010\d{8}$/.test(normalizedInputPhone)) {
      Alert.alert('휴대폰 번호', '010으로 시작하는 올바른 번호를 입력해 주세요.');
      return;
    }

    setOtpSending(true);
    try {
      const result = await requestPhoneOtp(normalizedInputPhone);
      if (result.alreadyVerified) {
        setVerifiedPhoneOverride(normalizedInputPhone);
        Alert.alert('이미 인증된 번호입니다', '이 계정에서 이미 인증한 번호입니다.');
        return;
      }

      setOtpSessionId(result.sessionId);
      setOtpCode('');
      setOtpHintCode(result.testCode ?? null);
      Alert.alert(
        '인증번호를 보냈습니다',
        result.testCode ? `개발용 코드: ${result.testCode}` : `${result.maskedDestination} 번호로 전송했습니다.`
      );
    } catch (error) {
      Alert.alert('인증번호 전송 실패', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.');
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otpSessionId) {
      Alert.alert('인증번호 요청 필요', '먼저 인증번호를 요청해 주세요.');
      return;
    }

    if (!/^\d{6}$/.test(otpCode.trim())) {
      Alert.alert('인증번호', '인증번호 6자리를 입력해 주세요.');
      return;
    }

    setOtpVerifying(true);
    try {
      await confirmPhoneOtp({
        sessionId: otpSessionId,
        phoneNumber: normalizedInputPhone,
        code: otpCode,
      });
      setVerifiedPhoneOverride(normalizedInputPhone);
      setOtpSessionId(null);
      setOtpCode('');
      setOtpHintCode(null);
      await refreshUser();
      Alert.alert('인증 완료', '새 번호를 저장할 수 있습니다.');
    } catch (error) {
      Alert.alert('인증 실패', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.');
    } finally {
      setOtpVerifying(false);
    }
  }

  async function handleSave() {
    if (!user?.uid) {
      Alert.alert('사용자 정보 없음', '다시 로그인한 뒤 시도해 주세요.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('이름', '이름을 입력해 주세요.');
      return;
    }

    if (phoneChanged && !isPhoneVerified) {
      Alert.alert('휴대폰 인증 필요', '새 번호를 저장하려면 이 화면에서 인증을 완료해 주세요.');
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        name: name.trim(),
        phoneNumber: normalizedInputPhone,
      });
      await refreshUser();
      Alert.alert('저장됨', '프로필 정보를 업데이트했습니다.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppTopBar title="프로필 정보 변경" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>사용자 정보</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="이름"
            placeholderTextColor={Colors.gray400}
          />
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={(value) => {
              setPhoneNumber(formatPhoneDigits(value));
              setVerifiedPhoneOverride(null);
              setOtpSessionId(null);
              setOtpCode('');
              setOtpHintCode(null);
            }}
            keyboardType="phone-pad"
            placeholder="010-1234-5678"
            placeholderTextColor={Colors.gray400}
          />
          <Text style={styles.helper}>{helperText}</Text>
          {phoneChanged ? (
            <>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  placeholder="인증번호 6자리"
                  placeholderTextColor={Colors.gray400}
                />
                <TouchableOpacity style={[styles.secondaryButton, styles.inlineButton]} onPress={() => void handleRequestOtp()}>
                  {otpSending ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.secondaryButtonText}>인증번호</Text>}
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleVerifyOtp()} disabled={otpVerifying || !otpSessionId}>
                {otpVerifying ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.secondaryButtonText}>번호 인증 완료</Text>}
              </TouchableOpacity>
              {otpHintCode ? <Text style={styles.helper}>개발용 코드: {otpHintCode}</Text> : null}
            </>
          ) : null}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSave()} disabled={saving}>
          {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryButtonText}>저장하기</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: 10,
    ...Shadows.sm,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  input: {
    minHeight: 52,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
  },
  helper: {
    color: Colors.textSecondary,
    ...Typography.caption,
  },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  flexInput: { flex: 1 },
  inlineButton: { minWidth: 96, paddingHorizontal: 12 },
  primaryButton: {
    minHeight: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontWeight: '800',
  },
});
