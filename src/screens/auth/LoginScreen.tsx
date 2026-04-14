import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BorderRadius, Colors, Spacing } from '../../theme';
import { Typography } from '../../theme/typography';

import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { handleGoogleSignIn } from '../../services/google-auth';
import { getKakaoLoginErrorMessage, loginWithKakao } from '../../services/kakao-auth';
import type { LoginScreenProps } from '../../types/navigation';

function getFirebaseAuthCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function getEmailLoginErrorMessage(error: unknown): string {
  switch (getFirebaseAuthCode(error)) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return '이메일과 비밀번호를 다시 확인해 주세요.';
    case 'auth/invalid-email':
      return '이메일 형식을 확인해 주세요.';
    case 'auth/user-disabled':
      return '비활성화된 계정입니다. 운영팀에 문의해 주세요.';
    case 'auth/too-many-requests':
      return '로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.';
    default:
      return error instanceof Error && error.message ? error.message : '로그인에 실패했습니다.';
  }
}

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saveId, setSaveId] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('@user_email');
        if (savedEmail) {
          setEmail(savedEmail);
          setSaveId(true);
        }
      } catch (error) {
        console.error('Failed to load saved email', error);
      }
    })();
  }, []);

  async function handleEmailLogin() {
    if (!email.trim() || !password) {
      Alert.alert('입력이 필요합니다', '이메일과 비밀번호를 입력해 주세요.');
      return;
    }

    setEmailLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      if (saveId) {
        await AsyncStorage.setItem('@user_email', email.trim());
      } else {
        await AsyncStorage.removeItem('@user_email');
      }
    } catch (error) {
      Alert.alert('로그인 실패', getEmailLoginErrorMessage(error));
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleGoogleLoginPress() {
    setGoogleLoading(true);
    try {
      await handleGoogleSignIn();
    } catch (error) {
      Alert.alert('Google 로그인 실패', error instanceof Error ? error.message : 'Google 로그인에 실패했습니다.');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleKakaoLoginPress() {
    setKakaoLoading(true);
    try {
      await loginWithKakao();
    } catch (error) {
      Alert.alert('카카오 로그인 실패', getKakaoLoginErrorMessage(error));
    } finally {
      setKakaoLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>로그인</Text>
        <Text style={styles.subtitle}>가는길에 계정으로 요청, 미션, 채팅, 정산 흐름을 이어서 관리합니다.</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="이메일"
            placeholderTextColor={Colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="비밀번호"
            placeholderTextColor={Colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.inlineRow} onPress={() => setSaveId((current) => !current)} activeOpacity={0.8}>
            <View style={[styles.checkbox, saveId && styles.checkboxActive]}>{saveId ? <Text style={styles.checkmark}>✓</Text> : null}</View>
            <Text style={styles.inlineLabel}>이메일 저장</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={() => void handleEmailLogin()} disabled={emailLoading}>
            {emailLoading ? <ActivityIndicator color={Colors.textWhite} /> : <Text style={styles.primaryButtonText}>이메일로 로그인</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.kakaoButton} onPress={() => void handleKakaoLoginPress()} disabled={kakaoLoading}>
            {kakaoLoading ? <ActivityIndicator color="#191600" /> : <Text style={styles.kakaoButtonText}>카카오로 계속하기</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleGoogleLoginPress()} disabled={googleLoading}>
            {googleLoading ? <ActivityIndicator color={Colors.textPrimary} /> : <Text style={styles.secondaryButtonText}>Google로 계속하기</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('NewSignUp')} activeOpacity={0.8}>
          <Text style={styles.footerLink}>아직 계정이 없어요</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, justifyContent: 'center', padding: Spacing['2xl'] },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['5xl'],
    fontWeight: Typography.fontWeight.extrabold,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  form: { gap: Spacing.md },
  input: {
    minHeight: 54, // consistent auth button/input height
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    color: Colors.textPrimary,
  },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6, // between xs(4) and sm(8) — checkbox rounding
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: Colors.surface, fontWeight: Typography.fontWeight.extrabold },
  inlineLabel: { color: Colors.textSecondary, fontSize: Typography.fontSize.base },
  primaryButton: {
    minHeight: 54, // consistent auth button height
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: Colors.textWhite, fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.extrabold },
  kakaoButton: {
    minHeight: 54, // consistent auth button height
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.warning, // amber — closest token to Kakao yellow (#FEE500 not in palette)
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakaoButtonText: { color: Colors.textPrimary, fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.extrabold },
  secondaryButton: {
    minHeight: 54, // consistent auth button height
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: Colors.textPrimary, fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold },
  footerLink: { color: Colors.primary, fontWeight: Typography.fontWeight.bold, textAlign: 'center', marginTop: Spacing.xl },
});
