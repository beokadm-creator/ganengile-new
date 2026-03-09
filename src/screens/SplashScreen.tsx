/**
 * Enhanced Splash Screen
 * 로딩 애니메이션이 적용된 스플래시 화면
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';

const { width: _width, height } = Dimensions.get('window');

export const SplashScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Fade-in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true
    }).start();

    // Scale-up
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true
    }).start();

    // Slide up
    Animated.timing(translateYAnim, {
      toValue: 0,
      duration: 800,
      useNativeDriver: true
    }).start();

    // Subtle rotation (logo)
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true
      })
    ).start();

    return () => {
      fadeAnim.removeAllListeners();
      scaleAnim.removeAllListeners();
      translateYAnim.removeAllListeners();
      rotateAnim.removeAllListeners();
    };
  }, []);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={styles.container}>
      {/* 배경 그라데이션 */}
      <Animated.View
        style={[
          styles.backgroundGradient,
          {
            opacity: fadeAnim
          }
        ]}
      >
        <View style={styles.gradientTop} />
        <View style={styles.gradientBottom} />
      </Animated.View>

      {/* 로고 컨테이너 */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: translateYAnim }
            ]
          }
        ]}
      >
        {/* 로고 이미지 또는 텍스트 */}
        {/* <Image source={Logo} style={styles.logo} /> */}
        <Animated.Text
          style={[
            styles.logoText,
            {
              transform: [{ rotate: rotateInterpolate }]
            }
          ]}
        >
          🚇🇰🇷
        </Animated.Text>
        <Text style={styles.appName}>가는길에</Text>
        <Text style={styles.tagline}>지하철 크라우드 배송</Text>
      </Animated.View>

      {/* 로딩 인디케이터 */}
      <Animated.View style={[styles.loadingContainer, { opacity: fadeAnim }]}>
        <LoadingDots />
      </Animated.View>

      {/* 버전 정보 */}
      <Animated.Text
        style={[
          styles.version,
          {
            opacity: fadeAnim
          }
        ]}
      >
        v1.0.0
      </Animated.Text>
    </View>
  );
};

/**
 * 로딩 도트 애니메이션
 */
const LoadingDots: React.FC = () => {
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnimation = (anim: Animated.Value) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true
          })
        ])
      );
    };

    const anim1 = createAnimation(dot1Anim);
    const anim2 = createAnimation(dot2Anim);
    const anim3 = createAnimation(dot3Anim);

    anim1.start();
    setTimeout(() => anim2.start(), 200);
    setTimeout(() => anim3.start(), 400);

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, []);

  return (
    <View style={styles.dotsContainer}>
      {[dot1Anim, dot2Anim, dot3Anim].map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              transform: [
                {
                  scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.5]
                  })
                }
              ],
              opacity: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1]
              })
            }
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00BCD4',
    alignItems: 'center',
    justifyContent: 'center'
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  gradientTop: {
    flex: 1,
    backgroundColor: '#00BCD4'
  },
  gradientBottom: {
    flex: 1,
    backgroundColor: '#0097A7'
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24
  },
  logoText: {
    fontSize: 64,
    marginBottom: 16
  },
  appName: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)'
  },
  loadingContainer: {
    marginTop: 48
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff'
  },
  version: {
    position: 'absolute',
    bottom: 48,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)'
  }
});
