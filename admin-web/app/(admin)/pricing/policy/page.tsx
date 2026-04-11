'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { calculateSharedDeliveryFee } from '../../../../../shared/pricing-policy';
import { MAJOR_STATIONS } from '../../../../../data/subway-stations';

type PricingPolicy = {
  version: string;
  baseFee: number;
  minFee: number;
  maxFee: number;
  platformFeeRate: number;
  vatRate: number;
  pgFeeRate: number;
  withholdingTaxRate: number;
  baseStations: number;
  baseDistanceFee: number;
  feePerStation: number;
  baseWeight: number;
  minWeightFee: number;
  feePerKg: number;
  sizeFees: {
    small: number;
    medium: number;
    large: number;
    xl: number;
    extra_large: number;
  };
  urgencyMultipliers: {
    normal: number;
    fast: number;
    urgent: number;
  };
  dynamicRules: {
    rainMultiplier: number;
    snowMultiplier: number;
    peakTimeMultiplier: number;
    professionalPeakMultiplier: number;
    lowSupplyThreshold: number;
    lowSupplyMultiplier: number;
    highSupplyThreshold: number;
    highSupplyDiscountMultiplier: number;
  };
  incentiveRules: {
    transferBonusPerHop: number;
    transferDiscount: number;
    professionalBonusRate: number;
    masterBonusRate: number;
  };
  quoteAdjustments: {
    addressPickupFee: number;
    addressDropoffFee: number;
    fastestReservationSurcharge: number;
    fastestImmediateSurcharge: number;
    balancedLockerAssistedFee: number;
    lowestPriceDistanceDiscount: number;
    lowestPriceReservationUrgencyDiscount: number;
    lowestPriceImmediateUrgencyDiscount: number;
    lowestPriceLockerFee: number;
    lowestPriceAddressPickupDiscountRate: number;
    lowestPriceAddressDropoffDiscountRate: number;
    lowestPriceServiceFeeDiscount: number;
    lowestPriceMinPublicPrice: number;
    lockerIncludedBaseFee: number;
    lockerIncludedReservationExtraFee: number;
    lockerIncludedImmediateExtraFee: number;
    lockerIncludedAddressPickupDiscountRate: number;
    lockerIncludedAddressDropoffDiscountRate: number;
    balancedReservationUrgencyOffset: number;
  };
  recommendationRules: {
    peakTimeMultiplier: number;
    professionalPeakMultiplier: number;
    rainMultiplier: number;
    snowMultiplier: number;
    lowSupplyMultiplier: number;
    highSupplyDiscountMultiplier: number;
    reservationDiscountMultiplier: number;
    maxRecommendationMultiplier: number;
  };
  timeRules: Array<{
    label: string;
    enabled: boolean;
    startHour: number;
    endHour: number;
    fixedAdjustment: number;
    multiplier: number;
  }>;
  bidStep: number;
  minimumWithdrawalAmount: number;
  recommendationMultiplier: number;
  notes: string;
};

type ApiResponse = {
  item?: Partial<PricingPolicy>;
  error?: string;
};

const emptyPolicy: PricingPolicy = {
  version: 'pricing-policy-v1',
  baseFee: 2000,
  minFee: 3000,
  maxFee: 10000,
  platformFeeRate: 0.1,
  vatRate: 0.1,
  pgFeeRate: 0.03,
  withholdingTaxRate: 0.033,
  baseStations: 5,
  baseDistanceFee: 600,
  feePerStation: 120,
  baseWeight: 1,
  minWeightFee: 100,
  feePerKg: 100,
  sizeFees: {
    small: 0,
    medium: 400,
    large: 800,
    xl: 1500,
    extra_large: 1500,
  },
  urgencyMultipliers: {
    normal: 0,
    fast: 0.1,
    urgent: 0.2,
  },
  dynamicRules: {
    rainMultiplier: 0.08,
    snowMultiplier: 0.18,
    peakTimeMultiplier: 0.12,
    professionalPeakMultiplier: 0.1,
    lowSupplyThreshold: 3,
    lowSupplyMultiplier: 0.12,
    highSupplyThreshold: 8,
    highSupplyDiscountMultiplier: -0.05,
  },
  incentiveRules: {
    transferBonusPerHop: 500,
    transferDiscount: 500,
    professionalBonusRate: 0.25,
    masterBonusRate: 0.35,
  },
  quoteAdjustments: {
    addressPickupFee: 900,
    addressDropoffFee: 800,
    fastestReservationSurcharge: 900,
    fastestImmediateSurcharge: 2500,
    balancedLockerAssistedFee: 1000,
    lowestPriceDistanceDiscount: 300,
    lowestPriceReservationUrgencyDiscount: 600,
    lowestPriceImmediateUrgencyDiscount: 200,
    lowestPriceLockerFee: 700,
    lowestPriceAddressPickupDiscountRate: 0.6,
    lowestPriceAddressDropoffDiscountRate: 0.6,
    lowestPriceServiceFeeDiscount: 150,
    lowestPriceMinPublicPrice: 3000,
    lockerIncludedBaseFee: 1200,
    lockerIncludedReservationExtraFee: 200,
    lockerIncludedImmediateExtraFee: 500,
    lockerIncludedAddressPickupDiscountRate: 0.7,
    lockerIncludedAddressDropoffDiscountRate: 0.7,
    balancedReservationUrgencyOffset: -200,
  },
  recommendationRules: {
    peakTimeMultiplier: 0.06,
    professionalPeakMultiplier: 0.04,
    rainMultiplier: 0.03,
    snowMultiplier: 0.07,
    lowSupplyMultiplier: 0.08,
    highSupplyDiscountMultiplier: -0.04,
    reservationDiscountMultiplier: -0.02,
    maxRecommendationMultiplier: 1.35,
  },
  timeRules: [
    {
      label: '출근 피크',
      enabled: true,
      startHour: 7,
      endHour: 9,
      fixedAdjustment: 500,
      multiplier: 1,
    },
    {
      label: '퇴근 피크',
      enabled: true,
      startHour: 18,
      endHour: 20,
      fixedAdjustment: 700,
      multiplier: 1,
    },
  ],
  bidStep: 1000,
  minimumWithdrawalAmount: 10000,
  recommendationMultiplier: 1.05,
  notes: '운영 기준 가격 정책',
};

export default function PricingPolicyPage() {
  const [policy, setPolicy] = useState<PricingPolicy>(emptyPolicy);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewPickupStationId, setPreviewPickupStationId] = useState('150');
  const [previewDeliveryStationId, setPreviewDeliveryStationId] = useState('222');
  const [previewWeight, setPreviewWeight] = useState(2);
  const [previewPackageSize, setPreviewPackageSize] = useState<'small' | 'medium' | 'large' | 'xl'>('medium');
  const [previewRequestMode, setPreviewRequestMode] = useState<'immediate' | 'reservation'>('immediate');
  const [previewUrgency, setPreviewUrgency] = useState<'normal' | 'fast' | 'urgent'>('fast');
  const [previewWeather, setPreviewWeather] = useState<'clear' | 'rain' | 'snow'>('clear');
  const [previewNearbyGillerCount, setPreviewNearbyGillerCount] = useState(3);
  const [previewPeakTime, setPreviewPeakTime] = useState(true);
  const [previewAddressPickup, setPreviewAddressPickup] = useState(false);
  const [previewAddressDropoff, setPreviewAddressDropoff] = useState(false);
  const [previewRequestedHour, setPreviewRequestedHour] = useState(8);

  const stationOptions = useMemo(
    () => [...MAJOR_STATIONS].sort((a, b) => a.stationName.localeCompare(b.stationName, 'ko-KR')),
    []
  );

  const previewPickupStation =
    stationOptions.find((station) => station.stationId === previewPickupStationId) ?? stationOptions[0];
  const previewDeliveryStation =
    stationOptions.find((station) => station.stationId === previewDeliveryStationId) ?? stationOptions[1] ?? stationOptions[0];

  const estimatedStationCount = useMemo(() => {
    return estimateStationCountBetweenStations(previewPickupStation, previewDeliveryStation);
  }, [previewDeliveryStation, previewPickupStation]);

  const stationDistanceKm = useMemo(() => {
    if (!previewPickupStation || !previewDeliveryStation) {
      return 0;
    }

    return calculateDistanceKm(previewPickupStation, previewDeliveryStation);
  }, [previewDeliveryStation, previewPickupStation]);

  const previewResult = useMemo(() => calculateSharedDeliveryFee({
    stationCount: estimatedStationCount,
    weight: previewWeight,
    packageSize: previewPackageSize,
    urgency: previewUrgency,
    context: {
      weather: previewWeather,
      isPeakTime: previewPeakTime,
      nearbyGillerCount: previewNearbyGillerCount,
      isProfessionalPeak: previewPeakTime,
      requestedHour: previewRequestedHour,
    },
  }, policy), [estimatedStationCount, policy, previewNearbyGillerCount, previewPackageSize, previewPeakTime, previewRequestedHour, previewUrgency, previewWeather, previewWeight]);

  const baselineRecommendation = useMemo(
    () => calculateRecommendationPrice({
      policy,
      baseTotalFee: previewResult.totalFee,
      weather: previewWeather,
      isPeakTime: previewPeakTime,
      isProfessionalPeak: previewPeakTime,
      nearbyGillerCount: previewNearbyGillerCount,
      requestMode: previewRequestMode,
    }),
    [policy, previewNearbyGillerCount, previewPeakTime, previewRequestMode, previewResult.totalFee, previewWeather]
  );

  const scenarioSummary = useMemo(
    () =>
      buildScenarioSummary({
        previewResult,
        policy,
        requestMode: previewRequestMode,
        hasAddressPickup: previewAddressPickup,
        hasAddressDropoff: previewAddressDropoff,
        recommendationPrice: baselineRecommendation,
        requestedHour: previewRequestedHour,
      }),
    [baselineRecommendation, policy, previewAddressDropoff, previewAddressPickup, previewRequestMode, previewRequestedHour, previewResult]
  );

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pricing-policy');
      const json = (await res.json()) as ApiResponse;
      if (res.ok && json.item) {
        setPolicy({
          ...emptyPolicy,
          ...json.item,
          sizeFees: {
            ...emptyPolicy.sizeFees,
            ...(json.item.sizeFees ?? {}),
          },
          urgencyMultipliers: {
            ...emptyPolicy.urgencyMultipliers,
            ...(json.item.urgencyMultipliers ?? {}),
          },
          dynamicRules: {
            ...emptyPolicy.dynamicRules,
            ...(json.item.dynamicRules ?? {}),
          },
          incentiveRules: {
            ...emptyPolicy.incentiveRules,
            ...(json.item.incentiveRules ?? {}),
          },
          quoteAdjustments: {
            ...emptyPolicy.quoteAdjustments,
            ...(json.item.quoteAdjustments ?? {}),
          },
          recommendationRules: {
            ...emptyPolicy.recommendationRules,
            ...(json.item.recommendationRules ?? {}),
          },
          timeRules: Array.isArray(json.item.timeRules) && json.item.timeRules.length > 0
            ? json.item.timeRules.map((rule, index) => ({
                label: rule?.label ?? `시간 규칙 ${index + 1}`,
                enabled: rule?.enabled ?? true,
                startHour: rule?.startHour ?? 9,
                endHour: rule?.endHour ?? 18,
                fixedAdjustment: rule?.fixedAdjustment ?? 0,
                multiplier: rule?.multiplier ?? 1,
              }))
            : emptyPolicy.timeRules,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof PricingPolicy>(key: K, value: PricingPolicy[K]) {
    setPolicy((prev) => ({ ...prev, [key]: value }));
  }

  function updateNestedField<K extends keyof PricingPolicy['sizeFees']>(key: K, value: number) {
    setPolicy((prev) => ({
      ...prev,
      sizeFees: { ...prev.sizeFees, [key]: value },
    }));
  }

  function updateUrgencyField<K extends keyof PricingPolicy['urgencyMultipliers']>(key: K, value: number) {
    setPolicy((prev) => ({
      ...prev,
      urgencyMultipliers: { ...prev.urgencyMultipliers, [key]: value },
    }));
  }

  function updateDynamicField<K extends keyof PricingPolicy['dynamicRules']>(key: K, value: number) {
    setPolicy((prev) => ({
      ...prev,
      dynamicRules: { ...prev.dynamicRules, [key]: value },
    }));
  }

  function updateIncentiveField<K extends keyof PricingPolicy['incentiveRules']>(key: K, value: number) {
    setPolicy((prev) => ({
      ...prev,
      incentiveRules: { ...prev.incentiveRules, [key]: value },
    }));
  }

  function updateQuoteField<K extends keyof PricingPolicy['quoteAdjustments']>(key: K, value: number) {
    setPolicy((prev) => ({
      ...prev,
      quoteAdjustments: { ...prev.quoteAdjustments, [key]: value },
    }));
  }

  function updateRecommendationField<K extends keyof PricingPolicy['recommendationRules']>(key: K, value: number) {
    setPolicy((prev) => ({
      ...prev,
      recommendationRules: { ...prev.recommendationRules, [key]: value },
    }));
  }

  function updateTimeRule(index: number, key: keyof PricingPolicy['timeRules'][number], value: string | number | boolean) {
    setPolicy((prev) => ({
      ...prev,
      timeRules: prev.timeRules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, [key]: value } : rule
      ),
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/pricing-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok) {
        window.alert(json.error ?? '저장에 실패했습니다.');
        return;
      }
      window.alert('가격 정책을 저장했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-slate-500">불러오는 중...</div>;
  }

  return (
    <div className="max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">가격 정책</h1>
        <p className="mt-2 text-sm text-slate-500">운영 기준</p>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
          <h2 className="text-base font-semibold text-slate-900">정책 역할</h2>
          <p className="mt-2 text-sm text-slate-600">
            기본요금, 환경 가중치, 수수료, 추천가 한계를 정하는 기준선입니다.
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">엔진 역할</h2>
          <p className="mt-2 text-sm text-slate-600">
            이 기준선을 바탕으로 실제 요청 상황, 공급 상태, 학습 데이터까지 반영해 사용자 제시가를 만듭니다.
          </p>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="기본 요금">
          <NumberField label="기본요금" value={policy.baseFee} onChange={(value) => updateField('baseFee', value)} />
          <NumberField label="최소요금" value={policy.minFee} onChange={(value) => updateField('minFee', value)} />
          <NumberField label="최대요금" value={policy.maxFee} onChange={(value) => updateField('maxFee', value)} />
          <NumberField label="기준 역 수" value={policy.baseStations} onChange={(value) => updateField('baseStations', value)} />
          <NumberField label="기준 거리요금" value={policy.baseDistanceFee} onChange={(value) => updateField('baseDistanceFee', value)} />
          <NumberField label="역당 가산" value={policy.feePerStation} onChange={(value) => updateField('feePerStation', value)} />
        </Section>

        <Section title="무게 및 수수료">
          <NumberField label="기준 무게(kg)" value={policy.baseWeight} step="0.1" onChange={(value) => updateField('baseWeight', value)} />
          <NumberField label="최소 무게요금" value={policy.minWeightFee} onChange={(value) => updateField('minWeightFee', value)} />
          <NumberField label="kg당 가산" value={policy.feePerKg} onChange={(value) => updateField('feePerKg', value)} />
          <RateField label="플랫폼 수수료율" value={policy.platformFeeRate} onChange={(value) => updateField('platformFeeRate', value)} />
          <RateField label="부가세율" value={policy.vatRate} onChange={(value) => updateField('vatRate', value)} />
          <RateField label="PG 수수료율" value={policy.pgFeeRate} onChange={(value) => updateField('pgFeeRate', value)} />
          <RateField label="원천징수율" value={policy.withholdingTaxRate} onChange={(value) => updateField('withholdingTaxRate', value)} />
        </Section>

        <Section title="크기 및 긴급도">
          <NumberField label="소형 가산" value={policy.sizeFees.small} onChange={(value) => updateNestedField('small', value)} />
          <NumberField label="중형 가산" value={policy.sizeFees.medium} onChange={(value) => updateNestedField('medium', value)} />
          <NumberField label="대형 가산" value={policy.sizeFees.large} onChange={(value) => updateNestedField('large', value)} />
          <NumberField label="특대형 가산" value={policy.sizeFees.xl} onChange={(value) => updateNestedField('xl', value)} />
          <RateField label="빠른 요청 가산율" value={policy.urgencyMultipliers.fast} onChange={(value) => updateUrgencyField('fast', value)} />
          <RateField label="긴급 요청 가산율" value={policy.urgencyMultipliers.urgent} onChange={(value) => updateUrgencyField('urgent', value)} />
        </Section>

        <Section title="환경 가변 규칙">
          <RateField label="비 가산율" value={policy.dynamicRules.rainMultiplier} onChange={(value) => updateDynamicField('rainMultiplier', value)} />
          <RateField label="눈 가산율" value={policy.dynamicRules.snowMultiplier} onChange={(value) => updateDynamicField('snowMultiplier', value)} />
          <RateField label="피크타임 가산율" value={policy.dynamicRules.peakTimeMultiplier} onChange={(value) => updateDynamicField('peakTimeMultiplier', value)} />
          <RateField label="전문길러 피크 가산율" value={policy.dynamicRules.professionalPeakMultiplier} onChange={(value) => updateDynamicField('professionalPeakMultiplier', value)} />
          <NumberField label="낮은 공급 임계치" value={policy.dynamicRules.lowSupplyThreshold} onChange={(value) => updateDynamicField('lowSupplyThreshold', value)} />
          <RateField label="낮은 공급 가산율" value={policy.dynamicRules.lowSupplyMultiplier} onChange={(value) => updateDynamicField('lowSupplyMultiplier', value)} />
          <NumberField label="높은 공급 임계치" value={policy.dynamicRules.highSupplyThreshold} onChange={(value) => updateDynamicField('highSupplyThreshold', value)} />
          <RateField label="높은 공급 할인율" value={policy.dynamicRules.highSupplyDiscountMultiplier} onChange={(value) => updateDynamicField('highSupplyDiscountMultiplier', value)} />
        </Section>

        <Section title="보너스 및 환승 정책">
          <NumberField label="환승 1회 보너스" value={policy.incentiveRules.transferBonusPerHop} onChange={(value) => updateIncentiveField('transferBonusPerHop', value)} />
          <NumberField label="환승 할인" value={policy.incentiveRules.transferDiscount} onChange={(value) => updateIncentiveField('transferDiscount', value)} />
          <RateField label="전문길러 보너스율" value={policy.incentiveRules.professionalBonusRate} onChange={(value) => updateIncentiveField('professionalBonusRate', value)} />
          <RateField label="마스터 보너스율" value={policy.incentiveRules.masterBonusRate} onChange={(value) => updateIncentiveField('masterBonusRate', value)} />
        </Section>

        <Section title="견적 카드 보정">
          <NumberField label="주소 픽업 가산" value={policy.quoteAdjustments.addressPickupFee} onChange={(value) => updateQuoteField('addressPickupFee', value)} />
          <NumberField label="주소 도착 가산" value={policy.quoteAdjustments.addressDropoffFee} onChange={(value) => updateQuoteField('addressDropoffFee', value)} />
          <NumberField label="즉시 빠른 견적 가산" value={policy.quoteAdjustments.fastestImmediateSurcharge} onChange={(value) => updateQuoteField('fastestImmediateSurcharge', value)} />
          <NumberField label="예약 빠른 견적 가산" value={policy.quoteAdjustments.fastestReservationSurcharge} onChange={(value) => updateQuoteField('fastestReservationSurcharge', value)} />
          <NumberField label="균형형 사물함 가산" value={policy.quoteAdjustments.balancedLockerAssistedFee} onChange={(value) => updateQuoteField('balancedLockerAssistedFee', value)} />
          <NumberField label="저가형 거리 할인" value={policy.quoteAdjustments.lowestPriceDistanceDiscount} onChange={(value) => updateQuoteField('lowestPriceDistanceDiscount', value)} />
          <NumberField label="저가형 예약 긴급 할인" value={policy.quoteAdjustments.lowestPriceReservationUrgencyDiscount} onChange={(value) => updateQuoteField('lowestPriceReservationUrgencyDiscount', value)} />
          <NumberField label="저가형 즉시 긴급 할인" value={policy.quoteAdjustments.lowestPriceImmediateUrgencyDiscount} onChange={(value) => updateQuoteField('lowestPriceImmediateUrgencyDiscount', value)} />
          <NumberField label="저가형 사물함 가산" value={policy.quoteAdjustments.lowestPriceLockerFee} onChange={(value) => updateQuoteField('lowestPriceLockerFee', value)} />
          <NumberField label="저가형 서비스요금 할인" value={policy.quoteAdjustments.lowestPriceServiceFeeDiscount} onChange={(value) => updateQuoteField('lowestPriceServiceFeeDiscount', value)} />
          <NumberField label="저가형 최소 노출가" value={policy.quoteAdjustments.lowestPriceMinPublicPrice} onChange={(value) => updateQuoteField('lowestPriceMinPublicPrice', value)} />
          <NumberField label="사물함 포함 기본 가산" value={policy.quoteAdjustments.lockerIncludedBaseFee} onChange={(value) => updateQuoteField('lockerIncludedBaseFee', value)} />
          <NumberField label="사물함 포함 예약 추가" value={policy.quoteAdjustments.lockerIncludedReservationExtraFee} onChange={(value) => updateQuoteField('lockerIncludedReservationExtraFee', value)} />
          <NumberField label="사물함 포함 즉시 추가" value={policy.quoteAdjustments.lockerIncludedImmediateExtraFee} onChange={(value) => updateQuoteField('lockerIncludedImmediateExtraFee', value)} />
          <RateField label="저가형 픽업 할인 배수" value={policy.quoteAdjustments.lowestPriceAddressPickupDiscountRate} onChange={(value) => updateQuoteField('lowestPriceAddressPickupDiscountRate', value)} />
          <RateField label="저가형 도착 할인 배수" value={policy.quoteAdjustments.lowestPriceAddressDropoffDiscountRate} onChange={(value) => updateQuoteField('lowestPriceAddressDropoffDiscountRate', value)} />
          <RateField label="사물함 포함 픽업 할인 배수" value={policy.quoteAdjustments.lockerIncludedAddressPickupDiscountRate} onChange={(value) => updateQuoteField('lockerIncludedAddressPickupDiscountRate', value)} />
          <RateField label="사물함 포함 도착 할인 배수" value={policy.quoteAdjustments.lockerIncludedAddressDropoffDiscountRate} onChange={(value) => updateQuoteField('lockerIncludedAddressDropoffDiscountRate', value)} />
          <NumberField label="예약 균형형 긴급 조정" value={policy.quoteAdjustments.balancedReservationUrgencyOffset} onChange={(value) => updateQuoteField('balancedReservationUrgencyOffset', value)} />
        </Section>

        <Section title="추천가 보정">
          <RateField label="피크 추천 가산" value={policy.recommendationRules.peakTimeMultiplier} onChange={(value) => updateRecommendationField('peakTimeMultiplier', value)} />
          <RateField label="전문 피크 추천 가산" value={policy.recommendationRules.professionalPeakMultiplier} onChange={(value) => updateRecommendationField('professionalPeakMultiplier', value)} />
          <RateField label="비 추천 가산" value={policy.recommendationRules.rainMultiplier} onChange={(value) => updateRecommendationField('rainMultiplier', value)} />
          <RateField label="눈 추천 가산" value={policy.recommendationRules.snowMultiplier} onChange={(value) => updateRecommendationField('snowMultiplier', value)} />
          <RateField label="공급 부족 추천 가산" value={policy.recommendationRules.lowSupplyMultiplier} onChange={(value) => updateRecommendationField('lowSupplyMultiplier', value)} />
          <RateField label="공급 충분 추천 할인" value={policy.recommendationRules.highSupplyDiscountMultiplier} onChange={(value) => updateRecommendationField('highSupplyDiscountMultiplier', value)} />
          <RateField label="예약 추천 할인" value={policy.recommendationRules.reservationDiscountMultiplier} onChange={(value) => updateRecommendationField('reservationDiscountMultiplier', value)} />
          <RateField label="추천가 최대 배수" value={policy.recommendationRules.maxRecommendationMultiplier} onChange={(value) => updateRecommendationField('maxRecommendationMultiplier', value)} />
        </Section>

        <Section title="요청 시간 할증">
          {policy.timeRules.map((rule, index) => (
            <div key={`${rule.label}-${index}`} className="grid gap-4 rounded-xl border border-slate-200 p-4">
              <Field label="이름">
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={rule.label}
                  onChange={(event) => updateTimeRule(index, 'label', event.target.value)}
                />
              </Field>
              <div className="grid gap-4 lg:grid-cols-2">
                <NumberField label="시작 시" value={rule.startHour} onChange={(value) => updateTimeRule(index, 'startHour', value)} />
                <NumberField label="종료 시" value={rule.endHour} onChange={(value) => updateTimeRule(index, 'endHour', value)} />
                <NumberField label="고정 가산" value={rule.fixedAdjustment} onChange={(value) => updateTimeRule(index, 'fixedAdjustment', value)} />
                <RateField label="배수" value={rule.multiplier} onChange={(value) => updateTimeRule(index, 'multiplier', value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) => updateTimeRule(index, 'enabled', event.target.checked)}
                />
                사용
              </label>
            </div>
          ))}
        </Section>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <NumberField label="입찰 권장 스텝" value={policy.bidStep} onChange={(value) => updateField('bidStep', value)} />
          <NumberField label="최소 출금 금액" value={policy.minimumWithdrawalAmount} onChange={(value) => updateField('minimumWithdrawalAmount', value)} />
          <RateField label="추천가 배수" value={policy.recommendationMultiplier} onChange={(value) => updateField('recommendationMultiplier', value)} />
        </div>
        <Field label="운영 메모">
          <textarea
            className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={policy.notes}
            onChange={(event) => updateField('notes', event.target.value)}
          />
        </Field>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">시나리오 미리보기</h2>
        <p className="mt-2 text-sm text-slate-500">실제 역 기준 데모</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          <Field label="출발역">
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={previewPickupStationId}
              onChange={(event) => setPreviewPickupStationId(event.target.value)}
            >
              {stationOptions.map((station) => (
                <option key={station.stationId} value={station.stationId}>
                  {station.stationName} · {station.lines[0]?.lineName ?? '-'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="도착역">
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={previewDeliveryStationId}
              onChange={(event) => setPreviewDeliveryStationId(event.target.value)}
            >
              {stationOptions.map((station) => (
                <option key={station.stationId} value={station.stationId}>
                  {station.stationName} · {station.lines[0]?.lineName ?? '-'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="요청 방식">
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={previewRequestMode}
              onChange={(event) => setPreviewRequestMode(event.target.value as 'immediate' | 'reservation')}
            >
              <option value="immediate">즉시</option>
              <option value="reservation">예약</option>
            </select>
          </Field>
          <NumberField label="적용 시간" value={previewRequestedHour} onChange={setPreviewRequestedHour} />
          <NumberField label="무게(kg)" value={previewWeight} step="0.1" onChange={setPreviewWeight} />
          <Field label="크기">
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={previewPackageSize}
              onChange={(event) => setPreviewPackageSize(event.target.value as 'small' | 'medium' | 'large' | 'xl')}
            >
              <option value="small">소형</option>
              <option value="medium">중형</option>
              <option value="large">대형</option>
              <option value="xl">특대형</option>
            </select>
          </Field>
          <Field label="긴급도">
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={previewUrgency} onChange={(event) => setPreviewUrgency(event.target.value as 'normal' | 'fast' | 'urgent')}>
              <option value="normal">보통</option>
              <option value="fast">빠름</option>
              <option value="urgent">긴급</option>
            </select>
          </Field>
          <Field label="날씨">
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={previewWeather} onChange={(event) => setPreviewWeather(event.target.value as 'clear' | 'rain' | 'snow')}>
              <option value="clear">맑음</option>
              <option value="rain">비</option>
              <option value="snow">눈</option>
            </select>
          </Field>
          <NumberField label="주변 길러 수" value={previewNearbyGillerCount} onChange={setPreviewNearbyGillerCount} />
          <Field label="시간대">
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={previewPeakTime ? 'peak' : 'normal'} onChange={(event) => setPreviewPeakTime(event.target.value === 'peak')}>
              <option value="normal">일반 시간대</option>
              <option value="peak">피크 시간대</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={previewAddressPickup} onChange={(event) => setPreviewAddressPickup(event.target.checked)} />
            주소 픽업 포함
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={previewAddressDropoff} onChange={(event) => setPreviewAddressDropoff(event.target.checked)} />
            주소 도착 포함
          </label>
        </div>
        <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 lg:grid-cols-4">
          <PreviewMetric label="직선 거리" value={`${stationDistanceKm.toFixed(1)}km`} />
          <PreviewMetric label="추정 역 수" value={`${estimatedStationCount}역`} />
          <PreviewMetric label="기준 요금" value={`${previewResult.totalFee.toLocaleString()}원`} />
          <PreviewMetric label="엔진 추천 기준" value={`${baselineRecommendation.toLocaleString()}원`} />
        </div>
        <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 lg:grid-cols-3">
          <PreviewMetric label="기본 + 거리" value={`${(previewResult.baseFee + previewResult.distanceFee).toLocaleString()}원`} />
          <PreviewMetric label="환경 보정" value={`${previewResult.dynamicAdjustment >= 0 ? '+' : ''}${previewResult.dynamicAdjustment.toLocaleString()}원`} />
          <PreviewMetric label="시간 할증" value={`${scenarioSummary.timeAdjustment >= 0 ? '+' : ''}${scenarioSummary.timeAdjustment.toLocaleString()}원`} />
          <PreviewMetric label="플랫폼 몫" value={`${previewResult.breakdown.platformFee.toLocaleString()}원`} />
          <PreviewMetric label="길러 몫" value={`${previewResult.breakdown.gillerFee.toLocaleString()}원`} />
          <PreviewMetric label="부가세" value={`${previewResult.vat.toLocaleString()}원`} />
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <PreviewMetric label="주소 픽업 기준" value={`${scenarioSummary.addressPickupFee.toLocaleString()}원`} />
          <PreviewMetric label="주소 도착 기준" value={`${scenarioSummary.addressDropoffFee.toLocaleString()}원`} />
          <PreviewMetric label="추천가 보정분" value={`${scenarioSummary.recommendationDelta >= 0 ? '+' : ''}${scenarioSummary.recommendationDelta.toLocaleString()}원`} />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? '저장 중...' : '가격 정책 저장'}
        </button>
      </div>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-slate-700">{label}</div>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        step={step ?? '1'}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))}
      />
    </Field>
  );
}

function RateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={`${label} (${Math.round(value * 1000) / 10}%)`}>
      <input
        type="number"
        step="0.01"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))}
      />
    </Field>
  );
}

function calculateDistanceKm(
  from: (typeof MAJOR_STATIONS)[number],
  to: (typeof MAJOR_STATIONS)[number]
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.location.latitude - from.location.latitude);
  const dLng = toRadians(to.location.longitude - from.location.longitude);
  const lat1 = toRadians(from.location.latitude);
  const lat2 = toRadians(to.location.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateStationCountBetweenStations(
  from: (typeof MAJOR_STATIONS)[number],
  to: (typeof MAJOR_STATIONS)[number]
) {
  const distanceKm = calculateDistanceKm(from, to);
  return Math.max(2, Math.round(distanceKm / 1.8) + 1);
}

function calculateRecommendationPrice({
  policy,
  baseTotalFee,
  weather,
  isPeakTime,
  isProfessionalPeak,
  nearbyGillerCount,
  requestMode,
}: {
  policy: PricingPolicy;
  baseTotalFee: number;
  weather: 'clear' | 'rain' | 'snow';
  isPeakTime: boolean;
  isProfessionalPeak: boolean;
  nearbyGillerCount: number;
  requestMode: 'immediate' | 'reservation';
}) {
  let multiplier = policy.recommendationMultiplier;

  if (weather === 'rain') {
    multiplier += policy.recommendationRules.rainMultiplier;
  } else if (weather === 'snow') {
    multiplier += policy.recommendationRules.snowMultiplier;
  }

  if (isPeakTime) {
    multiplier += policy.recommendationRules.peakTimeMultiplier;
  }

  if (isProfessionalPeak) {
    multiplier += policy.recommendationRules.professionalPeakMultiplier;
  }

  if (nearbyGillerCount <= policy.dynamicRules.lowSupplyThreshold) {
    multiplier += policy.recommendationRules.lowSupplyMultiplier;
  } else if (nearbyGillerCount >= policy.dynamicRules.highSupplyThreshold) {
    multiplier += policy.recommendationRules.highSupplyDiscountMultiplier;
  }

  if (requestMode === 'reservation') {
    multiplier += policy.recommendationRules.reservationDiscountMultiplier;
  }

  const boundedMultiplier = Math.max(0, Math.min(policy.recommendationRules.maxRecommendationMultiplier, multiplier));
  return Math.round((baseTotalFee * boundedMultiplier) / 100) * 100;
}

function buildScenarioSummary({
  previewResult,
  policy,
  requestMode,
  hasAddressPickup,
  hasAddressDropoff,
  recommendationPrice,
  requestedHour,
}: {
  previewResult: ReturnType<typeof calculateSharedDeliveryFee>;
  policy: PricingPolicy;
  requestMode: 'immediate' | 'reservation';
  hasAddressPickup: boolean;
  hasAddressDropoff: boolean;
  recommendationPrice: number;
  requestedHour: number;
}) {
  const baseAmount =
    previewResult.baseFee +
    previewResult.distanceFee +
    previewResult.weightFee +
    previewResult.sizeFee +
    previewResult.urgencySurcharge;

  return {
    addressPickupFee: hasAddressPickup ? policy.quoteAdjustments.addressPickupFee : 0,
    addressDropoffFee: hasAddressDropoff ? policy.quoteAdjustments.addressDropoffFee : 0,
    timeAdjustment: calculateTimeRuleAdjustment(baseAmount, requestedHour, policy),
    recommendationDelta: recommendationPrice - previewResult.totalFee,
    requestMode,
  };
}

function calculateTimeRuleAdjustment(
  baseAmount: number,
  requestedHour: number,
  policy: PricingPolicy
) {
  return policy.timeRules
    .filter((rule) => rule.enabled)
    .filter((rule) =>
      rule.startHour <= rule.endHour
        ? requestedHour >= rule.startHour && requestedHour <= rule.endHour
        : requestedHour >= rule.startHour || requestedHour <= rule.endHour
    )
    .reduce((sum, rule) => sum + Math.round(baseAmount * (rule.multiplier - 1)) + rule.fixedAdjustment, 0);
}
