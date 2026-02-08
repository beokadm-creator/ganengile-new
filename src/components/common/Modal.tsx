import React from 'react';
import {
  Modal as RNModal,
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme';

type ModalVariant = 'center' | 'bottomSheet';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  variant?: ModalVariant;
  animationType?: 'none' | 'slide' | 'fade';
  closeOnBackdropPress?: boolean;
  showCloseButton?: boolean;
  containerStyle?: ViewStyle;
  contentStyle?: ViewStyle;
}

export default function Modal({
  visible,
  onClose,
  children,
  variant = 'center',
  animationType = 'fade',
  closeOnBackdropPress = true,
  showCloseButton = false,
  containerStyle,
  contentStyle,
}: ModalProps) {
  const handleBackdropPress = () => {
    if (closeOnBackdropPress) {
      onClose();
    }
  };

  return (
    <RNModal
      visible={visible}
      animationType={animationType}
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, styles[variant]]}>
        <TouchableOpacity
          style={styles.backdrop}
          onPress={handleBackdropPress}
          activeOpacity={1}
        />

        <View style={[styles.content, variant === 'center' ? styles.centerModal : styles.bottomSheetModal, containerStyle, contentStyle]}>
          {showCloseButton && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityLabel="Close modal"
              accessibilityRole="button"
            >
              <View style={styles.closeButtonInner}>
                <View style={styles.closeIconLine} />
                <View style={[styles.closeIconLine, styles.closeIconLineRotated]} />
              </View>
            </TouchableOpacity>
          )}
          {children}
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },

  // Variants
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSheet: {
    alignItems: 'stretch',
    justifyContent: 'flex-end',
  },

  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },

  // Content
  content: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    elevation: 5,
    maxWidth: '90%',
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    width: '100%',
  },

  centerModal: {
    margin: Spacing.lg,
  },
  bottomSheetModal: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxWidth: '100%',
  },

  // Close button
  closeButton: {
    position: 'absolute',
    right: Spacing.sm,
    top: Spacing.sm,
    zIndex: 1,
  },
  closeButtonInner: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  closeIconLine: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
    height: 2,
    position: 'absolute',
    width: 20,
  },
  closeIconLineRotated: {
    transform: [{ rotate: '90deg' }],
  },
});
