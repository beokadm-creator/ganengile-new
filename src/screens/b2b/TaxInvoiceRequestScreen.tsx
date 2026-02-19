/**
 * Tax Invoice Request Screen
 * B2B 기업용 세금계산서 발행 화면
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
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { b2bFirestoreService } from '../../services/b2b-firestore-service';
import { taxInvoiceService } from '../../services/tax-invoice-service';
import { requireUserId } from '../../services/firebase';
import type { MainStackNavigationProp } from '../../types/navigation';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';

interface InvoicePeriod {
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
}

interface InvoiceSummary {
  totalAmount: number;
  taxAmount: number;
  totalAmountWithTax: number;
  deliveryCount: number;
}

export default function TaxInvoiceRequestScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
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
    loadInvoiceData();
  }, []);

  const loadInvoiceData = async () => {
    try {
      const userId = await requireUserId();
      const { year, month } = b2bFirestoreService.getCurrentYearMonth();

      // 기간 설정
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      setPeriod({ year, month, startDate, endDate });

      // 기업 정보 조회
      const businessInfo = await b2bFirestoreService.getBusinessInfo(userId);
      if (businessInfo) {
        setBusinessNumber(businessInfo.businessNumber || '');
        setCompanyName(businessInfo.companyName || '');
        setCeoName(businessInfo.ceoName || '');
        setAddress(businessInfo.address || '');
        setContact(businessInfo.contact || '');
      }

      // 청구 금액 계산
      const summaryData = await b2bFirestoreService.getMonthlyStats(userId, year, month);
      if (summaryData) {
        const taxAmount = Math.round(summaryData.totalAmount * 0.1); // 부가세 10%
        setSummary({
          totalAmount: summaryData.totalAmount,
          taxAmount,
          totalAmountWithTax: summaryData.totalAmount + taxAmount,
          deliveryCount: summaryData.totalDeliveries,
        });
      }
    } catch (error) {
      console.error('Error loading invoice data:', error);
      Alert.alert('오류', '세금계산서 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // 필수 필드 검증
    if (!businessNumber || !companyName || !ceoName || !address || !contact) {
      Alert.alert('입력 오류', '모든 필수 정보를 입력해주세요.');
      return;
    }

    // 사업자등록번호 형식 검증 (XXX-XX-XXXX)
    const businessNumberRegex = /^\d{3}-\d{2}-\d{5}$/;
    if (!businessNumberRegex.test(businessNumber)) {
      Alert.alert(
        '입력 오류',
        '사업자등록번호 형식이 올바르지 않습니다.\n예: 123-45-67890'
      );
      return;
    }

    setSubmitting(true);
    try {
      const userId = await requireUserId();
      const invoiceData = {
        businessNumber,
        companyName,
        ceoName,
        address,
        contact,
        period: {
          startDate: period?.startDate,
          endDate: period?.endDate,
        },
        amount: summary?.totalAmount || 0,
        tax: summary?.taxAmount || 0,
        totalAmount: summary?.totalAmountWithTax || 0,
      };

      await taxInvoiceService.issueTaxInvoice(userId, invoiceData);

      Alert.alert(
        '발행 완료',
        '세금계산서가 발행되었습니다.\n홈택스로 전송되었습니다.',
        [
          {
            text: '확인',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('발행 실패', error.message || '세금계산서 발행에 실패했습니다.');
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

  const formatBusinessNumber = (text: string): string => {
    // 자동으로 하이픈 추가
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 5) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 10)}`;
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
        <Text style={styles.headerTitle}>세금계산서 발행</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 기간 정보 */}
        {period && (
          <View style={styles.periodCard}>
            <Text style={styles.periodTitle}>발행 기간</Text>
            <Text style={styles.periodText}>
              {period.year}년 {period.month}월
            </Text>
            <Text style={styles.periodDate}>
              {period.startDate.toLocaleDateString('ko-KR')} ~{' '}
              {period.endDate.toLocaleDateString('ko-KR')}
            </Text>
          </View>
        )}

        {/* 청구 금액 요약 */}
        {summary && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>청구 금액</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>공급가액</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.totalAmount)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>부가세</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.taxAmount)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, styles.totalLabel]}>합계</Text>
              <Text style={[styles.summaryValue, styles.totalValue]}>
                {formatCurrency(summary.totalAmountWithTax)}
              </Text>
            </View>
            <Text style={styles.deliveryCount}>
              총 {summary.deliveryCount}건의 배송
            </Text>
          </View>
        )}

        {/* 기업 정보 입력 */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>기업 정보</Text>

          {/* 사업자등록번호 */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              사업자등록번호 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={businessNumber}
              onChangeText={(text) => setBusinessNumber(formatBusinessNumber(text))}
              placeholder="123-45-67890"
              placeholderTextColor={Colors.text.tertiary}
              maxLength={12}
              autoCapitalize="none"
            />
          </View>

          {/* 상호명 */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              상호명 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="회사명을 입력하세요"
              placeholderTextColor={Colors.text.tertiary}
            />
          </View>

          {/* 대표자명 */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              대표자명 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={ceoName}
              onChangeText={setCeoName}
              placeholder="대표자 성명을 입력하세요"
              placeholderTextColor={Colors.text.tertiary}
            />
          </View>

          {/* 사업장 주소 */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              사업장 주소 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={address}
              onChangeText={setAddress}
              placeholder="사업장 주소를 입력하세요"
              placeholderTextColor={Colors.text.tertiary}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* 담당자 연락처 */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              담당자 연락처 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={contact}
              onChangeText={setContact}
              placeholder="010-XXXX-XXXX"
              placeholderTextColor={Colors.text.tertiary}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* 안내 사항 */}
        <View style={styles.noticeCard}>
          <View style={styles.noticeHeader}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.noticeTitle}>유의사항</Text>
          </View>
          <Text style={styles.noticeText}>
            • 세금계산서는 매월 10일 영업일 내에 발행됩니다.
          </Text>
          <Text style={styles.noticeText}>
            • 발행된 세금계산서는 홈택스로 자동 전송됩니다.
          </Text>
          <Text style={styles.noticeText}>
            • 수정이 필요한 경우 고객센터로 문의해주세요.
          </Text>
        </View>

        {/* 하단 여백 */}
        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            submitting && styles.disabledButton,
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>세금계산서 발행</Text>
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
    backgroundColor: '#fff',
  },
  backButton: {
    marginRight: Spacing.md,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  content: {
    flex: 1,
  },
  periodCard: {
    margin: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  periodTitle: {
    ...Typography.body2,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  periodText: {
    ...Typography.h2,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  periodDate: {
    ...Typography.body2,
    color: Colors.text.secondary,
  },
  summaryCard: {
    margin: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  summaryTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    ...Typography.body2,
    color: Colors.text.secondary,
  },
  summaryValue: {
    ...Typography.body1,
    color: Colors.text.primary,
    fontWeight: 'bold',
  },
  totalLabel: {
    ...Typography.h3,
    color: Colors.primary,
  },
  totalValue: {
    ...Typography.h2,
    color: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  deliveryCount: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  formCard: {
    margin: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  formTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.body2,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  required: {
    color: Colors.error,
  },
  input: {
    ...Typography.body1,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.primary,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  noticeCard: {
    margin: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.warning + '10',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.warning + '30',
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  noticeTitle: {
    ...Typography.body1,
    color: Colors.warning,
    fontWeight: 'bold',
    marginLeft: Spacing.xs,
  },
  noticeText: {
    ...Typography.body2,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: '#fff',
  },
  submitButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: Colors.background.secondary,
  },
  submitButtonText: {
    ...Typography.body1,
    color: '#fff',
    fontWeight: 'bold',
  },
});
