export const SETTLEMENT_POLICY = {
  platformFeeRate: 0.1,
  businessIncomeTaxRate: 0.03,
  localIncomeTaxRate: 0.003,
  combinedWithholdingRate: 0.033,
  minimumWithdrawalAmount: 10000,
  annualFilingWindowLabel: '다음 해 5월 1일 ~ 5월 31일',
  withholdingRemitRule: '원천세 신고·납부는 일반적으로 지급일이 속하는 달의 다음 달 10일까지 진행합니다.',
  simpleStatementRule: '거주자의 사업소득 간이지급명세서는 지급일이 속하는 달의 다음 달 말일까지 제출하는 흐름을 기준으로 준비합니다.',
  caution: '실제 세무 신고와 원천세 납부 의무, 인적용역 해당 여부는 운영 정책과 개별 세무 상황을 함께 확인해야 합니다.',
} as const;

export const SETTLEMENT_POLICY_LABELS = {
  platformFee: '플랫폼 수수료 10%',
  businessIncomeTax: '사업소득세 3.0%',
  localIncomeTax: '지방소득세 0.3%',
  combinedWithholding: '사업소득 원천징수 3.3%',
} as const;

export function calculateWithholdingTax(amount: number): number {
  return Math.round(amount * SETTLEMENT_POLICY.combinedWithholdingRate);
}

export function calculateWithholdingBreakdown(amount: number) {
  const businessIncomeTax = Math.round(amount * SETTLEMENT_POLICY.businessIncomeTaxRate);
  const localIncomeTax = Math.round(amount * SETTLEMENT_POLICY.localIncomeTaxRate);
  const total = businessIncomeTax + localIncomeTax;

  return {
    businessIncomeTax,
    localIncomeTax,
    total,
  };
}
