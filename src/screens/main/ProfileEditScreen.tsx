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
import { BorderRadius, Colors, Shadows, Spacing } from '../../theme';
import { Typography } from '../../theme/typography';
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
  const { user, refreshUser, deactivateAccount } = useUser();
  const [name, setName] = useState(user?.name ?? '');
  const [email] = useState(user?.email ?? '');
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
  const [profileChangeVerified, setProfileChangeVerified] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const normalizedInputPhone = normalizePhoneNumber(phoneNumber);
  const normalizedCurrentPhone = normalizePhoneNumber(user?.phoneVerification?.phoneNumber ?? user?.phoneNumber ?? '');
  const normalizedVerifiedPhone = normalizePhoneNumber(
    verifiedPhoneOverride ?? user?.phoneVerification?.phoneNumber ?? ''
  );
  const phoneChanged = normalizedInputPhone !== normalizedCurrentPhone;
  const nameChanged = name.trim() !== (user?.name ?? '').trim();
  const hasChanges = nameChanged || phoneChanged;
  const isPhoneVerified =
    normalizedVerifiedPhone.length > 0 && normalizedInputPhone.length > 0 && normalizedVerifiedPhone === normalizedInputPhone;
  const canRequestOtpForChanges = normalizedInputPhone.length > 0 && /^010\d{8}$/.test(normalizedInputPhone);

  const helperText = useMemo(() => {
    if (!hasChanges) {
      return '수정할 내용을 바꾸면 인증 후 저장할 수 있습니다.';
    }
    if (profileChangeVerified) {
      return phoneChanged ? '새 번호 확인이 끝났습니다.' : '변경 확인이 끝났습니다.';
    }
    return phoneChanged
      ? '휴대폰 번호를 바꾸려면 새 번호 확인이 필요합니다.'
      : '이름이나 기타 정보를 바꿀 때도 본인 확인 후 저장합니다.';
  }, [hasChanges, phoneChanged, profileChangeVerified]);

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
        setProfileChangeVerified(true);
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
      setProfileChangeVerified(true);
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

    if (!hasChanges) {
      Alert.alert('변경 사항 없음', '수정한 내용이 없습니다.');
      return;
    }

    if (!profileChangeVerified || (phoneChanged && !isPhoneVerified)) {
      Alert.alert('변경 확인 필요', '정보를 저장하려면 이 화면에서 인증을 완료해 주세요.');
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

  function handleDeactivateAccount() {
    Alert.alert('회원 탈퇴', '탈퇴하면 계정이 비활성화되고 바로 로그아웃됩니다.', [
      { text: '닫기', style: 'cancel' },
      {
        text: '탈퇴 진행',
        style: 'destructive',
        onPress: () => {
          void confirmDeactivateAccount();
        },
      },
    ]);
  }

  async function confirmDeactivateAccount() {
    setDeactivating(true);
    try {
      await deactivateAccount('profile_edit_withdrawal');
    } catch (error) {
      Alert.alert('탈퇴 실패', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.');
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppTopBar title="프로필 정보 변경" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>사용자 정보</Text>
          <TextInput
            style={[styles.input, styles.readonlyInput]}
            value={email}
            editable={false}
            placeholder="이메일"
            placeholderTextColor={Colors.gray400}
          />
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(value) => {
              setName(value);
              setProfileChangeVerified(false);
            }}
            placeholder="이름"
            placeholderTextColor={Colors.gray400}
          />
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={(value) => {
              setPhoneNumber(formatPhoneDigits(value));
              setVerifiedPhoneOverride(null);
              setProfileChangeVerified(false);
              setOtpSessionId(null);
              setOtpCode('');
              setOtpHintCode(null);
            }}
            keyboardType="phone-pad"
            placeholder="010-1234-5678"
            placeholderTextColor={Colors.gray400}
          />
          <Text style={styles.helper}>{helperText}</Text>
          {hasChanges ? (
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
                <TouchableOpacity
                  style={[styles.secondaryButton, styles.inlineButton]}
                  onPress={() => void handleRequestOtp()}
                  disabled={otpSending || !canRequestOtpForChanges}
                >
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

        <View style={styles.card}>
          <Text style={styles.title}>기본 정보 바로가기</Text>
          <Text style={styles.helper}>
            자주 쓰는 주소와 기본주소는 주소록에서 관리합니다.
          </Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('AddressBook')}>
            <Text style={styles.secondaryButtonText}>주소록 관리</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSave()} disabled={saving}>
          {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryButtonText}>저장하기</Text>}
        </TouchableOpacity>

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>계정 정리</Text>
          <Text style={styles.dangerBody}>필요할 때만 탈퇴할 수 있습니다. 탈퇴는 이 화면에서만 진행됩니다.</Text>
          <TouchableOpacity style={styles.dangerButton} onPress={handleDeactivateAccount} disabled={deactivating}>
            {deactivating ? <ActivityIndicator color={Colors.error} /> : <Text style={styles.dangerButtonText}>회원 탈퇴</Text>}
          </TouchableOpacity>
        </View>
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
    fontWeight: Typography.fontWeight.extrabold,
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
  readonlyInput: {
    backgroundColor: Colors.gray50,
    color: Colors.textSecondary,
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
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
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
    fontWeight: Typography.fontWeight.extrabold,
  },
  dangerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: 10,
    ...Shadows.sm,
  },
  dangerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.extrabold,
  },
  dangerBody: {
    color: Colors.textSecondary,
    ...Typography.caption,
  },
  dangerButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.errorBackground,
  },
  dangerButtonText: {
    color: Colors.error,
    fontWeight: Typography.fontWeight.extrabold,
  },
});
