/**
 * 배지 초기 데이터 (P1)
 * 13개 배지 정의
 */

import { Badge, BadgeCategory, BadgeTier } from '../types/user';

/**
 * 초기 배지 데이터
 */
export const INITIAL_BADGES: Omit<Badge, 'createdAt'>[] = [
  // ===== 활동 배지 (3개) =====
  {
    id: 'badge_newbie',
    category: BadgeCategory.ACTIVITY,
    name: '첫걸음',
    description: '첫 배송 완료',
    icon: '🎯',
    tier: BadgeTier.BRONZE,
    requirement: { type: 'completedDeliveries', value: 1 }
  },
  {
    id: 'badge_active',
    category: BadgeCategory.ACTIVITY,
    name: '활동가',
    description: '일주일간 10건 배송',
    icon: '⚡',
    tier: BadgeTier.SILVER,
    requirement: { type: 'weeklyDeliveries', value: 10 }
  },
  {
    id: 'badge_consistent',
    category: BadgeCategory.ACTIVITY,
    name: '꾸준함',
    description: '4주 연속 주 5건 이상 배송',
    icon: '📅',
    tier: BadgeTier.GOLD,
    requirement: { type: 'consecutiveWeeks', value: 4, minWeekly: 5 }
  },

  // ===== 품질 배지 (3개) =====
  {
    id: 'badge_perfectionist',
    category: BadgeCategory.QUALITY,
    name: '완벽주의자',
    description: '지연 0회, 30건 연속',
    icon: '💎',
    tier: BadgeTier.GOLD,
    requirement: { type: 'consecutiveDeliveriesWithoutDelay', value: 30 }
  },
  {
    id: 'badge_friendly',
    category: BadgeCategory.QUALITY,
    name: '친절한 길러',
    description: '이용자 평점 4.9 이상, 20건 이상',
    icon: '😊',
    tier: BadgeTier.SILVER,
    requirement: { type: 'minRating', value: 4.9, minDeliveries: 20 }
  },
  {
    id: 'badge_trusted',
    category: BadgeCategory.QUALITY,
    name: '신뢰할 수 있는 길러',
    description: '노쇼 0회, 100건 완료',
    icon: '🛡️',
    tier: BadgeTier.PLATINUM,
    requirement: { type: 'noShowCount', value: 0, completedDeliveries: 100 }
  },

  // ===== 전문성 배지 (3개) =====
  {
    id: 'badge_subway_master',
    category: BadgeCategory.EXPERTISE,
    name: '지하철 마스터',
    description: '5개 노선 이용 경험',
    icon: '🚇',
    tier: BadgeTier.SILVER,
    requirement: { type: 'uniqueLinesUsed', value: 5 }
  },
  {
    id: 'badge_transfer_expert',
    category: BadgeCategory.EXPERTISE,
    name: '환승 전문가',
    description: '환승 배송 50건 완료',
    icon: '🔄',
    tier: BadgeTier.GOLD,
    requirement: { type: 'transferDeliveries', value: 50 }
  },
  {
    id: 'badge_time_manager',
    category: BadgeCategory.EXPERTISE,
    name: '시간 관리사',
    description: '지연 0.1회 미만/건, 50건 이상',
    icon: '⏰',
    tier: BadgeTier.PLATINUM,
    requirement: { type: 'delayRate', value: 0.001, minDeliveries: 50 }
  },

  // ===== 커뮤니티 배지 (4개) =====
  {
    id: 'badge_mentor',
    category: BadgeCategory.COMMUNITY,
    name: '멘토',
    description: '신규 길러 5명 온보딩 도움',
    icon: '🤝',
    tier: BadgeTier.GOLD,
    requirement: { type: 'mentorCount', value: 5 }
  },
  {
    id: 'badge_contributor',
    category: BadgeCategory.COMMUNITY,
    name: '기여자',
    description: '커뮤니티 게시글 50개 작성',
    icon: '📝',
    tier: BadgeTier.SILVER,
    requirement: { type: 'communityPosts', value: 50 }
  },
  {
    id: 'badge_top_rated',
    category: BadgeCategory.COMMUNITY,
    name: '최고 평점',
    description: '월간 평점 1위 달성',
    icon: '🏆',
    tier: BadgeTier.PLATINUM,
    requirement: { type: 'monthlyTopRating', value: 1 }
  },
  {
    id: 'badge_early_adopter',
    category: BadgeCategory.COMMUNITY,
    name: '얼리어답터',
    description: '서비스 출시 후 1주 내 가입',
    icon: '🌟',
    tier: BadgeTier.BRONZE,
    requirement: { type: 'earlySignup', value: 7 }
  },
];

/**
 * 배지 ID로 배지 찾기
 */
export function findBadgeById(id: string): Omit<Badge, 'createdAt'> | undefined {
  return INITIAL_BADGES.find(badge => badge.id === id);
}

/**
 * 카테고리별 배지 필터링
 */
export function getBadgesByCategory(category: BadgeCategory): Omit<Badge, 'createdAt'>[] {
  return INITIAL_BADGES.filter(badge => badge.category === category);
}

/**
 * 등급별 배지 필터링
 */
export function getBadgesByTier(tier: BadgeTier): Omit<Badge, 'createdAt'>[] {
  return INITIAL_BADGES.filter(badge => badge.tier === tier);
}
