/**
 * Gller Onboarding Screen
 * 이용자 (글러) 온보딩 - 3단계 슬라이드
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../contexts/UserContext';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';
import Button from '../../components/common/Button';
import Icons from '../../constants/icons';

const { width } = Dimensions.get('window');

interface Slide {
  id: number;
  icon: { name: string; color: string };
  title: string;
  content: string;
  action?: {
    text: string;
    routeTo: 'RouteManagement';
  };
  skip?: {
    text: string;
  };
}

export default function GllerOnboarding() {
  const { completeOnboarding } = useUser();
  const [currentSlide, setCurrentSlide] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const slides: Slide[] = [
    {
      id: 1,
      icon: Icons.subway,
      title: '출퇴근길에 짐을 보내보세요',
      content: '지하철 이용자에게 배송을 의뢰하고\n편리하게 수령하세요',
    },
    {
      id: 2,
      icon: Icons.cube,
      title: '3단계로 배송 요청',
      content: '1. 출발역과 도착역을 선택하세요\n2. 물건 정보와 요청 시간을 입력하세요\n3. 매칭된 길러를 확인하고 수락하세요',
    },
    {
      id: 3,
      icon: Icons.navigate,
      title: '자주 타는 경로를 등록하세요',
      content: '동선을 등록하면 더 빠르게 매칭됩니다\n최대 5개까지 등록 가능합니다',
      action: {
        text: '지금 동선 등록하기',
        routeTo: 'RouteManagement',
      },
      skip: {
        text: '나중에 할게요',
      },
    },
  ];

  const handleNext = async () => {
    if (currentSlide < slides.length - 1) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentSlide(currentSlide + 1);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    } else {
      // Complete onboarding and navigate
      await completeOnboarding();
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
  };

  const handleBack = () => {
    if (currentSlide > 0) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentSlide(currentSlide - 1);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const slide = slides[currentSlide];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={styles.dotsContainer}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentSlide && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {currentSlide < slides.length - 1 && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>건너뛰기</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={slide.icon.name as any}
              size={120}
              color={slide.icon.color}
            />
          </View>

          <Text style={styles.title}>{slide.title}</Text>

          <Text style={styles.slideContent}>{slide.content}</Text>

          {slide.action && slide.skip && (
            <View style={styles.actionContainer}>
              <Button
                title={slide.action.text}
                onPress={handleNext}
                variant="primary"
                size="large"
                fullWidth
              />
              <TouchableOpacity
                style={styles.skipActionButton}
                onPress={handleSkip}
              >
                <Text style={styles.skipActionText}>{slide.skip.text}</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {currentSlide < slides.length - 1 && (
        <View style={styles.navigation}>
          {currentSlide > 0 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>← 이전</Text>
            </TouchableOpacity>
          )}

          <View style={styles.nextContainer}>
            <Button
              title={currentSlide === slides.length - 2 ? '마지막' : '다음'}
              onPress={handleNext}
              variant="primary"
              size="large"
              fullWidth
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionContainer: {
    gap: Spacing.md,
    marginTop: Spacing['5xl'],
    width: '100%',
  },
  backButton: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  backButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  container: {
    backgroundColor: Colors.white,
    flex: 1,
  },
  dot: {
    backgroundColor: Colors.gray300,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  dotsContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    paddingBottom: Spacing.md,
    paddingTop: Spacing.xxl,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  navigation: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  nextContainer: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: Spacing['5xl'],
    paddingHorizontal: Spacing.xl,
  },
  skipActionButton: {
    padding: Spacing.md,
  },
  skipActionText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    textAlign: 'center',
  },
  skipButton: {
    position: 'absolute',
    right: Spacing.lg,
    top: Spacing.xxl,
    zIndex: 1,
  },
  skipButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  slideContent: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
    lineHeight: Typography.fontSize.base * 1.6,
    textAlign: 'center',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
    lineHeight: Typography.fontSize['3xl'] * 1.3,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
});
