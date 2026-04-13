import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useUser } from '../../contexts/UserContext';
import { getUserCoupons } from '../../services/coupon-service';
import { PointService } from '../../services/PointService';
import type { UserCoupon } from '../../types/coupon';
import Modal from '../common/Modal';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme';

interface CompoundPaymentPreviewProps {
  requestId: string;
  baseAmount: number;
  initialSelectedCouponId?: string | null;
  onCouponChanged?: (couponId: string | null) => void;
  readOnly?: boolean;
}

export function CompoundPaymentPreview({
  requestId,
  baseAmount,
  initialSelectedCouponId,
  onCouponChanged,
  readOnly = false,
}: CompoundPaymentPreviewProps) {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [availableCoupons, setAvailableCoupons] = useState<UserCoupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<UserCoupon | null>(null);
  const [pointBalance, setPointBalance] = useState(0);
  const [isCouponModalVisible, setIsCouponModalVisible] = useState(false);
  const [savingCoupon, setSavingCoupon] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    let mounted = true;

    async function load() {
      try {
        const [coupons, balance] = await Promise.all([
          getUserCoupons(user!.uid),
          PointService.getBalance(user!.uid),
        ]);
        if (!mounted) return;

        setPointBalance(balance);
        
        const validCoupons = coupons.filter(c => 
          c.status === 'active' && 
          (c.purpose === 'delivery_fee' || c.purpose === 'all')
        );
        setAvailableCoupons(validCoupons);

        if (initialSelectedCouponId) {
          const found = validCoupons.find(c => c.id === initialSelectedCouponId);
          if (found) setSelectedCoupon(found);
        }
      } catch (error) {
        console.error('Failed to load compound payment data:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, [user?.uid, initialSelectedCouponId]);

  const couponDiscount = React.useMemo(() => {
    if (!selectedCoupon) return 0;
    if (selectedCoupon.minOrderAmount && baseAmount < selectedCoupon.minOrderAmount) return 0;

    if (selectedCoupon.discountType === 'fixed') {
      return Math.min(selectedCoupon.discountValue, baseAmount);
    }
    const discount = Math.floor(baseAmount * (selectedCoupon.discountValue / 100));
    return selectedCoupon.maxDiscountAmount 
      ? Math.min(discount, selectedCoupon.maxDiscountAmount) 
      : discount;
  }, [selectedCoupon, baseAmount]);

  const afterCouponAmount = Math.max(0, baseAmount - couponDiscount);
  const pointCoverage = Math.min(pointBalance, afterCouponAmount);
  const finalPrice = Math.max(0, afterCouponAmount - pointCoverage);

  async function handleSelectCoupon(coupon: UserCoupon | null) {
    if (readOnly) return;
    try {
      setSavingCoupon(true);
      await updateDoc(doc(db, 'requests', requestId), {
        selectedCouponId: coupon ? coupon.id : null,
      });
      setSelectedCoupon(coupon);
      setIsCouponModalVisible(false);
      onCouponChanged?.(coupon ? coupon.id : null);
    } catch (error) {
      console.error('Failed to save coupon selection:', error);
    } finally {
      setSavingCoupon(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>예상 배송 요금</Text>
        <Text style={styles.value}>{baseAmount.toLocaleString()}원</Text>
      </View>

      <View style={styles.couponRow}>
        <View style={styles.couponLabelWrap}>
          <Text style={styles.label}>쿠폰 할인</Text>
          {!readOnly && (
            <TouchableOpacity 
              style={styles.changeButton} 
              onPress={() => setIsCouponModalVisible(true)}
              disabled={availableCoupons.length === 0}
            >
              <Text style={styles.changeButtonText}>변경</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.discountValue}>
          {couponDiscount > 0 ? `-${couponDiscount.toLocaleString()}원` : '0원'}
        </Text>
      </View>
      {selectedCoupon && couponDiscount > 0 && (
        <Text style={styles.couponNameHint}>{selectedCoupon.name} 적용됨</Text>
      )}

      {pointCoverage > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>포인트 우선 적용</Text>
          <Text style={styles.discountValue}>-{pointCoverage.toLocaleString()}원</Text>
        </View>
      )}

      <View style={styles.divider} />
      
      <View style={styles.row}>
        <Text style={styles.finalLabel}>최종 예상 결제 금액</Text>
        <Text style={styles.finalValue}>{finalPrice.toLocaleString()}원</Text>
      </View>

      {!readOnly && (
        <Modal
          visible={isCouponModalVisible}
          onClose={() => setIsCouponModalVisible(false)}
          variant="bottomSheet"
          animationType="slide"
          showCloseButton={true}
        >
          <View style={styles.sheetContainer}>
            <Text style={styles.sheetTitle}>사용 가능한 쿠폰</Text>
            {savingCoupon ? (
              <View style={styles.sheetLoading}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : (
              <FlatList
                data={availableCoupons}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.couponList}
                renderItem={({ item }) => {
                  const isSelected = selectedCoupon?.id === item.id;
                  const discountValueText = item.discountType === 'fixed' 
                    ? `${item.discountValue.toLocaleString()}원`
                    : `${item.discountValue}%`;
                  const expiryText = item.expiresAt 
                    ? (typeof (item.expiresAt as any).toDate === 'function' ? (item.expiresAt as any).toDate().toLocaleDateString() : new Date(item.expiresAt as any).toLocaleDateString())
                    : '';
                  return (
                    <TouchableOpacity
                      style={[styles.couponItem, isSelected && styles.couponItemSelected]}
                      onPress={() => void handleSelectCoupon(item)}
                    >
                      <View>
                        <Text style={[styles.couponName, isSelected && styles.couponNameSelected]}>{item.name}</Text>
                        <Text style={styles.couponDesc}>{item.description}</Text>
                      </View>
                      <View style={styles.couponRight}>
                        <Text style={[styles.couponDiscount, isSelected && styles.couponDiscountSelected]}>{discountValueText} 할인</Text>
                        {expiryText ? <Text style={styles.couponExpiry}>~ {expiryText}</Text> : null}
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListFooterComponent={
                  <TouchableOpacity
                    style={[styles.couponItem, !selectedCoupon && styles.couponItemSelected]}
                    onPress={() => void handleSelectCoupon(null)}
                  >
                    <Text style={[styles.couponName, !selectedCoupon && styles.couponNameSelected]}>적용 안 함</Text>
                  </TouchableOpacity>
                }
              />
            )}
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  loadingContainer: {
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  couponRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  couponLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  changeButton: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changeButtonText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  couponNameHint: {
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  value: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  discountValue: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  finalLabel: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  finalValue: {
    fontSize: Typography.fontSize.lg,
    color: Colors.primary,
    fontWeight: '800',
  },
  sheetContainer: { padding: Spacing.xl, minHeight: 300, maxHeight: 500 },
  sheetTitle: { fontSize: Typography.fontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  sheetLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
});
