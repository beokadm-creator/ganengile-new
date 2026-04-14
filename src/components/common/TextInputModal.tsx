import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Typography } from '../../theme';

interface TextInputModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  value: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onChangeText: (text: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function TextInputModal({
  visible,
  title,
  subtitle,
  value,
  placeholder,
  confirmText = '확인',
  cancelText = '취소',
  loading = false,
  onChangeText,
  onConfirm,
  onCancel,
}: TextInputModalProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            multiline
          />
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancel]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirm]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmText}>{confirmText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    padding: 12,
  },
  cancel: {
    backgroundColor: '#f0f0f0',
  },
  cancelText: {
    color: '#333',
    fontSize: Typography.fontSize.base,
    fontWeight: 'bold',
  },
  confirm: {
    backgroundColor: '#00BCD4',
  },
  confirmText: {
    color: '#fff',
    fontSize: Typography.fontSize.base,
    fontWeight: 'bold',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  input: {
    borderColor: '#ddd',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 80,
    maxHeight: 120,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: Typography.fontSize.base,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  subtitle: {
    color: '#666',
    fontSize: Typography.fontSize.sm,
    marginBottom: 12,
  },
  title: {
    color: '#333',
    fontSize: Typography.fontSize.xl,
    fontWeight: 'bold',
    marginBottom: 8,
  },
});
