import { getPricingPolicyConfig } from './pricing-policy-config-service';

export interface RuntimeSettlementPolicy {
  platformFeeRate: number;
  businessIncomeTaxRate: number;
  localIncomeTaxRate: number;
  combinedWithholdingRate: number;
  vatRate: number;
  minimumWithdrawalAmount: number;
  annualFilingWindowLabel: string;
  withholdingRemitRule: string;
  simpleStatementRule: string;
  caution: string;
}

const TAX_SPLIT_RATIO = {
  national: 10,
  local: 1,
} as const;

function splitWithholdingRate(combinedRate: number) {
  const totalRatio = TAX_SPLIT_RATIO.national + TAX_SPLIT_RATIO.local;
  const businessIncomeTaxRate =
    Math.round(((combinedRate * TAX_SPLIT_RATIO.national) / totalRatio) * 10000) / 10000;
  const localIncomeTaxRate = Math.max(0, combinedRate - businessIncomeTaxRate);

  return {
    businessIncomeTaxRate,
    localIncomeTaxRate,
  };
}

export async function getRuntimeSettlementPolicy(): Promise<RuntimeSettlementPolicy> {
  const pricingPolicy = await getPricingPolicyConfig();
  const taxSplit = splitWithholdingRate(pricingPolicy.withholdingTaxRate);

  return {
    platformFeeRate: pricingPolicy.platformFeeRate,
    businessIncomeTaxRate: taxSplit.businessIncomeTaxRate,
    localIncomeTaxRate: taxSplit.localIncomeTaxRate,
    combinedWithholdingRate: pricingPolicy.withholdingTaxRate,
    vatRate: pricingPolicy.vatRate,
    minimumWithdrawalAmount: pricingPolicy.minimumWithdrawalAmount,
    annualFilingWindowLabel: '다음 해 5월 1일 ~ 5월 31일',
    withholdingRemitRule: '원천세 신고·납부는 일반적으로 지급일이 속하는 달의 다음 달 10일까지 진행합니다.',
    simpleStatementRule: '거주자의 사업소득 간이지급명세서는 지급일이 속하는 달의 다음 달 말일까지 제출하는 흐름을 기준으로 준비합니다.',
    caution: '실제 세무 신고와 원천세 납부 의무, 인적용역 해당 여부는 운영 정책과 개별 세무 상황을 함께 확인해야 합니다.',
  };
}

export function formatPercentLabel(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}
