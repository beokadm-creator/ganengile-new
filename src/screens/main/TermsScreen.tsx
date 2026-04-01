import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ParamListBase } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getPolicyConfigs } from '../../services/config-service';
import { SETTLEMENT_POLICY, SETTLEMENT_POLICY_LABELS } from '../../constants/settlementPolicy';

type NavigationProp = StackNavigationProp<ParamListBase>;

interface Props {
  navigation: NavigationProp;
}

interface Policy {
  id: string;
  title: string;
  content: string[];
  effectiveDate: string;
}

const defaultPolicies: Policy[] = [
  {
    id: 'terms',
    title: '이용약관',
    effectiveDate: '2026-03-29',
    content: [
      '제1조(목적)',
      '이 약관은 가는길에가 제공하는 미션형 생활 배송 서비스의 이용 조건과 운영 기준을 설명합니다.',
      '',
      '제2조(역할)',
      '이용자는 배송 요청을 만들고, 길러는 승인된 미션을 수행합니다.',
      '회원가입만으로 바로 길러가 되는 것이 아니라 본인확인, 정산 계좌 준비, 운영 승급 심사를 거쳐야 합니다.',
      '',
      '제3조(배송 구조)',
      '서비스는 RequestDraft, AI 분석, 견적, Delivery, Mission 구조를 기준으로 운영됩니다.',
      '즉시형 요청과 예약형 요청은 같은 엔진을 쓰더라도 매칭과 가격 전략이 다르게 적용될 수 있습니다.',
      '',
      '제4조(운영 개입)',
      'AI는 입력 보조, 가격 제안, 미션 분해, actor 선택, 재매칭에 개입할 수 있습니다.',
      '환불, 보증금 차감, 패널티, 본인확인, 최종 정산은 AI가 단독 확정하지 않으며 운영자가 마지막으로 검토합니다.',
    ],
  },
  {
    id: 'deposit',
    title: '보증금과 패널티',
    effectiveDate: '2026-03-29',
    content: [
      '보증금은 사고, 환불, 패널티 대응을 위한 안전 장치입니다.',
      '보증금 차감이나 환불은 자동으로 끝나지 않고 운영 검토를 거친 뒤 확정될 수 있습니다.',
      '',
      '지연, 미수령, 임의 취소, 손상 신고는 미션과 채팅 로그, 사진, 수령 확인, 운영 판단을 함께 반영합니다.',
      '테스트 모드에서는 결제·인증 API 없이도 흐름이 이어지지만 최종 마감은 운영 책임으로 남습니다.',
    ],
  },
  {
    id: 'settlement',
    title: '정산 정책',
    effectiveDate: '2026-03-29',
    content: [
      '정산은 고객 결제 금액 전체를 길러 지급액으로 보지 않습니다.',
      `${SETTLEMENT_POLICY_LABELS.platformFee}가 먼저 반영되고, 그 다음 길러 세전 수익을 기준으로 ${SETTLEMENT_POLICY_LABELS.combinedWithholding}가 계산됩니다.`,
      '',
      '운영 화면과 길러 수익 화면에는 세전 수익, 플랫폼 수수료, 원천징수, 실수령액이 분리되어 표시됩니다.',
      '계좌 인증, 본인확인, 환불 이슈, 패널티, 수동 검토 상태가 남아 있으면 정산은 보류될 수 있습니다.',
      '',
      `원천세 신고·납부는 일반적으로 지급일이 속한 달의 다음 달 10일까지 진행하는 흐름을 기준으로 준비합니다.`,
      `사업소득 간이지급명세서는 지급월의 다음 달 말일까지 제출하는 흐름을 기준으로 준비합니다.`,
    ],
  },
  {
    id: 'tax',
    title: '세금 안내',
    effectiveDate: '2026-03-29',
    content: [
      `${SETTLEMENT_POLICY_LABELS.businessIncomeTax}와 ${SETTLEMENT_POLICY_LABELS.localIncomeTax}를 합산한 ${SETTLEMENT_POLICY_LABELS.combinedWithholding}를 원천징수 기준으로 사용합니다.`,
      '길러 지급 로그에는 누적 원천징수 금액과 실수령 내역이 남습니다.',
      '',
      `연간 지급 내역은 ${SETTLEMENT_POLICY.annualFilingWindowLabel} 종합소득세 신고 시 참고해야 합니다.`,
      '최종 세무 판단과 실제 신고 의무는 개인의 사업 형태와 소득 구조에 따라 달라질 수 있습니다.',
      '',
      '예시',
      '세전 수익 5,000원',
      `플랫폼 수수료 10%: -500원`,
      '원천징수 3.3%: -149원',
      '실수령액: 4,351원',
      '',
      SETTLEMENT_POLICY.caution,
    ],
  },
];

export default function TermsScreen({ navigation: _navigation }: Props) {
  const [policies, setPolicies] = useState<Policy[]>(defaultPolicies);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy>(defaultPolicies[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPolicies = async () => {
      try {
        const configs = await getPolicyConfigs();
        if (configs.length > 0) {
          const loaded = configs.map((item) => ({
            id: item.policyId,
            title: item.title,
            content: item.content,
            effectiveDate: item.effectiveDate,
          }));
          setPolicies(loaded);
          setSelectedPolicy(loaded[0]);
        }
      } catch (error) {
        console.error('정책 설정을 불러오지 못해 기본 문구를 사용합니다:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadPolicies();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color=Colors.primary />
        <Text style={styles.loadingText}>정책 문서를 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerKicker}>policy center</Text>
        <Text style={styles.headerTitle}>이용약관과 정산 기준</Text>
        <Text style={styles.headerSubtitle}>
          결제, 보증금, 패널티, 세금, 정산 책임 범위를 서비스 기준에 맞춰 확인할 수 있습니다.
        </Text>
      </View>

      <View style={styles.contentContainer}>
        <ScrollView
          style={styles.sidebar}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sidebarContent}
        >
          {policies.map((policy) => (
            <TouchableOpacity
              key={policy.id}
              style={[
                styles.sidebarItem,
                selectedPolicy.id === policy.id ? styles.sidebarItemActive : undefined,
              ]}
              onPress={() => setSelectedPolicy(policy)}
            >
              <Text
                style={[
                  styles.sidebarItemText,
                  selectedPolicy.id === policy.id ? styles.sidebarItemTextActive : undefined,
                ]}
              >
                {policy.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={styles.policyContent} showsVerticalScrollIndicator={false}>
          <View style={styles.policyCard}>
            <View style={styles.policyHeader}>
              <Text style={styles.policyTitle}>{selectedPolicy.title}</Text>
              <Text style={styles.policyDate}>시행일 {selectedPolicy.effectiveDate}</Text>
            </View>

            <View style={styles.policyBody}>
              {selectedPolicy.content.map((paragraph, index) => (
                <Text
                  key={`${selectedPolicy.id}-${index}`}
                  style={[
                    styles.policyParagraph,
                    paragraph === '' ? styles.policyParagraphSpacing : undefined,
                  ]}
                >
                  {paragraph}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>정산 주의</Text>
            <Text style={styles.infoText}>
              실서비스 키가 준비되기 전에는 테스트 모드와 운영 수동 검토를 병행할 수 있으며, 이 경우에도 정산 로그와 승인 책임은 남습니다.
            </Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>문의</Text>
            <Text style={styles.infoText}>
              정책과 정산 기준에 대한 문의는 고객센터 또는 운영 채널로 연결됩니다.
            </Text>
          </View>
        </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  header: {
    backgroundColor: Colors.textPrimary,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerKicker: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  headerTitle: {
    marginTop: 8,
    color: Colors.surface,
    fontSize: 26,
    fontWeight: '700',
  },
  headerSubtitle: {
    marginTop: 8,
    color: Colors.border,
    fontSize: 14,
    lineHeight: 20,
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sidebar: {
    width: 126,
    marginRight: 12,
  },
  sidebarContent: {
    paddingBottom: 16,
  },
  sidebarItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sidebarItemActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sidebarItemText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  sidebarItemTextActive: {
    color: Colors.surface,
  },
  policyContent: {
    flex: 1,
  },
  policyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  policyHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  policyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  policyDate: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  policyBody: {
    paddingBottom: 12,
  },
  policyParagraph: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 22,
    marginBottom: 8,
  },
  policyParagraphSpacing: {
    height: 10,
    marginVertical: 4,
  },
  infoBox: {
    backgroundColor: Colors.primaryMint,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  infoText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.primary,
  },
});
