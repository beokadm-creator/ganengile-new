/**
 * Giller Level Upgrade Screen
 * 길러 승급 신청 화면
 *
 * 일반 길러가 전문 길러로 승급을 신청하는 화면
 * - 승급 조건 안내
 * - 현재 등급 및 진행률 표시
 * - 승급 신청 폼
 * - 제출 및 검증
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createGillerService } from '../../services/giller-service';
import type { GillerProfile } from '../../types/giller';
import { GillerType } from '../../types/giller';

type Props = {
  navigation: any;
};

export default function GillerLevelUpgradeScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<GillerProfile | null>(null);
  const [eligibility, setEligibility] = useState<{
    isEligible: boolean;
    score: number;
    breakdown: {
      completedDeliveries: number;
      rating: number;
      accountAge: number;
      penalties: number;
      activity: number;
    };
  } | null>(null);

  const [reason, setReason] = useState('');
  const [activity, setActivity] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const gillerService = createGillerService();
      const profileData = await gillerService.getGillerProfile();

      if (!profileData) {
        Alert.alert('오류', '길러 프로필을 찾을 수 없습니다.');
        navigation.goBack();
        return;
      }

      setProfile(profileData);

      // 승급 자격 확인
      const eligibilityData = await gillerService.checkPromotionEligibility();
      setEligibility(eligibilityData);
    } catch (error) {
      console.error('Failed to load profile:', error);
      Alert.alert('오류', '프로필 로딩에 실패했습니다.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!eligibility?.isEligible) {
      Alert.alert(
        '승급 불가',
        '승급 기준을 충족하지 못했습니다.\n조건을 다시 확인해주세요.'
      );
      return;
    }

    if (!reason.trim()) {
      Alert.alert('입력 필요', '승급 사유를 입력해주세요.');
      return;
    }

    if (!activity.trim()) {
      Alert.alert('입력 필요', '활동 내역을 입력해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      const gillerService = createGillerService();

      // 전문 길러로 승급
      await gillerService.promoteToProfessional();

      Alert.alert(
        '승급 완료',
        '축하합니다!\n전문 길러로 승급되었습니다.\n\n혜택이 즉시 적용됩니다.',
        [
          {
            text: '확인',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Promotion failed:', error);
      Alert.alert(
        '승급 실패',
        error.message || '승급 처리 중 오류가 발생했습니다.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00BCD4" />
        <Text style={styles.loadingText}>프로필 로딩 중...</Text>
      </View>
    );
  }

  if (!profile || !eligibility) {
    return null;
  }

  const isProfessional = profile.gillerType === GillerType.PROFESSIONAL;

  // 등급별 색상
  const getLevelColor = () => {
    if (isProfessional) return '#FF5722'; // Professional: 빨간색
    return '#FFC107'; // Regular: 금색
  };

  const getLevelName = () => {
    if (isProfessional) return '전문 길러';
    return '일반 길러';
  };

  // 다음 등급 혜택
  const nextBenefits = isProfessional
    ? []
    : [
        '최대 동시 배송: 3개 → 5개',
        '우선 매칭',
        '프리미엄 수수료 (15%)',
        '전용 배지',
        '통계 및 분석',
      ];

  return (
    <ScrollView style={styles.container}>
      {/* 헤더: 현재 등급 */}
      <View style={[styles.header, { backgroundColor: getLevelColor() + '20' }]}>
        <View style={styles.levelBadge}>
          <Ionicons name="trophy" size={48} color={getLevelColor()} />
          <Text style={[styles.levelText, { color: getLevelColor() }]}>
            {getLevelName()}
          </Text>
        </View>

        {isProfessional ? (
          <View style={styles.alreadyProfessional}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={styles.alreadyText}>이미 전문 길러입니다</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={handleSubmit}
            disabled={!eligibility.isEligible || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="rocket" size={20} color="#fff" />
                <Text style={styles.upgradeButtonText}>
                  전문 길러 승급 신청
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* 승급 조건 안내 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>승급 기준</Text>

        <View style={styles.criteriaCard}>
          {/* 배송 건수 */}
          <View style={styles.criteriaRow}>
            <View style={styles.criteriaInfo}>
              <Ionicons name="cube" size={24} color="#00BCD4" />
              <Text style={styles.criteriaLabel}>완료 배송</Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        (profile.stats.totalCompletedDeliveries / 50) * 100,
                        100
                      )}%`,
                      backgroundColor:
                        profile.stats.totalCompletedDeliveries >= 50
                          ? '#4CAF50'
                          : '#FFC107',
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {profile.stats.totalCompletedDeliveries}/50건
              </Text>
            </View>
          </View>

          {/* 평점 */}
          <View style={styles.criteriaRow}>
            <View style={styles.criteriaInfo}>
              <Ionicons name="star" size={24} color="#FFC107" />
              <Text style={styles.criteriaLabel}>평점</Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        (profile.stats.rating / 4.5) * 100,
                        100
                      )}%`,
                      backgroundColor:
                        profile.stats.rating >= 4.5 ? '#4CAF50' : '#FFC107',
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {profile.stats.rating.toFixed(1)}/4.5점
              </Text>
            </View>
          </View>

          {/* 계정 기간 */}
          <View style={styles.criteriaRow}>
            <View style={styles.criteriaInfo}>
              <Ionicons name="calendar" size={24} color="#9C27B0" />
              <Text style={styles.criteriaLabel}>가입 기간</Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        (profile.stats.accountAgeDays / 30) * 100,
                        100
                      )}%`,
                      backgroundColor:
                        profile.stats.accountAgeDays >= 30
                          ? '#4CAF50'
                          : '#FFC107',
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {profile.stats.accountAgeDays}/30일
              </Text>
            </View>
          </View>

          {/* 페널티 */}
          <View style={styles.criteriaRow}>
            <View style={styles.criteriaInfo}>
              <Ionicons
                name="warning"
                size={24}
                color={profile.stats.recentPenalties === 0 ? '#4CAF50' : '#F44336'}
              />
              <Text style={styles.criteriaLabel}>최근 페널티</Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: '100%',
                      backgroundColor:
                        profile.stats.recentPenalties === 0
                          ? '#4CAF50'
                          : '#F44336',
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.progressText,
                  {
                    color:
                      profile.stats.recentPenalties === 0
                        ? '#4CAF50'
                        : '#F44336',
                  },
                ]}
              >
                {profile.stats.recentPenalties === 0 ? '없음' : '있음'}
              </Text>
            </View>
          </View>
        </View>

        {/* 총 점수 */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>승급 점수</Text>
          <View style={styles.scoreValueContainer}>
            <Text style={[styles.scoreValue, {
              color: eligibility.isEligible ? '#4CAF50' : '#FFC107'
            }]}>
              {eligibility.score.toFixed(0)}
            </Text>
            <Text style={styles.scoreMax}>/80점</Text>
          </View>
          <Text style={[
            styles.scoreStatus,
            { color: eligibility.isEligible ? '#4CAF50' : '#F44336' }
          ]}>
            {eligibility.isEligible ? '✅ 승급 가능' : '⏳ 조건 충족 필요'}
          </Text>
        </View>
      </View>

      {/* 다음 등급 혜택 */}
      {!isProfessional && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>전문 길러 혜택</Text>
          <View style={styles.benefitsCard}>
            {nextBenefits.map((benefit, index) => (
              <View key={index} style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 승급 신청 폼 */}
      {!isProfessional && eligibility.isEligible && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>승급 신청</Text>

          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>승급 사유</Text>
            <TextInput
              style={styles.textInput}
              placeholder="전문 길러가 되고 싶은 이유를 입력해주세요."
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={styles.inputLabel}>활동 내역</Text>
            <TextInput
              style={styles.textInput}
              placeholder="최근 활동 내역을 간단히 설명해주세요."
              value={activity}
              onChangeText={setActivity}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>승급 신청하기</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!isProfessional && !eligibility.isEligible && (
        <View style={styles.section}>
          <View style={styles.notEligibleCard}>
            <Ionicons name="information-circle" size={32} color="#FFC107" />
            <Text style={styles.notEligibleTitle}>승급 조건 미충족</Text>
            <Text style={styles.notEligibleText}>
              승급 기준(80점)을 충족하지 못했습니다.
              {'\n'}
              계속 활동하여 조건을 충족시켜주세요!
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  levelBadge: {
    alignItems: 'center',
    marginBottom: 16,
  },
  levelText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  alreadyProfessional: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF5020',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  alreadyText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00BCD4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  criteriaCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  criteriaRow: {
    marginBottom: 16,
  },
  criteriaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  criteriaLabel: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  scoreCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  scoreValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  scoreMax: {
    fontSize: 24,
    color: '#999',
    marginLeft: 4,
  },
  scoreStatus: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  benefitsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 80,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00BCD4',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  notEligibleCard: {
    backgroundColor: '#FFC10720',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  notEligibleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFC107',
    marginTop: 8,
  },
  notEligibleText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
});
