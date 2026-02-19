/**
 * Subscription Tier Selection Screen
 * B2B 기업용 구독 티어 선택 화면
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { businessContractService } from '../../services/business-contract-service';
import { requireUserId } from '../../services/firebase';
import type { MainStackNavigationProp } from '../../types/navigation';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';

interface SubscriptionTier {
  id: string;
  name: string;
  price: number; // 월 요금
  deliveryLimit: number; // 포함 건수
  pricePerDelivery: number; // 건당 요금
  features: string[];
  isPopular?: boolean;
}

export default function SubscriptionTierSelectionScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);

  useEffect(() => {
    loadTiers();
  }, []);

  const loadTiers = async () => {
    try {
      const availableTiers = await businessContractService.getSubscriptionTiers();
      setTiers(availableTiers);
    } catch (error) {
      console.error('Error loading tiers:', error);
      Alert.alert('오류', '구독 티어 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTier = async (tierId: string) => {
    setSelectedTier(tierId);
  };

  const handleSubscribe = async () => {
    if (!selectedTier) {
      Alert.alert('알림', '구독 티어를 선택해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const userId = await requireUserId();
      await businessContractService.subscribeToTier(userId, selectedTier);

      Alert.alert(
        '구독 완료',
        '구독이 시작되었습니다. 대시보드로 이동합니다.',
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
      Alert.alert('구독 실패', error.message || '구독에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  const renderTierCard = (tier: SubscriptionTier) => {
    const isSelected = selectedTier === tier.id;
    const isPopular = tier.isPopular;

    return (
      <TouchableOpacity
        key={tier.id}
        style={[
          styles.tierCard,
          isSelected && styles.selectedTierCard,
          isPopular && styles.popularTierCard,
        ]}
        onPress={() => handleSelectTier(tier.id)}
        activeOpacity={0.7}
      >
        {/* 인기 태그 */}
        {isPopular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>인기</Text>
          </View>
        )}

        {/* 티어 이름 */}
        <Text
          style={[
            styles.tierName,
            isSelected && styles.selectedTierName,
          ]}
        >
          {tier.name}
        </Text>

        {/* 월 요금 */}
        <View style={styles.priceContainer}>
          <Text
            style={[
              styles.priceAmount,
              isSelected && styles.selectedPriceAmount,
            ]}
          >
            {formatCurrency(tier.price)}
          </Text>
          <Text
            style={[
              styles.pricePeriod,
              isSelected && styles.selectedPricePeriod,
            ]}
          >
            /월
          </Text>
        </View>

        {/* 포함 건수 */}
        <View style={styles.limitContainer}>
          <Ionicons
            name="cube-outline"
            size={20}
            color={isSelected ? Colors.primary : Colors.text.secondary}
          />
          <Text
            style={[
              styles.limitText,
              isSelected && styles.selectedLimitText,
            ]}
          >
            월 {tier.deliveryLimit}건 포함
          </Text>
        </View>

        {/* 건당 요금 */}
        <View style={styles.pricePerDeliveryContainer}>
          <Text
            style={[
              styles.pricePerDelivery,
              isSelected && styles.selectedPricePerDelivery,
            ]}
          >
            초과 시 건당 {formatCurrency(tier.pricePerDelivery)}
          </Text>
        </View>

        {/* 특징 목록 */}
        <View style={styles.featuresContainer}>
          {tier.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={isSelected ? Colors.primary : Colors.success}
              />
              <Text
                style={[
                  styles.featureText,
                  isSelected && styles.selectedFeatureText,
                ]}
              >
                {feature}
              </Text>
            </View>
          ))}
        </View>

        {/* 선택 표시 */}
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>구독 티어 선택</Text>
      </View>

      {/* 설명 */}
      <View style={styles.descriptionContainer}>
        <Text style={styles.descriptionTitle}>
          비즈니스에 맞는 플랜을 선택하세요
        </Text>
        <Text style={styles.descriptionText}>
          언제든지 업그레이드 또는 다운그레이드 가능합니다
        </Text>
      </View>

      {/* 티어 카드 목록 */}
      <ScrollView
        style={styles.tiersContainer}
        contentContainerStyle={styles.tiersContent}
        showsVerticalScrollIndicator={false}
      >
        {tiers.map((tier) => renderTierCard(tier))}
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.subscribeButton,
            !selectedTier && styles.disabledButton,
          ]}
          onPress={handleSubscribe}
          disabled={!selectedTier || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.subscribeButtonText}>
              {selectedTier ? '구독 시작하기' : '티어를 선택해주세요'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  descriptionContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  descriptionTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  descriptionText: {
    ...Typography.body2,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  tiersContainer: {
    flex: 1,
  },
  tiersContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  tierCard: {
    position: 'relative',
    padding: Spacing.lg,
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  selectedTierCard: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}08`,
  },
  popularTierCard: {
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  popularBadge: {
    position: 'absolute',
    top: -1,
    right: Spacing.md,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderTopLeftRadius: BorderRadius.sm,
    borderTopRightRadius: BorderRadius.sm,
  },
  popularBadgeText: {
    ...Typography.caption,
    color: '#fff',
    fontWeight: 'bold',
  },
  tierName: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  selectedTierName: {
    color: Colors.primary,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  priceAmount: {
    ...Typography.h1,
    color: Colors.text.primary,
  },
  selectedPriceAmount: {
    color: Colors.primary,
  },
  pricePeriod: {
    ...Typography.body2,
    color: Colors.text.secondary,
    marginLeft: Spacing.xs,
  },
  selectedPricePeriod: {
    color: Colors.primary,
  },
  limitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  limitText: {
    ...Typography.body2,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  selectedLimitText: {
    color: Colors.primary,
  },
  pricePerDeliveryContainer: {
    marginBottom: Spacing.md,
  },
  pricePerDelivery: {
    ...Typography.body2,
    color: Colors.text.tertiary,
  },
  selectedPricePerDelivery: {
    color: Colors.primary,
  },
  featuresContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  featureText: {
    ...Typography.body2,
    color: Colors.text.primary,
    marginLeft: Spacing.sm,
  },
  selectedFeatureText: {
    color: Colors.primary,
  },
  selectedIndicator: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: '#fff',
  },
  subscribeButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: Colors.background.secondary,
  },
  subscribeButtonText: {
    ...Typography.body1,
    color: '#fff',
    fontWeight: 'bold',
  },
});
