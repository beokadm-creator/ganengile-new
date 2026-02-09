import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import RatingStars from '../common/RatingStars';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme';

export interface GillerMatch {
  rank: number;
  gillerId: string;
  gillerName: string;
  score: number;
  travelTime: number;
  hasExpress: boolean;
  transferCount: number;
  reasons: string[];
}

interface Props {
  match: GillerMatch;
  index: number;
  onPress: (match: GillerMatch) => void;
}

const GillerProfileCard: React.FC<Props> = ({ match, index, onPress }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    const delay = index * 100;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index]);

  const handlePress = () => {
    onPress(match);
  };

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>#{match.rank}</Text>
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>{Math.round(match.score)}점</Text>
        </View>
      </View>

      <View style={styles.profileInfo}>
        <Text style={styles.gillerName}>{match.gillerName}</Text>
        <View style={styles.rating}>
          <RatingStars rating={4.5} size={14} />
        </View>
      </View>

      <View style={styles.travelInfo}>
        <View style={styles.infoItem}>
          <Text style={styles.infoEmoji}>⏱</Text>
          <Text style={styles.infoText}>{match.travelTime}분</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoEmoji}>🔄</Text>
          <Text style={styles.infoText}>환승 {match.transferCount}회</Text>
        </View>
        {match.hasExpress && (
          <View style={styles.infoItem}>
            <Text style={styles.infoEmoji}>🚀</Text>
            <Text style={styles.infoText}>급행</Text>
          </View>
        )}
      </View>

      {match.reasons.length > 0 && (
        <View style={styles.reasonsContainer}>
          {match.reasons.slice(0, 3).map((reason, idx) => (
            <View key={idx} style={styles.reasonItem}>
              <Text style={styles.reasonBullet}>✓</Text>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.selectButton}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={styles.selectButtonText}>선택하기</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  rankBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  rankText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold as any,
  },
  scoreBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  scoreText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold as any,
  },
  profileInfo: {
    marginBottom: Spacing.sm,
  },
  gillerName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  travelInfo: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.gray100,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  infoEmoji: {
    fontSize: 14,
  },
  infoText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium as any,
  },
  reasonsContainer: {
    marginBottom: Spacing.sm,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  reasonBullet: {
    color: Colors.success,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold as any,
  },
  reasonText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  selectButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  selectButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold as any,
  },
});

export default GillerProfileCard;
