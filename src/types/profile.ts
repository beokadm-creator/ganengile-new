/**
 * Profile & Verification Types
 * ?꾨줈??諛??좎썝 ?몄쬆 愿??????뺤쓽
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 湲몃윭 ?깃툒 (諛곗넚 ?잛닔 湲곗?)
 */
export enum GillerGrade {
  NEWCOMER = 'newcomer',   // 0~10??
  REGULAR = 'regular',     // 11~30??
  EXPERT = 'expert',       // 31~50??
  MASTER = 'master',       // 51??
}

/**
 * ?꾨줈???뺣낫 (users/{uid}/profile)
 */
export interface UserProfile {
  userId: string;

  // 湲곕낯 ?뺣낫
  name: string;
  phoneNumber?: string;
  profilePhotoUrl?: string;
  defaultAddress?: {
    roadAddress: string;
    detailAddress: string;
    fullAddress: string;
  };

  // 怨꾩쥖 ?뺣낫
  bankAccount?: {
    bankName: string;      // ??됰챸 (?? KB援????? ?좏븳???
    accountNumber?: string; // 怨꾩쥖踰덊샇
    accountNumberMasked?: string;
    accountLast4?: string;
    accountHolder: string;  // ?덇툑二?
    bankCode?: string;
    verificationStatus?: string;
  };

  // 湲몃윭 ?뺣낫
  gillerInfo?: {
    totalDeliveries: number;  // 珥?諛곗넚 ?잛닔
    grade: GillerGrade;       // 湲몃윭 ?깃툒
  };

  // ?몄쬆 ?곹깭
  isVerified: boolean;

  // ??꾩뒪?ы봽
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
  lastUsedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * ?좎썝 ?몄쬆 ?뺣낫 (users/{uid}/verification)
 */
export interface UserVerification {
  userId: string;

  // ?몄쬆 ?곹깭
  status: 'pending' | 'under_review' | 'approved' | 'rejected';

  // ?좊텇利??뺣낫
  idCard?: {
    type: 'resident' | 'driver' | 'passport'; // 二쇰??깅줉利? ?댁쟾硫댄뿀利? ?ш텒
    frontImageUrl: string;    // ?욌㈃ ?ъ쭊 URL
    backImageUrl?: string;     // ?룸㈃ ?ъ쭊 URL (?댁쟾硫댄뿀利???
    uploadedAt: Timestamp;
  };

  // ?ㅻ챸 ?뺤씤
  name: string;          // ?좊텇利앹긽 ?대쫫
  birthDate: string;     // ?앸뀈?붿씪 (YYYYMMDD)
  personalId?: string;   // 二쇰??깅줉踰덊샇 ??7?먮━ (?뷀샇??

  // ?몃? 蹂몄씤?몄쬆 (PASS/Kakao CI)
  externalAuth?: {
    provider: 'pass' | 'kakao';
    status: 'started' | 'verified' | 'failed';
    requestedAt: Timestamp;
    verifiedAt?: Timestamp;
  };
  ciHash?: string;
  verificationMethod?: 'id_card' | 'ci';

  // ?ъ궗 ?뺣낫
  reviewedAt?: Timestamp;
  reviewedBy?: string;   // ?ъ궗??UID
  rejectionReason?: string;

  // ??꾩뒪?ы봽
  submittedAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * ?꾨줈???섏젙 ???곗씠??
 */
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

/**
 * ?좎썝 ?몄쬆 ?쒖텧 ?곗씠??
 */
export interface VerificationSubmitData {
  idCardType: 'resident' | 'driver' | 'passport';
  frontImageUrl: string;
  backImageUrl?: string;
  name: string;
  birthDate: string;
  personalId?: string;
}

export type VerificationProvider = 'pass' | 'kakao';

/**
 * ???紐⑸줉
 */
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

