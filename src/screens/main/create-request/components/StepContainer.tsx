import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../../../theme';

type Props = {
  step: number;
  currentStep: number;
  onNext?: () => void;
  onPrev?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  children: React.ReactNode;
};

export function StepContainer({
  step,
  currentStep,
  onNext,
  onPrev,
  nextLabel = '다음 단계로',
  nextDisabled = false,
  children,
}: Props) {
  if (currentStep < step) return null;

  return (
    <View style={[styles.stepContainer, currentStep < step && { display: 'none' }]}>
      <View style={currentStep > step ? { opacity: 0.6 } : undefined} pointerEvents={currentStep > step ? 'none' : 'auto'}>
        {children}
      </View>
      {currentStep > step && onPrev && (
        <TouchableOpacity style={styles.editStepButton} onPress={onPrev}>
          <Text style={styles.editStepButtonText}>수정하기</Text>
        </TouchableOpacity>
      )}
      {currentStep === step && onNext && (
        <TouchableOpacity
          style={[styles.nextStepButton, nextDisabled && styles.nextStepButtonDisabled]}
          onPress={onNext}
          disabled={nextDisabled}
        >
          <Text style={styles.nextStepButtonText}>{nextLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stepContainer: {
    gap: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  editStepButton: {
    position: 'absolute',
    top: -Spacing.sm,
    right: 0,
    padding: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
    ...Shadows.sm,
    zIndex: 10,
  },
  editStepButtonText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  nextStepButton: {
    minHeight: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    ...Shadows.md,
  },
  nextStepButtonDisabled: {
    opacity: 0.5,
  },
  nextStepButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
  },
});
