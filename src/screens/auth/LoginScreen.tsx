/**
 * Login Screen
 * 로그인 화면 - Email/Password 및 Google 로그인
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebase';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
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

          {/* TODO: Google 로그인 구현 */}
          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={() => Alert.alert('안내', 'Google 로그인은 곧 지원됩니다')}
          >
            <Text style={styles.googleButtonText}>Google로 계속하기</Text>
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
});
