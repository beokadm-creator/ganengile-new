import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getMatchingResults as getMatchesFromFirestore } from '../../services/matching-service';
import GillerProfileCard, { GillerMatch } from '../../components/matching/GillerProfileCard';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
  route: {
    params: {
      requestId: string;
    };
  };
}

const MATCHING_TIMEOUT = 30000; // 30 seconds

export default function MatchingResultScreen({ navigation, route }: Props) {
  const { requestId } = route.params;
  const [matches, setMatches] = useState<GillerMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(MATCHING_TIMEOUT / 1000);
  const [autoRetrying, setAutoRetrying] = useState(false);
  const [autoRetryCount, setAutoRetryCount] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const progressAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const clearTimersAndAnimations = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    pulseAnimationRef.current?.stop();
    progressAnimationRef.current?.stop();
  };

  const startSearch = useCallback(async () => {
    clearTimersAndAnimations();

    setTimedOut(false);
    setTimeRemaining(MATCHING_TIMEOUT / 1000);
    setSearching(true);
    setLoading(true);
    setMatches([]);

    // Reset animations
    progressAnim.setValue(0);
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);

    // Start progress animation
    const progressAnimation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: MATCHING_TIMEOUT,
      useNativeDriver: false,
    });
    progressAnimationRef.current = progressAnimation;
    progressAnimation.start();

    // Start pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimationRef.current = pulse;
    pulse.start();

    // Start countdown
    countdownIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    try {
      const results = await getMatchesFromFirestore(requestId);
      setMatches(results);
      setSearching(false);
      setLoading(false);

      if (results.length > 0) {
        animateSuccess();
      } else {
        animateFailure();
      }
    } catch (error) {
      console.error('Error loading matches:', error);
      setSearching(false);
      setLoading(false);
      animateFailure();
    } finally {
      clearTimersAndAnimations();
    }
  }, [requestId, fadeAnim, pulseAnim, progressAnim, scaleAnim]);

  useEffect(() => {
    startSearch();
    return () => {
      clearTimersAndAnimations();
    };
  }, [startSearch]);

  const handleTimeout = () => {
    setTimedOut(true);
    setSearching(false);
    setLoading(false);
    animateShake();

    if (autoRetryCount < 1 && !autoRetrying) {
      setAutoRetrying(true);
      setAutoRetryCount((prev) => prev + 1);
      setTimeout(() => {
        setAutoRetrying(false);
        startSearch();
      }, 1500);
    }
  };

  const animateSuccess = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateFailure = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      delay: 300,
      useNativeDriver: true,
    }).start();
  };

  const animateShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleRetry = () => {
    startSearch();
  };

  const handleChangeConditions = () => {
    navigation.goBack();
  };

  const handleSelectGiller = (match: GillerMatch) => {
    navigation.navigate('RequestDetail', {
      requestId,
      gillerId: match.gillerId,
    });
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <View style={styles.searchingIcon}>
            <Text style={styles.searchingEmoji}>🔍</Text>
          </View>
        </Animated.View>

        <Text style={styles.loadingText}>길러를 찾고 있어요...</Text>

        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <Animated.View
              style={[
                styles.progressBar,
                { width: progressWidth },
              ]}
            />
          </View>
          <Text style={styles.timeText}>{timeRemaining}초</Text>
        </View>

        {timedOut && (
          <View style={styles.timeoutContainer}>
            <Text style={styles.timeoutEmoji}>⏰</Text>
            <Text style={styles.timeoutText}>매칭 시간 초과</Text>
            <Text style={styles.timeoutHint}>
              조건에 맞는 길러를 찾지 못했어요
            </Text>
            {autoRetrying && (
              <Text style={styles.timeoutHint}>잠시 후 자동으로 다시 찾고 있어요</Text>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>매칭 결과</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        {searching ? null : matches.length > 0 ? (
          <Animated.View
            style={[
              styles.resultContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.successBanner}>
              <Text style={styles.successEmoji}>🎉</Text>
              <Text style={styles.successTitle}>매칭 성공!</Text>
              <Text style={styles.successSubtitle}>
                {matches.length}명의 길러를 찾았어요
              </Text>
            </View>

            {matches.map((match, index) => (
              <GillerProfileCard
                key={match.gillerId}
                match={match}
                index={index}
                onPress={handleSelectGiller}
              />
            ))}
          </Animated.View>
        ) : (
          <Animated.View
            style={[
              styles.failureContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateX: shakeAnim }],
              },
            ]}
          >
            <View style={styles.failureBanner}>
              <Text style={styles.failureEmoji}>😢</Text>
              <Text style={styles.failureTitle}>매칭 실패</Text>
              <Text style={styles.failureSubtitle}>
                {timedOut
                  ? '시간 내에 조건에 맞는 길러를 찾지 못했어요'
                  : '아직 조건에 맞는 길러가 없어요'}
              </Text>
              <Text style={styles.failureHint}>
                조건을 변경하거나 나중에 다시 시도해주세요
              </Text>
            </View>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
            >
              <Text style={styles.retryButtonText}>
                {timedOut ? '다시 시도하기' : '다시 검색하기'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleChangeConditions}
            >
              <Text style={styles.secondaryButtonText}>조건 변경하기</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 40,
  },
  backButtonText: {
    color: Colors.textPrimary,
    fontSize: 24,
  },
  container: {
    backgroundColor: Colors.gray100,
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  failureBanner: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  failureContainer: {
    gap: Spacing.lg,
  },
  failureEmoji: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  failureHint: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  failureSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  failureTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold as any,
    marginBottom: Spacing.sm,
  },
  header: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderBottomColor: Colors.gray300,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    color: Colors.textPrimary,
    flex: 1,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold as any,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    flex: 1,
    gap: Spacing.md,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold as any,
  },
  progressBackground: {
    backgroundColor: Colors.gray300,
    borderRadius: 8,
    flex: 1,
    height: 8,
    overflow: 'hidden',
  },
  progressBar: {
    backgroundColor: Colors.primary,
    height: '100%',
  },
  progressContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '80%',
  },
  resultContainer: {
    gap: Spacing.md,
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold as any,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold as any,
  },
  searchingEmoji: {
    fontSize: 40,
  },
  searchingIcon: {
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    marginBottom: Spacing.md,
    width: 80,
  },
  successBanner: {
    alignItems: 'center',
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  successSubtitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
  },
  successTitle: {
    color: Colors.white,
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold as any,
    marginBottom: Spacing.xs,
  },
  timeText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium as any,
    minWidth: 40,
    textAlign: 'right',
  },
  timeoutContainer: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  timeoutEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  timeoutHint: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  timeoutText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold as any,
  },
});
