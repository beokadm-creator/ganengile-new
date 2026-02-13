/**
 * Photo Types
 * 사진 인증 관련 타입
 */

import { Timestamp } from 'firebase/firestore';

export enum PhotoType {
  PICKUP = 'pickup',       // 인수 사진
  DROPOFF = 'dropoff',     // 인계 사진
  DAMAGED = 'damaged',     // 파손 신고 사진
  EVIDENCE = 'evidence',    // 분쟁 증거 사진
}

export enum PhotoStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  DISPUTED = 'disputed',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * 사진 정보
 */
export interface Photo {
  photoId: string;
  type: PhotoType;
  userId: string;
  requestId: string;
  deliveryId?: string;
  url: string;
  thumbnailUrl: string;
  location?: {
    lat: number;
    lng: number;
  };
  takenAt: Date;
  uploadedAt: Date;
  status: PhotoStatus;
  verifiedBy?: string;    // 검증자 (관리자 또는 시스템)
  verifiedAt?: Date;
  metadata?: {
    deviceInfo?: string;
    appVersion?: string;
    fileSize?: number;
    mimeType?: string;
  };
}

/**
 * 분쟁 정보
 */
export interface Dispute {
  disputeId: string;
  type: 'damage' | 'loss' | 'quality';
  reporterId: string;    // 신고자 ID
  reporterType: 'requester' | 'giller';
  requestId: string;
  deliveryId?: string;
  description: string;
  photoUrls: string[];   // 증거 사진들
  evidenceUrls: string[]; // 추가 증거
  status: 'pending' | 'investigating' | 'resolved' | 'rejected';
  resolution?: {
    responsibility: 'requester' | 'giller' | 'system';
    compensation: number;   // 보상금액 (원)
    note?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

/**
 * 사진 인증 결과
 */
export interface PhotoVerification {
  photoId: string;
  isValid: boolean;
  confidence: number;     // 0.0 ~ 1.0 (AI confidence score)
  issues?: string[];      // 발견된 문제들
  verifiedAt: Date;
}
