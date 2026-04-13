import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, FlatList } from 'react-native';
import { StepContainer } from '../components/StepContainer';
import { QuoteBreakdownRow } from '../components/QuoteBreakdownRow';
import { Colors, Spacing, BorderRadius, Typography } from '../../../../theme';
import { useCreateRequestStore } from '../store/useCreateRequestStore';
import type { Beta1QuoteCard } from '../../../../services/beta1-orchestration-service';

import { useUser } from '../../../../contexts/UserContext';
import { getUserCoupons } from '../../../../services/coupon-service';
import { PointService } from '../../../../services/PointService';
import type { UserCoupon } from '../../../../types/coupon';
import Modal from '../../../../components/common/Modal';

type Props = {
  quotes: Beta1QuoteCard[];
  quoteSelectionTouchedRef: React.MutableRefObject<boolean>;
  missingItems: string[];
  handleClearDraft: () => Promise<void>;
  submitDisabled: boolean;
  handleSubmit: () => Promise<void>;
  saving: boolean;
  handleSaveDraftNow: () => Promise<void>;
};

export function Step4Quote({
  quotes,
  quoteSelectionTouchedRef,
  missingItems,
  handleClearDraft,
  submitDisabled,
  handleSubmit,
  saving,
  handleSaveDraftNow,
}: Props) {
  const store = useCreateRequestStore();
  const { user } = useUser();
  const [isCouponModalVisible, setIsCouponModalVisible] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<UserCoupon[]>([]);
  const [pointBalance, setPointBalance] = useState(0);
  const [isMounting, setIsMounting] = useState(true);

  useEffect(() => {
    // 렌더링 직후 발생할 수 있는 Ghost click 방지를 위해 잠시 대기
    const timer = setTimeout(() => setIsMounting(false), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    async function loadData() {
      if (!user?.uid) return;
      try {
        const [coupons, balance] = await Promise.all([
          getUserCoupons(user.uid),
          PointService.getBalance(user.uid)
        ]);
        setPointBalance(balance);
        
        const validCoupons = coupons.filter(c => 
          c.status === 'active' && 
          (c.purpose === 'delivery_fee' || c.purpose === 'all')
        );
        setAvailableCoupons(validCoupons);
        
        // 적용 가능한 쿠폰이 있고 현재 선택된 쿠폰이 없으면 첫 번째 쿠폰 자동 적용
        if (validCoupons.length > 0 && !store.selectedCoupon) {
          store.setSelectedCoupon(validCoupons[0]);
        }
      } catch (e) {
        console.error('Failed to load coupons/points in Step4:', e);
      }
    }
    void loadData();
  }, [user?.uid]);

  const getCouponDiscount = (price: number) => {
    if (!store.selectedCoupon) return 0;
    if (store.selectedCoupon.minOrderAmount && price < store.selectedCoupon.minOrderAmount) return 0;

    if (store.selectedCoupon.discountType === 'fixed') {
      return Math.min(store.selectedCoupon.discountValue, price);
    }
    const discount = Math.floor(price * (store.selectedCoupon.discountValue / 100));
    return store.selectedCoupon.maxDiscountAmount 
      ? Math.min(discount, store.selectedCoupon.maxDiscountAmount) 
      : discount;
  };

  return (
    <StepContainer step={4} currentStep={store.activeStep}>
      <Text style={styles.sectionHeader}>쿠폰 적용</Text>
      <TouchableOpacity
        style={styles.couponSelectorCard}
        onPress={() => setIsCouponModalVisible(true)}
        disabled={availableCoupons.length === 0}
      >
        <Text style={store.selectedCoupon ? styles.couponSelectedText : styles.couponPlaceholderText}>
          {store.selectedCoupon 
            ? `${store.selectedCoupon.name} 적용됨` 
            : availableCoupons.length > 0 
              ? '사용 가능한 쿠폰 선택하기' 
              : '사용 가능한 쿠폰이 없습니다'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionHeader}>예상 금액</Text>
      {quotes.map((card) => {
        const price = card.pricing.publicPrice;
        const discount = getCouponDiscount(price);
        const afterCouponAmount = Math.max(0, price - discount);
        const pointCoverage = Math.min(pointBalance, afterCouponAmount);
        const finalPrice = Math.max(0, afterCouponAmount - pointCoverage);

        return (
          <TouchableOpacity
          key={card.quoteType}
          style={[styles.quoteCard, store.selectedQuoteType === card.quoteType && styles.quoteCardSelected]}
          onPress={() => {
            quoteSelectionTouchedRef.current = true;
            store.setSelectedQuoteType(card.quoteType);
          }}
        >
          <View style={styles.quoteHeader}>
            <View style={styles.quoteTextWrap}>
              <Text style={styles.quoteLabel}>{card.label}</Text>
              <Text style={styles.quoteHeadline}>{card.headline}</Text>
              {store.aiQuotesLoading ? <Text style={styles.quoteEngineHint}>추천 엔진 반영 중</Text> : null}
              <Text style={styles.muted}>{card.recommendationReason}</Text>
              {(card.pricing as any).dynamicAdjustment && (card.pricing as any).dynamicAdjustment > 0 ? (
                <View style={styles.surchargeBadge}>
                  <Text style={styles.surchargeBadgeText}>⚡️ 수요/공급 할증 적용</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.quotePriceWrap}>
              <Text style={styles.quotePrice}>{card.priceLabel}</Text>
              <Text style={styles.muted}>{card.etaLabel}</Text>
            </View>
          </View>
          <View style={styles.quoteBreakdown}>
              <QuoteBreakdownRow label="기본요금" value={card.pricing.baseFee} />
              <QuoteBreakdownRow label="거리요금" value={card.pricing.distanceFee} />
              <QuoteBreakdownRow label="무게요금" value={card.pricing.weightFee} />
              <QuoteBreakdownRow label="크기요금" value={card.pricing.sizeFee} />
              <QuoteBreakdownRow label="긴급가산" value={card.pricing.urgencySurcharge} />
              <QuoteBreakdownRow label="주소픽업" value={card.pricing.addressPickupFee} />
              <QuoteBreakdownRow label="주소도착" value={card.pricing.addressDropoffFee} />
              <QuoteBreakdownRow label="사물함" value={card.pricing.lockerFee} />
              {((card.pricing as any).dynamicAdjustment || (card.pricing as any).manualAdjustment) ? (
                <QuoteBreakdownRow label="수동/동적 조정" value={((card.pricing as any).dynamicAdjustment ?? 0) + ((card.pricing as any).manualAdjustment ?? 0)} />
              ) : null}
              <QuoteBreakdownRow label="서비스수수료" value={card.pricing.serviceFee} />
              <QuoteBreakdownRow label="부가세" value={card.pricing.vat} />
              <View style={styles.quoteDivider} />
              
              <QuoteBreakdownRow label="예상금액" value={price} />
              {discount > 0 && (
                <QuoteBreakdownRow label={`쿠폰 할인 (${store.selectedCoupon?.name})`} value={-discount} strong />
              )}
              {pointCoverage > 0 && (
                <QuoteBreakdownRow label="보유 포인트 결제 예정" value={-pointCoverage} />
              )}
              
              <View style={styles.quoteDivider} />
              <QuoteBreakdownRow label="최종 결제 예정 금액" value={finalPrice} strong />
            </View>
          </TouchableOpacity>
        );
      })}

      {missingItems.length > 0 && (
        <View style={styles.missingCard}>
          <Text style={styles.missingTitle}>아래 항목을 완성하면 요청할 수 있습니다</Text>
          {missingItems.map((item) => (
            <View key={item} style={styles.missingRow}>
              <Text style={styles.missingDot}>•</Text>
              <Text style={styles.missingText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {(store.draftRestored || store.draftSaving) && (
        <View style={styles.draftCard}>
          <Text style={styles.draftTitle}>{store.draftRestored ? '이전 작성 내용을 이어서 불러왔습니다' : '입력 중인 내용을 임시 저장하고 있습니다'}</Text>
          <TouchableOpacity style={styles.draftAction} onPress={() => void handleClearDraft()}>
            <Text style={styles.draftActionText}>이어쓰기 기록 지우기</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryButton, (submitDisabled || isMounting) && styles.disabled]}
        onPress={() => void handleSubmit()}
        disabled={saving || isMounting}
      >
        {saving ? (
          <ActivityIndicator color={Colors.white} />
        ) : submitDisabled ? (
          <Text style={styles.primaryButtonText}>부족한 항목 확인하기</Text>
        ) : (
          <Text style={styles.primaryButtonText}>배송 요청하기</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleSaveDraftNow()} disabled={saving || store.draftSaving}>
        <Text style={styles.secondaryButtonText}>{store.draftSaving ? '저장 중...' : '임시 저장하기'}</Text>
      </TouchableOpacity>
      {/* 쿠폰 선택 모달 */}
      <Modal
        visible={isCouponModalVisible}
        onClose={() => setIsCouponModalVisible(false)}
        variant="bottomSheet"
        animationType="slide"
        showCloseButton={true}
      >
        <View style={styles.sheetContainer}>
          <Text style={styles.sheetTitle}>사용 가능한 쿠폰</Text>
          <FlatList
            data={availableCoupons}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.couponList}
            renderItem={({ item }) => {
              const isSelected = store.selectedCoupon?.id === item.id;
              const discountValue = item.discountType === 'fixed' 
                ? `${item.discountValue.toLocaleString()}원`
                : `${item.discountValue}%`;
              return (
                <TouchableOpacity
                  style={[styles.couponItem, isSelected && styles.couponItemSelected]}
                  onPress={() => {
                    store.setSelectedCoupon(item);
                    setIsCouponModalVisible(false);
                  }}
                >
                  <View>
                    <Text style={[styles.couponName, isSelected && styles.couponNameSelected]}>{item.name}</Text>
                    <Text style={styles.couponDesc}>{item.description}</Text>
                  </View>
                  <View style={styles.couponRight}>
                    <Text style={[styles.couponDiscount, isSelected && styles.couponDiscountSelected]}>{discountValue} 할인</Text>
                    <Text style={styles.couponExpiry}>~ {(item.expiresAt as any)?.toDate ? (item.expiresAt as any).toDate().toLocaleDateString() : new Date(item.expiresAt as any).toLocaleDateString()}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListFooterComponent={
              <TouchableOpacity
                style={[styles.couponItem, !store.selectedCoupon && styles.couponItemSelected]}
                onPress={() => {
                  store.setSelectedCoupon(null);
                  setIsCouponModalVisible(false);
                }}
              >
                <Text style={[styles.couponName, !store.selectedCoupon && styles.couponNameSelected]}>적용 안 함</Text>
              </TouchableOpacity>
            }
          />
        </View>
      </Modal>
    </StepContainer>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { color: Colors.textPrimary, fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.extrabold, marginTop: Spacing.md, marginBottom: Spacing.sm },
  
  // Coupon Styles
  couponSelectorCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md, alignItems: 'center' },
  couponSelectedText: { color: Colors.primary, fontWeight: '700', fontSize: Typography.fontSize.base },
  couponPlaceholderText: { color: Colors.textSecondary, fontWeight: '700', fontSize: Typography.fontSize.base },
  
  sheetContainer: { padding: Spacing.xl, minHeight: 300, maxHeight: 500 },
  sheetTitle: { fontSize: Typography.fontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  couponList: { paddingBottom: Spacing.xl },
  couponItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray200, marginBottom: Spacing.sm },
  couponItemSelected: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}08` },
  couponName: { fontSize: Typography.fontSize.base, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  couponNameSelected: { color: Colors.primary },
  couponDesc: { fontSize: Typography.fontSize.xs, color: Colors.gray500 },
  couponRight: { alignItems: 'flex-end' },
  couponDiscount: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.textPrimary },
  couponDiscountSelected: { color: Colors.primary },
  couponExpiry: { fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: 2 },
  quoteCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 2, borderColor: Colors.border, marginBottom: Spacing.md },
  quoteCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.successLight },
  quoteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  quoteTextWrap: { flex: 1, paddingRight: Spacing.lg },
  quoteLabel: { color: Colors.primary, fontWeight: Typography.fontWeight.bold, fontSize: 13, marginBottom: Spacing.xs },
  quoteHeadline: { color: Colors.textPrimary, fontWeight: Typography.fontWeight.extrabold, fontSize: Typography.fontSize.xl, marginBottom: Spacing.xs },
  quoteEngineHint: { color: Colors.accent, fontSize: 12, fontWeight: Typography.fontWeight.bold, marginBottom: Spacing.xs },
  muted: { color: Colors.textSecondary, fontSize: 13, marginTop: Spacing.xs },
  surchargeBadge: { alignSelf: 'flex-start', backgroundColor: Colors.warningLight, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm, marginTop: Spacing.sm },
  surchargeBadgeText: { color: Colors.warningDark, fontSize: 12, fontWeight: Typography.fontWeight.extrabold },
  quotePriceWrap: { alignItems: 'flex-end' },
  quotePrice: { color: Colors.textPrimary, fontWeight: Typography.fontWeight.extrabold, fontSize: Typography.fontSize['2xl'] },
  quoteBreakdown: { backgroundColor: Colors.gray50, borderRadius: BorderRadius.md, padding: Spacing.md, gap: Spacing.sm },
  quoteDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  missingCard: { backgroundColor: Colors.errorBackground, padding: Spacing.lg, borderRadius: BorderRadius.md, marginTop: Spacing.sm },
  missingTitle: { color: Colors.error, fontWeight: Typography.fontWeight.extrabold, marginBottom: Spacing.md },
  missingRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.xs },
  missingDot: { color: Colors.error, marginRight: Spacing.sm },
  missingText: { color: Colors.error, flex: 1 },
  draftCard: { backgroundColor: Colors.gray50, padding: Spacing.lg, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  draftTitle: { color: Colors.textPrimary, fontWeight: Typography.fontWeight.extrabold, fontSize: Typography.fontSize.base, flex: 1 },
  draftAction: { padding: Spacing.sm },
  draftActionText: { color: Colors.primary, fontWeight: Typography.fontWeight.bold, fontSize: 13 },
  primaryButton: { minHeight: 56, borderRadius: BorderRadius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md },
  primaryButtonText: { color: Colors.white, fontWeight: Typography.fontWeight.extrabold, fontSize: Typography.fontSize.xl },
  secondaryButton: { minHeight: 56, borderRadius: BorderRadius.full, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: Colors.textSecondary, fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.lg },
  disabled: { opacity: 0.5 },
});
