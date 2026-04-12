import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { StepContainer } from '../components/StepContainer';
import { QuoteBreakdownRow } from '../components/QuoteBreakdownRow';
import { Colors, Spacing, BorderRadius, Typography } from '../../../../theme';
import { useCreateRequestStore } from '../store/useCreateRequestStore';
import type { Beta1QuoteCard } from '../../../../services/beta1-orchestration-service';

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

  return (
    <StepContainer step={4} currentStep={store.activeStep}>
      <Text style={styles.sectionHeader}>예상 금액</Text>
      {quotes.map((card) => (
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
            <QuoteBreakdownRow label="예상금액 합계" value={card.pricing.publicPrice} strong />
          </View>
        </TouchableOpacity>
      ))}

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
        style={[styles.primaryButton, submitDisabled && styles.disabled]}
        onPress={() => void handleSubmit()}
        disabled={saving}
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
    </StepContainer>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { color: Colors.textPrimary, fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.extrabold, marginTop: Spacing.md, marginBottom: Spacing.sm },
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
