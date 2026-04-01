import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { unlockLocker } from '../../services/locker-service';
import { getQRCodeRemainingTime, verifyQRCode } from '../../services/qrcode-service';
import type { MainStackNavigationProp } from '../../types/navigation';

export default function QRCodeScannerScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const [qrInput, setQrInput] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const qrPreview = useMemo(() => verifyQRCode(qrInput.trim()), [qrInput]);
  const remainingMinutes = useMemo(() => getQRCodeRemainingTime(qrInput.trim()), [qrInput]);

  const handleUnlock = async (): Promise<void> => {
    const trimmed = qrInput.trim();
    const verification = verifyQRCode(trimmed);

    if (!verification.isValid || !verification.data) {
      Alert.alert('QR 코드를 확인해 주세요', verification.error ?? '올바른 QR 코드가 아니에요.');
      return;
    }

    try {
      setUnlocking(true);
      const lockerId =
        verification.data.metadata && typeof verification.data.metadata.lockerId === 'string'
          ? verification.data.metadata.lockerId
          : verification.data.id;

      const result = await unlockLocker(lockerId, trimmed);
      if (!result.success) {
        Alert.alert('사물함 열기 실패', result.message ?? '잠시 후 다시 시도해 주세요.');
        return;
      }

      Alert.alert('사물함 열기 완료', 'QR 검증이 끝나서 사물함 해제 요청을 보냈어요.', [
        {
          text: '돌아가기',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Failed to unlock locker:', error);
      Alert.alert('사물함 열기 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>QR 확인</Text>
        <Text style={styles.subtitle}>
          카메라 연결은 다음 단계에서 붙이고, 지금은 QR 문자열을 바로 붙여 넣어 검증과 해제 흐름을 테스트할 수 있습니다.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>QR 문자열</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="QR 코드 문자열을 붙여 넣어 주세요"
          value={qrInput}
          onChangeText={setQrInput}
          multiline
          autoCapitalize="none"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>검증 결과</Text>
        <Text style={styles.resultText}>
          상태: {qrPreview.isValid ? '유효' : '무효'}
        </Text>
        <Text style={styles.resultText}>
          남은 시간: {remainingMinutes > 0 ? `${remainingMinutes}분` : '만료 또는 확인 불가'}
        </Text>
        {qrPreview.error ? <Text style={styles.errorText}>{qrPreview.error}</Text> : null}
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => void handleUnlock()} disabled={unlocking}>
        {unlocking ? (
          <ActivityIndicator size="small" color=Colors.white />
        ) : (
          <Text style={styles.primaryButtonText}>사물함 열기 요청</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    gap: 12,
    shadowColor: Colors.textPrimary,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
  },
  multilineInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  resultText: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: Colors.primary,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.surface,
  },
});
