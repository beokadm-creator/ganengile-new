import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { b2bFirestoreService } from '../../services/b2b-firestore-service';
import { requireUserId } from '../../services/firebase';
import { taxInvoiceService } from '../../services/tax-invoice-service';
import type { B2BStackNavigationProp } from '../../types/navigation';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';

interface InvoicePeriod {
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
}

interface InvoiceSummary {
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  deliveryCount: number;
}

type BusinessInfo = {
  businessNumber?: string;
  companyName?: string;
  ceoName?: string;
  address?: string;
  contact?: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
}

function formatBusinessNumber(text: string): string {
  const cleaned = text.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 5) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 10)}`;
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

export default function TaxInvoiceRequestScreen() {
  const navigation = useNavigation<B2BStackNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [period, setPeriod] = useState<InvoicePeriod | null>(null);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [businessNumber, setBusinessNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [ceoName, setCeoName] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');

  useEffect(() => {
    void loadInvoiceData();
  }, []);

  async function loadInvoiceData(): Promise<void> {
    try {
      const userId = requireUserId();
      const { year, month } = b2bFirestoreService.getCurrentYearMonth();
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      setPeriod({ year, month, startDate, endDate });

      const businessInfo = (await b2bFirestoreService.getBusinessInfo(userId)) as BusinessInfo | null;
      if (businessInfo) {
        setBusinessNumber(businessInfo.businessNumber ?? '');
        setCompanyName(businessInfo.companyName ?? '');
        setCeoName(businessInfo.ceoName ?? '');
        setAddress(businessInfo.address ?? '');
        setContact(businessInfo.contact ?? '');
      }

      const summaryData = await b2bFirestoreService.getMonthlyStats(userId, year, month);
      if (summaryData) {
        const supplyAmount = summaryData.totalAmount;
        const taxAmount = Math.round(supplyAmount * 0.1);
        setSummary({
          supplyAmount,
          taxAmount,
          totalAmount: supplyAmount + taxAmount,
          deliveryCount: summaryData.totalDeliveries,
        });
      }
    } catch (error) {
      Alert.alert('불러오기 실패', '세금계산서 정보를 준비하지 못했습니다.');
      console.error('Failed to load tax invoice request data', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!businessNumber || !companyName || !ceoName || !address || !contact || !period || !summary) {
      Alert.alert('입력 확인', '필수 정보를 모두 입력해 주세요.');
      return;
    }

    const businessNumberRegex = /^\d{3}-\d{2}-\d{5}$/;
    if (!businessNumberRegex.test(businessNumber)) {
      Alert.alert('사업자번호 확인', '형식은 123-45-67890 입니다.');
      return;
    }

    setSubmitting(true);
    try {
      const userId = requireUserId();
      const invoiceId = await taxInvoiceService.issueTaxInvoice(userId, {
        businessNumber,
        companyName,
        ceoName,
        address,
        contact,
        period: {
          startDate: period.startDate,
          endDate: period.endDate,
        },
        amount: summary.supplyAmount,
        tax: summary.taxAmount,
        totalAmount: summary.totalAmount,
      });

      Alert.alert(
        '발행 요청 완료',
        `세금계산서 초안을 생성했습니다.\n문서 ID: ${invoiceId}\n운영 검토 후 발송 상태가 업데이트됩니다.`,
        [{ text: '확인', onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      Alert.alert('발행 실패', getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
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
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>세금계산서 발행</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {period ? (
          <View style={styles.periodCard}>
            <Text style={styles.periodTitle}>발행 대상 기간</Text>
            <Text style={styles.periodMonth}>{period.year}년 {period.month}월</Text>
            <Text style={styles.periodRange}>
              {period.startDate.toLocaleDateString('ko-KR')} ~ {period.endDate.toLocaleDateString('ko-KR')}
            </Text>
          </View>
        ) : null}

        {summary ? (
          <View style={styles.summaryCard}>
            <Text style={styles.cardTitle}>청구 금액 요약</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>공급가액</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.supplyAmount)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>부가세</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.taxAmount)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>합계</Text>
              <Text style={styles.totalValue}>{formatCurrency(summary.totalAmount)}</Text>
            </View>
            <Text style={styles.deliveryCount}>이번 달 완료 배송 {summary.deliveryCount}건 기준</Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>공급받는자 정보</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>사업자등록번호</Text>
            <TextInput
              style={styles.input}
              value={businessNumber}
              onChangeText={(text) => setBusinessNumber(formatBusinessNumber(text))}
              placeholder="123-45-67890"
              placeholderTextColor={Colors.textTertiary}
              maxLength={12}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>상호명</Text>
            <TextInput
              style={styles.input}
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="회사명을 입력해 주세요"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>대표자명</Text>
            <TextInput
              style={styles.input}
              value={ceoName}
              onChangeText={setCeoName}
              placeholder="대표자명을 입력해 주세요"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>사업장 주소</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={address}
              onChangeText={setAddress}
              placeholder="세금계산서에 표시할 주소를 입력해 주세요"
              placeholderTextColor={Colors.textTertiary}
              multiline
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>담당자 연락처</Text>
            <TextInput
              style={styles.input}
              value={contact}
              onChangeText={setContact}
              placeholder="010-1234-5678"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.noticeCard}>
          <View style={styles.noticeHeader}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.noticeTitle}>운영 검토 안내</Text>
          </View>
          <Text style={styles.noticeText}>발행 요청 후 문서는 운영 검토 대기 상태로 저장됩니다.</Text>
          <Text style={styles.noticeText}>이메일 발송과 입금 확인은 실서비스 연동 전까지 운영 검토로 진행됩니다.</Text>
          <Text style={styles.noticeText}>사업자 정보가 변경되면 다시 요청해 최신 정보로 문서를 발행해 주세요.</Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          disabled={submitting}
          onPress={() => {
            void handleSubmit();
          }}
        >
          {submitting ? <ActivityIndicator color=Colors.white /> : <Text style={styles.submitButtonText}>발행 요청하기</Text>}
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  periodCard: {
    margin: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.primaryMint,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    ...Shadows.sm,
  },
  periodTitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  periodMonth: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  periodRange: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  summaryCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  totalLabel: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    color: Colors.primary,
  },
  totalValue: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
    color: Colors.primary,
  },
  deliveryCount: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },
  formCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  input: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  noticeCard: {
    marginHorizontal: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  noticeTitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.warningDark,
    fontWeight: '800',
    marginLeft: Spacing.xs,
  },
  noticeText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.warningDark,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: Spacing.xl,
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.gray200,
  },
  submitButtonText: {
    fontSize: Typography.fontSize.base,
    color: Colors.white,
    fontWeight: '800',
  },
});
