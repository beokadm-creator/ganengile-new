import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { businessContractService } from '../../services/business-contract-service';
import { requireUserId } from '../../services/firebase';
import type { B2BStackNavigationProp } from '../../types/navigation';
import type { SubscriptionTier as SubscriptionTierId } from '../../types/business-contract';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';

interface SubscriptionTierOption {
  id: SubscriptionTierId;
  name: string;
  price: number;
  deliveryLimit: number;
  pricePerDelivery: number;
  features: string[];
  isPopular?: boolean;
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.';
}

export default function SubscriptionTierSelectionScreen() {
  const navigation = useNavigation<B2BStackNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTierId | null>(null);
  const [tiers, setTiers] = useState<SubscriptionTierOption[]>([]);

  useEffect(() => {
    void loadTiers();
  }, []);

  async function loadTiers(): Promise<void> {
    try {
      const availableTiers = await businessContractService.getSubscriptionTiers();
      setTiers(availableTiers as SubscriptionTierOption[]);
    } catch (error) {
      console.error('Failed to load subscription tiers', error);
      Alert.alert('불러오기 실패', '구독 플랜 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(): Promise<void> {
    if (!selectedTier) {
      Alert.alert('선택 필요', '구독 플랜을 먼저 선택해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const userId = requireUserId();
      await businessContractService.subscribeToTier(userId, selectedTier);
      Alert.alert('구독 시작', '구독 플랜이 적용되었습니다. 대시보드로 이동합니다.', [
        {
          text: '확인',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'B2BDashboard' }],
            });
          },
        },
      ]);
    } catch (error) {
      Alert.alert('구독 실패', getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function renderTierCard(tier: SubscriptionTierOption) {
    const isSelected = selectedTier === tier.id;

    return (
      <TouchableOpacity
        key={tier.id}
        style={[styles.tierCard, isSelected && styles.selectedTierCard, tier.isPopular && styles.popularTierCard]}
        onPress={() => setSelectedTier(tier.id)}
        activeOpacity={0.8}
      >
        {tier.isPopular ? (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>추천</Text>
          </View>
        ) : null}

        <Text style={[styles.tierName, isSelected && styles.selectedTierName]}>{tier.name}</Text>

        <View style={styles.priceContainer}>
          <Text style={[styles.priceAmount, isSelected && styles.selectedPriceAmount]}>{formatCurrency(tier.price)}</Text>
          <Text style={[styles.pricePeriod, isSelected && styles.selectedPricePeriod]}>/월</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="cube-outline" size={18} color={isSelected ? Colors.primary : Colors.text.secondary} />
          <Text style={[styles.infoText, isSelected && styles.selectedInfoText]}>월 {tier.deliveryLimit}건 포함</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="cash-outline" size={18} color={isSelected ? Colors.primary : Colors.text.secondary} />
          <Text style={[styles.infoText, isSelected && styles.selectedInfoText]}>초과 시 건당 {formatCurrency(tier.pricePerDelivery)}</Text>
        </View>

        <View style={styles.featuresContainer}>
          {tier.features.map((feature) => (
            <View key={feature} style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={18} color={isSelected ? Colors.primary : Colors.success} />
              <Text style={[styles.featureText, isSelected && styles.selectedInfoText]}>{feature}</Text>
            </View>
          ))}
        </View>

        {isSelected ? (
          <View style={styles.selectedIndicator}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>구독 플랜 선택</Text>
      </View>

      <View style={styles.descriptionContainer}>
        <Text style={styles.descriptionTitle}>비즈니스에 맞는 플랜을 선택해 주세요</Text>
        <Text style={styles.descriptionText}>지금은 바로 업그레이드하거나 더 낮은 플랜으로 조정할 수 있습니다.</Text>
      </View>

      <ScrollView style={styles.tiersContainer} contentContainerStyle={styles.tiersContent} showsVerticalScrollIndicator={false}>
        {tiers.map((tier) => renderTierCard(tier))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.subscribeButton, (!selectedTier || submitting) && styles.disabledButton]}
          onPress={() => void handleSubscribe()}
          disabled={!selectedTier || submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.subscribeButtonText}>{selectedTier ? '구독 시작하기' : '플랜을 선택해 주세요'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    textAlign: 'center',
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
    ...Typography.bodySmall,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoText: {
    ...Typography.body2,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  selectedInfoText: {
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
    backgroundColor: Colors.gray100,
  },
  subscribeButtonText: {
    ...Typography.body1,
    color: '#fff',
    fontWeight: 'bold',
  },
});
