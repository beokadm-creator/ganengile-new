import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme';
import Modal from '../common/Modal';

interface TaxInfoRegistrationModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TaxInfoRegistrationModal({ visible, onClose, onSuccess }: TaxInfoRegistrationModalProps) {
  const [residentNumber, setResidentNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!residentNumber || !bankName || !bankAccountNumber || !accountHolderName) {
      Alert.alert('알림', '모든 정보를 입력해주세요.');
      return;
    }
    
    if (residentNumber.replace(/[^0-9]/g, '').length !== 13) {
      Alert.alert('알림', '올바른 주민등록번호 13자리를 입력해주세요.');
      return;
    }

    if (!consentAgreed) {
      Alert.alert('알림', '고유식별정보 수집 및 이용에 동의해주세요.');
      return;
    }

    try {
      setLoading(true);
      const registerTaxInfo = httpsCallable(getFunctions(), 'registerTaxInfo');
      
      await registerTaxInfo({
        residentNumber: residentNumber.replace(/[^0-9]/g, ''),
        bankName,
        bankAccountNumber,
        accountHolderName,
        consentAgreed,
      });

      Alert.alert('완료', '세무 및 계좌 정보가 안전하게 등록되었습니다. 이제 출금을 진행하실 수 있습니다.');
      onSuccess();
    } catch (error: any) {
      Alert.alert('오류', '정보 등록 중 문제가 발생했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} variant="bottomSheet" showCloseButton>
      <View style={styles.container}>
        <Text style={styles.title}>출금 계좌 및 세무 정보 등록</Text>
        <Text style={styles.subtitle}>
          플랫폼 정산 및 국세청 3.3% 원천징수 신고를 위해 1회에 한하여 필요한 정보입니다.
          입력하신 주민등록번호는 강력한 암호화(AES-256)를 거쳐 안전하게 보관됩니다.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>예금주명</Text>
          <TextInput
            style={styles.input}
            value={accountHolderName}
            onChangeText={setAccountHolderName}
            placeholder="본인 명의의 예금주명"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>주민등록번호 (13자리)</Text>
          <TextInput
            style={styles.input}
            value={residentNumber}
            onChangeText={setResidentNumber}
            placeholder="000000-0000000"
            keyboardType="number-pad"
            maxLength={14}
            secureTextEntry // 민감정보 마스킹
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.sm }]}>
            <Text style={styles.label}>은행명</Text>
            <TextInput
              style={styles.input}
              value={bankName}
              onChangeText={setBankName}
              placeholder="예: 국민은행"
            />
          </View>

          <View style={[styles.inputGroup, { flex: 2 }]}>
            <Text style={styles.label}>계좌번호 (- 제외)</Text>
            <TextInput
              style={styles.input}
              value={bankAccountNumber}
              onChangeText={setBankAccountNumber}
              placeholder="123456789012"
              keyboardType="number-pad"
            />
          </View>
        </View>

        <TouchableOpacity 
          style={styles.checkboxContainer} 
          onPress={() => setConsentAgreed(!consentAgreed)}
        >
          <View style={[styles.checkbox, consentAgreed && styles.checkboxChecked]} />
          <Text style={styles.checkboxText}>[필수] 고유식별정보(주민등록번호) 수집 및 이용 동의</Text>
        </TouchableOpacity>
        <Text style={styles.legalHint}>
          수집목적: 소득세법 제164조에 따른 원천징수영수증 및 지급명세서 국세청 제출용
        </Text>

        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>동의 및 등록 완료</Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    paddingBottom: Spacing['3xl'],
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.base,
    backgroundColor: Colors.white,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  legalHint: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginLeft: 28,
    marginBottom: Spacing.xl,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
});