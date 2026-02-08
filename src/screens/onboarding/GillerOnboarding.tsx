/**
 * Giller Onboarding Screen
 * 길러 온보딩 - 4단계 슬라이드
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import type { OnboardingStackParamList } from '../../types/navigation';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';
import Button from '../../components/common/Button';
import Icons from '../../constants/icons';

interface Slide {
  id: number;
  icon: { name: string; color: string };
  title: string;
  content: string;
}

type GillerOnboardingProps = {
  navigation: StackNavigationProp<OnboardingStackParamList, 'GillerOnboarding'>;
};

export default function GillerOnboarding({ navigation }: GillerOnboardingProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const slides: Slide[] = [
    {
      id: 1,
      icon: Icons.wallet,
      title: '출퇴근길에 수익을 창출하세요',
      content: '기존 동선을 활용해서 배송을 수행하고\n수익을 만드세요',
    },
    {
      id: 2,
      icon: Icons.navigate,
      title: '동선 등록부터 시작하세요',
      content: '1. 자주 타는 출발역과 도착역을 선택\n2. 출발 시간대와 요일을 설정\n3. 길러 활동을 시작하세요',
    },
    {
      id: 3,
      icon: Icons.cube,
      title: '배송은 이렇게 진행됩니다',
      content: '1. 매칭된 요청을 확인\n2. 수락 후 출발역에서 인수\n3. 도착역에서 전달 및 완료 처리\n4. 평가와 수익 확인',
    },
    {
      id: 4,
      icon: Icons.shield,
      title: '신원 확인이 필요합니다',
      content: '안전한 배송을 위해 신원 확인을 진행합니다\n신분증과 실명 확인이 필요합니다',
    },
  ];

  const handleNext = () => {
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
      // 마지막 슬라이드: 신원 확인 화면으로 네비게이션
      navigation.navigate('IdentityVerification');
    }
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
  const isLastSlide = currentSlide === slides.length - 1;

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
        <View style={styles.skipContainer}>
          <Text style={styles.skipWarningText}>
            * 신원 확인은 길러 활동을 위해 필수입니다
          </Text>
        </View>
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

          {isLastSlide && (
            <View style={styles.requiredInfo}>
              <Text style={styles.requiredInfoTitle}>필수 정보:</Text>
              <Text style={styles.requiredInfoText}>• 실명 (이미 입력됨)</Text>
              <Text style={styles.requiredInfoText}>• 전화번호 (이미 입력됨)</Text>
              <Text style={styles.requiredInfoText}>• 신분증 업로드</Text>
              <Text style={styles.requiredInfoText}>• 계좌 정보 (수익 정산용)</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={styles.navigation}>
        {currentSlide > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>← 이전</Text>
          </TouchableOpacity>
        )}

        <View style={styles.nextContainer}>
          {isLastSlide ? (
            <Button
              title="신원 확인 시작하기"
              onPress={handleNext}
              variant="primary"
              size="large"
              fullWidth
            />
          ) : (
            <Button
              title="다음"
              onPress={handleNext}
              variant="primary"
              size="large"
              fullWidth
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: Colors.secondary,
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
    justifyContent: 'center',
  },
  noteText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  requiredInfo: {
    backgroundColor: Colors.gray50,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    width: '100%',
  },
  requiredInfoText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * 1.5,
    marginBottom: Spacing.xs,
  },
  requiredInfoTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  scrollContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: Spacing['5xl'],
    paddingHorizontal: Spacing.xl,
  },
  skipContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  skipWarningText: {
    color: Colors.warning,
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
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
