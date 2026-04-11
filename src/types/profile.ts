/**
 * Profile & Verification Types
 * 프로필 및 신원 인증 관련 타입 정의
 */

import { Timestamp } from 'firebase/firestore';

/** 길러 등급 (배송 횟수 기준) */
export enum GillerGrade {
  NEWCOMER = 'newcomer',   // 0~10회
  REGULAR = 'regular',     // 11~30회
  EXPERT = 'expert',       // 31~50회
  MASTER = 'master',       // 51회 이상
}

/** 프로필 정보 (`users/{uid}/profile`) */
export interface UserProfile {
  userId: string;

  // 기본 정보
  name: string;
  phoneNumber?: string;
  profilePhotoUrl?: string;
  defaultAddress?: {
    roadAddress: string;
    detailAddress: string;
    fullAddress: string;
  };

  // 계좌 정보
  bankAccount?: {
    bankName: string;      // 은행명
    accountNumber?: string; // 계좌번호
    accountNumberMasked?: string;
    accountLast4?: string;
    accountHolder: string;  // 예금주
    bankCode?: string;
    verificationStatus?: string;
  };

  // 길러 정보
  gillerInfo?: {
    totalDeliveries: number;  // 총 배송 횟수
    grade: GillerGrade;       // 길러 등급
  };

  // 인증 상태
  isVerified: boolean;

  // 타임스탬프
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SavedAddress {
  addressId: string;
  label: string;
  roadAddress: string;
  detailAddress: string;
  fullAddress: string;
  isDefault?: boolean;
  isFavorite?: boolean;
  lastUsedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** 신원 인증 정보 (`users/{uid}/verification`) */
export interface UserVerification {
  userId: string;

  // 인증 상태
  status: 'pending' | 'under_review' | 'approved' | 'rejected';

  // 신분증 정보
  idCard?: {
    type: 'resident' | 'driver' | 'passport'; // 주민등록증, 운전면허증, 여권
    frontImageUrl: string;    // 앞면 사진 URL
    backImageUrl?: string;     // 뒷면 사진 URL
    uploadedAt: Timestamp;
  };

  // 실명 확인
  name: string;          // 신분증상 이름
  birthDate: string;     // 생년월일 (YYYYMMDD)
  personalId?: string;   // 주민등록번호 뒤 7자리

  // 외부 본인인증 (PASS/Kakao CI)
  externalAuth?: {
    provider: 'pass' | 'kakao';
    status: 'started' | 'verified' | 'failed';
    requestedAt: Timestamp;
    verifiedAt?: Timestamp;
  };
  ciHash?: string;
  verificationMethod?: 'id_card' | 'ci';

  // 심사 정보
  reviewedAt?: Timestamp;
  reviewedBy?: string;   // 심사자 UID
  rejectionReason?: string;

  // 타임스탬프
  submittedAt: Timestamp;
  updatedAt: Timestamp;
}

/** 프로필 수정용 데이터 */
export interface ProfileFormData {
  name: string;
  phoneNumber?: string;
  profilePhotoUrl?: string;
  defaultAddress?: {
    roadAddress: string;
    detailAddress: string;
    fullAddress: string;
  };
  bankAccount?: {
    bankName: string;
    accountNumber?: string;
    accountNumberMasked?: string;
    accountLast4?: string;
    accountHolder: string;
    bankCode?: string;
    verificationStatus?: string;
  };
}

/** 신원 인증 제출 데이터 */
export interface VerificationSubmitData {
  idCardType: 'resident' | 'driver' | 'passport';
  frontImageUrl: string;
  backImageUrl?: string;
  name: string;
  birthDate: string;
  personalId?: string;
}

export type VerificationProvider = 'pass' | 'kakao';

/** 은행 목록 */
export const BANK_LIST = [
  { code: 'kb', name: 'KB국민은행' },
  { code: 'shinhan', name: '신한은행' },
  { code: 'woori', name: '우리은행' },
  { code: 'hana', name: '하나은행' },
  { code: 'nh', name: 'NH농협은행' },
  { code: 'citibank', name: '씨티은행' },
  { code: 'keb', name: 'KEB하나은행' },
  { code: 'sc', name: 'SC제일은행' },
  { code: 'ibk', name: 'IBK기업은행' },
  { code: 'kdb', name: 'KDB산업은행' },
  { code: 'dgb', name: '대구은행' },
  { code: 'bnk', name: '부산은행' },
  { code: 'kj', name: '광주은행' },
  { code: 'jb', name: '전북은행' },
  { code: 'sh', name: '수협은행' },
  { code: 'post', name: '우체국' },
  { code: 'kakao', name: '카카오뱅크' },
  { code: 'toss', name: '토스뱅크' },
] as const;

export type BankCode = typeof BANK_LIST[number]['code'];
