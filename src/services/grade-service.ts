/**
 * Giller Grade System
 * 길러 등급 시스템 - 배송 횟수 기반 등급 계산
 */

import { GillerGrade } from '../types/profile';

/**
 * 등급별 배송 횟수 범위
 */
const GRADE_THRESHOLDS = {
  NEWCOMER: { min: 0, max: 10 },
  REGULAR: { min: 11, max: 30 },
  EXPERT: { min: 31, max: 50 },
  MASTER: { min: 51, max: Infinity },
} as const;

/**
 * 등급별 혜택 정보
 */
const GRADE_BENEFITS = {
  [GillerGrade.NEWCOMER]: {
    name: 'Newcomer',
    nameKo: '신규',
    color: '#9E9E9E',
    icon: '🌱',
    description: '0~10회 배송',
    benefits: ['기본 매칭', '기본 수수료율'],
  },
  [GillerGrade.REGULAR]: {
    name: 'Regular',
    nameKo: '정규',
    color: '#4CAF50',
    icon: '🚴',
    description: '11~30회 배송',
    benefits: ['기본 매칭', '기본 수수료율'],
  },
  [GillerGrade.EXPERT]: {
    name: 'Expert',
    nameKo: '전문가',
    color: '#2196F3',
    icon: '⭐',
    description: '31~50회 배송',
    benefits: ['우선 매칭', '5% 수수료 할인'],
  },
  [GillerGrade.MASTER]: {
    name: 'Master',
    nameKo: '마스터',
    color: '#FF9800',
    icon: '👑',
    description: '51회+ 배송',
    benefits: ['최우선 매칭', '10% 수수료 할인', '전용 요청 가능'],
  },
} as const;

/**
 * 배송 횟수에 따른 등급 계산
 */
export function calculateGrade(totalDeliveries: number): GillerGrade {
  if (totalDeliveries <= GRADE_THRESHOLDS.NEWCOMER.max) {
    return GillerGrade.NEWCOMER;
  }
  if (totalDeliveries <= GRADE_THRESHOLDS.REGULAR.max) {
    return GillerGrade.REGULAR;
  }
  if (totalDeliveries <= GRADE_THRESHOLDS.EXPERT.max) {
    return GillerGrade.EXPERT;
  }
  return GillerGrade.MASTER;
}

/**
 * 등급 정보 조회
 */
export function getGradeInfo(grade: GillerGrade) {
  return GRADE_BENEFITS[grade];
}

/**
 * 다음 등급까지 남은 배송 횟수 계산
 */
export function getDeliveriesUntilNextGrade(totalDeliveries: number): number | null {
  const currentGrade = calculateGrade(totalDeliveries);

  if (currentGrade === GillerGrade.MASTER) {
    return null;
  }

  const gradeKey = gradeToThresholdKey(currentGrade);
  let nextThreshold: number;

  if (gradeKey === 'NEWCOMER') {
    nextThreshold = GRADE_THRESHOLDS.REGULAR.min;
  } else if (gradeKey === 'REGULAR') {
    nextThreshold = GRADE_THRESHOLDS.EXPERT.min;
  } else {
    nextThreshold = GRADE_THRESHOLDS.MASTER.min;
  }

  return nextThreshold - totalDeliveries;
}

/**
 * 등급 진행률 계산 (0~1)
 */
export function getGradeProgress(totalDeliveries: number): number {
  const currentGrade = calculateGrade(totalDeliveries);

  if (currentGrade === GillerGrade.MASTER) {
    return 1;
  }

  const gradeKey = gradeToThresholdKey(currentGrade);
  const currentMin = GRADE_THRESHOLDS[gradeKey].min;
  const currentMax = GRADE_THRESHOLDS[gradeKey].max;

  return (totalDeliveries - currentMin) / (currentMax - currentMin);
}

function gradeToThresholdKey(grade: GillerGrade): keyof typeof GRADE_THRESHOLDS {
  switch (grade) {
    case GillerGrade.NEWCOMER: return 'NEWCOMER';
    case GillerGrade.REGULAR: return 'REGULAR';
    case GillerGrade.EXPERT: return 'EXPERT';
    case GillerGrade.MASTER: return 'MASTER';
  }
}
