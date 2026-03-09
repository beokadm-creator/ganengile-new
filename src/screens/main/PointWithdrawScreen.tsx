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
  KeyboardAvoidingView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { PointService } from '../../services/PointService';
import { WITHDRAW_MIN_AMOUNT } from '../../types/point';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type NavigationProp = StackNavigationProp<any>;

export default function PointWithdrawScreen({ navigation }: { navigation: NavigationProp }) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [balance, setBalance] = useState(0);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = '출금 금액을 입력해주세요.';
    } else if (parseFloat(amount) < WITHDRAW_MIN_AMOUNT) {
      newErrors.amount = `최소 출금 금액은 ${WITHDRAW_MIN_AMOUNT.toLocaleString()}원입니다.`;
    } else if (parseFloat(amount) > balance) {
      newErrors.amount = '보유 포인트가 부족합니다.';
    }

    if (!bankName || bankName.trim().length === 0) {
      newErrors.bankName = '은행명을 입력해주세요.';
    }

    if (!accountNumber || accountNumber.trim().length === 0) {
      newErrors.accountNumber = '계좌 번호를 입력해주세요.';
    } else if (!/^\d{10,13}$/.test(accountNumber)) {
      newErrors.accountNumber = '올바른 계좌 번호가 아닙니다. (예: 0101234567890)';
    }

    if (!accountHolder || accountHolder.trim().length === 0) {
      newErrors.accountHolder = '예금주 명을 입력해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      await PointService.requestWithdrawal({
        userId: 'current-user-id',
        amount: parseFloat(amount),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
      });

      Alert.alert(
        '출금 요청 완료',
        `${parseFloat(amount).toLocaleString()}원 출금 요청이 접수되었습니다.\n\n영업일 기준으로 입금됩니다.`,
        [
          {
            text: '확인',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('오류', error.message || '출금 요청 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>포인트 출금</Text>
          <Text style={styles.headerSubtitle}>
            보유 포인트를 은행으로 출금하세요
          </Text>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceTitle}>보유 포인트</Text>
          <Text style={styles.balanceAmount}>
            {balance.toLocaleString()} P
          </Text>
          <Text style={styles.balanceNote}>
            최소 출금: {WITHDRAW_MIN_AMOUNT.toLocaleString()}원
          </Text>
        </View>

        <Text style={styles.sectionTitle}>은행 정보</Text>

        <View style={styles.formSection}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>출금 금액</Text>
            <TextInput
              style={[styles.input, errors.amount && styles.inputError]}
              value={amount}
              onChangeText={(text) => {
                setAmount(text);
                if (errors.amount) {
                  setErrors(prev => ({ ...prev, amount: '' }));
                }
              }}
              placeholder="10,000원 이상 입력"
              keyboardType="number-pad"
              accessibilityLabel="출금 금액 입력"
            />
            {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>은행명</Text>
            <TextInput
              style={[styles.input, errors.bankName && styles.inputError]}
              value={bankName}
              onChangeText={(text) => {
                setBankName(text);
                if (errors.bankName) {
                  setErrors(prev => ({ ...prev, bankName: '' }));
                }
              }}
              placeholder="은행명 (예: 카카오은행)"
              accessibilityLabel="은행명 입력"
            />
            {errors.bankName && <Text style={styles.errorText}>{errors.bankName}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>계좌 번호</Text>
            <TextInput
              style={[styles.input, errors.accountNumber && styles.inputError]}
              value={accountNumber}
              onChangeText={(text) => {
                setAccountNumber(text);
                if (errors.accountNumber) {
                  setErrors(prev => ({ ...prev, accountNumber: '' }));
                }
              }}
              placeholder="0101234567890"
              keyboardType="number-pad"
              maxLength={11}
              accessibilityLabel="계좌 번호 입력"
            />
            {errors.accountNumber && <Text style={styles.errorText}>{errors.accountNumber}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>예금주</Text>
            <TextInput
              style={[styles.input, errors.accountHolder && styles.inputError]}
              value={accountHolder}
              onChangeText={(text) => {
                setAccountHolder(text);
                if (errors.accountHolder) {
                  setErrors(prev => ({ ...prev, accountHolder: '' }));
                }
              }}
              placeholder="예금주 (예: 김길러)"
              accessibilityLabel="예금주 입력"
            />
            {errors.accountHolder && <Text style={styles.errorText}>{errors.accountHolder}</Text>}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, !amount && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading || !amount}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {parseFloat(amount).toLocaleString()}원 출금하기
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>취소</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  balanceCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  balanceTitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  balanceAmount: {
    ...Typography.h1,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  balanceNote: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
    marginTop: Spacing.xl,
  },
  formSection: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  fieldGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.body,
    marginBottom: Spacing.xs,
    color: Colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Typography.body,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: Colors.gray400,
  },
  submitButtonText: {
    ...Typography.h3,
    color: Colors.white,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  cancelButtonText: {
    ...Typography.h3,
    color: Colors.textSecondary,
    fontWeight: 'bold',
  },
});
