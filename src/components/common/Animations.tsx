/**
 * Animation Components and Utilities
 * 재사용 가능한 애니메이션 컴포넌트
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  StyleProp,
  ViewStyle,
} from 'react-native';

// ==================== Fade In Animation ====================

interface FadeInProps {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function FadeIn({
  children,
  duration = 300,
  delay = 0,
  style,
}: FadeInProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity: fadeAnim }]}>
      {children}
    </Animated.View>
  );
}

// ==================== Slide Up Animation ====================

interface SlideUpProps {
  children: React.ReactNode;
  distance?: number;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function SlideUp({
  children,
  distance = 30,
  duration = 300,
  delay = 0,
  style,
}: SlideUpProps) {
  const slideAnim = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[style, { transform: [{ translateY: slideAnim }] }]}>
      {children}
    </Animated.View>
  );
}

// ==================== Scale In Animation ====================

interface ScaleInProps {
  children: React.ReactNode;
  initialScale?: number;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function ScaleIn({
  children,
  initialScale = 0.9,
  duration = 300,
  delay = 0,
  style,
}: ScaleInProps) {
  const scaleAnim = useRef(new Animated.Value(initialScale)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
      {children}
    </Animated.View>
  );
}

// ==================== Stagger Children Animation ====================

interface StaggerChildrenProps {
  children: React.ReactNode[];
  staggerDelay?: number;
  fadeIn?: boolean;
  slideUp?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function StaggerChildren({
  children,
  staggerDelay = 100,
  fadeIn = true,
  slideUp = false,
  style,
}: StaggerChildrenProps) {
  const animations = useRef(
    children.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(slideUp ? 20 : 0),
    }))
  ).current;

  useEffect(() => {
    const staggerAnimations = children.map((_, index) => {
      const anims = [];

      if (fadeIn) {
        anims.push(
          Animated.timing(animations[index].opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          })
        );
      }

      if (slideUp) {
        anims.push(
          Animated.timing(animations[index].translateY, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          })
        );
      }

      return Animated.parallel(anims);
    });

    Animated.stagger(staggerDelay, staggerAnimations).start();
  }, [children.length]);

  return (
    <View style={style}>
      {children.map((child, index) => (
        <Animated.View
          key={index}
          style={{
            opacity: animations[index].opacity,
            transform: [{ translateY: animations[index].translateY }],
          }}
        >
          {child}
        </Animated.View>
      ))}
    </View>
  );
}

// ==================== Pulse Animation ====================

interface PulseProps {
  children: React.ReactNode;
  scale?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export function Pulse({
  children,
  scale = 1.05,
  duration = 1000,
  style,
}: PulseProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: scale,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();

    return () => pulse.stop();
  }, []);

  return (
    <Animated.View style={[style, { transform: [{ scale: pulseAnim }] }]}>
      {children}
    </Animated.View>
  );
}

// ==================== Shimmer Loading Animation ====================

interface ShimmerProps {
  width?: number | string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function Shimmer({ width = '100%', height = 20, style }: ShimmerProps) {
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-100%', '100%'],
  });

  const containerStyle: ViewStyle = {
    width: width as any,
    height,
  };

  return (
    <View
      style={[
        styles.shimmerContainer,
        containerStyle,
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shimmerContainer: {
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  shimmer: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
});
