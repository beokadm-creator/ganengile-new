import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getMatchingResults as getMatchesFromFirestore } from '../../services/matching-service';
import RatingStars from '../../components/common/RatingStars';
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

interface GillerMatch {
  rank: number;
  gillerId: string;
  gillerName: string;
  score: number;
  travelTime: number;
  hasExpress: boolean;
  transferCount: number;
  reasons: string[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MatchingResultScreen({ navigation, route }: Props) {
  const { requestId } = route.params;
  const [matches, setMatches] = useState<GillerMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadMatches();
  }, [requestId]);

  const loadMatches = async () => {
    try {
      const results = await getMatchesFromFirestore(requestId);
      setMatches(results);

      if (results.length > 0) {
        animateSuccess();
      } else {
        animateFailure();
      }

      setSearching(false);
    } catch (error) {
      console.error('Error loading matches:', error);
      animateFailure();
      setSearching(false);
    } finally {
      setLoading(false);
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
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateCard = (index: number) => {
    const delay = index * 100;
    return {
      opacity: fadeAnim,
      transform: [
        {
          translateY: slideAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [50 * (index + 1), 0],
          }),
        },
      ],
    };
  };

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <View style={styles.searchingIcon}>
            <Text style={styles.searchingEmoji}>🔍</Text>
          </View>
        </Animated.View>
        <Text style={styles.loadingText}>길러를 찾고 있어요...</Text>
        <ActivityIndicator size="large" color={Colors.primary} style={styles.spinner} />
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
              <Animated.View
                key={match.gillerId}
                style={[styles.matchCard, animateCard(index)]}
              >
                <View style={styles.matchHeader}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>#{match.rank}</Text>
                  </View>
                  <View style={styles.matchScore}>
                    <Text style={styles.matchScoreText}>
                      {match.score.toFixed(0)}점
                    </Text>
                  </View>
                </View>

                <View style={styles.gillerInfo}>
                  <Text style={styles.gillerName}>{match.gillerName}</Text>
                  <RatingStars rating={4.5} size={16} />
                </View>

                <View style={styles.travelInfo}>
                  <View style={styles.travelItem}>
                    <Text style={styles.travelIcon}>⏱</Text>
                    <Text style={styles.travelText}>{match.travelTime}분</Text>
                  </View>
                  <View style={styles.travelItem}>
                    <Text style={styles.travelIcon}>🔄</Text>
                    <Text style={styles.travelText}>환승 {match.transferCount}회</Text>
                  </View>
                </View>

                {match.hasExpress && (
                  <View style={styles.expressBadge}>
                    <Text style={styles.expressText}>급행 가능</Text>
                  </View>
                )}

                <View style={styles.reasonsContainer}>
                  {match.reasons.map((reason, idx) => (
                    <Text key={idx} style={styles.reasonText}>
                      ✓ {reason}
                    </Text>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => {
                    navigation.navigate('RequestDetail', { requestId, gillerId: match.gillerId });
                  }}
                >
                  <Text style={styles.selectButtonText}>선택하기</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </Animated.View>
        ) : (
          <Animated.View
            style={[
              styles.failureContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.failureBanner}>
              <Text style={styles.failureEmoji}>😢</Text>
              <Text style={styles.failureTitle}>매칭 실패</Text>
              <Text style={styles.failureSubtitle}>
                아직 조건에 맞는 길러가 없어요
              </Text>
              <Text style={styles.failureHint}>
                조건을 변경하거나 나중에 다시 시도해주세요
              </Text>
            </View>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.retryButtonText}>다시 검색하기</Text>
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
  expressBadge: {
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    position: 'absolute',
    right: Spacing.md,
    top: Spacing.md,
  },
  expressText: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold as any,
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
  gillerInfo: {
    marginBottom: Spacing.sm,
  },
  gillerName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold as any,
    marginBottom: Spacing.xs,
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
  },
  loadingText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold as any,
  },
  matchCard: {
    backgroundColor: Colors.white,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    elevation: 3,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  matchHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  matchScore: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  matchScoreText: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold as any,
  },
  rankBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  rankText: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold as any,
  },
  reasonText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  reasonsContainer: {
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
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
  selectButton: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  selectButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold as any,
  },
  spinner: {
    marginTop: Spacing.lg,
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
  travelIcon: {
    fontSize: 16,
  },
  travelInfo: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  travelItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  travelText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
});
