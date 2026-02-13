/**
 * Gller Onboarding Screen
 * 글러(배송 요청자)를 위한 3단계 온보딩
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../../contexts/UserContext';
import type { StackNavigationProp } from '@react-navigation/stack';

const { width } = Dimensions.get('window');

interface OnboardingStep {
  emoji: string;
  title: string;
  description: string;
  process?: Array<{
    number: string;
    text: string;
  }>;
  highlights?: Array<{
    label: string;
    value: string;
  }>;
  checklist?: string[];
}

type Props = {
  navigation: StackNavigationProp<any>;
  route: {
    params: {
      role: string;
    };
  };
};

export default function GllerOnboardingScreen({ navigation, route }: Props) {
  const { role } = route.params || { role: 'gller' };
  const { refreshUser } = useUser();
  const [currentStep, setCurrentStep] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const steps = [
    {
      title: '지하철 타고\n배송하며 돈 버는 길러',
      emoji: '📦',
      description: '출퇴근길에 지하철을 타고 배송을 하며\n수익을 창출할 수 있습니다.',
      process: [
        { number: '1', text: '동선 등록' },
        { number: '2', text: '요청 수락' },
        { number: '3', text: '배송 완료' },
      ],
    },
    {
      title: '얼마나 벌 수 있나요?',
      emoji: '💰',
      description: '월 30~80만원까지\n예상 수익을 얻을 수 있습니다.',
      highlights: [
        { label: '최소 수익', value: '월 30만원' },
        { label: '평균 수익', value: '월 50만원' },
        { label: '최대 수익', value: '월 80만원' },
      ],
    },
    {
      title: '언제 활동할 수 있나요?',
      emoji: '⏰',
      description: '출퇴근 시간대에\n자유롭게 활동할 수 있습니다.',
      highlights: [
        { label: '아침', value: '07:00 - 09:00' },
        { label: '저녁', value: '18:00 - 20:00' },
        { label: '하루', value: '최대 10건' },
      ],
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const nextPage = currentStep + 1;
      setCurrentStep(nextPage);
      scrollViewRef.current?.scrollTo({
        x: nextPage * width,
        animated: true,
      });
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    try {
      // AsyncStorage에 온보딩 완료 저장
      await AsyncStorage.setItem('@onboarding_completed', 'true');

      // UserContext 갱신
      await refreshUser();

      // Main 화면으로 이동
      navigation.replace('Main');
    } catch (error) {
      console.error('온보딩 완료 저장 오류:', error);
      Alert.alert('오류', '온보딩 완료 상태를 저장하는 데 실패했습니다.');
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / width);
    setCurrentStep(page);
  };

  const renderStep = (step: OnboardingStep, index: number) => (
    <View key={index} style={[styles.step, { width }]}>
      <View style={styles.emojiContainer}>
        <Text style={styles.emoji}>{step.emoji}</Text>
      </View>

      <Text style={styles.title}>{step.title}</Text>
      <Text style={styles.description}>{step.description}</Text>

      {step.process && (
        <View style={styles.processContainer}>
          {step.process.map((item, i) => (
            <View key={i} style={styles.processItem}>
              <View style={styles.processNumber}>
                <Text style={styles.processNumberText}>{item.number}</Text>
              </View>
              <Text style={styles.processText}>{item.text}</Text>
              {i < step.process!.length - 1 && (
                <Text style={styles.processArrow}>→</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {step.highlights && (
        <View style={styles.highlightsContainer}>
          {step.highlights.map((item, i) => (
            <View key={i} style={styles.highlightCard}>
              <Text style={styles.highlightLabel}>{item.label}</Text>
              <Text style={styles.highlightValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 스킵 버튼 */}
      {currentStep < steps.length - 1 && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>나중에 하기</Text>
        </TouchableOpacity>
      )}

      {/* 스크롤 가능한 스텝 */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        {steps.map((step, index) => renderStep(step, index))}
      </ScrollView>

      {/* 페이지 인디케이터 */}
      <View style={styles.indicatorContainer}>
        {steps.map((_, index) => (
          <View
            key={index}
            style={[
              styles.indicator,
              currentStep === index && styles.indicatorActive,
            ]}
          />
        ))}
      </View>

      {/* 다음 버튼 */}
      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>
          {currentStep === steps.length - 1 ? '시작하기' : '다음'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  skipButtonText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
  step: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emojiContainer: {
    marginBottom: 30,
  },
  emoji: {
    fontSize: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 40,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  processContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  processItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  processNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00BCD4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  processNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  processText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
  },
  processArrow: {
    fontSize: 24,
    color: '#00BCD4',
    marginLeft: 15,
    marginRight: 15,
  },
  highlightsContainer: {
    width: '100%',
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  highlightCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 20,
    margin: 10,
    width: width / 2 - 60,
    alignItems: 'center',
  },
  highlightLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  highlightValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00BCD4',
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
    marginHorizontal: 4,
  },
  indicatorActive: {
    backgroundColor: '#00BCD4',
    width: 24,
  },
  nextButton: {
    backgroundColor: '#00BCD4',
    marginHorizontal: 20,
    marginBottom: Platform.OS === 'web' ? 20 : 40,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
