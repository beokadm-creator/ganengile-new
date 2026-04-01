import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { BadgeService } from '../../services/BadgeService';
import { acceptRequest, getMatchingResults } from '../../services/matching-service';
import { calculateGrade, getGradeInfo } from '../../services/grade-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { B2BStackNavigationProp, B2BStackParamList } from '../../types/navigation';
import type { Badge } from '../../types/user';

type MatchingStatus = 'searching' | 'found' | 'timeout' | 'failed';
type MatchCandidate = Awaited<ReturnType<typeof getMatchingResults>>[number];
type ScreenRoute = RouteProp<B2BStackParamList, 'B2BMatchingResult'>;

const MATCH_TIMEOUT_MS = 30_000;

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export default function B2BMatchingResultScreen() {
  const navigation = useNavigation<B2BStackNavigationProp>();
  const route = useRoute<ScreenRoute>();
  const requestId = route.params?.requestId;

  const [status, setStatus] = useState<MatchingStatus>('searching');
  const [loading, setLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedMatch, setSelectedMatch] = useState<MatchCandidate | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);

  const gradeInfo = useMemo(() => {
    const completedDeliveries = selectedMatch?.completedDeliveries ?? 0;
    return getGradeInfo(calculateGrade(completedDeliveries));
  }, [selectedMatch]);

  useEffect(() => {
    if (!requestId) {
      Alert.alert('Error', 'Request id is missing.');
      navigation.goBack();
      return;
    }

    let cancelled = false;
    const timer = setInterval(() => {
      setElapsedTime((previous) => previous + 1);
    }, 1000);

    const timeout = setTimeout(() => {
      if (!cancelled) {
        setStatus((current) => (current === 'searching' ? 'timeout' : current));
      }
    }, MATCH_TIMEOUT_MS);

    const loadMatches = async () => {
      try {
        const matches = await getMatchingResults(requestId);
        if (cancelled) {
          return;
        }

        const firstMatch = matches[0];
        if (!firstMatch) {
          setStatus('timeout');
          return;
        }

        setSelectedMatch(firstMatch);
        const fetchedBadges = await BadgeService.getGillerBadges(firstMatch.gillerId);

        if (!cancelled) {
          setBadges(fetchedBadges);
          setStatus('found');
        }
      } catch (error) {
        console.error('B2B matching error:', error);
        if (!cancelled) {
          setStatus('failed');
        }
      }
    };

    void loadMatches();

    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [navigation, requestId]);

  const handleAccept = async () => {
    if (!requestId || !selectedMatch) {
      return;
    }

    setLoading(true);
    try {
      const result = await acceptRequest(requestId, selectedMatch.gillerId);
      if (!result.success) {
        throw new Error(result.message);
      }

      Alert.alert('Assigned', 'The selected giller has been assigned.', [
        {
          text: 'OK',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'B2BDashboard' }],
            });
          },
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to assign giller.';
      Alert.alert('Assignment failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setElapsedTime(0);
    setSelectedMatch(null);
    setBadges([]);
    setStatus('searching');
  };

  const handleReject = () => {
    Alert.alert('Try another candidate', 'Search again for a different giller candidate.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Retry', onPress: handleRetry },
    ]);
  };

  const renderSearching = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.title}>Searching for a giller</Text>
      <Text style={styles.timer}>{formatElapsed(elapsedTime)}</Text>
      <Text style={styles.subtitle}>We are checking route fit, ETA, and reliability.</Text>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFound = () => (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Candidate found</Text>
        <Text style={styles.subtitle}>Best available match after {formatElapsed(elapsedTime)}.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.avatarWrap}>
          <Ionicons name="person-circle-outline" size={72} color={Colors.primary} />
        </View>

        <Text style={styles.name}>{selectedMatch?.gillerName ?? 'Giller'}</Text>

        <View style={styles.gradeChip}>
          <Ionicons name="shield-checkmark" size={14} color={Colors.white} />
          <Text style={styles.gradeChipText}>{gradeInfo.name}</Text>
        </View>

        <Text style={styles.statsText}>
          Rating {(selectedMatch?.rating ?? 0).toFixed(1)} · Completed {(selectedMatch?.completedDeliveries ?? 0).toLocaleString()}
        </Text>

        <View style={styles.summaryGrid}>
          <SummaryCard label="ETA" value={`${selectedMatch?.travelTime ?? 0} min`} />
          <SummaryCard label="Transfers" value={`${selectedMatch?.transferCount ?? 0}`} />
          <SummaryCard label="Congestion" value={selectedMatch?.congestion ?? '-'} />
          <SummaryCard label="Est. fee" value={`${(selectedMatch?.estimatedFee ?? 0).toLocaleString()} KRW`} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why this candidate</Text>
          {(selectedMatch?.reasons ?? []).map((reason) => (
            <View key={reason} style={styles.row}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.rowText}>{reason}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Grade benefits</Text>
          {gradeInfo.benefits.map((benefit) => (
            <View key={benefit} style={styles.row}>
              <Ionicons name="sparkles" size={16} color={Colors.primary} />
              <Text style={styles.rowText}>{benefit}</Text>
            </View>
          ))}
        </View>

        {badges.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Badges</Text>
            <View style={styles.badgesWrap}>
              {badges.slice(0, 4).map((badge) => (
                <View key={badge.id} style={styles.badgeChip}>
                  <Text style={styles.badgeText}>{badge.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleReject}>
          <Text style={styles.secondaryButtonText}>Find another</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleAccept()} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryButtonText}>Assign</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderFallback = (icon: keyof typeof Ionicons.glyphMap, title: string, subtitle: string) => (
    <View style={styles.centerContainer}>
      <Ionicons name={icon} size={64} color={title === 'Match failed' ? Colors.error : Colors.warning} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={handleRetry}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (status === 'searching') {
    return <View style={styles.container}>{renderSearching()}</View>;
  }

  if (status === 'found') {
    return renderFound();
  }

  if (status === 'timeout') {
    return (
      <View style={styles.container}>
        {renderFallback('time-outline', 'Match timeout', 'No available giller was found in the current window.')}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderFallback('alert-circle-outline', 'Match failed', 'Please try again after checking the request data.')}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  header: {
    gap: Spacing.xs,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  timer: {
    fontSize: Typography.fontSize['4xl'],
    fontWeight: '800',
    color: Colors.primary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarWrap: {
    alignItems: 'center',
  },
  name: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  gradeChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  gradeChipText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },
  statsText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 4,
  },
  summaryLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
  summaryValue: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  badgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  badgeChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gray50,
  },
  badgeText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  primaryButtonText: {
    fontSize: Typography.fontSize.base,
    color: Colors.white,
    fontWeight: '800',
  },
});
