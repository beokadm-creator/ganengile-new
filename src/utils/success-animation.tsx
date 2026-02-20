/**
 * Success Animation Component
 * 성공 애니메이션 컴포넌트 (체크마크, 컨페티 등)
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

const { width } = Dimensions.get('window');

export interface SuccessAnimationProps {
  visible: boolean;
  duration?: number;
  onComplete?: () => void;
  type?: 'checkmark' | 'confetti' | 'pulse';
  message?: string;
}

/**
 * 체크마크 성공 애니메이션
 */
export function SuccessAnimation({
  visible,
  duration = 2000,
  onComplete,
  type = 'checkmark',
  message,
}: SuccessAnimationProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset
      scaleAnim.setValue(0);
      rotateAnim.setValue(0);
      fadeAnim.setValue(0);
      pulseAnim.setValue(0);

      // Run animation sequence
      const sequence = Animated.sequence([
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // Scale up and rotate
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        // Pulse effect
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ),
      ]);

      sequence.start(() => {
        // Stop pulse and complete
        pulseAnim.stopAnimation();

        if (onComplete) {
          setTimeout(onComplete, 500);
        }
      });

      return () => {
        sequence.stop();
        pulseAnim.stopAnimation();
      };
    }
  }, [visible]);

  if (!visible) return null;

  const checkmarkPath = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z';

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const scaleInterpolate = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.circle,
          {
            transform: [
              { scale: Animated.multiply(scaleInterpolate, pulseScale) },
            ],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.checkmarkContainer,
            {
              transform: [{ rotate: rotateInterpolate }],
            },
          ]}
        >
          <Text style={styles.checkmark}>✓</Text>
        </Animated.View>
      </Animated.View>

      {message && (
        <Animated.Text
          style={[
            styles.message,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleInterpolate }],
            },
          ]}
        >
          {message}
        </Animated.Text>
      )}
    </Animated.View>
  );
}

/**
 * 컨페티 파티클 컴포넌트
 */
export interface ConfettiProps {
  visible: boolean;
  count?: number;
  duration?: number;
  onComplete?: () => void;
}

export function Confetti({
  visible,
  count = 50,
  duration = 3000,
  onComplete,
}: ConfettiProps) {
  const particles = useRef<Array<Animated.Value>>(
    Array.from({ length: count }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    if (visible) {
      const animations = particles.map((anim, index) => {
        const randomDelay = Math.random() * 500;
        const randomDuration = duration + Math.random() * 1000;

        return Animated.timing(anim, {
          toValue: 1,
          duration: randomDuration,
          delay: randomDelay,
          useNativeDriver: true,
        });
      });

      Animated.parallel(animations).start(() => {
        if (onComplete) {
          onComplete();
        }
      });

      return () => {
        animations.forEach(a => a.stop());
      };
    }
  }, [visible]);

  if (!visible) return null;

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];

  return (
    <View style={styles.confettiContainer}>
      {particles.map((anim, index) => {
        const translateX = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, (Math.random() - 0.5) * width],
        });

        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, height + 100],
        });

        const rotate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${Math.random() * 720}deg`],
        });

        const color = colors[index % colors.length];

        return (
          <Animated.View
            key={index}
            style={[
              styles.confettiParticle,
              {
                backgroundColor: color,
                transform: [
                  { translateX },
                  { translateY },
                  { rotate },
                ],
                left: Math.random() * width,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const height = Dimensions.get('window').height;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    zIndex: 1000,
  },
  circle: {
    alignItems: 'center',
    backgroundColor: Colors.success,
    borderRadius: 60,
    height: 120,
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    width: 120,
  },
  checkmarkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: Colors.white,
    fontSize: 60,
    fontWeight: 'bold',
  },
  message: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: Typography.fontWeight.bold,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    height,
    overflow: 'hidden',
    width,
  },
  confettiParticle: {
    height: 10,
    position: 'absolute',
    top: -20,
    width: 10,
  },
});

/**
 * 성공 메시지 오버레이 컴포넌트
 */
export interface SuccessOverlayProps {
  visible: boolean;
  message: string;
  submessage?: string;
  duration?: number;
  onComplete?: () => void;
}

export function SuccessOverlay({
  visible,
  message,
  submessage,
  duration = 2500,
  onComplete,
}: SuccessOverlayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      const sequence = Animated.sequence([
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(duration - 600),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]);

      sequence.start(() => {
        if (onComplete) onComplete();
      });

      return () => sequence.stop();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.overlayContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.overlayCard}>
        <View style={styles.overlayIcon}>
          <Text style={styles.overlayIconText}>✓</Text>
        </View>
        <Text style={styles.overlayMessage}>{message}</Text>
        {submessage && (
          <Text style={styles.overlaySubmessage}>{submessage}</Text>
        )}
      </View>
    </Animated.View>
  );
}

const overlayStyles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: Spacing.xl,
    zIndex: 999,
  },
  overlayCard: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '100%',
  },
  overlayIcon: {
    alignItems: 'center',
    backgroundColor: Colors.success,
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    marginBottom: Spacing.md,
    width: 60,
  },
  overlayIconText: {
    color: Colors.white,
    fontSize: 30,
    fontWeight: 'bold',
  },
  overlayMessage: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  overlaySubmessage: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
