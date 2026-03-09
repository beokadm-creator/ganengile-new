/**
 * Pricing Service - Phase 1 (지하철 to 지하철)
 * 1단계 배송비 계산 로직
 *
 * 주요 변경사항:
 * - 기본료: 3,000원 → 3,500원
 * - 거리료: 800원 (고정) → 역 개수 기반 동적 계산
 * - 서비스 수수료: 0원 → 15%
 * - 길러 정산 로직 추가 (길러 85%, 플랫폼 15%)
 * - 최소 배송비: 3,000원
 * - 최대 배송비: 8,000원
 */

/**
 * 패키지 사이즈 타입 (호환성을 위해 string union 사용)
 * 'xl'과 'extra_large' 모두 지원
 */
export type PackageSizeType = 'small' | 'medium' | 'large' | 'xl' | 'extra_large';

/**
 * 배송비 계산 매개변수 (1단계)
 */
export interface Phase1PricingParams {
  /** 지하철 역 개수 (필수) */
  stationCount: number;
  /** 무게 (kg, 기본값: 1) */
  weight?: number;
  /** 패키지 사이즈 (기본값: small) */
  packageSize?: PackageSizeType;
  /** 긴급도 (기본값: normal) */
  urgency?: 'normal' | 'fast' | 'urgent';
}

/**
 * 배송비 상세 내역
 */
export interface DeliveryFeeBreakdown {
  /** 기본 배송비 */
  baseFee: number;
  /** 거리 수수료 */
  distanceFee: number;
  /** 무게 추가 요금 */
  weightFee: number;
  /** 사이즈 추가 요금 */
  sizeFee: number;
  /** 긴급 surcharge */
  urgencySurcharge: number;
  /** 서비스 수수료 (15%) */
  serviceFee: number;
  /** 부가세 제외 합계 */
  subtotal: number;
  /** 부가세 (VAT 10%) */
  vat: number;
  /** 총 배송비 */
  totalFee: number;
  /** 길러/플랫폼 비용 분배 */
  breakdown: {
    /** 길러 정산 (85%) */
    gillerFee: number;
    /** 플랫폼 수수료 (15%) */
    platformFee: number;
  };
  /** 설명 텍스트 */
  description: string;
}

/**
 * 상수 설정
 */
const PRICING_CONFIG = {
  BASE_FEE: 3500,          // 기본 배송비 (상향 조정)
  MIN_FEE: 3000,           // 최소 배송비 (VAT 포함)
  MAX_FEE: 8000,           // 최대 배송비 (VAT 포함)
  PLATFORM_FEE_RATE: 0.15, // 플랫폼 수수료율 15%
  VAT_RATE: 0.1,           // 부가세율 10%

  // 거리 수수료 (역 개수 기반)
  BASE_STATIONS: 5,        // 기본 역 개수
  BASE_DISTANCE_FEE: 600,  // 기본 거리 수수료
  FEE_PER_STATION: 120,    // 역당 추가 수수료

  // 무게별 추가 요금
  BASE_WEIGHT: 1,          // 기본 무게 (kg)
  FEE_PER_KG: 100,         // kg당 수수료

  // 사이즈별 추가 요금
  SIZE_FEES: {
    small: 0,           // 소형 (서류, 핸드폰)
    medium: 400,        // 중형 (책, 옷)
    large: 800,         // 대형 (가방, 전자기기)
    xl: 1500,           // 특대 (대형 가전) - CreateRequestScreen 호환
    extra_large: 1500,  // 특대 (대형 가전) - delivery.ts 호환
  } as const,

  // 긴급도 surcharge (기본료+거리료 기준)
  URGENCY_MULTIPLIERS: {
    normal: 0,    // 보통 (2-3시간)
    fast: 0.1,    // 빠름 (1-2시간)
    urgent: 0.2,  // 긴급 (30분-1시간)
  },
} as const;

/**
 * 1단계 배송비 계산 함수
 * @param params 배송 매개변수
 * @returns 계산된 배송비 상세 내역
 */
export function calculatePhase1DeliveryFee(params: Phase1PricingParams): DeliveryFeeBreakdown {
  const {
    stationCount = 5,
    weight = 1,
    packageSize = 'small',
    urgency = 'normal',
  } = params;

  // 1. 기본 배송비
  const baseFee = PRICING_CONFIG.BASE_FEE;

  // 2. 거리 수수료 (역 개수 기반)
  const distanceFee = calculateDistanceFee(stationCount);

  // 3. 무게별 추가 요금
  const weightFee = calculateWeightFee(weight);

  // 4. 사이즈별 추가 요금
  const sizeFee = calculateSizeFee(packageSize);

  // 5. 긴급도 surcharge (기본료 + 거리료 기준)
  const urgencySurcharge = calculateUrgencySurcharge(urgency, baseFee + distanceFee);

  // 6. 서비스 수수료 (15%)
  const feeBeforeService = baseFee + distanceFee + weightFee + sizeFee;
  const serviceFee = calculateServiceFee(feeBeforeService, PRICING_CONFIG.PLATFORM_FEE_RATE);

  // 7. 부가세 (VAT 10%)
  const subtotal = baseFee + distanceFee + weightFee + sizeFee + urgencySurcharge + serviceFee;
  const vat = Math.round(subtotal * PRICING_CONFIG.VAT_RATE);

  // 8. 최종 배송비
  let totalFee = subtotal + vat;

  // 최소/최대 제한
  if (totalFee < PRICING_CONFIG.MIN_FEE) {
    totalFee = PRICING_CONFIG.MIN_FEE;
  }
  if (totalFee > PRICING_CONFIG.MAX_FEE) {
    totalFee = PRICING_CONFIG.MAX_FEE;
  }

  // 9. 길러 비용 분배 (길러 85%, 플랫폼 15%)
  const breakdown = calculateBreakdown(totalFee);

  // 10. 설명 텍스트 생성
  const description = generateDescription(stationCount, packageSize, urgency);

  return {
    baseFee,
    distanceFee,
    weightFee,
    sizeFee,
    urgencySurcharge,
    serviceFee,
    subtotal,
    vat,
    totalFee,
    breakdown,
    description,
  };
}

/**
 * 거리 수수료 계산 (1단계: 지하철 역 개수 기반)
 * @param stationCount 지하철 역 개수
 * @returns 거리 수수료
 */
export function calculateDistanceFee(stationCount: number): number {
  const { BASE_STATIONS, BASE_DISTANCE_FEE, FEE_PER_STATION } = PRICING_CONFIG;

  if (stationCount <= BASE_STATIONS) {
    return BASE_DISTANCE_FEE;
  }

  return BASE_DISTANCE_FEE + (stationCount - BASE_STATIONS) * FEE_PER_STATION;
}

/**
 * 무게별 추가 요금 계산
 * @param weight 무게 (kg)
 * @returns 무게 수수료
 */
export function calculateWeightFee(weight: number): number {
  const { BASE_WEIGHT, FEE_PER_KG } = PRICING_CONFIG;

  if (weight <= BASE_WEIGHT) {
    return 100; // 최소 무게 수수료
  }

  return Math.round(weight * FEE_PER_KG);
}

/**
 * 사이즈별 추가 요금 계산
 * @param packageSize 패키지 사이즈
 * @returns 사이즈 수수료
 */
export function calculateSizeFee(packageSize: PackageSizeType): number {
  return PRICING_CONFIG.SIZE_FEES[packageSize] || 0;
}

/**
 * 긴급도 surcharge 계산
 * @param urgency 긴급도
 * @param baseAndDistanceFee 기본료 + 거리료
 * @returns 긴급 surcharge
 */
export function calculateUrgencySurcharge(
  urgency: 'normal' | 'fast' | 'urgent',
  baseAndDistanceFee: number
): number {
  const multiplier = PRICING_CONFIG.URGENCY_MULTIPLIERS[urgency] || 0;
  return Math.round(baseAndDistanceFee * multiplier);
}

/**
 * 서비스 수수료 계산
 * @param feeBeforeService 서비스 수수료 전 금액
 * @param rate 수수료율 (기본값: 0.15)
 * @returns 서비스 수수료
 */
export function calculateServiceFee(feeBeforeService: number, rate: number = 0.15): number {
  return Math.round(feeBeforeService * rate);
}

/**
 * 길러 비용 분배 계산 (1단계: 길러 1명)
 * @param totalFee 총 배송비
 * @returns 길러/플랫폼 비용 분배
 */
export function calculateBreakdown(totalFee: number): {
  gillerFee: number;
  platformFee: number;
} {
  const platformFee = Math.round(totalFee * PRICING_CONFIG.PLATFORM_FEE_RATE);
  const gillerFee = totalFee - platformFee;

  return {
    gillerFee,
    platformFee,
  };
}

/**
 * 배송비 설명 텍스트 생성
 * @param stationCount 역 개수
 * @param packageSize 패키지 사이즈
 * @param urgency 긴급도
 * @returns 설명 텍스트
 */
function generateDescription(
  stationCount: number,
  packageSize: PackageSizeType,
  urgency: string
): string {
  const urgencyText = {
    normal: '2-3시간',
    fast: '1-2시간',
    urgent: '30분-1시간',
  } as const;

  const sizeText: Record<PackageSizeType, string> = {
    small: '소형',
    medium: '중형',
    large: '대형',
    xl: '특대',
    extra_large: '특대',
  };

  return `1단계 배송 (역 ${stationCount}개구간, ${sizeText[packageSize]}, ${urgencyText[urgency as keyof typeof urgencyText] || '보통'})`;
}

/**
 * 예상 배송비 계산 (UI 표시용)
 * @param params 배송 매개변수
 * @returns 총 배송비
 */
export function estimateDeliveryFee(params: Phase1PricingParams): number {
  const result = calculatePhase1DeliveryFee(params);
  return result.totalFee;
}
