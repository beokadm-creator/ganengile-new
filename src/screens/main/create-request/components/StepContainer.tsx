import React, { useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
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
  const isPressingRef = useRef(false);

  if (currentStep !== step) return null;

  const handleNext = () => {
    if (isPressingRef.current) return;
    
    if (!nextDisabled && onNext) {
      isPressingRef.current = true;
      Keyboard.dismiss();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onNext();
      
      // 더블 클릭(고스트 클릭)을 막기 위해 1000ms 딜레이
      setTimeout(() => {
        isPressingRef.current = false;
      }, 1000);
    }
  };

  return (
    <View style={styles.stepContainer}>
      {children}
      {onNext && (
        <TouchableOpacity
          style={[styles.nextStepButton, nextDisabled && styles.nextStepButtonDisabled]}
          onPress={handleNext}
          disabled={nextDisabled}
          activeOpacity={0.8}
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
