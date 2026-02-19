/**
 * B2B Matching Result Screen
 * B2B 기업용 길러 매칭 결과 화면
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { requireUserId } from '../../services/firebase';
import { matchingService } from '../../services/matching-service';
import { professionalGillerService } from '../../services/professional-giller-service';
import { gradeService } from '../../services/grade-service';
import { BadgeService } from '../../services/badge-service';
import type { MainStackNavigationProp } from '../../types/navigation';
import type { GillerProfile } from '../../types/giller';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';

interface RouteParams {
  requestId: string;
}

type MatchingStatus = 'searching' | 'found' | 'timeout' | 'failed';

export default function B2BMatchingResultScreen() {
  const route = useRoute();
  const navigation = useNavigation<MainStackNavigationProp>();
  const { requestId } = (route.params as RouteParams) || {};

  const [status, setStatus] = useState<MatchingStatus>('searching');
  const [loading, setLoading] = useState(false);
  const [giller, setGiller] = useState<GillerProfile | null>(null);
  const [grade, setGrade] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!requestId) {
      Alert.alert('오류', '요청 ID가 없습니다.');
      navigation.goBack();
      return;
    }

    startMatching();
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [requestId]);

  const startMatching = async () => {
    try {
      // B2B 요청에 대한 매칭 시작
      const matchResult = await matchingService.findB2BMatchers(requestId);

      if (matchResult && matchResult.length > 0) {
        // 첫 번째 매칭 결과 선택
        const firstMatch = matchResult[0];
        const gillerProfile = await matchingService.getGillerProfile(firstMatch.gillerId);

        if (gillerProfile) {
          setGiller(gillerProfile);

          // 길러 등급 정보 조회
          const gillerGrade = await gradeService.getGillerGrade(firstMatch.gillerId);
          setGrade(gillerGrade);

          // 길러 배지 조회
          const gillerBadges = await BadgeService.getGillerBadges(firstMatch.gillerId);
          setBadges(gillerBadges);

          setStatus('found');
        }
      } else {
        // 30초 후 타임아웃
        setTimeout(() => {
          if (status === 'searching') {
            setStatus('timeout');
          }
        }, 30000);
      }
    } catch (error) {
      console.error('Matching error:', error);
      setStatus('failed');
    }
  };

  const handleAccept = async () => {
    if (!giller) return;

    setLoading(true);
    try {
      const userId = await requireUserId();
      await matchingService.acceptB2BRequest(requestId, giller.gillerId, userId);

      Alert.alert(
        '매칭 완료',
        '길러가 배정되었습니다. 배송을 시작합니다.',
        [
          {
            text: '확인',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'B2BDashboard' }],
              });
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('매칭 실패', error.message || '매칭 수락에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = () => {
    Alert.alert(
      '매칭 거절',
      '다른 길러를 찾고 있습니다.',
      [
        {
          text: '확인',
          onPress: () => {
            setElapsedTime(0);
            startMatching();
          },
        },
      ]
    );
  };

  const handleRetry = () => {
    setElapsedTime(0);
    setStatus('searching');
    startMatching();
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getGradeColor = (gradeName: string): string => {
    switch (gradeName) {
      case '마스터 길러':
        return Colors.premium;
      case '전문 길러':
        return Colors.primary;
      default:
        return Colors.text.secondary;
    }
  };

  const getGradeIcon = (gradeName: string): string => {
    switch (gradeName) {
      case '마스터 길러':
        return 'diamond';
      case '전문 길러':
        return 'star';
      default:
        return 'person';
    }
  };

  const renderSearchingState = () => (
    <View style={styles.centerContainer}>
      <View style={styles.searchingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.searchingTitle}>길러를 찾고 있습니다</Text>
        <Text style={styles.searchingTime}>{formatTime(elapsedTime)}</Text>
        <Text style={styles.searchingSubtitle}>
          평균 매칭 시간: 약 20초
        </Text>
      </View>
      <TouchableOpacity style={styles.cancelButton} onPress={handleBack}>
        <Text style={styles.cancelButtonText}>취소</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFoundState = () => (
    <ScrollView style={styles.foundContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>길러를 찾았습니다!</Text>
        <Text style={styles.headerSubtitle}>
          {formatTime(elapsedTime)} 소요되었습니다.
        </Text>
      </View>

      <View style={styles.gillerCard}>
        {/* 길러 프로필 사진 */}
        <View style={styles.profileSection}>
          <Image
            source={
              giller?.profilePhoto
                ? { uri: giller.profilePhoto }
                : require('../../assets/images/default-avatar.png')
            }
            style={styles.profilePhoto}
          />
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.gillerName}>{giller?.name || '길러'}</Text>
              {grade && (
                <View
                  style={[
                    styles.gradeBadge,
                    { backgroundColor: getGradeColor(grade.name) },
                  ]}
                >
                  <Ionicons
                    name={getGradeIcon(grade.name) as any}
                    size={14}
                    color="#fff"
                  />
                  <Text style={styles.gradeText}>{grade.name}</Text>
                </View>
              )}
            </View>

            {/* 배지 표시 (최대 3개) */}
            {badges.length > 0 && (
              <View style={styles.badgesContainer}>
                {badges.slice(0, 3).map((badge, index) => (
                  <View key={index} style={styles.miniBadge}>
                    <Text style={styles.miniBadgeText}>{badge.emoji}</Text>
                  </View>
                ))}
                {badges.length > 3 && (
                  <Text style={styles.moreBadgesText}>+{badges.length - 3}</Text>
                )}
              </View>
            )}

            <Text style={styles.gillerStats}>
              완료 {giller?.completedDeliveries || 0}건 • 평점{' '}
              {giller?.averageRating?.toFixed(1) || '0.0'}
            </Text>
          </View>
        </View>

        {/* 등급별 혜택 */}
        {grade && (
          <View style={styles.benefitsSection}>
            <Text style={styles.benefitsTitle}>등급 혜택</Text>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={styles.benefitText}>
                수수료 {grade.feeBonus ? `${grade.feeBonus * 100}% 할인` : '기본'}
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={styles.benefitText}>
                우선 매칭 대상
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* 버튼 영역 */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.rejectButton]}
          onPress={handleReject}
        >
          <Text style={styles.rejectButtonText}>거절</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.acceptButton]}
          onPress={handleAccept}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.acceptButtonText}>수락</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderTimeoutState = () => (
    <View style={styles.centerContainer}>
      <View style={styles.errorContainer}>
        <Ionicons name="time-outline" size={64} color={Colors.warning} />
        <Text style={styles.errorTitle}>매칭 시간 초과</Text>
        <Text style={styles.errorSubtitle}>
          현재 이용 가능한 길러가 없습니다.
        </Text>
        <Text style={styles.errorNote}>
          잠시 후 다시 시도해 주세요.
        </Text>
      </View>
      <View style={styles.timeoutButtonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleBack}
        >
          <Text style={styles.secondaryButtonText}>돌아가기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleRetry}
        >
          <Text style={styles.primaryButtonText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFailedState = () => (
    <View style={styles.centerContainer}>
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorTitle}>매칭 실패</Text>
        <Text style={styles.errorSubtitle}>
          오류가 발생했습니다.
        </Text>
      </View>
      <View style={styles.timeoutButtonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleBack}
        >
          <Text style={styles.secondaryButtonText}>돌아가기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleRetry}
        >
          <Text style={styles.primaryButtonText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {status === 'searching' && renderSearchingState()}
      {status === 'found' && renderFoundState()}
      {status === 'timeout' && renderTimeoutState()}
      {status === 'failed' && renderFailedState()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  searchingContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  searchingTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
  },
  searchingTime: {
    ...Typography.h1,
    color: Colors.primary,
    marginTop: Spacing.md,
  },
  searchingSubtitle: {
    ...Typography.body2,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
  },
  cancelButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.secondary,
  },
  cancelButtonText: {
    ...Typography.body1,
    color: Colors.text.primary,
  },
  foundContainer: {
    flex: 1,
  },
  header: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  headerSubtitle: {
    ...Typography.body2,
    color: Colors.text.secondary,
  },
  gillerCard: {
    margin: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: Spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  gillerName: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginRight: Spacing.sm,
  },
  gradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  gradeText: {
    ...Typography.caption,
    color: '#fff',
    marginLeft: Spacing.xs,
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  miniBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.background.secondary,
    marginRight: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniBadgeText: {
    fontSize: 12,
  },
  moreBadgesText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  gillerStats: {
    ...Typography.body2,
    color: Colors.text.secondary,
  },
  benefitsSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  benefitsTitle: {
    ...Typography.body1,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  benefitText: {
    ...Typography.body2,
    color: Colors.text.primary,
    marginLeft: Spacing.sm,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: Colors.background.secondary,
  },
  rejectButtonText: {
    ...Typography.body1,
    color: Colors.text.primary,
  },
  acceptButton: {
    backgroundColor: Colors.primary,
  },
  acceptButtonText: {
    ...Typography.body1,
    color: '#fff',
    fontWeight: 'bold',
  },
  errorContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  errorTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
  },
  errorSubtitle: {
    ...Typography.body1,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
  },
  errorNote: {
    ...Typography.body2,
    color: Colors.text.tertiary,
    marginTop: Spacing.sm,
  },
  timeoutButtonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: Spacing.md,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.secondary,
  },
  secondaryButtonText: {
    ...Typography.body1,
    color: Colors.text.primary,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  primaryButtonText: {
    ...Typography.body1,
    color: '#fff',
    fontWeight: 'bold',
  },
});
