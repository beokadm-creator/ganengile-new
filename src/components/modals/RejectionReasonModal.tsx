import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';

interface RejectionReasonModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectReason: (reason: string) => void;
}

const REJECTION_REASONS = [
  { id: 'distance_too_far', label: '거리가 너무 멉니다', icon: '📍' },
  { id: 'fee_too_low', label: '요금이 너무 낮습니다', icon: '💰' },
  { id: 'schedule_not_suitable', label: '일정이 맞지 않습니다', icon: '📅' },
  { id: 'package_too_heavy', label: '물건이 너무 무겁습니다', icon: '📦' },
  { id: 'other', label: '기타', icon: '❓' },
];

export const RejectionReasonModal: React.FC<RejectionReasonModalProps> = ({
  visible,
  onClose,
  onSelectReason,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>거절 사유 선택</Text>
          <Text style={styles.subtitle}>거절 사유를 선택해주세요</Text>

          <View style={styles.reasonsContainer}>
            {REJECTION_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                style={styles.reasonButton}
                onPress={() => {
                  onSelectReason(reason.id);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.reasonIcon}>{reason.icon}</Text>
                <Text style={styles.reasonLabel}>{reason.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 360,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  reasonsContainer: {
    marginBottom: 16,
  },
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reasonIcon: {
    fontSize: Typography.fontSize['3xl'],
    marginRight: 16,
  },
  reasonLabel: {
    fontSize: Typography.fontSize.lg,
    color: '#333',
    flex: 1,
  },
  cancelButton: {
    marginTop: 8,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: Typography.fontSize.lg,
    color: '#666',
  },
});
