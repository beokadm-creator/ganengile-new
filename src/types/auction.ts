/**
 * Auction Types
 * 경매 시스템 관련 타입 정의
 *
 * 핵심 컨셉: REVERSE_AUCTION (역경매)
 * - 기본요금으로 시작
 * - 더 빨리 보내고 싶으면 요금을 올려 입찰
 * - 길러가 가장 높은 입찰을 선택하여 배송
 */

import { Timestamp } from 'firebase/firestore';
import { StationInfo } from './request';

/**
 * 경매 타입
 */
export enum AuctionType {
  /** 역경매 (급한 배송, 가격 상향) */
  REVERSE_AUCTION = 'reverse_auction',
}

/**
 * 경매 상태
 */
export enum AuctionStatus {
  /** 대기 중 (아직 시작되지 않음) */
  PENDING = 'pending',
  /** 진행 중 (입찰 가능) */
  ACTIVE = 'active',
  /** 마감됨 (낙찰자 선정 완료) */
  CLOSED = 'closed',
  /** 취소됨 */
  CANCELLED = 'cancelled',
  /** 만료됨 (입찰 없이 시간 만료) */
  EXPIRED = 'expired',
}

/**
 * 입찰 상태
 */
export enum BidStatus {
  /** 대기 중 */
  PENDING = 'pending',
  /** 낙찰됨 */
  WON = 'won',
  /** 탈락됨 */
  LOST = 'lost',
  /** 취소됨 */
  CANCELLED = 'cancelled',
}

/**
 * 경매 설정
 */
export interface AuctionConfig {
  /** 경매 진행 시간 (분) */
  durationMinutes: number;
  /** 최소 입찰가 증가 단위 (원) */
  minBidIncrement: number;
  /** 자동 연장 여부 (마지막 5분 내 입찰 시 연장) */
  autoExtend: boolean;
  /** 자동 연장 시간 (분) */
  autoExtendMinutes: number;
}

/**
 * 입찰 정보
 */
export interface Bid {
  /** 입찰 ID */
  bidId: string;

  /** 경매 ID */
  auctionId: string;

  /** 입찰자 (이용자) ID */
  bidderId: string;
  /** @deprecated Use bidderId */
  gllerId?: string;

  /** 입찰자 이름 */
  bidderName: string;
  /** @deprecated Use bidderName */
  gllerName?: string;

  /** 입찰 금액 (원) */
  bidAmount: number;

  /** 입찰 메시지 (선택) */
  message?: string;

  /** 입찰 상태 */
  status: BidStatus;

  /** 입찰 시간 */
  createdAt: Timestamp;

  /** 업데이트 시간 */
  updatedAt: Timestamp;
}

/**
 * 경매 정보
 */
export interface Auction {
  /** 경매 ID */
  auctionId: string;

  /** 경매 타입 */
  auctionType: AuctionType;

  /** 연관된 요청 ID (선택) */
  requestId?: string;

  // ===== 요청자 정보 =====
  /** 요청자 (이용자) ID */
  requesterId: string;
  /** @deprecated Use requesterId */
  gllerId?: string;

  /** 요청자 이름 */
  requesterName: string;
  /** @deprecated Use requesterName */
  gllerName?: string;

  // ===== 경로 정보 =====
  /** 픽업 역 */
  pickupStation: StationInfo;

  /** 배송 역 */
  deliveryStation: StationInfo;

  // ===== 패키지 정보 =====
  /** 패키지 크기 */
  packageSize: 'small' | 'medium' | 'large' | 'xl';

  /** 패키지 무게 (kg) */
  packageWeight: number;

  /** 패키지 설명 */
  packageDescription: string;

  // ===== 요금 정보 =====
  /** 기본 요금 (시작가) */
  baseFee: number;

  /** 거리 요금 */
  distanceFee: number;

  /** 무게 요금 */
  weightFee: number;

  /** 크기 요금 */
  sizeFee: number;

  /** 서비스 수수료 */
  serviceFee: number;

  /** 부가세 */
  vat: number;

  /** 현재 최고 입찰가 */
  currentHighestBid: number;

  /** 현재 최고 입찰자 ID */
  currentHighestBidderId?: string;

  /** 현재 최고 입찰자 이름 */
  currentHighestBidderName?: string;

  /** 최종 낙찰가 (마감 후) */
  winningBidAmount?: number;

  /** 낙찰자 (길러) ID */
  winnerId?: string;

  /** 낙찰자 이름 */
  winnerName?: string;

  // ===== 시간 정보 =====
  /** 경매 시작 시간 */
  startedAt: Timestamp;

  /** 경매 마감 시간 */
  endsAt: Timestamp;

  /** 실제 마감 시간 (연장된 경우) */
  actualEndsAt?: Timestamp;

  /** 희망 픽업 시간 (HH:mm) */
  preferredPickupTime?: string;

  /** 희망 배송 시간 (HH:mm) */
  preferredDeliveryTime?: string;

  /** 배송 마감 기한 */
  deliveryDeadline?: Timestamp;

  // ===== 상태 =====
  /** 경매 상태 */
  status: AuctionStatus;

  /** 총 입찰 수 */
  totalBids: number;

  // ===== 설정 =====
  /** 경매 설정 */
  config: AuctionConfig;

  // ===== 특이사항 =====
  /** 특별 요청 사항 */
  specialInstructions?: string;

  /** 깨지기 쉬움 여부 */
  isFragile?: boolean;

  /** 부패하기 쉬움 여부 */
  isPerishable?: boolean;

  // ===== 수신자 정보 =====
  /** 수신자 이름 */
  recipientName?: string;

  /** 수신자 전화번호 */
  recipientPhone?: string;

  // ===== 메타데이터 =====
  /** 생성 시간 */
  createdAt: Timestamp;

  /** 업데이트 시간 */
  updatedAt: Timestamp;
}

/**
 * 경매 생성 데이터
 */
export interface CreateAuctionData {
  /** 요청자 ID */
  requesterId: string;
  /** @deprecated Use requesterId */
  gllerId?: string;

  /** 요청자 이름 */
  requesterName: string;
  /** @deprecated Use requesterName */
  gllerName?: string;

  /** 연관된 요청 ID (선택) */
  requestId?: string;

  /** 픽업 역 */
  pickupStation: StationInfo;

  /** 배송 역 */
  deliveryStation: StationInfo;

  /** 패키지 크기 */
  packageSize: 'small' | 'medium' | 'large' | 'xl';

  /** 패키지 무게 (kg) */
  packageWeight: number;

  /** 패키지 설명 */
  packageDescription: string;

  /** 기본 요금 (시작가) */
  baseFee: number;

  /** 거리 요금 */
  distanceFee?: number;

  /** 무게 요금 */
  weightFee?: number;

  /** 크기 요금 */
  sizeFee?: number;

  /** 서비스 수수료 */
  serviceFee?: number;

  /** 경매 진행 시간 (분, 기본값: 30) */
  durationMinutes?: number;

  /** 희망 픽업 시간 */
  preferredPickupTime?: string;

  /** 희망 배송 시간 */
  preferredDeliveryTime?: string;

  /** 배송 마감 기한 */
  deliveryDeadline?: Date;

  /** 특별 요청 사항 */
  specialInstructions?: string;

  /** 깨지기 쉬움 여부 */
  isFragile?: boolean;

  /** 부패하기 쉬움 여부 */
  isPerishable?: boolean;

  /** 수신자 이름 */
  recipientName?: string;

  /** 수신자 전화번호 */
  recipientPhone?: string;

  /** 경매 설정 */
  config?: Partial<AuctionConfig>;
}

/**
 * 입찰 생성 데이터
 */
export interface CreateBidData {
  /** 경매 ID */
  auctionId: string;

  /** 입찰자 ID */
  bidderId: string;
  /** @deprecated Use bidderId */
  gllerId?: string;

  /** 입찰자 이름 */
  bidderName: string;
  /** @deprecated Use bidderName */
  gllerName?: string;

  /** 입찰 금액 */
  bidAmount: number;

  /** 입찰 메시지 */
  message?: string;
}

/**
 * 경매 필터 옵션
 */
export interface AuctionFilterOptions {
  /** 상태 필터 */
  status?: AuctionStatus | AuctionStatus[];

  /** 요청자 ID 필터 */
  requesterId?: string;
  /** @deprecated Use requesterId */
  gllerId?: string;

  /** 픽업 역 ID 필터 */
  pickupStationId?: string;

  /** 배송 역 ID 필터 */
  deliveryStationId?: string;

  /** 최소 입찰가 필터 */
  minBid?: number;

  /** 최대 입찰가 필터 */
  maxBid?: number;

  /** 날짜 범위 필터 */
  dateRange?: {
    start: Date;
    end: Date;
  };

  /** 정렬 */
  sortBy?: 'createdAt' | 'currentHighestBid' | 'endsAt';

  /** 정렬 순서 */
  sortOrder?: 'asc' | 'desc';

  /** 결과 제한 */
  limit?: number;
}

/**
 * 경매 통계
 */
export interface AuctionStatistics {
  /** 총 경매 수 */
  totalAuctions: number;

  /** 진행 중인 경매 수 */
  activeAuctions: number;

  /** 완료된 경매 수 */
  completedAuctions: number;

  /** 총 입찰 수 */
  totalBids: number;

  /** 평균 낙찰가 */
  averageWinningBid: number;

  /** 평균 입찰 수 */
  averageBidsPerAuction: number;

  /** 총 거래액 */
  totalTransactionAmount: number;
}

/**
 * 경매 목록 아이템 (UI 표시용)
 */
export interface AuctionListItem {
  /** 경매 ID */
  auctionId: string;

  /** 픽업 역 이름 */
  pickupStationName: string;

  /** 배송 역 이름 */
  deliveryStationName: string;

  /** 현재 최고 입찰가 */
  currentHighestBid: number;

  /** 기본 요금 */
  baseFee: number;

  /** 남은 시간 (초) */
  remainingSeconds: number;

  /** 총 입찰 수 */
  totalBids: number;

  /** 상태 */
  status: AuctionStatus;

  /** 패키지 크기 */
  packageSize: string;

  /** 내가 입찰했는지 여부 */
  hasMyBid?: boolean;

  /** 내 입찰 순위 */
  myBidRank?: number;

  /** 요청자 이름 */
  requesterName: string;
  /** @deprecated Use requesterName */
  gllerName?: string;

  /** 생성 시간 */
  createdAt: Timestamp;

  /** 마감 시간 */
  endsAt: Timestamp;
}

/**
 * Firestore 컬렉션 이름 상수
 */
export const AUCTION_COLLECTIONS = {
  AUCTIONS: 'auctions',
  BIDS: 'bids',
} as const;
