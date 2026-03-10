/**
 * Bank Account Modal
 * 은행 계좌 정보 입력 모달
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import BankSelectModal from './BankSelectModal';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (bankAccount: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  }) => void;
  initialData?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
  loading?: boolean;
}

export default function BankAccountModal({
  visible,
  onClose,
  onSave,
  initialData,
  loading = false,
}: Props) {
  const [bankName, setBankName] = useState(initialData?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(initialData?.accountNumber || '');
  const [accountHolder, setAccountHolder] = useState(initialData?.accountHolder || '');
  const [bankModalVisible, setBankModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBankName(initialData?.bankName || '');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccountNumber(initialData?.accountNumber || '');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccountHolder(initialData?.accountHolder || '');
    }
  }, [visible, initialData]);

  const handleSave = () => {
    if (!bankName || !accountNumber) {
      Alert.alert('알림', '은행과 계좌번호를 입력해주세요.');
      return;
    }

    onSave({
      bankName,
      accountNumber,
      accountHolder,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>계좌 정보 관리</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* 은행 선택 */}
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => setBankModalVisible(true)}
            >
              <Text style={styles.label}>은행</Text>
              <View style={styles.valueContainer}>
                <Text style={styles.value}>{bankName || '선택안함'}</Text>
                <Text style={styles.arrow}>›</Text>
              </View>
            </TouchableOpacity>

            {/* 계좌번호 입력 */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>계좌번호</Text>
              <TextInput
                style={styles.textInput}
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="'-' 없이 입력"
                placeholderTextColor="#999"
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* 예금주 입력 */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>예금주</Text>
              <TextInput
                style={styles.textInput}
                value={accountHolder}
                onChangeText={setAccountHolder}
                placeholder="예금주 성명"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* 안내 문구 */}
            <View style={styles.noticeBox}>
              <Text style={styles.noticeIcon}>ℹ️</Text>
              <Text style={styles.noticeText}>
                정산금은 입력하신 계좌로 입금됩니다.
                {'\n'}정보를 정확히 입력해주세요.
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>저장</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* 은행 선택 모달 */}
          <BankSelectModal
            visible={bankModalVisible}
            onClose={() => setBankModalVisible(false)}
            onSelect={(selectedBank) => {
              setBankName(selectedBank);
              setBankModalVisible(false);
            }}
            selectedBank={bankName}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  content: {
    padding: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  valueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  value: {
    fontSize: 16,
    color: '#333',
  },
  arrow: {
    fontSize: 20,
    color: '#999',
  },
  textInput: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    fontSize: 16,
    color: '#333',
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  noticeIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: '#1976D2',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
