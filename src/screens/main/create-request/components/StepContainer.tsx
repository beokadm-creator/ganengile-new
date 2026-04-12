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
  onPrev, // Keep for compatibility if used elsewhere, but not needed in UI
  nextLabel = '다음 단계로',
  nextDisabled = false,
  children,
}: Props) {
  if (currentStep !== step) return null;

  return (
    <View style={styles.stepContainer}>
      {children}
      {onNext && (
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
