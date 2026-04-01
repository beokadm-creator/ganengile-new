import { Timestamp } from 'firebase/firestore';
import {
  Badge,
  BadgeCategory,
  BadgeRequirementType,
  BadgeTier,
} from '../types/user';

const createdAt = Timestamp.now();

export const INITIAL_BADGES: Badge[] = [
  {
    id: 'activity_first_delivery',
    category: BadgeCategory.ACTIVITY,
    name: '첫 전달',
    description: '첫 배송을 무사히 완료한 길러에게 주는 시작 배지입니다.',
    icon: '🚉',
    tier: BadgeTier.BRONZE,
    requirement: { type: BadgeRequirementType.COMPLETED_DELIVERIES, value: 1 },
    createdAt,
  },
  {
    id: 'activity_commuter_runner',
    category: BadgeCategory.ACTIVITY,
    name: '출퇴근 러너',
    description: '최근 30일 동안 10건 이상 배송을 완료한 길러에게 부여됩니다.',
    icon: '🏃',
    tier: BadgeTier.SILVER,
    requirement: { type: BadgeRequirementType.WEEKLY_DELIVERIES, value: 10 },
    createdAt,
  },
  {
    id: 'activity_route_keeper',
    category: BadgeCategory.ACTIVITY,
    name: '동선 지킴이',
    description: '연속 4주 동안 꾸준히 배송을 수행한 길러의 루틴을 보여줍니다.',
    icon: '🗓️',
    tier: BadgeTier.GOLD,
    requirement: { type: BadgeRequirementType.CONSECUTIVE_WEEKS, value: 4 },
    createdAt,
  },
  {
    id: 'quality_on_time',
    category: BadgeCategory.QUALITY,
    name: '정시 전달',
    description: '지연 없이 연속 15건을 완료한 신뢰형 길러 배지입니다.',
    icon: '⏱️',
    tier: BadgeTier.SILVER,
    requirement: {
      type: BadgeRequirementType.CONSECUTIVE_DELIVERIES_WITHOUT_DELAY,
      value: 15,
    },
    createdAt,
  },
  {
    id: 'quality_five_star',
    category: BadgeCategory.QUALITY,
    name: '만족도 에이스',
    description: '평점 4.9 이상을 유지하는 길러에게 부여되는 고평가 배지입니다.',
    icon: '⭐',
    tier: BadgeTier.GOLD,
    requirement: { type: BadgeRequirementType.MIN_RATING, value: 4.9 },
    createdAt,
  },
  {
    id: 'quality_zero_noshow',
    category: BadgeCategory.QUALITY,
    name: '노쇼 제로',
    description: '노쇼 없이 안정적으로 활동한 길러의 책임감을 보여줍니다.',
    icon: '🛡️',
    tier: BadgeTier.PLATINUM,
    requirement: { type: BadgeRequirementType.NO_SHOW_COUNT, value: 0 },
    createdAt,
  },
  {
    id: 'expert_transfer_pro',
    category: BadgeCategory.EXPERTISE,
    name: '환승 프로',
    description: '환승이 필요한 배송을 20건 이상 수행한 길러에게 주어집니다.',
    icon: '🔁',
    tier: BadgeTier.GOLD,
    requirement: { type: BadgeRequirementType.TRANSFER_DELIVERIES, value: 20 },
    createdAt,
  },
  {
    id: 'expert_line_collector',
    category: BadgeCategory.EXPERTISE,
    name: '노선 컬렉터',
    description: '다양한 노선을 다루는 숙련된 길러의 범위를 보여줍니다.',
    icon: '🧭',
    tier: BadgeTier.SILVER,
    requirement: { type: BadgeRequirementType.UNIQUE_LINES_USED, value: 6 },
    createdAt,
  },
  {
    id: 'community_helpful_partner',
    category: BadgeCategory.COMMUNITY,
    name: '든든한 파트너',
    description: '채팅과 인계 과정에서 좋은 후기를 꾸준히 받은 길러에게 부여됩니다.',
    icon: '🤝',
    tier: BadgeTier.BRONZE,
    requirement: { type: 'positiveReviews', value: 10 },
    createdAt,
  },
  {
    id: 'community_local_hero',
    category: BadgeCategory.COMMUNITY,
    name: '우리 동네 히어로',
    description: '같은 생활권에서 반복 신뢰를 쌓은 길러의 지역 기여를 보여줍니다.',
    icon: '🏡',
    tier: BadgeTier.GOLD,
    requirement: { type: 'repeatAreaDeliveries', value: 30 },
    createdAt,
  },
];

export function findBadgeById(id: string): Badge | undefined {
  return INITIAL_BADGES.find((badge) => badge.id === id);
}

export function getBadgesByCategory(category: BadgeCategory): Badge[] {
  return INITIAL_BADGES.filter((badge) => badge.category === category);
}

export function getBadgesByTier(tier: BadgeTier): Badge[] {
  return INITIAL_BADGES.filter((badge) => badge.tier === tier);
}

export function getBadgeCategoryLabel(category: BadgeCategory): string {
  switch (category) {
    case BadgeCategory.ACTIVITY:
      return '활동';
    case BadgeCategory.QUALITY:
      return '품질';
    case BadgeCategory.EXPERTISE:
      return '전문성';
    case BadgeCategory.COMMUNITY:
      return '커뮤니티';
    default:
      return category;
  }
}

export function getBadgeTierLabel(tier: BadgeTier): string {
  switch (tier) {
    case BadgeTier.BRONZE:
      return '브론즈';
    case BadgeTier.SILVER:
      return '실버';
    case BadgeTier.GOLD:
      return '골드';
    case BadgeTier.PLATINUM:
      return '플래티넘';
    default:
      return tier;
  }
}
