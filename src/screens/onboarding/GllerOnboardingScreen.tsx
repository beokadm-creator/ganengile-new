/**
 * Service Intro Onboarding Screen
 * 신규 가입자를 위한 서비스 소개 슬라이드 (3장)
 * - 슬라이드 1: 서비스가 뭔가요
 * - 슬라이드 2: 이용자로 어떻게 쓰나요
 * - 슬라이드 3: 길러도 할 수 있어요 (신청 안내)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useUser } from '../../contexts/UserContext';
import type { StackNavigationProp } from '@react-navigation/stack';

type Props = {
  navigation: StackNavigationProp<any>;
};

interface Slide {
  emoji: string;
  title: string;
  description: string;
  points: string[];
  accent: string;
}

const SLIDES: Slide[] = [
  {
    emoji: '🚇',
    title: '지하철 동선으로\n당일 배송하는 서비스',
    description: '가는길에는 지하철 이동 동선을 활용해\n이웃의 물건을 빠르게 전달하는 공유 배송 서비스입니다.',
    points: [
      '📦  출퇴근 동선 그대로, 수익 창출',
      '⚡  빠르고 저렴한 당일 배송',
      '🔒  보증금 시스템으로 안전한 거래',
    ],
    accent: '#9C27B0',
  },
  {
    emoji: '🛍️',
    title: '이용자로\n이렇게 사용해요',
    description: '보낼 물건과 출발역/도착역을 입력하면\n동선이 맞는 길러와 연결됩니다.',
    points: [
      '1️⃣  배송 요청 등록 (출발·도착역, 물품)',
      '2️⃣  동선이 맞는 길러 매칭',
      '3️⃣  지하철 보관함 경유 배송 완료',
    ],
    accent: '#2196F3',
  },
  {
    emoji: '🙋',
    title: '길러도 할 수 있어요',
    description: '이용자 모드에서 신원 인증 후 길러 신청을 하면\n심사 승인 뒤 배송을 시작할 수 있어요.',
    points: [
      '📝  동선 등록 → 관리자 심사 → 승인',
      '💰  건당 수익 + 포인트 적립',
      '🔐  PASS 인증 · 계좌 인증 필요',
    ],
    accent: '#4CAF50',
  },
];

export default function GllerOnboardingScreen({ navigation }: Props) {
  const { completeOnboarding } = useUser();
  const { width } = useWindowDimensions();
  const isSmall = width < 380;
  const isNarrow = width < 360;
  const [currentSlide, setCurrentSlide] = useState(0);
  const [completing, setCompleting] = useState(false);

  const goNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    setCompleting(true);
    try {
      await completeOnboarding();
      // 상태 반영 지연 시 즉시 메인으로 이동 시도 (Onboarding -> Root)
      const root = navigation.getParent()?.getParent();
      root?.navigate('Main' as never);
    } finally {
      setCompleting(false);
    }
  };

  const slide = SLIDES[currentSlide];

  return (
    <View style={styles.container}>
      {/* 슬라이드 영역 */}
      <View style={styles.slider}>
        <View style={[styles.slide, { width }, isNarrow && styles.slideNarrow]}>
          <View style={[styles.circle, { backgroundColor: slide.accent + '18' }]} />

          <Text style={[styles.emoji, isSmall && styles.emojiSmall]}>{slide.emoji}</Text>
          <Text style={[styles.title, { color: slide.accent }, isSmall && styles.titleSmall]}>{slide.title}</Text>
          <Text style={[styles.description, isSmall && styles.descriptionSmall]}>{slide.description}</Text>

          <View style={[styles.pointsContainer, isNarrow && styles.pointsContainerNarrow]}>
            {slide.points.map((point, j) => (
              <View key={j} style={styles.pointRow}>
                <Text style={[styles.pointText, isSmall && styles.pointTextSmall]}>{point}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* 하단 컨트롤 */}
      <View style={styles.footer}>
        {/* 도트 인디케이터 */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === currentSlide ? slide.accent : '#ddd',
                  width: i === currentSlide ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* 버튼 행 */}
        <View style={styles.buttonRow}>
          {currentSlide < SLIDES.length - 1 ? (
            <>
              <TouchableOpacity onPress={handleFinish} style={styles.skipButton}>
                <Text style={styles.skipText}>건너뛰기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextButton, { backgroundColor: slide.accent }]}
                onPress={goNext}
                disabled={completing}
              >
                <Text style={styles.nextButtonText}>다음 →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: slide.accent }]}
              onPress={handleFinish}
              disabled={completing}
            >
              <Text style={styles.startButtonText}>
                {completing ? '잠시만요...' : '메인으로 이동하기'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  slider: {
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 20,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  slideNarrow: {
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  circle: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  emoji: {
    fontSize: 72,
    marginBottom: 24,
  },
  emojiSmall: {
    fontSize: 60,
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 16,
  },
  titleSmall: {
    fontSize: 24,
    lineHeight: 33,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 36,
  },
  descriptionSmall: {
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 28,
  },
  pointsContainer: {
    width: '100%',
    gap: 12,
  },
  pointsContainerNarrow: {
    gap: 10,
  },
  pointRow: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  pointText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  pointTextSmall: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  skipText: {
    fontSize: 15,
    color: '#999',
  },
  nextButton: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});
