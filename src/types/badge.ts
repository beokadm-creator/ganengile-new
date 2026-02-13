/**
 * Badge Types
 * 배지 시스템 관련 타입
 */

export enum BadgeCategory {
  ACTIVITY = 'activity',       // 활동
  QUALITY = 'quality',         // 품질
  EXPERTISE = 'expertise',     // 전문성
  COMMUNITY = 'community',      // 커뮤니티
}

export enum BadgeRank {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
}

export interface Badge {
  badgeId: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  rank: BadgeRank;
  earnedAt?: Date;
  progress?: {
    current: number;
    target: number;
  };
}

export interface UserBadge {
  userId: string;
  badgeId: string;
  earnedAt: Date;
}

/**
 * 활동 배지 정의
 */
export const ACTIVITY_BADGES: Omit<Badge, 'earnedAt' | 'progress'>[] = [
  {
    badgeId: 'first_delivery',
    name: '첫걸음',
    description: '첫 배송 완료',
    icon: '🎯',
    category: BadgeCategory.ACTIVITY,
    rank: BadgeRank.BRONZE,
  },
  {
    badgeId: 'weekly_10',
    name: '활동가',
    description: '일주일간 10건 배송',
    icon: '⚡',
    category: BadgeCategory.ACTIVITY,
    rank: BadgeRank.SILVER,
  },
  {
    badgeId: 'monthly_50',
    name: '열정가',
    description: '한 달간 50건 배송',
    icon: '🔥',
    category: BadgeCategory.ACTIVITY,
    rank: BadgeRank.SILVER,
  },
];

/**
 * 품질 배지 정의
 */
export const QUALITY_BADGES: Omit<Badge, 'earnedAt' | 'progress'>[] = [
  {
    badgeId: 'perfect_week',
    name: '완벽주의자',
    description: '30건 연속 지연 0회',
    icon: '💎',
    category: BadgeCategory.QUALITY,
    rank: BadgeRank.GOLD,
  },
  {
    badgeId: 'rating_4_8',
    name: '최고 평점',
    description: '평점 4.8 이상 유지',
    icon: '⭐',
    category: BadgeCategory.QUALITY,
    rank: BadgeRank.PLATINUM,
  },
];

/**
 * 전문성 배지 정의
 */
export const EXPERTISE_BADGES: Omit<Badge, 'earnedAt' | 'progress'>[] = [
  {
    badgeId: 'route_master',
    name: '경로 마스터',
    description: '10개 동선 등록',
    icon: '🗺️',
    category: BadgeCategory.EXPERTISE,
    rank: BadgeRank.GOLD,
  },
  {
    badgeId: 'reliable',
    name: '신뢰할 수 있는 길러',
    description: '노쇼 0회, 100건 완료',
    icon: '🛡️',
    category: BadgeCategory.QUALITY,
    rank: BadgeRank.PLATINUM,
  },
  {
    badgeId: 'master_giller',
    name: '마스터 길러',
    description: '500건, 평점 4.8, 배지 10개',
    icon: '👑',
    category: BadgeCategory.EXPERTISE,
    rank: BadgeRank.PLATINUM,
  },
];

/**
 * 커뮤니티 배지 정의
 */
export const COMMUNITY_BADGES: Omit<Badge, 'earnedAt' | 'progress'>[] = [
  {
    badgeId: 'mentor',
    name: '멘토',
    description: '신규 길러 5명 멘토링',
    icon: '🤝',
    category: BadgeCategory.COMMUNITY,
    rank: BadgeRank.GOLD,
  },
  {
    badgeId: 'helper',
    name: '돕는 손',
    description: '커뮤니티 질문 10개 답변',
    icon: '🙌',
    category: BadgeCategory.COMMUNITY,
    rank: BadgeRank.SILVER,
  },
];

/**
 * 전체 배지 목록
 */
export const ALL_BADGES = [
  ...ACTIVITY_BADGES,
  ...QUALITY_BADGES,
  ...EXPERTISE_BADGES,
  ...COMMUNITY_BADGES,
];
