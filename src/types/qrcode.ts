/**
 * QR Code Types
 * QR코드 생성/검증 관련 타입
 */

import { Timestamp } from 'firebase/firestore';

export enum QRCodeType {
  PICKUP = 'pickup',       // 인수용 QR코드
  DROPOFF = 'dropoff',    // 인계용 QR코드
  LOCKER_OPEN = 'locker_open',  // 사물함 개방용 QR코드
}

export enum QRCodeStatus {
  ACTIVE = 'active',
  USED = 'used',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

/**
 * QR코드 페이로드 (JWT)
 */
export interface QRCodePayload {
  type: QRCodeType;
  reservationId: string;
  userId: string;
  lockerId: string;
  expiresAt: number;     // Unix timestamp (ms)
  createdAt: number;     // Unix timestamp (ms)
  signature: string;     // JWT 서명
}

/**
 * QR코드 정보
 */
export interface QRCodeInfo {
  qrCodeId: string;
  type: QRCodeType;
  reservationId: string;
  userId: string;
  lockerId: string;
  code: string;          // QR코드 문자열
  expiresAt: Date;
  status: QRCodeStatus;
  usedAt?: Date;
  usedBy?: string;       // 사용한 사용자 ID
  createdAt: Date;
  updatedAt: Date;
}

/**
 * QR코드 검증 결과
 */
export interface QRCodeVerification {
  isValid: boolean;
  error?: string;
  qrCode?: QRCodeInfo;
  payload?: QRCodePayload;
}

/**
 * QR코드 생성 옵션
 */
export interface QRCodeGenerateOptions {
  type: QRCodeType;
  reservationId: string;
  userId: string;
  lockerId: string;
  expiresInMinutes: number;  // 만료 시간 (분)
}
