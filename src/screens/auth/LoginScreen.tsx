/**
 * Login Screen
 * 로그인 화면 - Email/Password 및 Google 로그인
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveId, setSaveId] = useState(false);

  // 앱 시작 시 저장된 ID 불러오기
  useEffect(() => {
    loadSavedEmail();
  }, []);

  const loadSavedEmail = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('@user_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setSaveId(true);
      }
    } catch (error) {
      console.error('Error loading saved email:', error);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);

      // ID 저장 체크박스가 선택되어 있으면 저장
      if (saveId) {
        await AsyncStorage.setItem('@user_email', email);
      } else {
        // 체크 해제되면 저장된 ID 삭제
        await AsyncStorage.removeItem('@user_email');
      }

      // Auth state change will be handled by AppNavigator
    } catch (error: any) {
      let errorMessage = '로그인에 실패했습니다.';

      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = '등록되지 않은 이메일입니다. 회원가입을 먼저 진행해주세요.';
          break;
        case 'auth/wrong-password':
          errorMessage = '비밀번호가 올바르지 않습니다. 다시 확인해주세요.';
          break;
        case 'auth/invalid-email':
          errorMessage = '이메일 형식이 올바르지 않습니다.';
          break;
        case 'auth/user-disabled':
          errorMessage = '계정이 비활성화되었습니다. 고객센터에 문의해주세요.';
          break;
        case 'auth/too-many-requests':
          errorMessage = '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.';
          break;
        default:
          errorMessage = error.message || '로그인에 실패했습니다. 다시 시도해주세요.';
      }

      Alert.alert('로그인 실패', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // google-auth의 handleGoogleSignIn 사용 (Web + Native 지원)
      const { handleGoogleSignIn } = await import('../../services/google-auth');
      await handleGoogleSignIn();

      // Auth state change will be handled by AppNavigator
    } catch (error: any) {
      console.error('Google login error:', error);
      Alert.alert('Google 로그인 실패', error.message || 'Google 로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>로그인</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="이메일"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="비밀번호"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.saveIdContainer}
            onPress={() => setSaveId(!saveId)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, saveId && styles.checkboxChecked]}>
              {saveId && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.saveIdLabel}>이메일 저장</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.loginButton]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>로그인</Text>
            )}
          </TouchableOpacity>

          {/* Google 로그인 */}
          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#333" />
            ) : (
              <Text style={styles.googleButtonText}>Google로 계속하기</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.signupLink}>계정이 없으신가요? 회원가입</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 8,
    padding: 16,
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 30,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderWidth: 1,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
    padding: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#4CAF50',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signupLink: {
    color: '#4CAF50',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
  title: {
    color: '#4CAF50',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
  },
  saveIdContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 16,
    marginTop: 8,
  },
  checkbox: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderRadius: 4,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    marginRight: 8,
    width: 24,
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveIdLabel: {
    color: '#666',
    fontSize: 14,
  },
});
