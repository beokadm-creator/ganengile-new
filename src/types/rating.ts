/**
 * Rating Types
 * 사용자 평가 시스템 타입 정의
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 평가 태그
 */
export enum RatingTag {
  FRIENDLY = 'friendly',        // 친절함
  FAST = 'fast',                // 빠름
  TRUSTWORTHY = 'trustworthy',  // 신뢰
  COMMUNICATIVE = 'communicative', // 소통
  PUNCTUAL = 'punctual',        // 시간 엄수
}

/**
 * 태그 정보
 */
export interface RatingTagInfo {
  id: RatingTag;
  label: string;
  emoji: string;
}

/**
 * 평가 태그 목록
 */
export const RATING_TAGS: RatingTagInfo[] = [
  { id: RatingTag.FRIENDLY, label: '친절함', emoji: '😊' },
  { id: RatingTag.FAST, label: '빠름', emoji: '⚡' },
  { id: RatingTag.TRUSTWORTHY, label: '신뢰', emoji: '🤝' },
  { id: RatingTag.COMMUNICATIVE, label: '소통', emoji: '💬' },
  { id: RatingTag.PUNCTUAL, label: '시간 엄수', emoji: '⏰' },
];

/**
 * 평가
 */
export interface Rating {
  ratingId: string;
  matchId: string;
  fromUserId: string;
  toUserId: string;
  rating: number; // 1-5
  tags: RatingTag[]; // 선택한 태그 목록
  comment?: string; // 텍스트 리뷰
  isAnonymous: boolean; // 익명 여부
  createdAt: Timestamp;
}

/**
 * 평가 생성 데이터
 */
export interface CreateRatingData {
  matchId: string;
  fromUserId: string;
  toUserId: string;
  rating: number; // 1-5
  tags: RatingTag[]; // 선택한 태그 목록
  comment?: string; // 텍스트 리뷰 (선택)
  isAnonymous: boolean; // 익명 여부
}

/**
 * 사용자 평가 통계
 */
export interface UserRatingStats {
  userId: string;
  averageRating: number; // 평균 평점
  totalRatings: number; // 총 평가 수
  distribution: {
    [key: number]: number; // { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  };
  tagStats: {
    [key in RatingTag]: number; // 각 태그별 선택 횟수
  };
  recentRatings: number; // 최근 30일 평가 수
  updatedAt: Timestamp;
}

/**
 * 평가 통계 (간단 버전)
 */
export interface RatingSummary {
  averageRating: number;
  totalRatings: number;
  distribution: { [key: number]: number };
}

/**
 * 리뷰 아이템 (화면 표시용)
 */
export interface ReviewItem {
  ratingId: string;
  rating: number;
  tags: RatingTag[];
  comment?: string;
  fromUser: {
    userId: string;
    name: string;
    profileImage?: string;
  };
  isAnonymous: boolean;
  createdAt: Date;
  matchId?: string;
}
